const shader = `precision highp float;
precision highp sampler2D;

uniform sampler2D inputTexture;
uniform int mode;
uniform float debugScale;


in vec2 vUv;

out vec4 fragColor;

// Each buffer holds its own range, so there is a mode per kind.
void main() {
  vec4 t = texture(inputTexture, vUv);
  vec3 c;

  if (mode == 1) {
    c = normalize(t.xyz) * 0.5 + 0.5;
  } else if (mode == 2) {
    // View space position is dominated by the constant offset down the camera's
    // z, so scaling it gives a flat wash. Banding each axis keeps the variation.
    c = fract(t.xyz * 2.0 * debugScale);
  } else if (mode == 3) {
    c = vec3(fract(t.w * 900.0 * debugScale));
  } else if (mode == 4) {
    c = vec3(1.0 - clamp(t.r * 8.0 * debugScale, 0.0, 1.0));
  } else if (mode == 6) {
    // The shadow ray's answer before the resolve blurs it.
    c = vec3(t.b);
  } else if (mode == 5) {
    c = vec3(fract(t.g * 900.0 * debugScale));
  } else {
    c = t.rgb;
  }

  fragColor = vec4(c, 1.0);
}
`;

export { shader };
