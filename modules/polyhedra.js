const PHI = (1 + Math.sqrt(5)) / 2;

// A symmetric solid lists one normal per pair of opposite faces and the
// shader mirrors the point onto its side; the tetrahedron has no opposite
// faces, so it lists all four.
const SOLIDS = [
  { symmetric: true, normals: [
    [1, 1, 1],
    [-1, 1, 1],
    [1, -1, 1],
    [1, 1, -1],
  ] },
  { symmetric: true, normals: [
    [1, 1, 1],
    [-1, 1, 1],
    [1, -1, 1],
    [1, 1, -1],
    [0, 1, PHI + 1],
    [0, -1, PHI + 1],
    [PHI + 1, 0, 1],
    [-PHI - 1, 0, 1],
    [1, PHI + 1, 0],
    [-1, PHI + 1, 0],
  ] },
  { symmetric: true, normals: [
    [0, PHI, 1],
    [0, -PHI, 1],
    [1, 0, PHI],
    [-1, 0, PHI],
    [PHI, 1, 0],
    [-PHI, 1, 0],
  ] },
  { symmetric: false, normals: [
    [-1, -1, -1],
    [1, 1, -1],
    [-1, 1, 1],
    [1, -1, 1],
  ] },
];

const EPS = 1e-6;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a) => scale(a, 1 / Math.hypot(...a));

function vertices(normals, symmetric) {
  const planes = symmetric ? normals.flatMap((n) => [n, scale(n, -1)]) : normals;
  const found = [];

  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      for (let k = j + 1; k < planes.length; k++) {
        const [a, b, c] = [planes[i], planes[j], planes[k]];
        const bc = cross(b, c);
        const det = dot(a, bc);
        if (Math.abs(det) < EPS) continue;

        const x = scale(
          [
            bc[0] + cross(c, a)[0] + cross(a, b)[0],
            bc[1] + cross(c, a)[1] + cross(a, b)[1],
            bc[2] + cross(c, a)[2] + cross(a, b)[2],
          ],
          1 / det,
        );

        const outside = (n) => (symmetric ? Math.abs(dot(n, x)) : dot(n, x)) > 1 + EPS;
        if (normals.some(outside)) continue;
        if (found.some((v) => Math.hypot(...sub(v, x)) < EPS)) continue;
        found.push(x);
      }
    }
  }

  return found;
}

// The shader's inside test needs these counter-clockwise from outside.
function face(normal, all) {
  const on = all.filter((v) => Math.abs(dot(normal, v) - 1) < EPS);
  const u = unit(cross(normal, Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const w = cross(normal, u);
  return on.sort((a, b) => Math.atan2(dot(a, w), dot(a, u)) - Math.atan2(dot(b, w), dot(b, u)));
}

function build() {
  const normals = [];
  const polygons = [];
  const firstFace = [0];

  for (const solid of SOLIDS) {
    const unitNormals = solid.normals.map(unit);
    const all = vertices(unitNormals, solid.symmetric);
    for (const n of unitNormals) {
      normals.push(n);
      polygons.push(face(n, all));
    }
    firstFace.push(normals.length);
  }

  const vertexStart = [0];
  for (const polygon of polygons) vertexStart.push(vertexStart[vertexStart.length - 1] + polygon.length);

  return { normals, polygons, firstFace, vertexStart };
}

const polyhedra = build();

const f = (x) => x.toFixed(8);
const v3 = (v) => `vec3(${v.map(f).join(", ")})`;

// Written out rather than looped over constant arrays: indexing those with a
// loop counter more than doubled the field pass on D3D11.
function solidFunction(solid) {
  const faces = [];
  for (let i = polyhedra.firstFace[solid]; i < polyhedra.firstFace[solid + 1]; i++) {
    faces.push({ normal: polyhedra.normals[i], polygon: polyhedra.polygons[i] });
  }

  const { symmetric } = SOLIDS[solid];
  const planes = faces.map(({ normal }) =>
    symmetric ? `abs(dot(p, ${v3(normal)}))` : `dot(p, ${v3(normal)})`,
  );
  const plane = planes.slice(1).reduce((acc, term) => `max(${acc}, ${term})`, planes[0]);
  const calls = faces.map(
    ({ normal, polygon }) =>
      `  d = min(d, polyFace${polygon.length}(p, ${v3(normal)}, r, ${symmetric}, ${polygon.map(v3).join(", ")}));`,
  );

  return `float sdPolyhedron${solid}(vec3 p, float r, float far) {
  float plane = ${plane} - r;
  if (plane <= 0.0 || plane >= far) return plane;
  float d = 1e18;
${calls.join("\n")}
  return sqrt(d);
}`;
}

// Skipping faces the point is behind is safe on any convex solid: the nearest
// point always lies on some face the point is in front of. Past far the field
// is zero, so the plane bound, which never exceeds the exact distance, stands
// in.
const polyhedronDistance = `
float polyEdge(vec3 s, vec3 n, vec3 a, vec3 b, inout bool inside) {
  vec3 ab = b - a;
  vec3 as = s - a;
  if (dot(cross(ab, as), n) < 0.0) inside = false;
  vec3 c = as - ab * clamp(dot(as, ab) / dot(ab, ab), 0.0, 1.0);
  return dot(c, c);
}

float polyFace3(vec3 p, vec3 n, float r, bool mirror, vec3 a, vec3 b, vec3 c) {
  vec3 q = mirror && dot(p, n) < 0.0 ? -p : p;
  float h = dot(q, n) - r;
  if (h <= 0.0) return 1e18;
  vec3 s = q - h * n;
  bool inside = true;
  float e = polyEdge(s, n, a * r, b * r, inside);
  e = min(e, polyEdge(s, n, b * r, c * r, inside));
  e = min(e, polyEdge(s, n, c * r, a * r, inside));
  return h * h + (inside ? 0.0 : e);
}

float polyFace5(vec3 p, vec3 n, float r, bool mirror, vec3 a, vec3 b, vec3 c, vec3 d, vec3 e5) {
  vec3 q = mirror && dot(p, n) < 0.0 ? -p : p;
  float h = dot(q, n) - r;
  if (h <= 0.0) return 1e18;
  vec3 s = q - h * n;
  bool inside = true;
  float e = polyEdge(s, n, a * r, b * r, inside);
  e = min(e, polyEdge(s, n, b * r, c * r, inside));
  e = min(e, polyEdge(s, n, c * r, d * r, inside));
  e = min(e, polyEdge(s, n, d * r, e5 * r, inside));
  e = min(e, polyEdge(s, n, e5 * r, a * r, inside));
  return h * h + (inside ? 0.0 : e);
}

${SOLIDS.map((_, i) => solidFunction(i)).join("\n\n")}
`;

export { polyhedra, polyhedronDistance };
