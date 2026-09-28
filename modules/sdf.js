// Any key in ranges besides size is a slider the shape uses. reach is the
// surface's distance from the centre, in field units where the volume is 0..1.
const SQRT3 = Math.sqrt(3);

const ICOSA = 1.2584;

const rounded = (inner, ratio, r) => Math.max(inner - r, 0) * ratio + Math.min(r, inner);

const shapes = [
  {
    name: "sphere",
    ranges: { size: [0.15, 0.3] },
    defaults: { size: 0.25 },
    reach: (p) => p.size,
  },
  {
    name: "box",
    ranges: { size: [0.12, 0.25], rounding: [0, 0.12] },
    defaults: { size: 0.2, rounding: 0.03 },
    reach: (p) => rounded(p.size, SQRT3, p.rounding),
  },
  {
    name: "torus",
    ranges: { size: [0.18, 0.32], thickness: [0.03, 0.1] },
    defaults: { size: 0.26, thickness: 0.08 },
    reach: (p) => p.size + p.thickness,
  },
  {
    name: "cylinder",
    ranges: { size: [0.1, 0.22], height: [0.2, 0.6], rounding: [0, 0.1] },
    defaults: { size: 0.16, height: 0.45, rounding: 0.03 },
    reach: (p) => Math.hypot(p.size, p.height / 2),
  },
  {
    name: "octahedron",
    ranges: { size: [0.15, 0.25], rounding: [0, 0.12] },
    defaults: { size: 0.24, rounding: 0.03 },
    reach: (p) => rounded(p.size, SQRT3, p.rounding),
  },
  {
    name: "icosahedron",
    ranges: { size: [0.15, 0.3], rounding: [0, 0.12] },
    defaults: { size: 0.24, rounding: 0.03 },
    reach: (p) => rounded(p.size, ICOSA, p.rounding),
  },
  {
    name: "dodecahedron",
    ranges: { size: [0.15, 0.3], rounding: [0, 0.12] },
    defaults: { size: 0.24, rounding: 0.03 },
    reach: (p) => rounded(p.size, ICOSA, p.rounding),
  },
  {
    name: "trefoil",
    ranges: { size: [0.25, 0.4], thickness: [0.03, 0.08] },
    defaults: { size: 0.32, thickness: 0.06 },
    reach: (p) => p.size + p.offset + p.thickness,
  },
  {
    name: "mobius",
    ranges: { size: [0.18, 0.3], thickness: [0.01, 0.05], width: [0.04, 0.14] },
    defaults: { size: 0.26, thickness: 0.015, width: 0.13 },
    reach: (p) => p.size + p.offset + p.width + p.thickness,
  },
  {
    name: "suzanne",
    ranges: { size: [0.3, 0.36], rounding: [0.2, 0.4] },
    defaults: { size: 0.36, rounding: 0.3 },
    reach: (p) => 1.09 * (p.size + p.offset),
  },
  {
    name: "sphube",
    ranges: { size: [0.15, 0.3], rounding: [0, 0.12] },
    defaults: { size: 0.24, rounding: 0.05 },
    reach: (p) => p.size * (1 + (SQRT3 - 1) * (1 - Math.min(p.rounding / p.size, 1))),
  },
  {
    name: "goursat",
    ranges: { size: [0.18, 0.26] },
    defaults: { size: 0.22 },
    reach: (p) => 1.74 * (p.size + p.offset),
  },
  {
    name: "gyroid",
    ranges: { size: [0.25, 0.4], thickness: [0.03, 0.07] },
    defaults: { size: 0.33, thickness: 0.05 },
    reach: (p) => p.size + p.offset,
  },
  {
    name: "tetrahedron",
    ranges: { size: [0.15, 0.3], rounding: [0, 0.12] },
    defaults: { size: 0.26, rounding: 0.03 },
    reach: (p) => rounded(p.size / SQRT3, 3, p.rounding),
  },
  {
    name: "cinquefoil",
    ranges: { size: [0.25, 0.38], thickness: [0.02, 0.05] },
    defaults: { size: 0.32, thickness: 0.045 },
    reach: (p) => p.size + p.offset + p.thickness,
  },
  {
    name: "torus knot",
    ranges: { size: [0.25, 0.38], thickness: [0.02, 0.05] },
    defaults: { size: 0.32, thickness: 0.045 },
    reach: (p) => p.size + p.offset + p.thickness,
  },
  {
    name: "arc",
    ranges: { size: [0.18, 0.3], thickness: [0.04, 0.1], angle: [120, 320] },
    defaults: { size: 0.24, thickness: 0.07, angle: 250 },
    reach: (p) => p.size + p.offset + p.thickness,
  },
  {
    name: "spike ball",
    ranges: { size: [0.42, 0.45], thickness: [0.13, 0.15] },
    defaults: { size: 0.45, thickness: 0.15 },
    reach: (p) => p.size + p.offset + p.thickness,
  },
  {
    name: "pretzel",
    ranges: { size: [0.25, 0.4] },
    defaults: { size: 0.33 },
    reach: (p) => p.size + p.offset,
  },
  {
    name: "star",
    ranges: { size: [0.25, 0.4] },
    defaults: { size: 0.33 },
    reach: (p) => 1.05 * (p.size + p.offset),
  },
  {
    name: "stella",
    ranges: { size: [0.3, 0.42], rounding: [0, 0.02] },
    defaults: { size: 0.38, rounding: 0.01 },
    reach: (p) => rounded(p.size / 3, 3, p.rounding),
  },
];

const shapeNames = shapes.map((shape) => shape.name);

const find = (name) => shapes.find((shape) => shape.name === name);

// What the shader's uShape means: 0 is no shape.
function shapeIndex(name) {
  return shapeNames.indexOf(name) + 1;
}

function shapeUses(name, control) {
  return control in (find(name)?.ranges ?? {});
}

function shapeRanges(name) {
  return find(name)?.ranges ?? {};
}

function shapeDefaults(name) {
  return find(name)?.defaults ?? {};
}

// Short of the volume's half width, less the sealed shell.
const LIMIT = 0.48;

const LINEAR = ["size", "thickness", "height", "rounding", "width"];

// Past the volume's walls a shape is cut flat, and a part thinner than a cell
// vanishes.
function fitShape(name, params, { offset, minThickness }) {
  const shape = find(name);
  const p = { ...params, thickness: Math.max(params.thickness, minThickness) };
  if (!shape) return p;

  const scaled = (f) => {
    const q = { ...p, offset };
    for (const key of LINEAR) q[key] = p[key] * f;
    return q;
  };
  if (shape.reach(scaled(1)) <= LIMIT) return p;

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (shape.reach(scaled(mid)) <= LIMIT) lo = mid;
    else hi = mid;
  }
  const fitted = scaled(lo);
  delete fitted.offset;
  fitted.thickness = Math.max(fitted.thickness, minThickness);
  return fitted;
}

function shapeMaxSize(name, params, offset) {
  const shape = find(name);
  if (!shape) return 0.45;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (shape.reach({ ...params, size: mid, offset }) <= LIMIT) lo = mid;
    else hi = mid;
  }
  return lo;
}

export { shapeNames, shapeIndex, shapeUses, shapeRanges, shapeDefaults, fitShape, shapeMaxSize };
