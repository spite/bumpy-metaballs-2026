// The modern MarchingCubesGeometry exposes the scalar field and leaves it to the
// caller to fill, so the metaball falloff that used to live inside
// THREE.MarchingCubes.addBall lives here instead.

const SUBTRACT = 12;
const EPSILON = 0.000001;

// Solving strength / radius^2 - subtract = 0 for the radius gives the extent
// past which a ball can no longer push the field over the isolation level, so
// only that neighbourhood has to be touched.
function addBall(geometry, ballx, bally, ballz, strength, subtract) {
  const { size, size2, field } = geometry;
  const radius = size * Math.sqrt(strength / subtract);

  const zs = ballz * size;
  const ys = bally * size;
  const xs = ballx * size;

  const minZ = Math.max(1, Math.floor(zs - radius));
  const maxZ = Math.min(size - 1, Math.floor(zs + radius));
  const minY = Math.max(1, Math.floor(ys - radius));
  const maxY = Math.min(size - 1, Math.floor(ys + radius));
  const minX = Math.max(1, Math.floor(xs - radius));
  const maxX = Math.min(size - 1, Math.floor(xs + radius));

  for (let z = minZ; z < maxZ; z++) {
    const zOffset = size2 * z;
    const fz = z / size - ballz;
    const fz2 = fz * fz;

    for (let y = minY; y < maxY; y++) {
      const yOffset = zOffset + size * y;
      const fy = y / size - bally;
      const fy2 = fy * fy;

      for (let x = minX; x < maxX; x++) {
        const fx = x / size - ballx;
        const value = strength / (EPSILON + fx * fx + fy2 + fz2) - subtract;
        if (value > 0) field[yOffset + x] += value;
      }
    }
  }
}

// The geometry's own reset() also zeroes a palette array, which is only ever
// written by reset() itself and only ever read into values that are discarded
// unless colours are enabled. It is zero from allocation and nothing dirties it,
// so clearing it every frame is pure cost. This clears the two arrays that do
// change.
function resetField(geometry) {
  const { field, normal_cache: cache, size3 } = geometry;

  for (let i = 0; i < size3; i++) {
    field[i] = 0;
    cache[i * 3] = 0;
  }
}

// A distance function laid into the field with the same falloff the balls use,
// so the two blend into one surface rather than merely overlapping. The only
// difference is where the distance is measured from: a point for a ball, the
// shape's surface here. Anything at or inside that surface reads as solidly
// inside.
//
// The falloff puts the isosurface a little outside whatever it is measured
// from, which for a ball just means it is drawn slightly larger than its radius.
// For a thin shape that offset is most of the thickness, and it varies with the
// ball count and the isolation level, so the size asked for would have meant
// nothing in particular. Solving the falloff for where it crosses the isolation
// level gives that offset exactly, and taking it off leaves the size as the one
// actually drawn.
function addShape(
  geometry,
  distance,
  cx,
  cy,
  cz,
  size,
  thickness,
  strength,
  subtract,
  isolation,
) {
  const { size: gridSize, size2, field } = geometry;

  const surfaceOffset = Math.sqrt(strength / (isolation + subtract));
  const core = Math.max(size - surfaceOffset, 0);
  const coreThickness = Math.max(thickness - surfaceOffset, 0);

  // Past this distance from the surface the falloff no longer clears subtract.
  // The bound is deliberately loose: a polyhedron reaches further towards its
  // corners than the size names, and visiting a few empty cells costs less than
  // clipping the shape would.
  const reach = Math.sqrt(strength / subtract);
  const span = core * 2 + coreThickness + reach;

  const min = (c) => Math.max(1, Math.floor((c - span) * gridSize));
  const max = (c) => Math.min(gridSize - 1, Math.ceil((c + span) * gridSize));

  for (let z = min(cz); z < max(cz); z++) {
    const zOffset = size2 * z;
    const fz = z / gridSize - cz;

    for (let y = min(cy); y < max(cy); y++) {
      const yOffset = zOffset + gridSize * y;
      const fy = y / gridSize - cy;

      for (let x = min(cx); x < max(cx); x++) {
        const fx = x / gridSize - cx;

        // Negative inside; clamped so the inside is all equally far in rather
        // than folding back out again.
        const d = Math.max(distance(fx, fy, fz, core, coreThickness), 0);
        const value = strength / (EPSILON + d * d) - subtract;

        if (value > 0) field[yOffset + x] += value;
      }
    }
  }
}

// Smoothing the field before it is polygonised, from the copy of this geometry
// in genuary-2026, which carries a blur the threejs-conf one does not.
//
// It rounds the surface off at its source rather than after the fact, which also
// helps the shading: the normals are central differences taken across single
// cells of the field, and a field that changes less abruptly between cells gives
// less abrupt normals. A blurred field peaks lower, so the isosurface pulls in a
// little as this rises.
//
// One pass is the most the field will take: blurring flattens it, and the edge
// interpolation the polygoniser does between cells, (isolation - v1) / (v2 - v1),
// gets worse conditioned as it does, until vertices snap to cell corners and the
// surface facets — the opposite of what the setting is for. So the intensity is
// what is exposed and the pass count is fixed at one.
function blurField(geometry, intensity) {
  const { field, size, size2 } = geometry;

  // Reading and writing the same field would let a cell see its already-blurred
  // neighbours, so the reads come from a copy. It is the same size every pass,
  // so it is kept on the geometry rather than reallocated each frame.
  if (!geometry.blurScratch || geometry.blurScratch.length !== field.length) {
    geometry.blurScratch = new Float32Array(field.length);
  }
  const copy = geometry.blurScratch;
  copy.set(field);

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const index = size2 * z + size * y + x;
        let value = copy[index];
        let count = 1;

        for (let dx = -1; dx <= 1; dx += 2) {
          const x2 = dx + x;
          if (x2 < 0 || x2 >= size) continue;

          for (let dy = -1; dy <= 1; dy += 2) {
            const y2 = dy + y;
            if (y2 < 0 || y2 >= size) continue;

            for (let dz = -1; dz <= 1; dz += 2) {
              const z2 = dz + z;
              if (z2 < 0 || z2 >= size) continue;

              count++;
              value += (intensity * (copy[size2 * z2 + size * y2 + x2] - value)) / count;
            }
          }
        }

        field[index] = value;
      }
    }
  }
}

// Resamples one field into a coarser one, so the core can be polygonised at its
// own resolution instead of walking the shell's grid a second time.
//
// Trilinear rather than nearest. Nearest picks one of the eight corners of the
// block it stands for, which moves the isosurface by up to half a cell and does
// it differently along each axis — the core would shift and ripple against the
// shell as the blobs moved. Interpolating puts the sample where it is asked for.
function resampleField(src, dst) {
  const { field: sf, size: ss, size2: ss2 } = src;
  const { field: df, size: ds, size2: ds2 } = dst;

  if (ds === ss) {
    df.set(sf);
    return;
  }

  // Both grids span the same box, so it is the last sample that lines up, not
  // the spacing: ss - 1 source intervals stretched over ds - 1 destination ones.
  const step = (ss - 1) / (ds - 1);

  for (let z = 0; z < ds; z++) {
    const fz = z * step;
    const z0 = Math.min(ss - 1, fz | 0);
    const z1 = Math.min(ss - 1, z0 + 1);
    const tz = fz - z0;

    for (let y = 0; y < ds; y++) {
      const fy = y * step;
      const y0 = Math.min(ss - 1, fy | 0);
      const y1 = Math.min(ss - 1, y0 + 1);
      const ty = fy - y0;

      const row = ds2 * z + ds * y;

      for (let x = 0; x < ds; x++) {
        const fx = x * step;
        const x0 = Math.min(ss - 1, fx | 0);
        const x1 = Math.min(ss - 1, x0 + 1);
        const tx = fx - x0;

        const z0o = ss2 * z0;
        const z1o = ss2 * z1;
        const y0o = ss * y0;
        const y1o = ss * y1;

        const c000 = sf[z0o + y0o + x0];
        const c100 = sf[z0o + y0o + x1];
        const c010 = sf[z0o + y1o + x0];
        const c110 = sf[z0o + y1o + x1];
        const c001 = sf[z1o + y0o + x0];
        const c101 = sf[z1o + y0o + x1];
        const c011 = sf[z1o + y1o + x0];
        const c111 = sf[z1o + y1o + x1];

        const c00 = c000 + (c100 - c000) * tx;
        const c10 = c010 + (c110 - c010) * tx;
        const c01 = c001 + (c101 - c001) * tx;
        const c11 = c011 + (c111 - c011) * tx;

        const c0 = c00 + (c10 - c00) * ty;
        const c1 = c01 + (c11 - c01) * ty;

        df[row + x] = c0 + (c1 - c0) * tz;
      }
    }
  }
}

// Filling the field and polygonising it are separate steps because one field can
// feed two surfaces: raising the isolation level shrinks the isosurface, so the
// same metaballs give both the outer shell and a smaller solid core.
function updateField(
  geometry,
  time,
  numBlobs,
  { blobs = true, shape = null, isolation = 80, smoothing = 0 } = {},
) {
  resetField(geometry);

  const strength = 1.2 / ((Math.sqrt(numBlobs) - 1) / 4 + 1);

  if (shape) {
    addShape(
      geometry,
      shape.distance,
      0.5,
      0.5,
      0.5,
      shape.size,
      shape.thickness,
      strength,
      SUBTRACT,
      isolation,
    );
  }

  // The count still sets the strength either way, so turning the balls off
  // leaves whatever else is in the field looking exactly as it did.
  for (let i = 0; blobs && i < numBlobs; i++) {
    const ballx =
      Math.sin(i + 1.26 * time * (1.03 + 0.5 * Math.cos(0.21 * i))) * 0.27 + 0.5;
    const bally =
      Math.cos(i + 1.12 * time * 0.21 * Math.sin(0.72 + 0.83 * i)) * 0.27 + 0.5;
    const ballz =
      Math.cos(i + 1.32 * time * 0.1 * Math.sin(0.92 + 0.53 * i)) * 0.27 + 0.5;

    addBall(geometry, ballx, bally, ballz, strength, SUBTRACT);
  }

  if (smoothing > 0) blurField(geometry, smoothing);
}

// Polygonises whatever is in the field at the given level. The normal cache is
// keyed on its own first component being zero, so it has to be cleared before a
// pass — except straight after updateField, which has just cleared it. Pass
// `cacheIsClear` there rather than paying for the walk twice.
function buildAt(geometry, isolation, cacheIsClear = false) {
  if (!cacheIsClear) {
    const cache = geometry.normal_cache;
    for (let i = 0, n = geometry.size3; i < n; i++) cache[i * 3] = 0;
  }

  geometry.isolation = isolation;
  geometry.invalidated = true;

  // build() keeps counting past the end of its buffers, and the writes past the
  // end are silently dropped, so the count it returns can exceed what is
  // actually there. Drawing that many vertices reads whatever the driver feels
  // like and paints it as geometry. Clamp instead: the surface gets clipped,
  // which is visible and harmless, rather than filled with garbage triangles.
  const capacity = geometry.getAttribute("position").count;
  geometry.setDrawRange(0, Math.min(geometry.build(), capacity));
}

export { addBall, addShape, blurField, buildAt, resampleField, resetField, updateField };
