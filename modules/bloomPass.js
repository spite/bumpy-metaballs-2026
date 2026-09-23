import {
  RawShaderMaterial,
  Vector2,
  GLSL3,
  RGBAFormat,
} from "three";
import { ShaderPingPongPass } from "modules/ShaderPingPongPass.js";
import { shader as orthoVs } from "shaders/ortho.js";
import { shader as blurFs } from "shaders/bloomBlur.js";

const MIP_TAPS = [3, 5, 7, 9, 11];

const blurShader = new RawShaderMaterial({
  uniforms: {
    inputTexture: { value: null },
    direction: { value: new Vector2(1, 0) },
    texelSize: { value: new Vector2(1, 1) },
    taps: { value: 3 },
    prefilter: { value: 0 },
    threshold: { value: 0 },
  },
  vertexShader: orthoVs,
  fragmentShader: blurFs,
  glslVersion: GLSL3,
});

class BloomPass {
  constructor(levels = 5, options = {}) {
    this.threshold = 0;
    this.levels = levels;
    this.blurPasses = [];
    this.sizes = [];
    this.width = 1;
    this.height = 1;
    for (let i = 0; i < this.levels; i++) {
      this.blurPasses.push(
        new ShaderPingPongPass(blurShader, { format: RGBAFormat, ...options }),
      );
      this.sizes.push(new Vector2(1, 1));
    }
  }

  setSize(w, h) {
    this.width = w;
    this.height = h;
    let tw = w;
    let th = h;
    for (let i = 0; i < this.levels; i++) {
      tw = Math.max(1, Math.round(tw / 2));
      th = Math.max(1, Math.round(th / 2));
      this.sizes[i].set(tw, th);
      this.blurPasses[i].setSize(tw, th);
    }
  }

  set source(texture) {
    blurShader.uniforms.inputTexture.value = texture;
  }

  render(renderer) {
    const u = blurShader.uniforms;
    u.threshold.value = this.threshold;

    for (let j = 0; j < this.levels; j++) {
      const blurPass = this.blurPasses[j];
      const size = this.sizes[j];

      u.texelSize.value.set(1 / size.x, 1 / size.y);
      u.taps.value = MIP_TAPS[Math.min(j, MIP_TAPS.length - 1)];

      u.prefilter.value = j === 0 ? 1 : 0;
      u.direction.value.set(1, 0);
      blurPass.render(renderer);

      u.prefilter.value = 0;
      u.inputTexture.value = blurPass.current.texture;
      u.direction.value.set(0, 1);
      blurPass.render(renderer);

      u.inputTexture.value = blurPass.current.texture;
    }
  }
}

export { BloomPass };
