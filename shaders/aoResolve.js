const shader = `precision highp float;
precision highp sampler2D;

uniform sampler2D normalMap;
uniform sampler2D aoMap;
uniform float strength;
uniform float depthSharpness;

// From the environment's first spherical harmonic band: its brightest
// direction, and how lopsided it is. A flat white sky should cast no hard
// shadow, and directionality is what knows that.
uniform vec3 lightDir;
uniform float directionality;

// 25 taps, not 49: the noise removed falls off as the square root of the
// count, so this keeps ~70% of the cut for half the cost.
#define RESOLVE_RADIUS 2

in vec2 vUv;

out vec4 fragColor;

// strength is an exponent, not a multiplier. clamp(v * strength) plateaus at
// 1 / strength, so at the 7.5 to 9.9 the presets use everything past a tenth of
// occlusion is equally black and the shading reads as an edge, not a gradient.
float amplify(float v, float s) {
  return 1.0 - pow(max(1.0 - v, 0.0), max(s, 1e-3));
}

// Averaging the neighbourhood is what makes the occlusion pass's 16 taps
// usable, and is the whole reason its kernel is rotated per pixel rather than
// per screen. Weighted by depth so it stops at a silhouette instead of dragging
// a background zero into the surface in front of it.
void main() {
  vec3 centre = texture(aoMap, vUv).rgb;

  // Background carries zero depth; zero factors leave the composite's mix on
  // the unshaded end.
  if (centre.y <= 0.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 texel = 1.0 / vec2(textureSize(aoMap, 0));

  float sum = 0.0;
  float weight = 0.0;

  float shadowSum = 0.0;

  for (int y = -RESOLVE_RADIUS; y <= RESOLVE_RADIUS; y++) {
    for (int x = -RESOLVE_RADIUS; x <= RESOLVE_RADIUS; x++) {
      vec3 probe = texture(aoMap, vUv + vec2(float(x), float(y)) * texel).rgb;

      float w = exp(-abs(probe.y - centre.y) * depthSharpness);
      w *= step(1e-6, probe.y);

      sum += probe.x * w;
      shadowSum += probe.z * w;
      weight += w;
    }
  }

  float occlusion = weight > 0.0 ? sum / weight : centre.x;
  float shadow = weight > 0.0 ? shadowSum / weight : centre.z;

  vec4 normalSample = texture(normalMap, vUv);
  vec3 N = normalize(normalSample.xyz);

  // Shadow is caught in proportion to solidity: light through glass came from
  // the backdrop and never travelled the shadow ray.
  float solidity = normalSample.w;

  float ndl = max(dot(N, lightDir), 0.0);

  float diffuseShadow = amplify(shadow * ndl * directionality, strength);

  // No N dot L: a reflection does not follow the normal. Do not trace this
  // along the reflection direction either -- it answers a better question but
  // turns with the camera, and a shadow that moves with the viewer stops
  // reading as a shadow.
  float specularShadow = amplify(shadow * directionality * solidity, strength);

  fragColor = vec4(amplify(occlusion, strength), diffuseShadow, specularShadow, 1.0);
}
`;

export { shader };
