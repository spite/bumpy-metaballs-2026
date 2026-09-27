import { polyhedronDistance } from "modules/polyhedra.js";
import { shapeIndex } from "modules/sdf.js";

// The shapes a scene can add to the field. Spliced into shaders/field.js, whose
// uniforms and rotate2 it uses, so it only compiles there.
const shapes = `
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

// Every knot here lies inside the torus of ring 2 around its axis: the torus
// knots on its tube of 1, the trefoil out to 1.0804. Past reach the field is
// zero and this bound stands in for the search.
float knotBound(vec3 q) {
  return length(vec2(length(q.xy) - 2.0, q.z)) - 1.09;
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

vec3 knotAt(int curve, float t, float P, float Q) {
  return curve == 0 ? trefoilAt(t) : torusKnotAt(t, P, Q);
}

vec3 knotVelocity(int curve, float t, float P, float Q) {
  return curve == 0 ? trefoilVelocity(t) : torusKnotVelocity(t, P, Q);
}

vec3 knotAcceleration(int curve, float t, float P, float Q) {
  return curve == 0 ? trefoilAcceleration(t) : torusKnotAcceleration(t, P, Q);
}

// Samples stepped by turning cos and sin of each multiple of t rather than
// calling them: the trefoil needs t, 2t and 3t, a torus knot Pt and Qt.
vec3 knotSample(int curve, vec2 a1, vec2 a2, vec2 a3) {
  if (curve == 0) return vec3(a1.y + 2.0 * a2.y, a1.x - 2.0 * a2.x, -a3.y);
  float r = a2.x + 2.0;
  return vec3(r * a1.x, r * a1.y, -a2.y);
}

// Newton, not bracket halving: halving leaves an error that repeats along the
// knot and shows as rings at high resolution. Curve 0 is the trefoil; 1 is the
// (P, Q) torus knot, about twice as long, so twice the samples.
float sdKnot(vec3 p, float size, float thickness, float reach, int curve, float P, float Q) {
  float k = 3.0 / max(size, 1e-4);
  vec3 q = p * k;
  float bound = knotBound(q) / k - thickness;
  if (bound >= reach) return bound;

  int samples = curve == 0 ? 32 : 64;
  float dt = 6.2831853 / float(samples);
  vec3 m = curve == 0 ? vec3(1.0, 2.0, 3.0) : vec3(P, Q, 0.0);
  vec2 turn1 = vec2(cos(m.x * dt), sin(m.x * dt));
  vec2 turn2 = vec2(cos(m.y * dt), sin(m.y * dt));
  vec2 turn3 = vec2(cos(m.z * dt), sin(m.z * dt));

  vec2 a1 = vec2(1.0, 0.0);
  vec2 a2 = vec2(1.0, 0.0);
  vec2 a3 = vec2(1.0, 0.0);
  float best = 1e9;
  int bestI = 0;
  for (int i = 0; i < 64; i++) {
    if (i >= samples) break;
    vec3 d = q - knotSample(curve, a1, a2, a3);
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
  for (int i = 0; i < 64; i++) {
    if (i >= samples) break;
    int gap = abs(i - bestI);
    if (min(gap, samples - gap) > 3) {
      vec3 d = q - knotSample(curve, a1, a2, a3);
      float d2 = dot(d, d);
      if (d2 < other) { other = d2; otherI = i; }
    }
    a1 = rotate2(a1, turn1);
    a2 = rotate2(a2, turn2);
    a3 = rotate2(a3, turn3);
  }

  float nearest = min(best, other);
  for (int c = 0; c < 2; c++) {
    float t = float(c == 0 ? bestI : otherI) * dt;
    for (int i = 0; i < 3; i++) {
      vec3 r = knotAt(curve, t, P, Q) - q;
      vec3 v = knotVelocity(curve, t, P, Q);
      float bend = dot(v, v) + dot(r, knotAcceleration(curve, t, P, Q));
      if (bend > 0.0) t -= clamp(dot(r, v) / bend, -dt, dt);
    }
    vec3 r = knotAt(curve, t, P, Q) - q;
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

  if (uShape == ${shapeIndex("sphere")}) return length(p) - size;

  if (uShape == ${shapeIndex("box")}) {
    float r = min(uShapeRounding, size + offset);
    float s = size + offset - r;
    vec3 q = max(abs(p) - s, 0.0);
    float inside = min(max(abs(p.x) - s, max(abs(p.y) - s, abs(p.z) - s)), 0.0);
    return length(q) + inside - r + offset;
  }

  if (uShape == ${shapeIndex("torus")}) return length(vec2(length(p.xy) - (size + offset), p.z)) - thickness + offset;

  if (uShape == ${shapeIndex("cylinder")}) {
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
  if (uShape == ${shapeIndex("octahedron")}) return sdPolyhedron0(p, inner, far) - r + offset;
  if (uShape == ${shapeIndex("icosahedron")}) return sdPolyhedron1(p, inner, far) - r + offset;
  if (uShape == ${shapeIndex("dodecahedron")}) return sdPolyhedron2(p, inner, far) - r + offset;
  if (uShape == ${shapeIndex("tetrahedron")}) {
    float faces = (size + offset) / 1.7320508;
    float rt = min(uShapeRounding, faces);
    return sdPolyhedron3(p, faces - rt, far - r + rt) - rt + offset;
  }

  if (uShape == ${shapeIndex("trefoil")}) return sdKnot(p, size + offset, thickness, reach, 0, 0.0, 0.0) + offset;
  if (uShape == ${shapeIndex("mobius")}) return sdMobius(p, size + offset, thickness) + offset;
  if (uShape == ${shapeIndex("suzanne")}) return sdModel(p, size, offset);

  float full = size + offset;
  if (uShape == ${shapeIndex("sphube")}) return sdSphube(p, full, 1.0 - clamp(uShapeRounding / full, 0.0, 1.0)) + offset;
  if (uShape == ${shapeIndex("goursat")}) return sdGoursat(p, full) + offset;
  if (uShape == ${shapeIndex("gyroid")}) return sdGyroid(p, full, thickness) + offset;
  if (uShape == ${shapeIndex("cinquefoil")}) return sdKnot(p, full, thickness, reach, 1, 2.0, 5.0) + offset;
  if (uShape == ${shapeIndex("torus knot")}) return sdKnot(p, full, thickness, reach, 1, 3.0, 4.0) + offset;
  if (uShape == ${shapeIndex("arc")}) return sdArc(p, full, thickness) + offset;
  if (uShape == ${shapeIndex("spike ball")}) return sdSpikeBall(p, full, thickness, reach) + offset;
  if (uShape == ${shapeIndex("pretzel")}) return sdPretzel(p, full) + offset;
  if (uShape == ${shapeIndex("star")}) return sdRoundStar(p, full) + offset;
  if (uShape == ${shapeIndex("stella")}) {
    float faces = full / 3.0;
    float rs = min(uShapeRounding, faces);
    float d = min(sdPolyhedron3(p, faces - rs, reach + rs), sdPolyhedron3(-p, faces - rs, reach + rs));
    return d - rs + offset;
  }

  return 1e9;
}
`;

export { shapes };
