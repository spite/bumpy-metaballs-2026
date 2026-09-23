const shader = `precision highp float;

uniform sampler2D inputTexture;

in vec2 vUv;

out vec4 fragColor;

void main() {
  fragColor = texture(inputTexture, vUv);
}
`;

export { shader };
