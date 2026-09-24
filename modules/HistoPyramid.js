import {
  FloatType,
  GLSL3,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RGBAFormat,
  RGFormat,
  Scene,
  Vector2,
  WebGLRenderTarget,
} from "three";

// The march draws only as many vertices as the surface has, and each finds its
// voxel by walking down this pyramid of counts. Voxels are laid out in a
// square 2D base so every level halves both sides; each texel of level k
// holds the totals of its four children in rgba.
//
// Levels share two atlases, odd and even, because three counts vertex and
// fragment samplers against one limit of 16 and a sampler per level spent
// most of it. Alternating means a level is never read from the texture it is
// being written into.
const MAX_LEVELS = 11;

const vertexShader = `precision highp float;
in vec3 position;
void main() {
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}
`;

const baseFragmentShader = `precision highp float;
precision highp int;
precision highp sampler3D;
precision highp isampler2D;

uniform sampler3D uField;
uniform isampler2D uTriTable;
uniform int uGrid;
uniform int uWidth;
uniform float uIsolation;

out vec4 fragColor;

float corner(int x, int y, int z) {
  return textureLod(uField, (vec3(x, y, z) + 0.5) / float(uGrid), 0.0).r;
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int n = uGrid;
  int i = texel.y * uWidth + texel.x;
  int z = i / (n * n);
  int rest = i - z * n * n;
  int y = rest / n;
  int x = rest - y * n;

  if (x >= n - 1 || y >= n - 1 || z >= n - 1) {
    fragColor = vec4(0.0);
    return;
  }

  int cube = 0;
  if (corner(x, y, z) < uIsolation) cube |= 1;
  if (corner(x + 1, y, z) < uIsolation) cube |= 2;
  if (corner(x + 1, y + 1, z) < uIsolation) cube |= 4;
  if (corner(x, y + 1, z) < uIsolation) cube |= 8;
  if (corner(x, y, z + 1) < uIsolation) cube |= 16;
  if (corner(x + 1, y, z + 1) < uIsolation) cube |= 32;
  if (corner(x + 1, y + 1, z + 1) < uIsolation) cube |= 64;
  if (corner(x, y + 1, z + 1) < uIsolation) cube |= 128;

  int count = texelFetch(uTriTable, ivec2(15, cube), 0).r;
  fragColor = vec4(float(cube), float(count), 0.0, 0.0);
}
`;

const reduceFragmentShader = `precision highp float;

uniform sampler2D uSource;
uniform bool uFromBase;
uniform ivec2 uSourceOffset;
uniform ivec2 uTargetOffset;

out vec4 fragColor;

float total(ivec2 p) {
  vec4 c = texelFetch(uSource, p, 0);
  return uFromBase ? c.g : c.r + c.g + c.b + c.a;
}

void main() {
  ivec2 p = (ivec2(gl_FragCoord.xy) - uTargetOffset) * 2 + uSourceOffset;
  fragColor = vec4(
    total(p),
    total(p + ivec2(1, 0)),
    total(p + ivec2(0, 1)),
    total(p + ivec2(1, 1))
  );
}
`;

const levelSteps = Array.from({ length: MAX_LEVELS }, (_, i) => MAX_LEVELS - i)
  .map(
    (k) =>
      `  if (pyramidLevels >= ${k} && !descend(pyramid${k % 2 ? "Odd" : "Even"}, pyramidOffsets[${k}], texel, slot)) return false;`,
  )
  .join("\n");

// Finds the voxel holding vertex slot and leaves slot as the index within it.
// Only the top level can be out of range, which is a vertex past the end of
// the surface.
const pyramidTraversal = `
uniform sampler2D pyramidBase;
uniform sampler2D pyramidOdd;
uniform sampler2D pyramidEven;
uniform ivec2 pyramidOffsets[${MAX_LEVELS + 1}];
uniform int pyramidLevels;
uniform int pyramidWidth;

bool descend(sampler2D atlas, ivec2 offset, inout ivec2 texel, inout int slot) {
  ivec4 n = ivec4(texelFetch(atlas, offset + texel, 0) + 0.5);
  if (slot >= n.r + n.g + n.b + n.a) return false;

  texel *= 2;
  if (slot < n.r) return true;
  slot -= n.r;
  if (slot < n.g) { texel.x += 1; return true; }
  slot -= n.g;
  if (slot < n.b) { texel.y += 1; return true; }
  slot -= n.b;
  texel += 1;
  return true;
}

bool locate(int vertex, out ivec3 voxel, out int cube, out int slot) {
  ivec2 texel = ivec2(0);
  slot = vertex;
${levelSteps}

  cube = int(texelFetch(pyramidBase, texel, 0).r + 0.5);

  int n = int(gridSize);
  int i = texel.y * pyramidWidth + texel.x;
  int z = i / (n * n);
  int rest = i - z * n * n;
  voxel = ivec3(rest - (rest / n) * n, rest / n, z);
  return true;
}
`;

class HistoPyramid {
  constructor(triTableTexture) {
    this.camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
    this.quad = new Mesh(new PlaneGeometry(1, 1));
    this.quad.frustumCulled = false;
    this.scene = new Scene();
    this.scene.add(this.quad);

    this.baseMaterial = new RawShaderMaterial({
      uniforms: {
        uField: { value: null },
        uTriTable: { value: triTableTexture },
        uGrid: { value: 0 },
        uWidth: { value: 0 },
        uIsolation: { value: 0 },
      },
      vertexShader,
      fragmentShader: baseFragmentShader,
      glslVersion: GLSL3,
    });

    this.reduceMaterial = new RawShaderMaterial({
      uniforms: {
        uSource: { value: null },
        uFromBase: { value: true },
        uSourceOffset: { value: new Vector2() },
        uTargetOffset: { value: new Vector2() },
      },
      vertexShader,
      fragmentShader: reduceFragmentShader,
      glslVersion: GLSL3,
    });

    this.grid = 0;
    this.offsets = new Int32Array((MAX_LEVELS + 1) * 2);
    this.generation = 0;
    this.total = null;
    this.gl = null;
    this.readbacks = [];
  }

  setGrid(grid) {
    if (this.grid === grid) return;

    this.grid = grid;
    this.width = 2 ** Math.ceil(Math.log2(Math.sqrt(grid ** 3)));
    this.levelCount = Math.log2(this.width);

    if (this.levelCount > MAX_LEVELS) {
      throw new Error(`A grid of ${grid} needs more than ${MAX_LEVELS} pyramid levels`);
    }

    const target = (width, height, format) =>
      new WebGLRenderTarget(width, height, {
        format,
        type: FloatType,
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        depthBuffer: false,
        stencilBuffer: false,
      });

    this.dispose(false);
    this.base = target(this.width, this.width, RGFormat);

    // The first level of an atlas fills its left side and the rest stack in a
    // column to its right, which the first is always tall enough to hold.
    this.offsets.fill(0);
    this.atlases = [1, 2].map((first) => {
      const side = this.width >> first;
      let y = 0;
      for (let k = first + 2; k <= this.levelCount; k += 2) {
        this.offsets[k * 2] = side;
        this.offsets[k * 2 + 1] = y;
        y += this.width >> k;
      }
      const column = first + 2 <= this.levelCount ? this.width >> (first + 2) : 0;
      return first <= this.levelCount ? target(side + column, side, RGBAFormat) : null;
    });

    this.invalidate();
  }

  // Past results describe a surface that is gone, so until a fresh count comes
  // back the march has to be drawn at its worst case.
  invalidate() {
    this.generation++;
    this.total = null;
  }

  get maxVertices() {
    return Math.max(0, this.grid - 1) ** 3 * 15;
  }

  // The count read back is about six frames old at 60fps; the margin covers
  // how much the surface can grow in that time while it animates.
  get vertexBudget() {
    if (this.total === null) return this.maxVertices;
    return Math.min(this.maxVertices, Math.ceil(this.total * 1.25) + 1536);
  }

  build(renderer, fieldTexture, isolation) {
    const bu = this.baseMaterial.uniforms;
    bu.uField.value = fieldTexture;
    bu.uGrid.value = this.grid;
    bu.uWidth.value = this.width;
    bu.uIsolation.value = isolation;

    // A clear ignores the viewport, so it would wipe the levels already in the
    // atlas.
    const target = renderer.getRenderTarget();
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;

    this.quad.material = this.baseMaterial;
    renderer.setRenderTarget(this.base);
    renderer.render(this.scene, this.camera);

    const ru = this.reduceMaterial.uniforms;
    this.quad.material = this.reduceMaterial;
    for (let k = 1; k <= this.levelCount; k++) {
      const atlas = this.atlasFor(k);
      const size = this.width >> k;
      ru.uSource.value = k === 1 ? this.base.texture : this.atlasFor(k - 1).texture;
      ru.uFromBase.value = k === 1;
      ru.uSourceOffset.value.set(this.offsets[(k - 1) * 2], this.offsets[(k - 1) * 2 + 1]);
      ru.uTargetOffset.value.set(this.offsets[k * 2], this.offsets[k * 2 + 1]);
      atlas.viewport.set(this.offsets[k * 2], this.offsets[k * 2 + 1], size, size);
      renderer.setRenderTarget(atlas);
      renderer.render(this.scene, this.camera);
    }
    ru.uSource.value = null;
    bu.uField.value = null;

    this.request(renderer);

    renderer.autoClear = autoClear;
    renderer.setRenderTarget(target);
  }

  // A fence per read, checked at the top of each frame, so a count is used on
  // the frame it arrives.
  request(renderer) {
    const gl = (this.gl ??= renderer.getContext());
    this.poll();

    if (this.readbacks.length >= 3) return;

    const top = this.levelCount;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, 16, gl.STREAM_READ);
    renderer.setRenderTarget(this.atlasFor(top));
    gl.readPixels(this.offsets[top * 2], this.offsets[top * 2 + 1], 1, 1, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

    this.readbacks.push({
      buffer,
      sync: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0),
      generation: this.generation,
    });
  }

  poll() {
    const gl = this.gl;
    if (!gl) return;

    const values = new Float32Array(4);
    while (this.readbacks.length) {
      const read = this.readbacks[0];
      if (gl.getSyncParameter(read.sync, gl.SYNC_STATUS) !== gl.SIGNALED) break;

      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, read.buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, values);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      this.release(read);
      this.readbacks.shift();

      if (read.generation === this.generation) {
        this.total = values[0] + values[1] + values[2] + values[3];
      }
    }
  }

  release(read) {
    this.gl.deleteSync(read.sync);
    this.gl.deleteBuffer(read.buffer);
  }

  atlasFor(level) {
    return this.atlases[(level + 1) % 2];
  }

  bind(uniforms) {
    uniforms.pyramidBase.value = this.base.texture;
    uniforms.pyramidOdd.value = this.atlases[0]?.texture ?? null;
    uniforms.pyramidEven.value = this.atlases[1]?.texture ?? null;
    uniforms.pyramidOffsets.value = this.offsets;
    uniforms.pyramidLevels.value = this.levelCount;
    uniforms.pyramidWidth.value = this.width;
  }

  static uniforms() {
    return {
      pyramidBase: { value: null },
      pyramidOdd: { value: null },
      pyramidEven: { value: null },
      pyramidOffsets: { value: new Int32Array((MAX_LEVELS + 1) * 2) },
      pyramidLevels: { value: 0 },
      pyramidWidth: { value: 0 },
    };
  }

  dispose(materials = true) {
    this.base?.dispose();
    for (const atlas of this.atlases ?? []) atlas?.dispose();
    if (!materials) return;
    for (const read of this.readbacks) this.release(read);
    this.readbacks.length = 0;
    this.baseMaterial.dispose();
    this.reduceMaterial.dispose();
    this.quad.geometry.dispose();
  }
}

export { HistoPyramid, pyramidTraversal };
