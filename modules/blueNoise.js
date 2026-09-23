const SIGMA = 1.9;

function energyKernel(size) {
  const radius = Math.min(Math.floor(size / 2), 9);
  const span = radius * 2 + 1;
  const kernel = new Float32Array(span * span);
  const denom = 2 * SIGMA * SIGMA;
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      kernel[(y + radius) * span + (x + radius)] =
        Math.exp(-(x * x + y * y) / denom);
    }
  }
  return { kernel, radius, span };
}

function splat(energy, size, kernel, radius, span, index, sign) {
  const cx = index % size;
  const cy = (index / size) | 0;
  for (let y = -radius; y <= radius; y++) {
    const row = ((cy + y + size) % size) * size;
    const krow = (y + radius) * span;
    for (let x = -radius; x <= radius; x++) {
      energy[row + ((cx + x + size) % size)] +=
        sign * kernel[krow + (x + radius)];
    }
  }
}

function extreme(energy, pattern, size, wanted, largest) {
  let best = -1;
  let bestValue = largest ? -Infinity : Infinity;
  for (let i = 0; i < size * size; i++) {
    if (pattern[i] !== wanted) continue;
    const v = energy[i];
    if (largest ? v > bestValue : v < bestValue) {
      bestValue = v;
      best = i;
    }
  }
  return best;
}

function generateBlueNoise(size, seed = 1) {
  const total = size * size;
  const { kernel, radius, span } = energyKernel(size);
  const energy = new Float32Array(total);
  const pattern = new Uint8Array(total);
  const rank = new Int32Array(total).fill(-1);

  let state = (seed >>> 0) || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 0xffffff) / 0xffffff;
  };

  let ones = 0;
  const initial = Math.max(1, Math.round(total / 10));
  while (ones < initial) {
    const i = (random() * total) | 0;
    if (pattern[i]) continue;
    pattern[i] = 1;
    splat(energy, size, kernel, radius, span, i, 1);
    ones++;
  }

  for (;;) {
    const cluster = extreme(energy, pattern, size, 1, true);
    pattern[cluster] = 0;
    splat(energy, size, kernel, radius, span, cluster, -1);
    const vd = extreme(energy, pattern, size, 0, false);
    if (vd === cluster) {
      pattern[cluster] = 1;
      splat(energy, size, kernel, radius, span, cluster, 1);
      break;
    }
    pattern[vd] = 1;
    splat(energy, size, kernel, radius, span, vd, 1);
  }

  const initialPattern = pattern.slice();
  const initialEnergy = energy.slice();

  for (let r = ones - 1; r >= 0; r--) {
    const cluster = extreme(energy, pattern, size, 1, true);
    pattern[cluster] = 0;
    splat(energy, size, kernel, radius, span, cluster, -1);
    rank[cluster] = r;
  }

  pattern.set(initialPattern);
  energy.set(initialEnergy);

  for (let r = ones; r < total; r++) {
    const vd = extreme(energy, pattern, size, 0, false);
    pattern[vd] = 1;
    splat(energy, size, kernel, radius, span, vd, 1);
    rank[vd] = r;
  }

  const out = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    out[i] = Math.min(255, Math.floor((rank[i] / total) * 256));
  }
  return out;
}

export { generateBlueNoise };
