import { field } from "shaders/field.js";

const fieldStored = `
uniform sampler3D fieldTexture;
uniform float fieldTexel;
// The mesh's scale, so a ray in world space still lands in the field.
uniform float fieldScale;

float fieldValue(vec3 p) {
  // Half a texel in: the value for voxel v was written at v / size, but a 3D
  // texture holds it at the texel centre, (v + 0.5) / size.
  return textureLod(fieldTexture, p + 0.5 * fieldTexel, 0.0).r;
}
`;

const shader = `precision highp float;
precision highp sampler2D;
precision highp sampler3D;

uniform sampler2D positionMap;
uniform sampler2D normalMap;
uniform float bias;
uniform float radius;
uniform vec2 attenuation;
uniform sampler2D blueNoise;
uniform int blueNoiseSize;

uniform vec3 lightDir;
uniform float shadowDistance;
uniform float shadowBias;
uniform float shadowSoftness;

uniform mat4 viewToWorldMatrix;
uniform float isolation;

${fieldStored}

in vec2 vUv;

out vec4 fragColor;

// The kernel rotation's noise is not meant to be looked at: aoResolve
// averages it away. Applied straight to the image it is visible stipple.
float sampleBuffer(vec3 position, vec3 normal, vec2 uv) {
  vec4 probe = texture(positionMap, uv);
  if (probe.w <= 0.0) return 0.0;

  vec3 dir = probe.xyz - position;
  float dist = length(dir);

  // A tap can land on the fragment's own texel, making dir zero and normalize
  // 0/0. A driver that lets the NaN through feeds it to the blur chain, where
  // it spreads a little further at every mip level.
  if (dist < 1e-6) return 0.0;

  float intensity = max(dot(dir / dist, normal) - bias, 0.0);
  float factor = 1.0 / (attenuation.x + attenuation.y * dist);

  return intensity * factor;
}

// Traced through the field, not the position buffer: a buffer march only
// finds occluders that are themselves on screen, which on separated convex
// blobs found one on 0.00% of the surface under a side light.
#define SHADOW_STEPS 24

float traceRay(vec3 worldPos, vec3 worldNormal, vec3 direction) {
  // A ramp, not a step, or the terminator draws a hard line across every blob.
  // Both exits below carry it: the solid hit is the path most shadowed pixels
  // take, so scaling only the falloff does nothing.
  float facing = smoothstep(0.0, 0.7, dot(worldNormal, direction));
  if (facing <= 0.0) return 0.0;

  float stepLength = shadowDistance / float(SHADOW_STEPS);

  vec3 p = (worldPos + worldNormal * shadowBias) / fieldScale * 0.5 + 0.5 + 0.5 * fieldTexel;
  vec3 step = direction * stepLength * 0.5 / fieldScale;

  // Closest approach over distance travelled, from one fixed ray. A sampled
  // cone was tried instead and left blotches, and crawled whenever its jitter
  // was keyed to anything that moves.
  float visibility = 1.0;
  float travelled = shadowBias;

  for (int i = 0; i < SHADOW_STEPS; i++) {
    p += step;
    travelled += stepLength;

    // Outside the cube the field is undefined, and the clamped edge texel would
    // smear the boundary along the rest of the ray.
    if (any(lessThan(p, vec3(0.0))) || any(greaterThan(p, vec3(1.0)))) break;

    float f = fieldValue(p);

    if (f > isolation) return facing;

    // The field is a sum of falloffs, not a distance. (isolation - f) alone sits
    // near 1 across the whole cube and plunges at the blobs, so it has no dynamic
    // range; dividing by the gradient makes it a Newton step towards the
    // isosurface, which is a length. Empty space falls out for free.
    if (f > isolation * 0.05) {
      vec2 d = vec2(fieldTexel, 0.0);
      vec3 gradient = vec3(
        fieldValue(p + d.xyy) - fieldValue(p - d.xyy),
        fieldValue(p + d.yxy) - fieldValue(p - d.yxy),
        fieldValue(p + d.yyx) - fieldValue(p - d.yyx)
      ) / (2.0 * fieldTexel);

      // Field space is the unit cube, the world is that cube at -1..1.
      float distance = 2.0 * fieldScale * (isolation - f) / max(length(gradient), 1e-4);

      visibility = min(visibility, shadowSoftness * distance / travelled);
    }
  }

  return facing * (1.0 - clamp(visibility, 0.0, 1.0));
}

float blueNoiseAt(vec2 p) {
  // mod rather than %: the offset can push p negative, and % keeps the sign of
  // the dividend, which would index outside the texture and read back zero
  return texelFetch(blueNoise, ivec2(mod(p, float(blueNoiseSize))), 0).r;
}

void main() {
  vec4 posDepth = texture(positionMap, vUv);

  // The zero depth going out here tells the resolve not to average across the
  // silhouette.
  if (posDepth.w <= 0.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 inc = 1.0 / vec2(textureSize(positionMap, 0));
  vec3 position = posDepth.xyz;
  vec3 normal = normalize(texture(normalMap, vUv).xyz);

  float aoAngle = blueNoiseAt(gl_FragCoord.xy + vec2(23.0, 29.0)) * 6.2831853;
  vec2 randVec = vec2(cos(aoAngle), sin(aoAngle));

  float kRadius = radius * (1.0 - abs(posDepth.w));

  vec2 k[4];
  k[0] = vec2(0.0, 1.0);
  k[1] = vec2(1.0, 0.0);
  k[2] = vec2(0.0, -1.0);
  k[3] = vec2(-1.0, 0.0);

  const float v = 3.1415926535897932384626433832795 / 4.0;
  float occlusion = 0.0;

  for (int i = 0; i < 4; ++i) {
    vec2 k1 = reflect(k[i], randVec);
    vec2 k2 = vec2(k1.x * v - k1.y * v, k1.x * v + k1.y * v);
    k1 *= inc;
    k2 *= inc;

    occlusion += sampleBuffer(position, normal, vUv + k1 * kRadius);
    occlusion += sampleBuffer(position, normal, vUv + k2 * kRadius * 0.75);
    occlusion += sampleBuffer(position, normal, vUv + k1 * kRadius * 0.5);
    occlusion += sampleBuffer(position, normal, vUv + k2 * kRadius * 0.25);
  }

  occlusion = clamp(occlusion / 16.0, 0.0, 1.0);

  // No dither on the shadow ray: the falloff is already a gradient from one
  // fixed ray, so an offset only adds something that resamples when the camera
  // moves.
  vec3 worldPos = (viewToWorldMatrix * vec4(position, 1.0)).xyz;
  vec3 worldNormal = normalize(mat3(viewToWorldMatrix) * normal);

  float shadow = traceRay(worldPos, worldNormal, lightDir);



  fragColor = vec4(occlusion, posDepth.w, shadow, 1.0);
}
`;

export { shader };
