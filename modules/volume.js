import {
  FloatType,
  GLSL3,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RedFormat,
  Scene,
  Vector3,
  WebGL3DRenderTarget,
} from "three";

import { field } from "shaders/field.js";

// The field on the GPU as a 3D texture, so the shadow pass has something to
// trace against. A draw writes one 2D layer, so each slice is rendered
// straight into its own layer with framebufferTextureLayer; copying a 2D
// atlas in instead cost 0.9ms per slice against 0.28ms of real work.
const vertexShader = `precision highp float;
in vec3 position;
void main() {
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}
`;

const fragmentShader = `precision highp float;
precision highp sampler3D;

uniform float uSize;
uniform float uSlice;

${field}

out vec4 fragColor;

void main() {
  vec3 voxel = vec3(floor(gl_FragCoord.xy), uSlice);

  // Emptied on purpose: marching cubes only builds a face where the field
  // crosses the level inside a cube, so without this a surface running past the
  // wall is left open.
  vec3 edge = min(voxel, vec3(uSize - 1.0) - voxel);
  if (min(edge.x, min(edge.y, edge.z)) < 0.5) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // x / size, no half texel: half a voxel of disagreement here is half a voxel
  // of shadow offset.
  fragColor = vec4(fieldAt(voxel / uSize), 0.0, 0.0, 1.0);
}
`;

// Ported from blurField in legacy/metaballs.js, term for term. Not a box
// blur, and the shape is not incidental: only the eight DIAGONAL neighbours
// are read, folded in with a running mean whose divisor climbs as it goes, so
// the first neighbour moves the value further than the last. An out of range
// neighbour is skipped without advancing the divisor, which makes the edges
// of the grid blur less than the middle.
const blurFragmentShader = `precision highp float;
precision highp sampler3D;

uniform sampler3D uField;
uniform float uSize;
uniform float uSlice;
uniform float uSmoothing;

out vec4 fragColor;

void main() {
  int size = int(uSize);
  ivec3 voxel = ivec3(ivec2(gl_FragCoord.xy), int(uSlice));

  float value = texelFetch(uField, voxel, 0).r;
  float count = 1.0;

  for (int dx = -1; dx <= 1; dx += 2) {
    int x2 = voxel.x + dx;
    if (x2 < 0 || x2 >= size) continue;

    for (int dy = -1; dy <= 1; dy += 2) {
      int y2 = voxel.y + dy;
      if (y2 < 0 || y2 >= size) continue;

      for (int dz = -1; dz <= 1; dz += 2) {
        int z2 = voxel.z + dz;
        if (z2 < 0 || z2 >= size) continue;

        count += 1.0;
        value += uSmoothing * (texelFetch(uField, ivec3(x2, y2, z2), 0).r - value) / count;
      }
    }
  }

  fragColor = vec4(value, 0.0, 0.0, 1.0);
}
`;

class Volume {
  constructor(size = 50) {
    this.camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
    this.scene = new Scene();

    this.material = new RawShaderMaterial({
      uniforms: {
        uSize: { value: size },
        uSlice: { value: -1 },
        uShape: { value: 0 },
        uShapeSize: { value: 0.2 },
        uShapeThickness: { value: 0.055 },
        uNumBlobs: { value: 20 },
        uBlobsOn: { value: 1 },
        uTime: { value: 0 },
        uIsolation: { value: 80 },
        uTwistCenter: { value: new Vector3(0.5, 0.5, 0.5) },
        uTwistAxis: { value: new Vector3(0, 0, 1) },
        uTwistStrength: { value: 0 },
        uTwistRadius: { value: 0.28 },
        uModelSDF: { value: null },
        uModelMargin: { value: 1.15 },
        uModelReady: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      glslVersion: GLSL3,
    });

    this.quad = new Mesh(new PlaneGeometry(1, 1), this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    this.blurMaterial = new RawShaderMaterial({
      uniforms: {
        uField: { value: null },
        uSize: { value: size },
        uSlice: { value: 0 },
        uSmoothing: { value: 0 },
      },
      vertexShader,
      fragmentShader: blurFragmentShader,
      glslVersion: GLSL3,
    });

    this.blurScene = new Scene();
    this.blurQuad = new Mesh(new PlaneGeometry(1, 1), this.blurMaterial);
    this.blurQuad.frustumCulled = false;
    this.blurScene.add(this.blurQuad);

    this.setSize(size);
  }

  setSize(size) {
    if (this.size === size) return;

    this.size = size;

    this.material.uniforms.uSize.value = size;
    this.blurMaterial.uniforms.uSize.value = size;

    this.layered?.dispose();
    this.layered = new WebGL3DRenderTarget(size, size, size, {
      format: RedFormat,
      type: FloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });

    this.blurred?.dispose();
    this.blurred = new WebGL3DRenderTarget(size, size, size, {
      format: RedFormat,
      type: FloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
  }

  // Everything must read the same texture or they disagree about where the
  // surface is.
  get fieldTexture() {
    return this.smoothed ? this.blurred.texture : this.layered.texture;
  }

  update(
    renderer,
    {
      time,
      numBlobs,
      blobs,
      shape,
      shapeSize,
      shapeThickness,
      isolation,
      smoothing = 0,
      twistCenter,
      twistAxis,
      twistStrength = 0,
      twistRadius = 0.28,
      modelSDF = null,
    },
  ) {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uNumBlobs.value = numBlobs;
    u.uBlobsOn.value = blobs ? 1 : 0;
    u.uShape.value = shape;
    u.uShapeSize.value = shapeSize;
    u.uShapeThickness.value = shapeThickness;
    u.uIsolation.value = isolation;
    if (twistCenter) u.uTwistCenter.value.copy(twistCenter);
    if (twistAxis) u.uTwistAxis.value.copy(twistAxis);
    u.uTwistStrength.value = twistStrength;
    u.uTwistRadius.value = twistRadius;
    if (modelSDF) u.uModelSDF.value = modelSDF;
    u.uModelReady.value = modelSDF ? 1 : 0;

    const target = renderer.getRenderTarget();

    for (let z = 0; z < this.size; z++) {
      u.uSlice.value = z;
      renderer.setRenderTarget(this.layered, z);
      renderer.render(this.scene, this.camera);
    }

    this.smoothed = smoothing > 0;

    if (this.smoothed) {
      const bu = this.blurMaterial.uniforms;
      bu.uField.value = this.layered.texture;
      bu.uSmoothing.value = smoothing;
      for (let z = 0; z < this.size; z++) {
        bu.uSlice.value = z;
        renderer.setRenderTarget(this.blurred, z);
        renderer.render(this.blurScene, this.camera);
      }
    }

    renderer.setRenderTarget(target);
  }

  dispose() {
    this.blurred?.dispose();
    this.blurMaterial.dispose();
    this.blurQuad.geometry.dispose();
    this.layered?.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}

export { Volume };
