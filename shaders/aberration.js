const ABERRATION_SAMPLES = 12;

const shader = `precision highp float;

uniform sampler2D inputTexture;
uniform float aberration;
uniform vec2 resolution;

in vec2 vUv;

out vec4 fragColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 brownConradyDistortion(vec2 uv, float px) {
  uv = uv * 2.0 - 1.0;
  float r2 = dot(uv, uv);
  float k = px * 2.0 / resolution.y;
  uv *= 1.0 + k * r2 - 0.25 * k * r2 * r2;
  return uv * 0.5 + 0.5;
}

vec3 spectrumOffset(float t) {
  float t0 = 3.0 * t - 1.5;
  return clamp(vec3(-t0, 1.0 - abs(t0), t0), 0.0, 1.0);
}

void main() {
  float stepsiz = ${(1 / (ABERRATION_SAMPLES - 1)).toFixed(8)};
  float t = hash12(gl_FragCoord.xy) * stepsiz;

  vec3 sumcol = vec3(0.0);
  vec3 sumw = vec3(0.0);

  for (int i = 0; i < ${ABERRATION_SAMPLES}; i++) {
    vec3 w = spectrumOffset(t);
    sumw += w;
    float px = mix(-aberration, aberration, t);
    vec2 duv = clamp(brownConradyDistortion(vUv, px), 0.0, 1.0);
    sumcol += w * texture(inputTexture, duv).rgb;
    t += stepsiz;
  }

  fragColor = vec4(sumcol / sumw, 1.0);
}`;

export { shader };
