import {
  environment,
  mrtOutputs,
  sRGBToLinear,
  triplanarNormal,
  viewDepth,
} from "shaders/common.js";

const shader = `precision highp float;
precision highp sampler2D;

uniform sampler2D normalMap;
uniform float normalScale;
uniform float texScale;

uniform vec3 color;
uniform float useSSS;
uniform float useScreen;

uniform float roughness;
uniform float metalness;
uniform float tint;
uniform float specular;
uniform int termView;

uniform float transmission;
uniform sampler2D backdrop;
uniform vec2 resolution;
uniform float thickness;
uniform float refraction;
uniform float dispersion;
uniform float blurStrength;
uniform float scatter;
uniform sampler2D blueNoise;
uniform int blueNoiseSize;
uniform vec3 absorption;
uniform float density;
uniform float fresnel;
uniform float gloss;
uniform float backdropMix;
uniform vec3 sky;
uniform vec3 ground;

uniform vec3 cameraPosition;
uniform mat4 modelMatrix;
uniform mat3 normalMatrix;
uniform float cameraNear;
uniform float cameraFar;

in vec3 vNormal;
in vec3 vObjectNormal;
in vec3 vPosition;
in vec3 vViewPosition;
in vec3 vWorldPosition;
${mrtOutputs}
${sRGBToLinear}
${viewDepth}
${triplanarNormal}
${environment}
// mod rather than %: % keeps the sign of the dividend, which would index
// outside the texture and read back zero.
vec2 blueNoiseAt(vec2 p) {
  return texelFetch(blueNoise, ivec2(mod(p, float(blueNoiseSize))), 0).rg;
}

vec2 clampUv(vec2 uv) {
  return clamp(uv, vec2(0.001), vec2(0.999));
}

// Screen is a display space operation: 1 - (1 - c)^2 only behaves for c in 0
// to 1. Handed an HDR value it inverts, the brightest channel goes negative
// and clamps, and red vanishes out of warm highlights leaving cyan.
//
// Kept last and called twice, for the pixel and the pixel-without-diffuse, so
// both go through identical arithmetic -- see fragDiffuse below.
vec3 stylise(vec3 value, vec3 glow) {
  vec3 styled = value + glow;

  vec3 inRange = min(styled, vec3(1.0));
  vec3 excess = styled - inRange;
  vec3 screened =
    vec3(1.0) - (vec3(1.0) - inRange) * (vec3(1.0) - inRange) + excess;

  return mix(styled, screened, useScreen);
}

void main() {
  vec3 objectNormal =
    triplanarNormal(normalMap, vPosition, vObjectNormal, texScale, normalScale);

  vec3 N = normalize(normalMatrix * objectNormal);
  vec3 V = normalize(-vViewPosition);

  vec3 worldNormal = normalize(mat3(modelMatrix) * objectNormal);
  vec3 worldRay = reflect(normalize(vWorldPosition - cameraPosition), worldNormal);

  // --- lighting ---
  //
  // Deliberately not tonemapped here. Rolling the environment off at the sample
  // throws away what a shiny surface is made of: a studio softbox sits 1676x
  // above a mid wall, and c / (c + 1) brings that to 1.50. The grade compresses
  // once, at the end, which makes the tone curve load bearing, not optional.
  vec3 irradiance = textureCubeUV(envMap, worldNormal, 1.0).rgb * envIntensity;
  vec3 radiance = textureCubeUV(envMap, worldRay, roughness).rgb * envIntensity;

  vec3 backdropReflection = sRGBToLinear(mix(ground, sky, worldRay.y * 0.5 + 0.5));
  radiance = mix(radiance, backdropReflection, backdropMix);

  // --- the surface --- linear from here down.
  vec3 albedo = mix(vec3(1.0), sRGBToLinear(color), tint);
  float NdotV = clamp(abs(dot(N, V)), 0.0, 1.0);

  vec3 F0 = mix(vec3(0.04 + 0.96 * gloss), albedo, metalness);
  vec3 F = mix(F0, vec3(1.0), clamp(fresnel * pow(1.0 - NdotV, 5.0), 0.0, 1.0));

  vec3 diffuse = irradiance * albedo * (1.0 - metalness);

  // --- what is under the reflection -----------------------------------------
  vec3 transmitted = vec3(0.0);

  if (transmission > 0.0) {
    float path = thickness * mix(0.15, 1.0, pow(1.0 - NdotV, 1.5));

    vec2 uv = gl_FragCoord.xy / resolution;
    vec2 bend = N.xy * refraction * path;

    ivec2 backdropSize = textureSize(backdrop, 0);
    float maxLod = floor(log2(float(max(backdropSize.x, backdropSize.y)))) - 2.0;

    float lod = clamp(path * blurStrength + roughness * 5.0, 0.0, maxLod);

    // A coarse mip interpolated by the hardware shows its texel grid as facets,
    // so the tap is offset within a disc that size: grain instead of structure.
    float texel = exp2(lod) / float(max(backdropSize.x, backdropSize.y));
    vec2 noise = blueNoiseAt(gl_FragCoord.xy);
    float angle = noise.x * 6.2831853;
    float radius = sqrt(noise.y);
    vec2 jitter = vec2(cos(angle), sin(angle)) * radius * texel * scatter;

    transmitted = vec3(
      textureLod(backdrop, clampUv(uv + jitter + bend * (1.0 - dispersion)), lod).r,
      textureLod(backdrop, clampUv(uv + jitter + bend), lod).g,
      textureLod(backdrop, clampUv(uv + jitter + bend * (1.0 + dispersion)), lod).b
    );

    // Transmittance is absorption raised to the path length. As a coefficient it
    // drowns every channel at once, because a dark tint is close to no tint.
    vec3 absorbed = max(sRGBToLinear(absorption), vec3(0.002));
    transmitted *= exp(log(absorbed) * density * path);
  }

  vec3 body = mix(diffuse, transmitted, transmission);
  vec3 lit = body * (vec3(1.0) - F) + radiance * F * specular;

  // --- stylise ---
  float rim = 1.75 * abs(dot(normalize(vNormal), V));

  // The swatch, not the albedo: the albedo is white wherever Colour strength is
  // 0, which is most presets.
  vec3 glow = useSSS * sRGBToLinear(color) * max(1.0 - 0.75 * rim, 0.0);

  vec3 styled = stylise(lit, glow);

  // The image minus the same image without the diffuse. The occlusion pass
  // subtracts this and adds back a darkened copy, which only holds if it is a
  // difference of two *finished* pixels -- the raw diffuse term is wrong
  // wherever the screen blend is on, because that curve is not linear. Anything
  // added to the pixel after the diffuse is computed must go inside stylise().
  vec3 diffuseLit = diffuse * (1.0 - transmission) * (vec3(1.0) - F);
  vec3 withoutDiffuse = stylise(lit - diffuseLit, glow);

  vec3 result = styled;

  if (termView > 0) {
    result =
      termView == 1 ? irradiance :
      termView == 2 ? radiance :
      termView == 3 ? albedo :
      termView == 4 ? F :
      termView == 5 ? diffuse :
      termView == 6 ? transmitted :
      termView == 7 ? body :
      termView == 8 ? radiance * F * specular :
      termView == 9 ? lit :
      styled;
  }

  fragColor = vec4(result, 1.0);

  // The geometric normal, not the bump-perturbed one: per-fragment bump tilt
  // only decorrelates the occlusion test.
  fragPosition = vec4(vViewPosition, viewDepth(length(vViewPosition), cameraNear, cameraFar));
  // Solidity: light through glass arrives from the backdrop and never travelled
  // the shadow ray.
  float solidity = 1.0 - transmission;

  fragNormal = vec4(normalize(vNormal), solidity);

  fragDiffuse = vec4(styled - withoutDiffuse, 1.0);
}
`;

export { shader };
