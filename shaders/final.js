import { chromaticAberration } from "shaders/aberration.js";

const shader = `precision highp float;
precision highp sampler2D;

uniform sampler2D sceneMap;
uniform sampler2D bloom0;
uniform sampler2D bloom1;
uniform sampler2D bloom2;
uniform sampler2D bloom3;
uniform sampler2D bloom4;
uniform float bloomStrength;
uniform float bloomRadius;
uniform float vignette;
uniform float grain;
uniform float dither;
uniform float grainFrame;
uniform float toneMapping;
uniform float toneMappingExposure;
uniform float aberration;
uniform vec2 resolution;

in vec2 vUv;

out vec4 fragColor;

vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

vec3 ACESFilmicToneMapping(vec3 color) {
  const mat3 ACESInputMat = mat3(
    0.59719, 0.07600, 0.02840,
    0.35458, 0.90834, 0.13383,
    0.04823, 0.01566, 0.83777
  );
  const mat3 ACESOutputMat = mat3(
    1.60475, -0.10208, -0.00327,
    -0.53108, 1.10813, -0.07276,
    -0.07367, -0.00605, 1.07602
  );
  color *= toneMappingExposure / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, vec3(0.0), vec3(1.0));
}

vec3 linearToSRGB(vec3 rgb) {
  // Floored for the same reason the surface shaders floor theirs: pow() of a
  // negative is NaN, and the shading can legitimately go below zero.
  vec3 value = max(rgb, vec3(0.0));
  return mix(
    pow(value, vec3(0.41666)) * 1.055 - vec3(0.055),
    value * 12.92,
    vec3(lessThanEqual(value, vec3(0.0031308)))
  );
}

float interleavedGradient(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}


// Grain must not come from the blue noise texture: it is a 64 pixel tile, and
// offsetting it a pixel a frame translates the field rigidly, so it reads as
// a fixed pattern sliding diagonally. Measured on a flat backdrop it
// correlated +0.32 with itself 64 pixels away. A hash of pixel and frame has
// no tile and no direction to travel in.
uint grainHash(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v.x;
}

float grainAt(vec2 p, float frame) {
  uint bits = grainHash(uvec3(uvec2(p), uint(frame)));
  return float(bits & 0xFFFFFFu) / float(0xFFFFFFu);
}

${chromaticAberration}
float bloomFactor(float factor) {
  return mix(factor, 1.2 - factor, bloomRadius);
}

void main() {
  vec3 color = aberration > 0.0 ? aberrate(sceneMap, vUv) : texture(sceneMap, vUv).rgb;

  if (bloomStrength > 0.0) {
    vec3 b = bloomFactor(1.0) * texture(bloom0, vUv).rgb;
    b += bloomFactor(0.8) * texture(bloom1, vUv).rgb;
    b += bloomFactor(0.6) * texture(bloom2, vUv).rgb;
    b += bloomFactor(0.4) * texture(bloom3, vUv).rgb;
    b += bloomFactor(0.2) * texture(bloom4, vUv).rgb;
    color += (b / 3.0) * bloomStrength;
  }

  // the vignette the original demo drew into its background sphere, except it
  // now covers the whole frame and is resolution independent
  if (vignette > 0.0) {
    float edge = length(vUv - 0.5) * 2.0;
    color *= mix(1.0, smoothstep(1.5, 0.35, edge), vignette);
  }

  vec3 graded = toneMapping > 0.0
    ? ACESFilmicToneMapping(color)
    : clamp(color * toneMappingExposure, vec3(0.0), vec3(1.0));

  graded = linearToSRGB(graded);

  // film grain, then a dither to keep the gradient off the 8 bit banding
  graded += grain * (grainAt(gl_FragCoord.xy, grainFrame) - 0.5);
  graded += (interleavedGradient(gl_FragCoord.xy) - 0.5) * dither / 255.0;

  fragColor = vec4(graded, 1.0);
}
`;

export { shader };
