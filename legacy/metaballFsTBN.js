// The 2013 formulation, kept for comparison: it reconstructs a full tangent
// space basis per fragment out of the interpolated normal. Swap it in by
// pointing main.js at this file instead of metaballFs.js.
//
// It is not quite right, and the demo's own README says why. The projections
// and the blend weights are object space, but these tangents are built from the
// view space normal, so the frame does not line up with the texture axes it is
// meant to describe and it turns with the camera rather than with the surface.
// Measured against a correctly oriented basis the relief lands a median of 13
// degrees out, along the curves where a tangent falls parallel to the normal
// the cross product collapses and the detail smears, and because the tangent is
// never orthogonalised the shear projects part of the perturbation back onto
// the normal, flattening the relief to roughly a third of its intended tilt.

const shader = `precision highp float;

uniform sampler2D textureMap;
uniform sampler2D normalMap;
uniform vec3 color;
uniform float normalScale;
uniform float texScale;
uniform float useSSS;
uniform float useScreen;
uniform float cameraNear;
uniform float cameraFar;

in vec3 vNormal;
in vec3 vObjectNormal;
in vec3 vPosition;
in vec3 vViewPosition;

layout(location = 0) out vec4 fragColor;
layout(location = 1) out vec4 fragPosition;
layout(location = 2) out vec4 fragNormal;

// The shading below is reproduced in the space it was authored in: the original
// demo sampled the matcap raw and wrote its result straight to an 8 bit
// framebuffer, so the tint, the rim term and the screen blend are all balanced
// against sRGB values. Converting once at the end keeps that balance while
// still handing the post chain the linear light it expects.
vec3 sRGBToLinear(vec3 value) {
  return mix(
    pow((value + 0.055) / 1.055, vec3(2.4)),
    value / 12.92,
    vec3(lessThanEqual(value, vec3(0.04045)))
  );
}

float viewDepth(float dist) {
  return clamp((dist - cameraNear) / (cameraFar - cameraNear), 1e-3, 1.0);
}

void main() {
  // Blend weights for the three projections, sharpened so that each plane only
  // contributes where the surface actually faces its axis.
  vec3 n = normalize(vObjectNormal);
  vec3 blendWeights = abs(n);
  blendWeights = max((blendWeights - 0.2) * 7.0, 0.0);
  blendWeights /= blendWeights.x + blendWeights.y + blendWeights.z;

  vec2 coord1 = vPosition.yz * texScale;
  vec2 coord2 = vPosition.zx * texScale;
  vec2 coord3 = vPosition.xy * texScale;

  vec3 bump1 = texture(normalMap, coord1).rgb;
  vec3 bump2 = texture(normalMap, coord2).rgb;
  vec3 bump3 = texture(normalMap, coord3).rgb;

  vec3 blendedBump = bump1 * blendWeights.xxx +
                     bump2 * blendWeights.yyy +
                     bump3 * blendWeights.zzz;

  // The isosurface has no UVs, so there are no tangents to interpolate from the
  // vertices. Following the GPU Gems 3 triplanar article, the tangent space
  // basis is rebuilt here per fragment out of the interpolated normal.
  vec3 tanX = vec3( vNormal.x, -vNormal.z,  vNormal.y);
  vec3 tanY = vec3( vNormal.z,  vNormal.y, -vNormal.x);
  vec3 tanZ = vec3(-vNormal.y,  vNormal.x,  vNormal.z);

  vec3 blendedTangent = tanX * blendWeights.xxx +
                        tanY * blendWeights.yyy +
                        tanZ * blendWeights.zzz;

  vec3 normalTex = blendedBump * 2.0 - 1.0;
  normalTex.xy *= normalScale;
  normalTex.y *= -1.0;
  normalTex = normalize(normalTex);

  mat3 tsb = mat3(
    normalize(blendedTangent),
    normalize(cross(vNormal, blendedTangent)),
    normalize(vNormal)
  );
  vec3 finalNormal = tsb * normalTex;

  // MatCap, same spherical environment mapping as the original demo
  vec3 r = reflect(normalize(vViewPosition), normalize(finalNormal));
  float m = 2.0 * length(vec3(r.xy, r.z + 1.0));
  vec3 base = texture(textureMap, r.xy / m + 0.5).rgb;

  float rim = 1.75 * abs(dot(normalize(vNormal), normalize(-vViewPosition)));
  base += useSSS * color * (1.0 - 0.75 * rim);
  base += (1.0 - useSSS) * 10.0 * base * color * clamp(1.0 - rim, 0.0, 0.15);

  // screen blend of the shading against itself, for the glossy preset
  base = mix(base, vec3(1.0) - (vec3(1.0) - base) * (vec3(1.0) - base), useScreen);

  fragColor = vec4(sRGBToLinear(base), 1.0);

  // G-buffer for the AO pass. The geometric normal goes out rather than the
  // bump-perturbed one: the occlusion test compares neighbouring surface points
  // against this normal, and per-fragment bump tilt would just decorrelate it.
  fragPosition = vec4(vViewPosition, viewDepth(length(vViewPosition)));
  fragNormal = vec4(normalize(vNormal), 1.0);
}
`;

export { shader };
