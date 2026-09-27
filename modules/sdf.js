// Every shape the field can add, with the ranges the randomizer picks from.
// Size always applies; any other key in ranges is a slider the shape uses.
const shapes = [
  { name: "sphere", ranges: { size: [0.15, 0.3] } },
  { name: "box", ranges: { size: [0.12, 0.25], rounding: [0, 0.12] } },
  { name: "torus", ranges: { size: [0.18, 0.32], thickness: [0.03, 0.1] } },
  { name: "cylinder", ranges: { size: [0.1, 0.22], height: [0.2, 0.6], rounding: [0, 0.1] } },
  { name: "octahedron", ranges: { size: [0.15, 0.3], rounding: [0, 0.12] } },
  { name: "icosahedron", ranges: { size: [0.15, 0.3], rounding: [0, 0.12] } },
  { name: "dodecahedron", ranges: { size: [0.15, 0.3], rounding: [0, 0.12] } },
  { name: "trefoil", ranges: { size: [0.25, 0.4], thickness: [0.03, 0.08] } },
  { name: "mobius", ranges: { size: [0.18, 0.3], thickness: [0.01, 0.05] } },
  { name: "suzanne", ranges: { size: [0.15, 0.3], rounding: [0, 0.12] } },
  { name: "sphube", ranges: { size: [0.15, 0.3], rounding: [0, 0.12] } },
  { name: "goursat", ranges: { size: [0.25, 0.4] } },
  { name: "gyroid", ranges: { size: [0.25, 0.4], thickness: [0.03, 0.07] } },
  { name: "tetrahedron", ranges: { size: [0.15, 0.3], rounding: [0, 0.12] } },
  { name: "cinquefoil", ranges: { size: [0.25, 0.38], thickness: [0.02, 0.05] } },
  { name: "torus knot", ranges: { size: [0.25, 0.38], thickness: [0.02, 0.05] } },
  { name: "arc", ranges: { size: [0.18, 0.3], thickness: [0.04, 0.1] } },
  { name: "spike ball", ranges: { size: [0.3, 0.42], thickness: [0.025, 0.05] } },
  { name: "pretzel", ranges: { size: [0.25, 0.4] } },
  { name: "star", ranges: { size: [0.25, 0.4] } },
  { name: "stella", ranges: { size: [0.3, 0.42], rounding: [0, 0.04] } },
];

const shapeNames = shapes.map((shape) => shape.name);

// What the shader's uShape means: 0 is no shape.
function shapeIndex(name) {
  return shapeNames.indexOf(name) + 1;
}

function shapeUses(name, control) {
  return control in (shapes.find((shape) => shape.name === name)?.ranges ?? {});
}

function shapeRanges(name) {
  return shapes.find((shape) => shape.name === name)?.ranges ?? {};
}

export { shapeNames, shapeIndex, shapeUses, shapeRanges };
