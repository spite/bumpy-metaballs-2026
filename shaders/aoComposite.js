// Occlusion and shadow applied at full resolution, from passes that run at
// half. What crosses the boundary is three scalars and never a shaded colour:
// an interpolated colour bleeds one surface's shading across the silhouette
// onto another.
const shader = `precision highp float;
precision highp sampler2D;

uniform sampler2D colorMap;
uniform sampler2D diffuseMap;
uniform sampler2D aoFactors;
uniform vec3 aoColor;

in vec2 vUv;

out vec4 fragColor;

void main() {
  vec3 color = texture(colorMap, vUv).rgb;

  vec3 factors = texture(aoFactors, vUv).rgb;

  float occlusion = factors.x;
  float shadow = factors.y;
  float blocked = factors.z;

  // Union, never a product: two mixes towards the same colour multiplied
  // together reach aoColor squared, darker than any tint that was chosen.
  float lost = clamp(occlusion + shadow - occlusion * shadow, 0.0, 1.0);

  vec3 diffuseTint = mix(vec3(1.0), aoColor, lost);

  // Everything that is not diffuse loses only the directional share: a crease
  // nearby does not block a reflection, but a blocked light cannot reflect.
  vec3 restTint = mix(vec3(1.0), aoColor, blocked);

  vec3 diffuse = texture(diffuseMap, vUv).rgb;

  fragColor = vec4((color - diffuse) * restTint + diffuse * diffuseTint, 1.0);
}
`;

export { shader };
