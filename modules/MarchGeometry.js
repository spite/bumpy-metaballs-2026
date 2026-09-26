import {
  BufferAttribute,
  DataTexture,
  InstancedBufferGeometry,
  IntType,
  NearestFilter,
  RedIntegerFormat,
  Sphere,
  Vector3,
} from "three";

import { triTable } from "modules/triTable.js";

// Must be a multiple of three, or triangles straddle instances.
const VERTICES_PER_INSTANCE = 96;

// Column 15 holds each case's vertex count, not an edge: the table never uses
// it.
function makeTriTableTexture() {
  const data = new Int32Array(256 * 16);
  data.fill(-1);
  data.set(triTable.subarray(0, Math.min(triTable.length, data.length)));

  for (let row = 0; row < 256; row++) {
    let count = 0;
    while (count < 15 && data[row * 16 + count] !== -1) count++;
    data[row * 16 + 15] = count;
  }

  const texture = new DataTexture(data, 16, 256, RedIntegerFormat, IntType);
  texture.internalFormat = "R32I";
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

class MarchGeometry extends InstancedBufferGeometry {
  constructor() {
    super();

    this.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(VERTICES_PER_INSTANCE * 3), 3),
    );

    // The placeholder positions are not where the mesh is, so a bounding volume
    // derived from them would cull the draw from most angles. The surface can be
    // anywhere in the -1..1 grid.
    this.boundingSphere = new Sphere(new Vector3(0, 0, 0), Math.sqrt(3));
    this.setVertexCount(0);
  }

  setVertexCount(count) {
    this.instanceCount = Math.ceil(count / VERTICES_PER_INSTANCE);
  }

  // Left as the constructor set it; the default would measure the placeholder
  // attribute and conclude the mesh is a point at the origin.
  computeBoundingSphere() {}
}

export { MarchGeometry, makeTriTableTexture, VERTICES_PER_INSTANCE };
