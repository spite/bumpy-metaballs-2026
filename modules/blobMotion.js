// Seeded by blob index, so changing the count never moves the other blobs.
const MAX_BLOBS = 64;

const motionNames = ["legacy", "drift", "orbit"];

function random(seed) {
  let a = (seed * 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function legacy(i, time, out, o) {
  out[o] = Math.sin(i + 1.26 * time * (1.03 + 0.5 * Math.cos(0.21 * i))) * 0.27 + 0.5;
  out[o + 1] = Math.cos(i + 1.12 * time * 0.21 * Math.sin(0.72 + 0.83 * i)) * 0.27 + 0.5;
  out[o + 2] = Math.cos(i + 1.32 * time * 0.1 * Math.sin(0.92 + 0.53 * i)) * 0.27 + 0.5;
}

// A blob's parameters depend only on its index, so they are drawn once.
function cached(cache, draw) {
  return (i) => (cache[i] ??= draw(random(i + 1)));
}

const driftParams = cached([], (r) =>
  [0, 1, 2].map(() => ({
    w1: 0.5 + 0.5 * r(),
    w2: 0.8 + 0.7 * r(),
    p1: 2 * Math.PI * r(),
    p2: 2 * Math.PI * r(),
  })),
);

function wave({ w1, w2, p1, p2 }, time) {
  return 0.5 * (Math.sin(w1 * time + p1) + Math.sin(w2 * time + p2));
}

function drift(i, time, out, o) {
  const axes = driftParams(i);
  const x = wave(axes[0], time);
  const y = wave(axes[1], time);
  const z = wave(axes[2], time);
  const scale = 0.34 / Math.max(1, Math.hypot(x, y, z));
  out[o] = 0.5 + x * scale;
  out[o + 1] = 0.5 + y * scale;
  out[o + 2] = 0.5 + z * scale;
}

const orbitParams = cached([], (r) => {
  const radius = 0.05 + 0.25 * Math.cbrt(r());
  const speed = (0.7 + 0.7 * r()) * (r() < 0.5 ? -1 : 1);
  const phase = 2 * Math.PI * r();
  const breathe = 0.2 + 0.3 * r();
  const precession = (0.05 + 0.1 * r()) * (r() < 0.5 ? -1 : 1);
  const nz = 2 * r() - 1;
  const na = 2 * Math.PI * r();
  const cx = 0.5 + 0.16 * (r() - 0.5);
  const cy = 0.5 + 0.16 * (r() - 0.5);
  const cz = 0.5 + 0.16 * (r() - 0.5);
  return { radius, speed, phase, breathe, precession, nz, na, cx, cy, cz };
});

function orbit(i, time, out, o) {
  const { radius, speed, phase, breathe, precession, nz, na, cx, cy, cz } = orbitParams(i);

  const ring = Math.sqrt(1 - nz * nz);
  const turn = na + precession * time;
  const nx = ring * Math.cos(turn);
  const ny = nz;
  const nw = ring * Math.sin(turn);

  // u = normalize(n x helper), v = n x u, with helper y unless n is close to it.
  let ux;
  let uy;
  let uz;
  if (Math.abs(ny) < 0.9) {
    ux = ny * 0 - nw * 1;
    uy = nw * 0 - nx * 0;
    uz = nx * 1 - ny * 0;
  } else {
    ux = ny * 0 - nw * 0;
    uy = nw * 1 - nx * 0;
    uz = nx * 0 - ny * 1;
  }
  const l = Math.hypot(ux, uy, uz);
  ux /= l;
  uy /= l;
  uz /= l;
  const vx = ny * uz - nw * uy;
  const vy = nw * ux - nx * uz;
  const vz = nx * uy - ny * ux;

  const angle = speed * time + phase;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const rr = radius * (1 + 0.15 * Math.sin(breathe * time + phase));

  out[o] = cx + rr * (ux * c + vx * s);
  out[o + 1] = cy + rr * (uy * c + vy * s);
  out[o + 2] = cz + rr * (uz * c + vz * s);
}

const motions = { legacy, drift, orbit };

function blobPositions(motion, count, time, out) {
  const place = motions[motion] ?? drift;
  const n = Math.min(count, MAX_BLOBS);
  for (let i = 0; i < n; i++) place(i, time, out, i * 3);
  return out;
}

export { blobPositions, motionNames, MAX_BLOBS };
