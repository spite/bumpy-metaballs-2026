// The shapes a preset can add to the field, in the order shaders/field.js
// expects them: main.js sends the index of the name and shapeDistance() picks
// by that index, so reordering this list silently changes which solid a preset
// draws.
//
// The distance functions live only in the shader now. The JS copies they were
// ported from stopped being called when the marching moved to the GPU; they
// are in legacy/ with the rest of the CPU path.

const shapeNames = [
  "sphere",
  "box",
  "torus",
  "cylinder",
  "octahedron",
  "icosahedron",
  "dodecahedron",
  // The shader switches on each name's position here, with the numbers
  // written into shapeDistance: change the order and they must change too.
  "trefoil",
  "mobius",
  "suzanne",
  "sphube",
  "goursat",
  "gyroid",
  "tetrahedron",
  "cinquefoil",
  "torus knot",
  "arc",
  "spike ball",
  "pretzel",
  "star",
  "stella",
];

export { shapeNames };
