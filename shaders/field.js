// The scalar field. The marching, the core and the shadow ray all read what
// this produces, so it is the single definition of where the surface is.
// Ported from legacy/metaballs.js, which no longer runs.
const field = `
#define FIELD_SUBTRACT 12.0
#define FIELD_EPSILON 0.000001

uniform int uShape;
uniform float uShapeSize;
uniform float uShapeThickness;
uniform int uNumBlobs;
uniform float uBlobsOn;
uniform float uTime;
uniform float uIsolation;
uniform vec3 uTwistCenter;
uniform vec3 uTwistAxis;
uniform float uTwistStrength;
uniform float uTwistRadius;

const float PHI = 1.618033988749895;

// Same order as the GDF array on the JS side, so the same index ranges pick
// the same solids.
vec3 gdfNormal(int i) {
  if (i == 0) return normalize(vec3(1.0, 1.0, 1.0));
  if (i == 1) return normalize(vec3(-1.0, 1.0, 1.0));
  if (i == 2) return normalize(vec3(1.0, -1.0, 1.0));
  if (i == 3) return normalize(vec3(1.0, 1.0, -1.0));
  if (i == 4) return normalize(vec3(0.0, 1.0, PHI + 1.0));
  if (i == 5) return normalize(vec3(0.0, -1.0, PHI + 1.0));
  if (i == 6) return normalize(vec3(PHI + 1.0, 0.0, 1.0));
  if (i == 7) return normalize(vec3(-PHI - 1.0, 0.0, 1.0));
  if (i == 8) return normalize(vec3(1.0, PHI + 1.0, 0.0));
  if (i == 9) return normalize(vec3(-1.0, PHI + 1.0, 0.0));
  if (i == 10) return normalize(vec3(0.0, PHI, 1.0));
  if (i == 11) return normalize(vec3(0.0, -PHI, 1.0));
  if (i == 12) return normalize(vec3(1.0, 0.0, PHI));
  if (i == 13) return normalize(vec3(-1.0, 0.0, PHI));
  if (i == 14) return normalize(vec3(PHI, 1.0, 0.0));
  return normalize(vec3(-PHI, 1.0, 0.0));
}

float gdf(vec3 p, int from, int to, float r) {
  float d = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i < from) continue;
    if (i >= to) break;
    d = max(d, abs(dot(p, gdfNormal(i))));
  }
  return d - r;
}

float shapeDistance(vec3 p, float size, float thickness) {
  if (uShape == 1) return length(p) - size;

  if (uShape == 2) {
    vec3 q = max(abs(p) - size, 0.0);
    float outside = length(q);
    float inside = min(max(abs(p.x) - size, max(abs(p.y) - size, abs(p.z) - size)), 0.0);
    return outside + inside - thickness;
  }

  if (uShape == 3) return length(vec2(length(p.xy) - size, p.z)) - thickness;

  if (uShape == 4) {
    float d = length(p.xy) - size;
    float h = abs(p.z) - thickness;
    return min(max(d, h), 0.0) + length(max(vec2(d, h), 0.0));
  }

  if (uShape == 5) return gdf(p, 0, 4, size) - thickness;
  if (uShape == 6) return gdf(p, 0, 10, size) - thickness;
  if (uShape == 7) return gdf(p, 10, 16, size) - thickness;

  return 1e9;
}

// Closed form on the JS side too, so the positions need no uploading and
// agree as long as both are handed the same time.
vec3 blobAt(int i, float time) {
  float fi = float(i);
  return vec3(
    sin(fi + 1.26 * time * (1.03 + 0.5 * cos(0.21 * fi))) * 0.27 + 0.5,
    cos(fi + 1.12 * time * 0.21 * sin(0.72 + 0.83 * fi)) * 0.27 + 0.5,
    cos(fi + 1.32 * time * 0.1 * sin(0.92 + 0.53 * fi)) * 0.27 + 0.5
  );
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
float fieldAt(vec3 p) {
  p = twistPoint(p);

  float strength = 1.2 / ((sqrt(float(uNumBlobs)) - 1.0) / 4.0 + 1.0);
  float value = 0.0;

  if (uShape != 0) {
    // The falloff puts the isosurface a little outside what it is measured from,
    // so the size asked for is reduced by that much first.
    float surfaceOffset = sqrt(strength / (uIsolation + FIELD_SUBTRACT));
    float core = max(uShapeSize - surfaceOffset, 0.0);
    float coreThickness = max(uShapeThickness - surfaceOffset, 0.0);

    // currentShape() passes (y, z, x), so the same rotation has to happen here
    // or every shape comes out on a different axis than the one polygonised.
    vec3 d3 = (p - 0.5).yzx;
    float d = max(shapeDistance(d3, core, coreThickness), 0.0);
    float v = strength / (FIELD_EPSILON + d * d) - FIELD_SUBTRACT;
    if (v > 0.0) value += v;
  }

  if (uBlobsOn > 0.5) {
    for (int i = 0; i < 64; i++) {
      if (i >= uNumBlobs) break;
      vec3 b = blobAt(i, uTime);
      vec3 delta = p - b;
      float v = strength / (FIELD_EPSILON + dot(delta, delta)) - FIELD_SUBTRACT;
      if (v > 0.0) value += v;
    }
  }

  return value;
}
`;

export { field };
