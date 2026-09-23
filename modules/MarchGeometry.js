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

// Fifteen vertices per voxel: five triangles is the most one cube can
// produce, and a vertex that is not needed retires itself.
const VERTICES_PER_VOXEL = 15;

// Integers rather than floats because these are indices and -1 is a
// terminator that must survive the round trip exactly.
function makeTriTableTexture() {
  const data = new Int32Array(256 * 16);
  data.fill(-1);
  data.set(triTable.subarray(0, Math.min(triTable.length, data.length)));

  const texture = new DataTexture(data, 16, 256, RedIntegerFormat, IntType);
  texture.internalFormat = "R32I";
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

class MarchGeometry extends InstancedBufferGeometry {
  constructor(size) {
    super();

    this.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(VERTICES_PER_VOXEL * 3), 3),
    );

    // The placeholder positions are not where the mesh is, so a bounding volume
    // derived from them would cull the draw from most angles. The surface can be
    // anywhere in the -1..1 grid.
    this.boundingSphere = new Sphere(new Vector3(0, 0, 0), Math.sqrt(3));
    this.setSize(size);
  }

  setSize(size) {
    this.size = size;
    this.instanceCount = size * size * size;
  }

  // Left as the constructor set it; the default would measure the placeholder
  // attribute and conclude the mesh is a point at the origin.
  computeBoundingSphere() {}
}

export { MarchGeometry, makeTriTableTexture };
