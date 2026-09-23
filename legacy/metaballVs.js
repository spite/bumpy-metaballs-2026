const shader = `precision highp float;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

in vec3 position;
in vec3 normal;

out vec3 vNormal;
out vec3 vObjectNormal;
out vec3 vPosition;
out vec3 vViewPosition;
out vec3 vWorldPosition;

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);

  // object space position and normal drive the triplanar mapping, view space
  // normal and position drive the matcap lookup and the rim term
  vPosition = position;
  vObjectNormal = normal;
  vNormal = normalMatrix * normal;
  vViewPosition = viewPosition.xyz;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

  gl_Position = projectionMatrix * viewPosition;
}
`;

export { shader };
