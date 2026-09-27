import { MAX_BLOBS } from "modules/blobMotion.js";
import { shapes } from "shaders/shapes.js";

// The scalar field. The marching, the core and the shadow ray all read what
// this produces, so it is the single definition of where the surface is.
// Ported from legacy/metaballs.js, which no longer runs.
const field = `
#define FIELD_SUBTRACT 12.0
#define FIELD_EPSILON 0.000001

uniform int uShape;
uniform float uShapeSize;
uniform float uShapeThickness;
uniform float uShapeRounding;
uniform float uShapeHeight;
uniform vec3 uAxisTwist;
uniform int uNumBlobs;
uniform float uBlobsOn;
uniform vec3 uBlobs[${MAX_BLOBS}];
uniform float uIsolation;
uniform vec3 uTwistCenter;
uniform vec3 uTwistAxis;
uniform float uTwistStrength;
uniform float uTwistRadius;

// uModelMargin must match BAKE_MARGIN in modules/meshField.js.
uniform sampler3D uModelSDF;
uniform float uModelMargin;
uniform float uModelReady;

vec2 rotate2(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

${shapes}
// The field is queried at the rotated point rather than built and then bent,
// so the marching cubes, the core and the shadow ray all read through this
// and agree about where the surface is.
//
// Gaussian falloff, not a clamped radius: the angle has to reach zero
// smoothly or the edge of the twisted region is a visible seam.
vec3 twistPoint(vec3 p) {
  if (uTwistStrength == 0.0) return p;

  vec3 rel = p - uTwistCenter;
  float d = length(rel) / max(uTwistRadius, 1e-4);
  float angle = uTwistStrength * exp(-d * d);

  vec3 a = normalize(uTwistAxis);
  float s = sin(angle);
  float c = cos(angle);
  return uTwistCenter + rel * c + cross(a, rel) * s + a * dot(a, rel) * (1.0 - c);
}

// Each axis turns the plane across it by an angle that grows along it, from
// minus half the setting at one wall to plus half at the other.
vec3 twistAxes(vec3 p) {
  vec3 c = p - 0.5;
  if (uAxisTwist.x != 0.0) c.yz = rotate2(c.yz, vec2(cos(uAxisTwist.x * c.x), sin(uAxisTwist.x * c.x)));
  if (uAxisTwist.y != 0.0) c.zx = rotate2(c.zx, vec2(cos(uAxisTwist.y * c.y), sin(uAxisTwist.y * c.y)));
  if (uAxisTwist.z != 0.0) c.xy = rotate2(c.xy, vec2(cos(uAxisTwist.z * c.z), sin(uAxisTwist.z * c.z)));
  return c + 0.5;
}

// Each contribution is clamped above zero on its own, not summed and clamped
// at the end: that is what gives a ball a finite extent instead of a tail
// across the whole grid.
float fieldAt(vec3 p) {
  p = twistPoint(twistAxes(p));

  float strength = 1.2 / ((sqrt(float(uNumBlobs)) - 1.0) / 4.0 + 1.0);
  float value = 0.0;

  if (uShape != 0) {
    // The falloff puts the isosurface a little outside what it is measured from,
    // so the size asked for is reduced by that much first.
    float surfaceOffset = sqrt(strength / (uIsolation + FIELD_SUBTRACT));
    float core = max(uShapeSize - surfaceOffset, 0.0);

    // Changing this swizzle turns every shape onto a different axis.
    vec3 d3 = (p - 0.5).yzx;
    float d = max(shapeDistance(d3, core, uShapeThickness, surfaceOffset), 0.0);
    float v = strength / (FIELD_EPSILON + d * d) - FIELD_SUBTRACT;
    if (v > 0.0) value += v;
  }

  if (uBlobsOn > 0.5) {
    for (int i = 0; i < ${MAX_BLOBS}; i++) {
      if (i >= uNumBlobs) break;
      vec3 delta = p - uBlobs[i];
      float v = strength / (FIELD_EPSILON + dot(delta, delta)) - FIELD_SUBTRACT;
      if (v > 0.0) value += v;
    }
  }

  return value;
}
`;

export { field };
