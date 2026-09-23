import { DataUtils, HalfFloatType, Vector3 } from "three";

// The dominant light direction, from the radiance map's first spherical
// harmonic band: L1 is the centroid of the light, pointing where the sphere
// is brightest with a length that says how lopsided it is. Better than the
// brightest texel, which locks onto one hot pixel and jitters between
// neighbours as the map changes.
const Y0 = 0.282095; // sqrt(1/(4pi))     - the constant basis function
const Y1 = 0.488603; // sqrt(3/(4pi))     - the three linear ones

// A single infinitely small light puts the band ratio here, so dividing by it
// rescales onto 0..1.
const MAX_RATIO = Y1 / Y0;

const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Band 1 converges long before the full 2048x1024, and sampling every texel
// only to average it back down would pause on every environment switch.
const MAX_SAMPLES = 256;

function environmentLight(image, type) {
  const { data, width, height } = image;

  // RGBELoader hands back half floats unless asked for full ones.
  const read =
    type === HalfFloatType
      ? (i) => DataUtils.fromHalfFloat(data[i])
      : (i) => data[i];

  const xStep = Math.max(1, Math.floor(width / MAX_SAMPLES));
  const yStep = Math.max(1, Math.floor(height / MAX_SAMPLES));

  let l0 = 0;
  const l1 = new Vector3();
  let total = 0;

  for (let y = 0; y < height; y += yStep) {
    // Row 0 of an RGBE scanline is the top of the image, where v is 1, so the row
    // counts down through v rather than up. Taken the other way round, every
    // environment reports its light arriving from under the floor.
    const v = 1 - (y + 0.5) / height;
    const dirY = Math.sin((v - 0.5) * Math.PI);
    const ring = Math.sqrt(Math.max(0, 1 - dirY * dirY));

    // Weighting by ring radius is what stops a bright pole counting as much as a
    // bright horizon many times its area.
    const weight = ring;

    for (let x = 0; x < width; x += xStep) {
      const u = (x + 0.5) / width;
      const phi = (u - 0.5) * 2 * Math.PI;
      const dirX = ring * Math.cos(phi);
      const dirZ = ring * Math.sin(phi);

      const i = (y * width + x) * 4;
      const lum = luminance(read(i), read(i + 1), read(i + 2)) * weight;

      l0 += lum * Y0;
      l1.x += lum * Y1 * dirX;
      l1.y += lum * Y1 * dirY;
      l1.z += lum * Y1 * dirZ;
      total += weight;
    }
  }

  if (total > 0) {
    l0 /= total;
    l1.divideScalar(total);
  }

  const length = l1.length();

  // Normalising a vector that short would amplify rounding into a confident
  // direction pointing nowhere.
  const direction =
    length > 1e-6 ? l1.clone().divideScalar(length) : new Vector3(0, 1, 0);

  return {
    direction,
    directionality: Math.min(1, length / Math.max(l0 * MAX_RATIO, 1e-6)),
  };
}

export { environmentLight };
