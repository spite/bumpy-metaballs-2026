import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Data3DTexture,
  DoubleSide,
  FloatType,
  LinearFilter,
  Ray,
  RedFormat,
  Vector3,
} from "three";
import { MeshBVH } from "third_party/bvh.js";
import { OBJLoader } from "third_party/OBJLoader.js";
import { LoopSubdivision } from "third_party/LoopSubdivision.js";
import { nextPaint } from "modules/loading.js";

const BAKE_SIZE = 64;

// Must match uModelMargin in shaders/field.js.
const BAKE_MARGIN = 1.15;

// Each pass quadruples the triangles.
const SUBDIVISIONS = 2;
const MAX_TRIANGLES = 200000;

function mergedPositions(group) {
  let total = 0;
  group.traverse((child) => {
    if (child.isMesh) total += child.geometry.attributes.position.count;
  });

  const positions = new Float32Array(total * 3);
  let at = 0;
  group.traverse((child) => {
    if (!child.isMesh) return;
    const source = child.geometry.attributes.position.array;
    positions.set(source, at);
    at += source.length;
  });

  return positions;
}

function normalise(positions) {
  const box = new Box3();
  const p = new Vector3();
  for (let i = 0; i < positions.length; i += 3) {
    box.expandByPoint(p.fromArray(positions, i));
  }

  const centre = box.getCenter(new Vector3());
  const extent = box.getSize(new Vector3());
  const scale = 2 / Math.max(extent.x, extent.y, extent.z);

  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] - centre.x) * scale;
    positions[i + 1] = (positions[i + 1] - centre.y) * scale;
    positions[i + 2] = (positions[i + 2] - centre.z) * scale;
  }
}

// Three rays, not one: parity says nothing about a ray leaving through an open
// hole, and Suzanne's neck is one. A nearest-triangle normal is cheaper and
// wrong wherever the surface disagrees with itself across a cell.
const PARITY_DIRECTIONS = [
  [0.5773, 0.5773, 0.5773],
  [-0.7071, 0.7071, 0.0],
  [0.3574, -0.3574, 0.8629],
];

function insideByParity(bvh, ray, point) {
  let votes = 0;
  for (const [x, y, z] of PARITY_DIRECTIONS) {
    ray.origin.copy(point);
    ray.direction.set(x, y, z);
    if (bvh.raycast(ray, DoubleSide).length % 2 === 1) votes++;
  }
  return votes >= 2;
}

function bake(geometry) {
  const bvh = new MeshBVH(geometry);

  const data = new Float32Array(BAKE_SIZE * BAKE_SIZE * BAKE_SIZE);
  const point = new Vector3();
  const hit = {};

  const ray = new Ray(new Vector3(), new Vector3());

  const step = (2 * BAKE_MARGIN) / (BAKE_SIZE - 1);

  let at = 0;
  for (let z = 0; z < BAKE_SIZE; z++) {
    for (let y = 0; y < BAKE_SIZE; y++) {
      for (let x = 0; x < BAKE_SIZE; x++) {
        point.set(
          -BAKE_MARGIN + x * step,
          -BAKE_MARGIN + y * step,
          -BAKE_MARGIN + z * step,
        );

        bvh.closestPointToPoint(point, hit);
        data[at++] = insideByParity(bvh, ray, point)
          ? -hit.distance
          : hit.distance;
      }
    }
  }

  const texture = new Data3DTexture(data.slice(), BAKE_SIZE, BAKE_SIZE, BAKE_SIZE);
  texture.format = RedFormat;
  texture.type = FloatType;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;

  return { texture, raw: data, sigma: 0 };
}

function smoothMeshField(field, sigma) {
  if (field.sigma === sigma) return false;
  field.sigma = sigma;

  const out = field.texture.image.data;
  if (sigma <= 0) {
    out.set(field.raw);
    field.texture.needsUpdate = true;
    return true;
  }

  const radius = Math.ceil(3 * sigma);
  const weights = new Float32Array(2 * radius + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    weights[i + radius] = Math.exp((-i * i) / (2 * sigma * sigma));
    sum += weights[i + radius];
  }
  for (let i = 0; i < weights.length; i++) weights[i] /= sum;

  const n = BAKE_SIZE;
  const blur = (source, target, stride) => {
    for (let i = 0; i < source.length; i++) {
      const c = Math.floor(i / stride) % n;
      let value = 0;
      for (let k = -radius; k <= radius; k++) {
        const j = Math.min(n - 1, Math.max(0, c + k));
        value += weights[k + radius] * source[i + (j - c) * stride];
      }
      target[i] = value;
    }
  };

  const x = new Float32Array(out.length);
  const y = new Float32Array(out.length);
  blur(field.raw, x, 1);
  blur(x, y, n);
  blur(y, out, n * n);

  field.texture.needsUpdate = true;
  return true;
}

async function loadMeshField(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`could not load ${url}: ${response.status}`);
  }

  const text = await response.text();

  // Everything from here blocks for seconds; let the loading indicator paint.
  await nextPaint();

  const group = new OBJLoader().parse(text);
  const positions = mergedPositions(group);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));

  const smoothed = LoopSubdivision.modify(geometry, SUBDIVISIONS, {
    maxTriangles: MAX_TRIANGLES,
  });

  // After subdividing, not before: Loop moves vertices inward, so the bounds
  // change.
  normalise(smoothed.attributes.position.array);

  return bake(smoothed);
}

export { loadMeshField, smoothMeshField, BAKE_MARGIN };
