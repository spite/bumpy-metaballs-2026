// Marching cubes in the vertex shader: one instance per voxel of fifteen
// vertices, each working out from gl_InstanceID and gl_VertexID which voxel
// and corner it is. Instanced rather than one run of size^3 * 15, because a
// run that long needs a position attribute of the same length to be drawn at
// all: 22MB of zeroes at a grid of 50.
import { field } from "shaders/field.js";

const sampleStored = `
uniform sampler3D fieldTexture;
uniform sampler3D indexTexture;
uniform float indexChannel;
uniform float indexGrid;

float sampleField(vec3 voxel) {
  return textureLod(fieldTexture, (voxel + 0.5) / gridSize, 0.0).r;
}
`;

const shader = `precision highp float;
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
  int size = int(gridSize);

  int voxel = gl_InstanceID;
  int corner = gl_VertexID;

  int z = voxel / (size * size);
  int rest = voxel - z * size * size;
  int y = rest / size;
  int x = rest - y * size;

  // The last cell on each axis has no neighbour to form a cube with.
  if (x >= size - 1 || y >= size - 1 || z >= size - 1) {
    discardVertex();
    return;
  }

  vec3 base = vec3(float(x), float(y), float(z));

  int cubeIndex = 0;

  // One fetch, not eight, from the prepass. The core marches the same volume at
  // a coarser grid and has to do it the long way, because the prepass indices
  // are per voxel of the finer one.
  if (abs(gridSize - indexGrid) < 0.5) {
    vec2 cases = texelFetch(indexTexture, ivec3(x, y, z), 0).rg;
    cubeIndex = int(indexChannel < 0.5 ? cases.r : cases.g);
  } else {
    for (int i = 0; i < 8; i++) {
      if (sampleField(base + cornerOffset(i)) < isolation) cubeIndex |= (1 << i);
    }
  }

  if (cubeIndex == 0 || cubeIndex == 255) {
    discardVertex();
    return;
  }

  int edge = texelFetch(triTableTexture, ivec2(corner, cubeIndex), 0).r;
  if (edge == -1) {
    discardVertex();
    return;
  }

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
