import { MAX_BLOBS } from "modules/blobMotion.js";
import { polyhedronDistance } from "modules/polyhedra.js";

const TREFOIL_SAMPLES = 32;
const TREFOIL_STEP = (2 * Math.PI) / TREFOIL_SAMPLES;

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

${polyhedronDistance}

vec3 trefoilAt(float t) {
  return vec3(
    sin(t) + 2.0 * sin(2.0 * t),
    cos(t) - 2.0 * cos(2.0 * t),
    -sin(3.0 * t)
  );
}

vec3 trefoilVelocity(float t) {
  return vec3(cos(t) + 4.0 * cos(2.0 * t), -sin(t) + 4.0 * sin(2.0 * t), -3.0 * cos(3.0 * t));
}

vec3 trefoilAcceleration(float t) {
  return vec3(-sin(t) - 8.0 * sin(2.0 * t), -cos(t) + 8.0 * cos(2.0 * t), 9.0 * sin(3.0 * t));
}

vec2 rotate2(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// Newton, not bracket halving: halving leaves an error that repeats along the
// knot and shows as rings at high resolution.
// Every knot here lies inside the torus of ring 2 around its axis: the torus
// knots on its tube of 1, the trefoil out to 1.0804. Past reach the field is
// zero and this bound stands in for the search.
float knotBound(vec3 q) {
  return length(vec2(length(q.xy) - 2.0, q.z)) - 1.09;
}

float sdTrefoil(vec3 p, float size, float thickness, float reach) {
  float k = 3.0 / max(size, 1e-4);
  vec3 q = p * k;
  float bound = knotBound(q) / k - thickness;
  if (bound >= reach) return bound;

  const int SAMPLES = ${TREFOIL_SAMPLES};
  const float STEP = ${(TREFOIL_STEP).toFixed(10)};
  const vec2 turn1 = vec2(${Math.cos(TREFOIL_STEP).toFixed(10)}, ${Math.sin(TREFOIL_STEP).toFixed(10)});
  const vec2 turn2 = vec2(${Math.cos(2 * TREFOIL_STEP).toFixed(10)}, ${Math.sin(2 * TREFOIL_STEP).toFixed(10)});
  const vec2 turn3 = vec2(${Math.cos(3 * TREFOIL_STEP).toFixed(10)}, ${Math.sin(3 * TREFOIL_STEP).toFixed(10)});

  vec2 a1 = vec2(1.0, 0.0);
  vec2 a2 = vec2(1.0, 0.0);
  vec2 a3 = vec2(1.0, 0.0);
  float best = 1e9;
  int bestI = 0;
  for (int i = 0; i < SAMPLES; i++) {
    vec3 d = q - vec3(a1.y + 2.0 * a2.y, a1.x - 2.0 * a2.x, -a3.y);
    float d2 = dot(d, d);
    if (d2 < best) { best = d2; bestI = i; }
    a1 = rotate2(a1, turn1);
    a2 = rotate2(a2, turn2);
    a3 = rotate2(a3, turn3);
  }

  // Where strands pass close the nearest sample can be on the wrong one.
  a1 = vec2(1.0, 0.0);
  a2 = vec2(1.0, 0.0);
  a3 = vec2(1.0, 0.0);
  float other = 1e9;
  int otherI = 0;
  for (int i = 0; i < SAMPLES; i++) {
    int gap = abs(i - bestI);
    if (min(gap, SAMPLES - gap) > 3) {
      vec3 d = q - vec3(a1.y + 2.0 * a2.y, a1.x - 2.0 * a2.x, -a3.y);
      float d2 = dot(d, d);
      if (d2 < other) { other = d2; otherI = i; }
    }
    a1 = rotate2(a1, turn1);
    a2 = rotate2(a2, turn2);
    a3 = rotate2(a3, turn3);
  }

  float nearest = min(best, other);
  for (int c = 0; c < 2; c++) {
    float t = float(c == 0 ? bestI : otherI) * STEP;
    for (int i = 0; i < 3; i++) {
      vec3 r = trefoilAt(t) - q;
      vec3 v = trefoilVelocity(t);
      float slope = dot(r, v);
      float curve = dot(v, v) + dot(r, trefoilAcceleration(t));
      if (curve > 0.0) t -= clamp(slope / curve, -STEP, STEP);
    }
    vec3 r = trefoilAt(t) - q;
    nearest = min(nearest, dot(r, r));
  }

  return (sqrt(nearest) - thickness * k) / k;
}

// The 0.8 corrects for the twisting frame not being a rigid motion, so the box
// distance measured in it overstates the real one.
float sdMobius(vec3 p, float size, float thickness) {
  float radius = size;
  float width = size * 0.4;
  float rounding = min(thickness, width);

  float angle = atan(p.y, p.x);
  float twist = 0.5 * angle;
  float tc = cos(twist);
  float ts = sin(twist);

  float qx = length(p.xy) - radius;
  float qy = p.z;

  float rx = tc * qx - ts * qy;
  float ry = ts * qx + tc * qy;

  vec2 d = vec2(abs(rx) - width, abs(ry) - thickness) + rounding;
  return (length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - rounding) * 0.8;
}

// Squareness 0 is a sphere and 1 the cube it is bounded by.
float sdSphube(vec3 p, float radius, float squareness) {
  vec3 q = p / max(radius, 1e-4);
  vec3 q2 = q * q;
  float s2 = squareness * squareness;
  float potential = dot(q2, vec3(1.0))
    - s2 * (q2.x * q2.y + q2.y * q2.z + q2.z * q2.x)
    + s2 * s2 * q2.x * q2.y * q2.z - 1.0;
  vec3 grad = 2.0 * q * (1.0 - s2 * (q2.yxx + q2.zzy) + s2 * s2 * q2.yxx * q2.zzy);
  float d = potential / max(length(grad), 1e-3) * radius;

  vec3 b = abs(p) - radius;
  float box = length(max(b, 0.0)) + min(max(b.x, max(b.y, b.z)), 0.0);
  return max(d, box);
}

float goursat(vec3 q, out vec3 grad) {
  vec3 q2 = q * q;
  grad = 4.0 * q * q2 - 10.0 * q;
  return dot(q2, q2) - 5.0 * dot(q2, vec3(1.0)) + 11.8;
}

// Value over gradient alone is only first order, and the quartic bends enough
// that it bulges and pinches the surface; near it, Newton steps onto it give a
// real distance.
float sdGoursat(vec3 p, float size) {
  float k = 2.0 / max(size, 1e-4);
  vec3 q = p * k;
  vec3 g;
  float f = goursat(q, g);
  float d = f / max(length(g), 1e-3);

  if (abs(d) < 1.0) {
    vec3 x = q;
    for (int i = 0; i < 6; i++) {
      vec3 gi;
      float fi = goursat(x, gi);
      float g2 = dot(gi, gi);
      if (g2 < 1e-6) break;
      vec3 move = gi * (fi / g2);
      float len = length(move);
      x -= len > 0.3 ? move * (0.3 / len) : move;
    }
    vec3 gx;
    if (abs(goursat(x, gx)) < 0.05) d = sign(f) * length(q - x);
  }
  return d / k;
}

float sdGyroid(vec3 p, float radius, float thickness) {
  float w = 6.0 / max(radius, 1e-4);
  vec3 q = p * w;
  float g = dot(sin(q), cos(q.yzx));
  vec3 grad = cos(q) * cos(q.yzx) - sin(q) * sin(q.zxy);
  float sheet = abs(g) / max(length(grad) * w, 1e-4) - thickness;
  float ball = length(p) - radius;
  float k = 0.25 * radius;
  float h = clamp(0.5 - 0.5 * (ball - sheet) / k, 0.0, 1.0);
  return mix(ball, sheet, h) + k * h * (1.0 - h);
}

vec3 torusKnotAt(float t, float P, float Q) {
  float r = cos(Q * t) + 2.0;
  return vec3(r * cos(P * t), r * sin(P * t), -sin(Q * t));
}

vec3 torusKnotVelocity(float t, float P, float Q) {
  float r = cos(Q * t) + 2.0;
  float dr = -Q * sin(Q * t);
  return vec3(
    dr * cos(P * t) - P * r * sin(P * t),
    dr * sin(P * t) + P * r * cos(P * t),
    -Q * cos(Q * t)
  );
}

vec3 torusKnotAcceleration(float t, float P, float Q) {
  float r = cos(Q * t) + 2.0;
  float dr = -Q * sin(Q * t);
  float ddr = -Q * Q * cos(Q * t);
  return vec3(
    ddr * cos(P * t) - 2.0 * P * dr * sin(P * t) - P * P * r * cos(P * t),
    ddr * sin(P * t) + 2.0 * P * dr * cos(P * t) - P * P * r * sin(P * t),
    Q * Q * sin(Q * t)
  );
}

// The trefoil's search for any (P, Q): twice the samples, because the curve is
// about twice as long.
float sdTorusKnot(vec3 p, float size, float thickness, float P, float Q, float reach) {
  float k = 3.0 / max(size, 1e-4);
  vec3 q = p * k;
  float bound = knotBound(q) / k - thickness;
  if (bound >= reach) return bound;

  const int SAMPLES = 64;
  const float STEP = 6.2831853 / 64.0;
  vec2 turnP = vec2(cos(P * STEP), sin(P * STEP));
  vec2 turnQ = vec2(cos(Q * STEP), sin(Q * STEP));

  vec2 aP = vec2(1.0, 0.0);
  vec2 aQ = vec2(1.0, 0.0);
  float best = 1e9;
  int bestI = 0;
  for (int i = 0; i < SAMPLES; i++) {
    float r = aQ.x + 2.0;
    vec3 d = q - vec3(r * aP.x, r * aP.y, -aQ.y);
    float d2 = dot(d, d);
    if (d2 < best) { best = d2; bestI = i; }
    aP = rotate2(aP, turnP);
    aQ = rotate2(aQ, turnQ);
  }

  aP = vec2(1.0, 0.0);
  aQ = vec2(1.0, 0.0);
  float other = 1e9;
  int otherI = 0;
  for (int i = 0; i < SAMPLES; i++) {
    int gap = abs(i - bestI);
    if (min(gap, SAMPLES - gap) > 3) {
      float r = aQ.x + 2.0;
      vec3 d = q - vec3(r * aP.x, r * aP.y, -aQ.y);
      float d2 = dot(d, d);
      if (d2 < other) { other = d2; otherI = i; }
    }
    aP = rotate2(aP, turnP);
    aQ = rotate2(aQ, turnQ);
  }

  float nearest = min(best, other);
  for (int c = 0; c < 2; c++) {
    float t = float(c == 0 ? bestI : otherI) * STEP;
    for (int i = 0; i < 3; i++) {
      vec3 r = torusKnotAt(t, P, Q) - q;
      vec3 v = torusKnotVelocity(t, P, Q);
      float curve = dot(v, v) + dot(r, torusKnotAcceleration(t, P, Q));
      if (curve > 0.0) t -= clamp(dot(r, v) / curve, -STEP, STEP);
    }
    vec3 r = torusKnotAt(t, P, Q) - q;
    nearest = min(nearest, dot(r, r));
  }

  return (sqrt(nearest) - thickness * k) / k;
}

float sdArc(vec3 p, float radius, float thickness) {
  const vec2 opening = vec2(0.8084964, -0.5885011);
  p.x = abs(p.x);
  float k = opening.y * p.x > opening.x * p.y ? dot(p.xy, opening) : length(p.xy);
  return sqrt(dot(p, p) + radius * radius - 2.0 * radius * k) - thickness;
}

float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr * rr;
  float il2 = 1.0 / l2;
  vec3 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  vec3 xv = pa * l2 - ba * y;
  float x2 = dot(xv, xv);
  float y2 = y * y * l2;
  float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

float smoothUnion(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Spikes on a spherical Fibonacci lattice, each direction the last one turned
// by the golden angle.
float sdSpikeBall(vec3 p, float size, float thickness, float reach) {
  float bound = length(p) - size - thickness;
  if (bound >= reach) return bound;

  const int SPIKES = 40;
  const vec2 golden = vec2(-0.7373688, 0.6754903);
  float core = 0.6 * size;
  vec2 turn = vec2(1.0, 0.0);
  float spikes = 1e9;
  for (int i = 0; i < SPIKES; i++) {
    float z = 1.0 - (2.0 * float(i) + 1.0) / float(SPIKES);
    float r = sqrt(1.0 - z * z);
    vec3 dir = vec3(r * turn.x, r * turn.y, z);
    spikes = min(spikes, sdRoundCone(p, dir * core * 0.5, dir * size, thickness, thickness * 0.2));
    turn = rotate2(turn, golden);
  }
  return smoothUnion(length(p) - core, spikes, 0.5 * thickness);
}

float sdRoundStar(vec3 p, float size) {
  vec3 a = abs(p);
  float arm = 0.26 * size;
  float tip = 0.05 * size;
  float arms = sdRoundCone(a, vec3(0.0), vec3(size, 0.0, 0.0), arm, tip);
  arms = min(arms, sdRoundCone(a, vec3(0.0), vec3(0.0, size, 0.0), arm, tip));
  arms = min(arms, sdRoundCone(a, vec3(0.0), vec3(0.0, 0.0, size), arm, tip));
  return smoothUnion(length(p) - 0.42 * size, arms, 0.12 * size);
}

float pretzel(vec3 q) {
  vec3 q2 = q * q;
  float a = q2.x * (1.0 - q2.x) - q2.y;
  return a * a + 0.5 * q2.z - 0.01 * (1.0 + 2.0 * dot(q2, vec3(1.0)));
}

vec3 pretzelGradient(vec3 q) {
  const vec2 e = vec2(1e-3, 0.0);
  return vec3(
    pretzel(q + e.xyy) - pretzel(q - e.xyy),
    pretzel(q + e.yxy) - pretzel(q - e.yxy),
    pretzel(q + e.yyx) - pretzel(q - e.yyx)
  ) / (2.0 * e.x);
}

// Same approach as the Goursat: value over gradient far out, Newton onto the
// surface near it.
float sdPretzel(vec3 p, float size) {
  float k = 1.1 / max(size, 1e-4);
  vec3 q = p * k;
  float f = pretzel(q);
  float d = f / max(length(pretzelGradient(q)), 1e-3);

  if (abs(d) < 0.5) {
    vec3 x = q;
    for (int i = 0; i < 6; i++) {
      float fi = pretzel(x);
      vec3 gi = pretzelGradient(x);
      float g2 = dot(gi, gi);
      if (g2 < 1e-8) break;
      vec3 move = gi * (fi / g2);
      float len = length(move);
      x -= len > 0.2 ? move * (0.2 / len) : move;
    }
    if (abs(pretzel(x)) < 0.02) d = sign(f) * length(q - x);
  }
  return d / k;
}

float sdModel(vec3 p, float size, float offset) {
  // Sampling an unbound sampler3D returns 0, which reads as on the surface and
  // fills the grid solid until the bake lands.
  if (uModelReady < 0.5) return 1e9;

  // Added, not cancelled by shrinking size the way the other shapes do: scaling
  // a model down does not erode it, so without this the field's dilation rounds
  // every feature away.
  float fullSize = size + offset;
  float k = 1.0 / max(fullSize, 1e-4);
  vec3 q = p * k;

  // Must agree with the sampled value at the wall, or the mesher finds a
  // surface there.
  vec3 inside = clamp(q, vec3(-uModelMargin), vec3(uModelMargin));
  float beyond = length(q - inside);

  // Texel centres, not edges: the bake put sample i at (i + 0.5) / N.
  float n = float(textureSize(uModelSDF, 0).x);
  vec3 t = (inside + uModelMargin) / (2.0 * uModelMargin);
  vec3 uv = (t * (n - 1.0) + 0.5) / n;

  return (texture(uModelSDF, uv).r + beyond) / k + offset;
}

// Rounding is applied to the finished surface, not the core: from the core,
// the surface offset alone rounds every edge and zero cannot be sharp.
float shapeDistance(vec3 p, float size, float thickness, float offset) {
  // Where strength / d^2 falls to the subtracted constant, less the offset the
  // literal shapes add back.
  float reach = offset * sqrt((uIsolation + FIELD_SUBTRACT) / FIELD_SUBTRACT) - offset;

  if (uShape == 1) return length(p) - size;

  if (uShape == 2) {
    float r = min(uShapeRounding, size + offset);
    float s = size + offset - r;
    vec3 q = max(abs(p) - s, 0.0);
    float inside = min(max(abs(p.x) - s, max(abs(p.y) - s, abs(p.z) - s)), 0.0);
    return length(q) + inside - r + offset;
  }

  if (uShape == 3) return length(vec2(length(p.xy) - (size + offset), p.z)) - thickness + offset;

  if (uShape == 4) {
    float halfHeight = 0.5 * uShapeHeight;
    float r = min(uShapeRounding, min(size + offset, halfHeight));
    float d = length(p.xy) - (size + offset - r);
    float h = abs(p.z) - (halfHeight - r);
    return min(max(d, h), 0.0) + length(max(vec2(d, h), 0.0)) - r + offset;
  }

  float r = min(uShapeRounding, size + offset);
  float inner = size + offset - r;
  // Where strength / d^2 falls to the subtracted constant.
  float far = offset * sqrt((uIsolation + FIELD_SUBTRACT) / FIELD_SUBTRACT) + r - offset;
  if (uShape == 5) return sdPolyhedron0(p, inner, far) - r + offset;
  if (uShape == 6) return sdPolyhedron1(p, inner, far) - r + offset;
  if (uShape == 7) return sdPolyhedron2(p, inner, far) - r + offset;
  if (uShape == 14) {
    float faces = (size + offset) / 1.7320508;
    float rt = min(uShapeRounding, faces);
    return sdPolyhedron3(p, faces - rt, far - r + rt) - rt + offset;
  }

  if (uShape == 8) return sdTrefoil(p, size + offset, thickness, reach) + offset;
  if (uShape == 9) return sdMobius(p, size + offset, thickness) + offset;
  if (uShape == 10) return sdModel(p, size, offset);

  float full = size + offset;
  if (uShape == 11) return sdSphube(p, full, 1.0 - clamp(uShapeRounding / full, 0.0, 1.0)) + offset;
  if (uShape == 12) return sdGoursat(p, full) + offset;
  if (uShape == 13) return sdGyroid(p, full, thickness) + offset;
  if (uShape == 15) return sdTorusKnot(p, full, thickness, 2.0, 5.0, reach) + offset;
  if (uShape == 16) return sdTorusKnot(p, full, thickness, 3.0, 4.0, reach) + offset;
  if (uShape == 17) return sdArc(p, full, thickness) + offset;
  if (uShape == 18) return sdSpikeBall(p, full, thickness, reach) + offset;
  if (uShape == 19) return sdPretzel(p, full) + offset;
  if (uShape == 20) return sdRoundStar(p, full) + offset;
  if (uShape == 21) {
    float faces = full / 3.0;
    float rs = min(uShapeRounding, faces);
    float d = min(sdPolyhedron3(p, faces - rs, reach + rs), sdPolyhedron3(-p, faces - rs, reach + rs));
    return d - rs + offset;
  }

  return 1e9;
}

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

// Each contribution is clamped above zero on its own, not summed and clamped
// at the end: that is what gives a ball a finite extent instead of a tail
// across the whole grid.
// Each axis turns the plane across it by an angle that grows along it, from
// minus half the setting at one wall to plus half at the other.
vec3 twistAxes(vec3 p) {
  vec3 c = p - 0.5;
  if (uAxisTwist.x != 0.0) c.yz = rotate2(c.yz, vec2(cos(uAxisTwist.x * c.x), sin(uAxisTwist.x * c.x)));
  if (uAxisTwist.y != 0.0) c.zx = rotate2(c.zx, vec2(cos(uAxisTwist.y * c.y), sin(uAxisTwist.y * c.y)));
  if (uAxisTwist.z != 0.0) c.xy = rotate2(c.xy, vec2(cos(uAxisTwist.z * c.z), sin(uAxisTwist.z * c.z)));
  return c + 0.5;
}

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
