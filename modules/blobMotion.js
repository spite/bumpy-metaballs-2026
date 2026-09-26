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

function drift(i, time, out, o) {
  const r = random(i + 1);
  let x = 0;
  let y = 0;
  let z = 0;
  for (let axis = 0; axis < 3; axis++) {
    const w1 = 0.5 + 0.5 * r();
    const w2 = 0.8 + 0.7 * r();
    const p1 = 2 * Math.PI * r();
    const p2 = 2 * Math.PI * r();
    const v = 0.5 * (Math.sin(w1 * time + p1) + Math.sin(w2 * time + p2));
    if (axis === 0) x = v;
    else if (axis === 1) y = v;
    else z = v;
  }
  const scale = 0.34 / Math.max(1, Math.hypot(x, y, z));
  out[o] = 0.5 + x * scale;
  out[o + 1] = 0.5 + y * scale;
  out[o + 2] = 0.5 + z * scale;
}

function orbit(i, time, out, o) {
  const r = random(i + 1);
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

  const ring = Math.sqrt(1 - nz * nz);
  const turn = na + precession * time;
  const n = [ring * Math.cos(turn), nz, ring * Math.sin(turn)];

  const helper = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = cross(n, helper);
  normalize(u);
  const v = cross(n, u);

  const angle = speed * time + phase;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const rr = radius * (1 + 0.15 * Math.sin(breathe * time + phase));

  out[o] = cx + rr * (u[0] * c + v[0] * s);
  out[o + 1] = cy + rr * (u[1] * c + v[1] * s);
  out[o + 2] = cz + rr * (u[2] * c + v[2] * s);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(a) {
  const l = Math.hypot(a[0], a[1], a[2]);
  a[0] /= l;
  a[1] /= l;
  a[2] /= l;
}

const motions = { legacy, drift, orbit };

function blobPositions(motion, count, time, out) {
  const place = motions[motion] ?? drift;
  const n = Math.min(count, MAX_BLOBS);
  for (let i = 0; i < n; i++) place(i, time, out, i * 3);
  return out;
}

export { blobPositions, motionNames, MAX_BLOBS };
