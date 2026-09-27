import {
  BackSide,
  Color,
  FrontSide,
  GLSL3,
  HalfFloatType,
  Matrix4,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  RawShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { ShaderPass } from "modules/ShaderPass.js";
import { BloomPass } from "modules/bloomPass.js";
import { BLUE_NOISE_SIZE, blueNoiseTexture } from "modules/blueNoiseTexture.js";
import { getFBO } from "modules/fbo.js";
import { shader as orthoVs } from "shaders/ortho.js";
import { shader as aoFs } from "shaders/ao.js";
import { shader as aoResolveFs } from "shaders/aoResolve.js";
import { shader as aoCompositeFs } from "shaders/aoComposite.js";
import { shader as debugFs } from "shaders/debug.js";
import { shader as finalFs } from "shaders/final.js";
import { shader as fxaaFs } from "shaders/fxaa.js";
import { shader as copyFs } from "shaders/copy.js";


// Opaque -> blurred copy -> transmissive shell -> AO -> bloom -> grade (with
// chromatic aberration) -> FXAA.
class Pipeline {
  constructor() {
    this.renderTarget = getFBO(1, 1, {
      count: 4,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
    });

    this.renderTarget.textures.forEach((texture) => {
      texture.minFilter = NearestFilter;
      texture.magFilter = NearestFilter;
      texture.type = HalfFloatType;
    });

    this.color = this.renderTarget.textures[0];
    this.positions = this.renderTarget.textures[1];
    this.normals = this.renderTarget.textures[2];
    this.diffuse = this.renderTarget.textures[3];

    this.clearColor = new Color();
    this.frame = 0;

    this.transmission = false;
    this.transmissionLayer = 1;

    // With farWall off the copy holds only the core and the backdrop, and the
    // glass reads as a tinted film over them.
    this.transmissiveMaterial = null;
    this.farWall = true;

    this.copyShader = new RawShaderMaterial({
      uniforms: { inputTexture: { value: null } },
      vertexShader: orthoVs,
      fragmentShader: copyFs,
      glslVersion: GLSL3,
    });

    // three regenerates the mip chain when it unbinds the target, so the copy is
    // all this costs.
    this.copyPass = new ShaderPass(this.copyShader, {
      type: HalfFloatType,
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
    });
    this.copyPass.texture.generateMipmaps = true;

    this.aoShader = new RawShaderMaterial({
      uniforms: {
        positionMap: { value: this.positions },
        normalMap: { value: this.normals },
        bias: { value: 0.05 },
        radius: { value: 40 },
        attenuation: { value: new Vector2(1, 4) },
        blueNoise: { value: blueNoiseTexture },
        blueNoiseSize: { value: BLUE_NOISE_SIZE },
        lightDir: { value: new Vector3(0, 1, 0) },
        shadowDistance: { value: 2.0 },
        shadowBias: { value: 0.02 },
        // Bigger is a *harder* shadow, which the name does not suggest: the ray dims
        // by closest approach over distance travelled, so a higher value means it
        // must pass nearer to count as blocked.
        shadowSoftness: { value: 4.0 },
        viewToWorldMatrix: { value: new Matrix4() },
        isolation: { value: 80 },
        fieldTexture: { value: null },
        fieldTexel: { value: 1 / 50 },
        fieldScale: { value: 1 },
      },
      vertexShader: orthoVs,
      fragmentShader: aoFs,
      glslVersion: GLSL3,
    });
    this.aoPass = new ShaderPass(this.aoShader, { type: HalfFloatType });

    this.lightWorld = new Vector3(0, 1, 0);

    this.aoResolveShader = new RawShaderMaterial({
      uniforms: {
        aoMap: { value: this.aoPass.texture },
        strength: { value: 3 },
        normalMap: { value: this.normals },
        lightDir: { value: new Vector3(0, 1, 0) },
        directionality: { value: 0 },
        // Depth is normalised across the near-far range, so a silhouette is enormous
        // next to any difference within one surface.
        depthSharpness: { value: 300 },
      },
      vertexShader: orthoVs,
      fragmentShader: aoResolveFs,
      glslVersion: GLSL3,
    });
    this.aoResolvePass = new ShaderPass(this.aoResolveShader, { type: HalfFloatType });

    this.aoCompositeShader = new RawShaderMaterial({
      uniforms: {
        colorMap: { value: this.color },
        diffuseMap: { value: this.diffuse },
        aoFactors: { value: this.aoResolvePass.texture },
        aoColor: { value: new Color(0x2a2f3a) },
      },
      vertexShader: orthoVs,
      fragmentShader: aoCompositeFs,
      glslVersion: GLSL3,
    });
    this.aoCompositePass = new ShaderPass(this.aoCompositeShader, { type: HalfFloatType });

    this.debug = "off";
    this.coreOcclusion = true;
    this.debugShader = new RawShaderMaterial({
      uniforms: {
        inputTexture: { value: null },
        mode: { value: 0 },
        debugScale: { value: 1 },
      },
      vertexShader: orthoVs,
      fragmentShader: debugFs,
      glslVersion: GLSL3,
    });
    this.debugPass = new ShaderPass(this.debugShader, { type: HalfFloatType });

    this.debugViews = {
      colour: { texture: () => this.color, mode: 0 },
      normals: { texture: () => this.normals, mode: 1 },
      position: { texture: () => this.positions, mode: 2 },
      depth: { texture: () => this.positions, mode: 3 },
      occlusion: { texture: () => this.aoPass.texture, mode: 4 },
      "occlusion-depth": { texture: () => this.aoPass.texture, mode: 5 },
      "shadow": { texture: () => this.aoPass.texture, mode: 6 },
      shaded: { texture: () => this.aoCompositePass.texture, mode: 0 },
      backdrop: { texture: () => this.copyPass.texture, mode: 0 },
      "bloom-0": { texture: () => this.bloom.blurPasses[0].texture, mode: 0 },
      "bloom-1": { texture: () => this.bloom.blurPasses[1].texture, mode: 0 },
      "bloom-2": { texture: () => this.bloom.blurPasses[2].texture, mode: 0 },
      "bloom-3": { texture: () => this.bloom.blurPasses[3].texture, mode: 0 },
      "bloom-4": { texture: () => this.bloom.blurPasses[4].texture, mode: 0 },
    };

    this.bloom = new BloomPass(5, { type: HalfFloatType });
    this.bloom.threshold = 0.35;

    this.finalShader = new RawShaderMaterial({
      uniforms: {
        sceneMap: { value: this.aoCompositePass.texture },
        bloom0: { value: null },
        bloom1: { value: null },
        bloom2: { value: null },
        bloom3: { value: null },
        bloom4: { value: null },
        aberration: { value: 6 },
        resolution: { value: new Vector2(1, 1) },
        bloomStrength: { value: 0.35 },
        bloomRadius: { value: 0.5 },
        vignette: { value: 0.35 },
        grain: { value: 0.05 },
        dither: { value: 1 },
        grainFrame: { value: 0 },
        toneMapping: { value: 1 },
        toneMappingExposure: { value: 1 },
      },
      vertexShader: orthoVs,
      fragmentShader: finalFs,
      glslVersion: GLSL3,
    });
    this.finalPass = new ShaderPass(this.finalShader);

    this.fxaaShader = new RawShaderMaterial({
      uniforms: {
        inputTexture: { value: this.finalPass.texture },
        fxaa: { value: 1 },
      },
      vertexShader: orthoVs,
      fragmentShader: fxaaFs,
      glslVersion: GLSL3,
    });
    this.fxaaPass = new ShaderPass(this.fxaaShader);
  }

  get transmissionTexture() {
    return this.copyPass.texture;
  }

  setSize(width, height, dpr) {
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);

    this.renderTarget.setSize(w, h);
    this.copyPass.setSize(
      Math.max(1, Math.round(w / 2)),
      Math.max(1, Math.round(h / 2)),
    );
    const aw = Math.max(1, Math.round(w / 2));
    const ah = Math.max(1, Math.round(h / 2));
    this.aoPass.setSize(aw, ah);
    this.aoResolvePass.setSize(aw, ah);
    this.aoCompositePass.setSize(w, h);
    this.debugPass.setSize(w, h);
    this.finalPass.setSize(w, h);
    this.fxaaPass.setSize(w, h);
    this.bloom.setSize(Math.round(width), Math.round(height));

    this.finalShader.uniforms.resolution.value.set(width, height);
    this.fxaaShader.uniforms.inputTexture.value = this.finalPass.texture;
  }

  setField(texture, isolation, size) {
    this.aoShader.uniforms.fieldTexture.value = texture;
    this.aoShader.uniforms.isolation.value = isolation;
    this.aoShader.uniforms.fieldTexel.value = 1 / size;
  }

  // Set once when an environment loads: it is a property of the map.
  setLight(direction, directionality) {
    this.lightWorld.copy(direction);
    this.aoResolveShader.uniforms.directionality.value = directionality;
  }

  // transformDirection uses the rotation alone and renormalises, which is what
  // a direction wants and what the full matrix would get wrong.
  updateLight(camera) {
    // The occlusion pass traces the field, which is world space; the resolve only
    // wants an N dot L against G-buffer normals, which are view space.
    this.aoShader.uniforms.lightDir.value.copy(this.lightWorld);
    this.aoShader.uniforms.viewToWorldMatrix.value.copy(camera.matrixWorld);
    this.aoResolveShader.uniforms.lightDir.value
      .copy(this.lightWorld)
      .transformDirection(camera.matrixWorldInverse);
  }

  render(renderer, scene, camera) {
    const clear = renderer.getClearColor(this.clearColor);
    const alpha = renderer.getClearAlpha();

    camera.updateMatrixWorld();

    const layers = camera.layers.mask;

    if (this.transmission) camera.layers.disable(this.transmissionLayer);

    renderer.setRenderTarget(this.renderTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    this.timer?.begin("scene");
    renderer.render(scene, camera);
    this.timer?.end();
    renderer.setRenderTarget(null);

    if (this.transmission) {
      camera.layers.set(this.transmissionLayer);

      const autoClear = renderer.autoClear;
      renderer.autoClear = false;

      // Before the walls: the near wall overwrites the core in the G-buffer.
      const occludeCore =
        this.coreOcclusion && this.aoResolveShader.uniforms.strength.value > 0;

      if (occludeCore) {
        this.updateLight(camera);
        this.timer?.begin("ao");
        this.aoPass.render(renderer);
        this.aoResolvePass.render(renderer);
        this.aoCompositePass.render(renderer);
        this.timer?.end();
      }

      const copyBackdrop = () => {
        this.copyShader.uniforms.inputTexture.value = occludeCore
          ? this.aoCompositePass.texture
          : this.color;
        this.copyPass.render(renderer);
        this.copyShader.uniforms.inputTexture.value = null;
      };

      // Refreshed before each wall, or it shows last frame's image as a ghost.
      copyBackdrop();

      if (this.farWall && this.transmissiveMaterial) {
        this.transmissiveMaterial.side = BackSide;
        renderer.setRenderTarget(this.renderTarget);
        this.timer?.begin("scene");
        renderer.render(scene, camera);
        this.timer?.end();
        renderer.setRenderTarget(null);
        this.transmissiveMaterial.side = FrontSide;

        if (occludeCore) this.aoCompositePass.render(renderer);
        copyBackdrop();
      }

      renderer.setRenderTarget(this.renderTarget);
      this.timer?.begin("scene");
      renderer.render(scene, camera);
      this.timer?.end();
      renderer.setRenderTarget(null);

      renderer.autoClear = autoClear;
    }

    camera.layers.mask = layers;
    renderer.setClearColor(clear, alpha);

    this.updateLight(camera);

    this.timer?.begin("ao");
    this.aoPass.render(renderer);
    this.aoResolvePass.render(renderer);
    this.aoCompositePass.render(renderer);
    this.timer?.end();

    const source = this.aoCompositePass.texture;

    const u = this.finalShader.uniforms;
    // Wrapped well inside the range a float holds exactly, so the hash gets a
    // whole number rather than a rounded one.
    u.grainFrame.value = this.frame++ % 1048576;

    const debugView = this.debugViews[this.debug];
    const wantsBloom = this.debug.startsWith("bloom-");

    if (u.bloomStrength.value > 0 || wantsBloom) {
      this.bloom.source = source;
      this.timer?.begin("bloom");
      this.bloom.render(renderer);
      this.timer?.end();
      for (let i = 0; i < 5; i++) {
        u[`bloom${i}`].value = this.bloom.blurPasses[i].texture;
      }
    }

    u.sceneMap.value = source;

    if (debugView) {
      this.debugShader.uniforms.inputTexture.value = debugView.texture();
      this.debugShader.uniforms.mode.value = debugView.mode;
      this.debugPass.render(renderer, true);
      return;
    }

    this.timer?.begin("grade");
    if (this.fxaaShader.uniforms.fxaa.value > 0) {
      this.finalPass.render(renderer);
      this.fxaaPass.render(renderer, true);
    } else {
      this.finalPass.render(renderer, true);
    }
    this.timer?.end();
  }

  dispose() {
    this.renderTarget.dispose();
    this.copyPass.dispose();
    this.aoPass.dispose();
    this.aoResolvePass.dispose();
    this.debugPass.dispose();
    this.finalPass.dispose();
    this.fxaaPass.dispose();
  }
}

export { Pipeline };
