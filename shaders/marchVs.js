import { pyramidTraversal } from "modules/HistoPyramid.js";
import { VERTICES_PER_INSTANCE } from "modules/MarchGeometry.js";

const sampleStored = `
uniform sampler3D fieldTexture;

float sampleField(vec3 voxel) {
  return textureLod(fieldTexture, (voxel + 0.5) / gridSize, 0.0).r;
}
`;

const shader = `precision highp float;
precision highp sampler2D;
precision highp int;
precision highp sampler3D;
precision highp isampler2D;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

uniform isampler2D triTableTexture;
uniform float gridSize;
uniform float isolation;

${sampleStored}
${pyramidTraversal}

out vec3 vNormal;
out vec3 vObjectNormal;
out vec3 vPosition;
out vec3 vViewPosition;
out vec3 vWorldPosition;

const ivec2 edgeCorners[12] = ivec2[](
  ivec2(0, 1), ivec2(1, 2), ivec2(2, 3), ivec2(3, 0),
  ivec2(4, 5), ivec2(5, 6), ivec2(6, 7), ivec2(7, 4),
  ivec2(0, 4), ivec2(1, 5), ivec2(2, 6), ivec2(3, 7)
);

vec3 cornerOffset(int i) {
  if (i == 0) return vec3(0.0, 0.0, 0.0);
  if (i == 1) return vec3(1.0, 0.0, 0.0);
  if (i == 2) return vec3(1.0, 1.0, 0.0);
  if (i == 3) return vec3(0.0, 1.0, 0.0);
  if (i == 4) return vec3(0.0, 0.0, 1.0);
  if (i == 5) return vec3(1.0, 0.0, 1.0);
  if (i == 6) return vec3(1.0, 1.0, 1.0);
  return vec3(0.0, 1.0, 1.0);
}

// The field rises towards the inside, so the normal points down it. The CPU
// takes the same difference in the same direction.
vec3 fieldNormal(vec3 voxel) {
  vec3 d = vec3(1.0, 0.0, 0.0);
  float nx = sampleField(voxel - d.xyy) - sampleField(voxel + d.xyy);
  float ny = sampleField(voxel - d.yxy) - sampleField(voxel + d.yxy);
  float nz = sampleField(voxel - d.yyx) - sampleField(voxel + d.yyx);
  return normalize(vec3(nx, ny, nz));
}

void discardVertex() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}

void main() {
  ivec3 voxel;
  int cubeIndex;
  int slot;

  if (!locate(gl_InstanceID * ${VERTICES_PER_INSTANCE} + gl_VertexID, voxel, cubeIndex, slot)) {
    discardVertex();
    return;
  }

  vec3 base = vec3(voxel);
  int edge = texelFetch(triTableTexture, ivec2(slot, cubeIndex), 0).r;

  int a = edgeCorners[edge].x;
  int b = edgeCorners[edge].y;

  float va = sampleField(base + cornerOffset(a));
  float vb = sampleField(base + cornerOffset(b));

  // The guard is for an edge whose ends read the same value, which the divide
  // would turn into a vertex at infinity.
  float denominator = vb - va;
  float t = abs(denominator) < 1e-9 ? 0.5 : clamp((isolation - va) / denominator, 0.0, 1.0);

  vec3 voxelPos = mix(base + cornerOffset(a), base + cornerOffset(b), t);

  // -1..1 in object space, the same extent the CPU geometry has.
  vec3 objectPosition = voxelPos / gridSize * 2.0 - 1.0;
  vec3 objectNormal = fieldNormal(voxelPos);

  vec4 viewPosition = modelViewMatrix * vec4(objectPosition, 1.0);

  vPosition = objectPosition;
  vObjectNormal = objectNormal;
  vNormal = normalMatrix * objectNormal;
  vViewPosition = viewPosition.xyz;
  vWorldPosition = (modelMatrix * vec4(objectPosition, 1.0)).xyz;

  gl_Position = projectionMatrix * viewPosition;
}
`;

export { shader };
