const shader = `precision highp float;

uniform sampler2D inputTexture;
uniform float fxaa;

in vec2 vUv;

out vec4 fragColor;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);
const float SPAN_MAX = 8.0;
const float REDUCE_MUL = 0.125;
const float REDUCE_MIN = 0.0078125;
const float EDGE_THRESHOLD = 0.166;
const float EDGE_THRESHOLD_MIN = 0.0833;

void main() {
  vec3 middle = texture(inputTexture, vUv).rgb;

  if (fxaa <= 0.0) {
    fragColor = vec4(middle, 1.0);
    return;
  }

  vec2 texel = 1.0 / vec2(textureSize(inputTexture, 0));
  vec3 nw = texture(inputTexture, vUv + vec2(-1.0, -1.0) * texel).rgb;
  vec3 ne = texture(inputTexture, vUv + vec2(1.0, -1.0) * texel).rgb;
  vec3 sw = texture(inputTexture, vUv + vec2(-1.0, 1.0) * texel).rgb;
  vec3 se = texture(inputTexture, vUv + vec2(1.0, 1.0) * texel).rgb;

  float lNW = dot(nw, LUMA);
  float lNE = dot(ne, LUMA);
  float lSW = dot(sw, LUMA);
  float lSE = dot(se, LUMA);
  float lM = dot(middle, LUMA);

  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(EDGE_THRESHOLD_MIN, lMax * EDGE_THRESHOLD)) {
    fragColor = vec4(middle, 1.0);
    return;
  }

  vec2 dir = vec2(
    -((lNW + lNE) - (lSW + lSE)),
    (lNW + lSW) - (lNE + lSE)
  );
  float reduce = max((lNW + lNE + lSW + lSE) * 0.25 * REDUCE_MUL, REDUCE_MIN);
  float scale = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
  dir = clamp(dir * scale, -SPAN_MAX, SPAN_MAX) * texel;

  vec3 inner = 0.5 * (
    texture(inputTexture, vUv + dir * (1.0 / 3.0 - 0.5)).rgb +
    texture(inputTexture, vUv + dir * (2.0 / 3.0 - 0.5)).rgb
  );
  vec3 outer = inner * 0.5 + 0.25 * (
    texture(inputTexture, vUv + dir * -0.5).rgb +
    texture(inputTexture, vUv + dir * 0.5).rgb
  );

  float lOuter = dot(outer, LUMA);
  vec3 aa = (lOuter < lMin || lOuter > lMax) ? inner : outer;
  fragColor = vec4(mix(middle, aa, fxaa), 1.0);
}`;

export { shader };
