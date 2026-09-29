import {
  BackSide,
  Color,
  GLSL3,
  IcosahedronGeometry,
  LinearSRGBColorSpace,
  Mesh,
  PerspectiveCamera,
  RawShaderMaterial,
  RepeatWrapping,
  PMREMGenerator,
  SRGBColorSpace,
  Scene,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { bindKey } from "guspira";
import { RGBELoader } from "third_party/RGBELoader.js";
import { environmentLight } from "modules/sh.js";
import { Volume, surfaceOffset } from "modules/volume.js";
import { MarchGeometry, makeTriTableTexture } from "modules/MarchGeometry.js";
import { HistoPyramid } from "modules/HistoPyramid.js";
import { motionNames } from "modules/blobMotion.js";
import { shader as marchVs } from "shaders/marchVs.js";
import { OrbitControls } from "third_party/OrbitControls.js";
import { Pipeline } from "modules/Pipeline.js";
import { BLUE_NOISE_SIZE, blueNoiseTexture } from "modules/blueNoiseTexture.js";
import { shapeNames, shapeIndex, fitShape } from "modules/sdf.js";
import { loadMeshField, smoothMeshField } from "modules/meshField.js";
import { trackLoad, idle } from "modules/loading.js";
import { pickLook, randomizeLook } from "modules/randomize.js";
import { trackPointer } from "modules/pointer.js";
import { environments, normalMaps, presets, findPreset } from "modules/presets.js";
import { buildPanel } from "modules/panel.js";
import {
  GEOMETRY_FIELDS,
  apply,
  auditPresets,
  readUrl,
  serialize,
  syncUrl,
} from "modules/urlState.js";
import { stats } from "modules/stats.js";
import { GpuTimer } from "modules/gpuTimer.js";
import { shader as surfaceFs } from "shaders/surfaceFs.js";
import { shader as backgroundVs } from "shaders/backgroundVs.js";
import { shader as backgroundFs } from "shaders/backgroundFs.js";

const state = {
  preset: 0,
  resolution: 50,
  coreResolution: 50,
  numBlobs: 20,
  isolation: 80,
  speed: 1,
  motion: "drift",
  paused: false,
  transmission: false,
  coreIsolation: 170,
  farWall: true,
  blobs: true,
  environment: "studio",
  debug: "off",
  term: "off",
  coreOcclusion: true,
  smoothing: 0,
  shape: "none",
  shapeSize: 0.2,
  shapeThickness: 0.055,
  shapeRounding: 0.14,
  shapeHeight: 0.28,
  shapeWidth: 0.1,
  shapeAngle: 252,
  outerNormalMap: normalMaps[0].name,
  innerNormalMap: normalMaps[0].name,
  twistStrength: 0,
  twistRadius: 0.28,
  axisTwist: [0, 0, 0],
  wireframe: false,
};

const twistCenter = new Vector3(0.5, 0.5, 0.5);
const twistAxis = new Vector3(0, 0, 1);

const TRANSMISSION_LAYER = 1;

let dirty = true;
let twisted = false;

const container = document.querySelector("#container");
const pauseButton = document.querySelector("#pause");

// ?size=N renders an N×N canvas at dpr 1 whatever the window, for screenshots
// and recordings.
const fixedSize = Number(new URLSearchParams(location.search).get("size")) || 0;

// preserveDrawingBuffer is what makes a right-click save or toDataURL give
// the frame rather than a blank, and it can only be asked for at context
// creation.
const renderer = new WebGLRenderer({
  antialias: false,
  preserveDrawingBuffer: true,
});
renderer.outputColorSpace = SRGBColorSpace;
// three resets the counters at the top of every draw, and the chain draws the
// scene three or four times a frame.
renderer.info.autoReset = false;
container.appendChild(renderer.domElement);

const scene = new Scene();

const camera = new PerspectiveCamera(90, 1, 0.01, 100);
camera.position.set(1.45, 0.39, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.minDistance = 1.2;
controls.maxDistance = 6;
controls.target.set(0, 0, 0);

const pipeline = new Pipeline();

const envUniforms = {
  envMap: { value: null },
  envIntensity: { value: 1 },
  cubeUV_maxMip: { value: 0 },
  cubeUV_texelWidth: { value: 0 },
  cubeUV_texelHeight: { value: 0 },
};


const envCache = new Map();

let envRequest = 0;

async function setEnvironment(name) {
  const entry = environments.find((e) => e.name === name) ?? environments[0];
  state.environment = entry.name;

  const request = ++envRequest;
  const env = await loadEnvironment(entry.url, entry.name);
  if (request !== envRequest) return;

  // Applied every time, never inside the load: caching the load's promise meant
  // picking an environment twice awaited a settled promise and assigned
  // nothing.
  envUniforms.envMap.value = env.texture;
  envUniforms.cubeUV_maxMip.value = env.maxMip;
  envUniforms.cubeUV_texelHeight.value = env.texelHeight;
  envUniforms.cubeUV_texelWidth.value = env.texelWidth;

  pipeline.setLight(env.light.direction, env.light.directionality);

  dirty = true;
  if (panel) panel.sync();
}

function loadEnvironment(url, name) {
  let pending = envCache.get(url);
  if (pending === undefined) {
    pending = trackLoad(`Loading the ${name} environment`, buildEnvironment(url));
    envCache.set(url, pending);
  }
  return pending;
}

async function buildEnvironment(url) {
  const pmrem = new PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const equirect = await new RGBELoader().loadAsync(url);
  const target = pmrem.fromEquirectangular(equirect);

  // Read while the equirect is still here: PMREM's output is a packed cube the
  // CPU has no cheap way back into.
  const light = environmentLight(equirect.image, equirect.type);

  equirect.dispose();
  pmrem.dispose();

  // Off the texture's height, not its width, the way three does it.
  const texture = target.texture;
  const height = texture.image.height;
  const maxMip = Math.log2(height) - 2;

  return {
    texture,
    maxMip,
    texelHeight: 1 / height,
    texelWidth: 1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16)),
    light,
  };
}

// Textures

const loader = new TextureLoader();
const textureCache = new Map();
const textureLoads = new Map();

function loadTexture(url, wrapping) {
  let texture = textureCache.get(url);

  if (texture === undefined) {
    let settle;
    const loaded = new Promise((resolve) => (settle = resolve));
    texture = loader.load(url, settle, undefined, settle);
    trackLoad(`Loading ${url.split("/").pop()}`, loaded);
    textureCache.set(url, texture);
    textureLoads.set(url, loaded);
  }

  // Set every time, not just on the miss: wrapping belongs to the use, not the
  // file, so a second use of one file would keep the first use's mode.
  // Not before the image arrives: three warns on every draw until then, and the
  // loader flags the texture itself when it lands.
  if (texture.wrapS !== wrapping) {
    texture.wrapS = texture.wrapT = wrapping;
    if (texture.image) texture.needsUpdate = true;
  }

  return texture;
}

// Isosurface

const triTableTexture = makeTriTableTexture();
const marchGeometry = new MarchGeometry();
const coreMarchGeometry = new MarchGeometry();
const shellPyramid = new HistoPyramid(triTableTexture);
const corePyramid = new HistoPyramid(triTableTexture);

function createSurfaceMaterial({ march = false } = {}) {
  return new RawShaderMaterial({
    uniforms: {
      fieldTexture: { value: null },
      ...HistoPyramid.uniforms(),
      triTableTexture: { value: triTableTexture },
      gridSize: { value: state.resolution },
      isolation: { value: state.isolation },

      normalMap: { value: null },
      normalScale: { value: 1 },
      texScale: { value: 5 },

      color: { value: new Color(0, 0, 0) },
      tint: { value: 0 },
      specular: { value: 1 },
      termView: { value: 0 },
      useSSS: { value: 1 },
      useScreen: { value: 0 },

      roughness: { value: 0.25 },
      metalness: { value: 0 },
      ...envUniforms,

      transmission: { value: 0 },
      backdrop: { value: null },
      resolution: { value: new Vector2(1, 1) },
      thickness: { value: 1 },
      refraction: { value: 0.35 },
      gloss: { value: 0 },
      dispersion: { value: 0.2 },
      blurStrength: { value: 2.5 },
      scatter: { value: 1 },
      blueNoise: { value: blueNoiseTexture },
      blueNoiseSize: { value: BLUE_NOISE_SIZE },
      absorption: { value: new Color(1, 1, 1) },
      density: { value: 1.8 },
      fresnel: { value: 1 },
      backdropMix: { value: 0.65 },
      sky: { value: null },
      ground: { value: null },

      cameraNear: { value: camera.near },
      cameraFar: { value: camera.far },
    },
    vertexShader: marchVs,
    fragmentShader: surfaceFs,
    glslVersion: GLSL3,
  });
}

const material = createSurfaceMaterial({ march: true });

// A coarser grid is a second meshing of the same field and deviates by up to
// half a coarse cell, which is fatal where the core pokes through: the near
// wall loses the depth test and the core draws with no glass over it. A core
// level a quarter above the isolation measured 0.00% escape at every
// resolution; below that it shares the shell's grid.
const CORE_COARSE_MARGIN = 1.25;

function coreFieldResolution() {
  if (state.coreResolution >= state.resolution) return state.resolution;
  if (state.coreIsolation < state.isolation * CORE_COARSE_MARGIN) return state.resolution;
  return state.coreResolution;
}




const coreMaterial = createSurfaceMaterial({ march: true });


const gpuTimer = new GpuTimer(renderer);

pipeline.timer = gpuTimer;

const volume = new Volume(state.resolution);
const mesh = new Mesh(marchGeometry, material);
scene.add(mesh);

const core = new Mesh(coreMarchGeometry, coreMaterial);
scene.add(core);

// Background

const backgroundMaterial = new RawShaderMaterial({
  uniforms: {
    sky: { value: new Color(0, 0, 0) },
    ground: { value: new Color(0, 0, 0) },
  },
  vertexShader: backgroundVs,
  fragmentShader: backgroundFs,
  glslVersion: GLSL3,
  side: BackSide,
});

scene.add(new Mesh(new IcosahedronGeometry(30, 1), backgroundMaterial));

for (const m of [material, coreMaterial]) {
  m.uniforms.sky.value = backgroundMaterial.uniforms.sky.value;
  m.uniforms.ground.value = backgroundMaterial.uniforms.ground.value;
  m.uniforms.backdrop.value = pipeline.transmissionTexture;
}

// Presets

function setColor(uniform, r, g, b) {
  uniform.value.setRGB(r / 255, g / 255, b / 255, LinearSRGBColorSpace);
}

// The url the app writes names whichever preset is selected, so a link saved
// from the address bar names *itself*, and the guard below turns a link
// naming a link away. A name that is not a block preset's is dropped.
//
// Merged, not joined: apply() reads the first occurrence of a key, so
// concatenating would let the defaults win over the preset.
function linkBase(preset) {
  const fields = new URLSearchParams(preset.url);
  const named = presets[findPreset(fields.get("mat") ?? "")];
  const isBlock = named !== undefined && !named.url;

  if (isBlock) return preset.url;

  const merged = new URLSearchParams(pristine);
  fields.delete("mat");
  for (const [key, value] of fields) merged.set(key, value);
  return merged.toString();
}

// Resolves once everything the preset shows is loaded, so a switch can wait
// rather than show the new look first and pop its textures in after.
function presetAssets(index) {
  const preset = presets[(index + presets.length) % presets.length];
  const fields = new URLSearchParams(preset.url ? linkBase(preset) : pristine);
  const base = preset.url ? presets[findPreset(fields.get("mat") ?? "")] : preset;
  const mapUrl = (name, fallback) =>
    normalMaps.find((m) => m.name === name)?.url ?? fallback;

  const outer = mapUrl(fields.get("onmap"), base?.normalMap);
  const inner = mapUrl(fields.get("inmap"), base?.transmission?.inside?.normalMap ?? base?.normalMap);
  const env = environments.find((e) => e.name === fields.get("env")) ?? environments[0];

  const maps = [outer, inner].filter(Boolean).map((url) => {
    loadTexture(url, RepeatWrapping);
    return textureLoads.get(url);
  });
  return Promise.all([loadEnvironment(env.url, env.name), ...maps]);
}

let applyingPreset = false;

// The look as the preset left it, to tell when it has been edited since.
// Geometry is left out because presets never set it, and the debug views
// because they change how the look is shown, not the look.
const VIEW_FIELDS = new Set(["mat", "dbg", "dbgs", "term", "wire"]);
let presetLook = null;
let presetCheckDue = 0;

function lookFields() {
  const fields = new URLSearchParams(serialize(app));
  for (const key of [...fields.keys()]) {
    if (GEOMETRY_FIELDS.has(key) || VIEW_FIELDS.has(key)) fields.delete(key);
  }
  return fields.toString();
}

function presetApplied() {
  presetLook = lookFields();
  presetCheckDue = 0;
}

function checkPreset(now) {
  if (!panel || now < presetCheckDue) return;
  presetCheckDue = now + 250;
  panel.showPreset(presets[state.preset].name, lookFields() !== presetLook);
}

function applyPreset(index) {
  const wanted = (index + presets.length) % presets.length;
  state.preset = wanted;

  const preset = presets[state.preset];

  if (preset.url) {
    if (applyingPreset) return;
    applyingPreset = true;
    try {
      apply(app, linkBase(preset), { keep: GEOMETRY_FIELDS });
    } finally {
      applyingPreset = false;
    }
    state.preset = wanted;
    presetApplied();
    if (panel) panel.sync();
    return;
  }

  apply(app, pristine, { keep: GEOMETRY_FIELDS });

  const uniforms = material.uniforms;
  uniforms.normalMap.value = loadTexture(preset.normalMap, RepeatWrapping);
  state.outerNormalMap = normalMapName(preset.normalMap);
  uniforms.normalScale.value = preset.normalScale;
  uniforms.texScale.value = preset.texScale;
  uniforms.useSSS.value = preset.useSSS;
  uniforms.useScreen.value = preset.useScreen;
  uniforms.roughness.value = preset.roughness ?? 0.25;
  uniforms.metalness.value = preset.metalness ?? 0;

  setColor(uniforms.color, ...preset.color);
  setColor(backgroundMaterial.uniforms.sky, ...preset.sky);
  setColor(backgroundMaterial.uniforms.ground, ...preset.ground);

  const inside = { ...preset, ...(preset.transmission.inside ?? {}) };
  const coreUniforms = coreMaterial.uniforms;
  coreUniforms.normalMap.value = loadTexture(inside.normalMap, RepeatWrapping);
  state.innerNormalMap = normalMapName(inside.normalMap);
  coreUniforms.normalScale.value = inside.normalScale;
  coreUniforms.texScale.value = inside.texScale;
  coreUniforms.useSSS.value = inside.useSSS;
  coreUniforms.useScreen.value = inside.useScreen;
  coreUniforms.roughness.value = inside.roughness ?? 0.25;
  coreUniforms.metalness.value = inside.metalness ?? 0;
  coreUniforms.tint.value = inside.tint ?? 1;
  coreUniforms.specular.value = inside.specular ?? 1;
  uniforms.specular.value = preset.specular ?? 1;
  // 1, not 0: a colour strength of 0 leaves a white albedo, and with the
  // environment as the only light the swatch has to be the albedo.
  uniforms.tint.value = preset.tint ?? 1;
  setColor(coreUniforms.color, ...inside.color);

  const t = preset.transmission;
  const glass = t.amount ?? 0;

  uniforms.transmission.value = glass;
  setColor(uniforms.absorption, ...(t.tint ?? preset.color));

  // Loaded whether or not this preset uses them, or a solid one carries
  // whatever the last glass preset left in the uniforms.
  state.coreIsolation = t.coreIsolation ?? 170;
  uniforms.thickness.value = t.thickness ?? 1;
  uniforms.refraction.value = t.refraction ?? 0.35;
  uniforms.dispersion.value = t.dispersion ?? 0.2;
  uniforms.blurStrength.value = t.blurStrength ?? 2.5;
  uniforms.density.value = t.density ?? 1.8;
  uniforms.fresnel.value = t.fresnel ?? 1;
  uniforms.backdropMix.value = t.reflection ?? 0.65;

  setTransmission(glass);

  presetApplied();
  if (panel) panel.sync();
}

function setTransmission(amount) {
  state.transmission = amount;
  material.uniforms.transmission.value = amount;
  dirty = true;

  const glassy = amount > 0;
  mesh.layers.set(glassy ? TRANSMISSION_LAYER : 0);
  core.visible = glassy;

  pipeline.transmission = glassy;
  pipeline.transmissiveMaterial = glassy ? material : null;

  // Disabled states are decided in sync, not per frame, so a setter that gates
  // another row has to call it.
  if (panel) panel.sync();
}

function setWireframe(value) {
  state.wireframe = value;
  material.wireframe = value;
  coreMaterial.wireframe = value;
  dirty = true;
}

function setTwistStrength(value) {
  state.twistStrength = value;
  dirty = true;

  if (panel) panel.sync();
}

function setAxisTwist(axis, degrees) {
  state.axisTwist[axis] = degrees;
  dirty = true;
}

function setTwistRadius(value) {
  state.twistRadius = value;
  dirty = true;
}

function setCoreIsolation(value) {
  state.coreIsolation = Math.max(value, state.isolation);
  dirty = true;
  if (panel) panel.sync();
}

function outerMaterial() {
  return material;
}

function normalMapName(url) {
  return (normalMaps.find((m) => m.url === url) ?? normalMaps[0]).name;
}

// Both outer materials: a texture is the same choice for the solid surface
// and the glass one.
function setNormalMap(which, name) {
  const entry = normalMaps.find((m) => m.name === name) ?? normalMaps[0];
  const texture = loadTexture(entry.url, RepeatWrapping);

  if (which === "inner") {
    state.innerNormalMap = entry.name;
    coreMaterial.uniforms.normalMap.value = texture;
  } else {
    state.outerNormalMap = entry.name;
    material.uniforms.normalMap.value = texture;
  }

  if (panel) panel.sync();
}

function setBlobs(enabled) {
  state.blobs = enabled;
  if (panel) panel.sync();
  dirty = true;
}

const terms = [
  "off",
  "irradiance",
  "radiance",
  "albedo",
  "fresnel",
  "diffuse",
  "transmitted",
  "body",
  "specular",
  "lit",
  "styled",
];

function setTerm(name) {
  const index = terms.indexOf(name);
  state.term = index > 0 ? name : "off";

  const value = index > 0 ? index : 0;
  material.uniforms.termView.value = value;
  coreMaterial.uniforms.termView.value = value;

  dirty = true;
  if (panel) panel.sync();
}

function setDebug(name) {
  state.debug = name in pipeline.debugViews || name === "off" ? name : "off";
  pipeline.debug = state.debug;
  dirty = true;
  if (panel) panel.sync();
}

function setSmoothing(value) {
  state.smoothing = value;
  dirty = true;
}

let modelField = null;
let modelPending = null;

const MODEL_SMOOTHING_CELLS = 3;

function ensureModelField() {
  if (modelField || modelPending) return;
  modelPending = trackLoad("Building Suzanne", loadMeshField("assets/suzanne.obj"), {
    immediate: true,
  })
    .then((field) => {
      modelField = field;
      dirty = true;
    })
    .catch((error) => {
      console.error("model field failed", error);
      modelPending = null;
    });
}

function setShape(name) {
  state.shape = shapeNames.includes(name) ? name : "none";
  if (state.shape === "suzanne") ensureModelField();
  dirty = true;
  if (panel) panel.sync();
}

function setShapeSize(value) {
  state.shapeSize = value;
  dirty = true;
}

function setShapeThickness(value) {
  state.shapeThickness = value;
  dirty = true;
}

function setShapeRounding(value) {
  state.shapeRounding = value;
  dirty = true;
}

function setShapeHeight(value) {
  state.shapeHeight = value;
  dirty = true;
}

function setShapeWidth(value) {
  state.shapeWidth = value;
  dirty = true;
}

// Nine numbers, column major: a rotation of the whole field about its centre.
function setSpin(elements) {
  volume.material.uniforms.uSpin.value.fromArray(elements);
  dirty = true;
}

async function preloadAll() {
  ensureModelField();
  for (const map of normalMaps) loadTexture(map.url, RepeatWrapping);
  await Promise.all(environments.map((env) => loadEnvironment(env.url, env.name)));
  await modelPending;
  await idle();
}

function setShapeAngle(value) {
  state.shapeAngle = value;
  dirty = true;
}

function setMotion(name) {
  state.motion = motionNames.includes(name) ? name : "drift";
  dirty = true;
}

function setNumBlobs(value) {
  state.numBlobs = value;
  dirty = true;
}

function setCoreOcclusion(value) {
  state.coreOcclusion = value;
  pipeline.coreOcclusion = value;
  dirty = true;
}

function setFarWall(value) {
  state.farWall = value;
  pipeline.farWall = value;
}

function setPaused(value) {
  state.paused = value;
  pauseButton.setAttribute("aria-pressed", String(value));
  pauseButton.setAttribute("aria-label", value ? "Play" : "Pause");
  pauseButton.title = value ? "Play (Space)" : "Pause (Space)";
}

function setResolution(value) {
  if (value === state.resolution) return;

  const linked = state.coreResolution === state.resolution;

  state.resolution = value;
  if (linked) state.coreResolution = value;
  dirty = true;

  if (panel) panel.sync();
}

function setCoreResolution(value) {
  state.coreResolution = value;
  dirty = true;
  if (panel) panel.sync();
}

function setIsolation(value) {
  state.isolation = value;

  // A lower level means a bigger surface, so a core level below the shell's
  // grows the core straight through it.
  state.coreIsolation = Math.max(state.coreIsolation, value);

  dirty = true;
  if (panel) panel.sync();
}

let panel = null;

await setEnvironment(state.environment);

const app = {
  state,
  material,
  backgroundMaterial,
  pipeline,
  applyPreset,
  setResolution,
  setCoreResolution,
  setIsolation,
  setTransmission,
  setWireframe,
  setTwistStrength,
  setTwistRadius,
  setAxisTwist,
  setCoreIsolation,
  setBlobs,
  setNumBlobs,
  setMotion,
  setNormalMap,
  setEnvironment,
  setDebug,
  setTerm,
  terms,
  setSmoothing,
  setShape,
  setShapeSize,
  setShapeThickness,
  setShapeRounding,
  setShapeHeight,
  setShapeWidth,
  setShapeAngle,
  setCoreOcclusion,
  setFarWall,
  setColor,
  envUniforms,
  coreFieldResolution,
  modelLoaded: () => modelField !== null,
  presets,
  preload: preloadAll,
  setSpin,
  bounce: () => (bounceStart = performance.now()),
  nextLook: (preset) => {
    randomizeLook(app, preset);
    panel?.sync();
    bounceStart = performance.now();
  },
  canvas: renderer.domElement,
  stats,
  outerMaterial,
  coreMaterial,
};

// A block preset names only some of the fields a link carries, so without this
// selecting one leaves the rest wherever the last look put it. Taken from the
// uniforms' own defaults, before any preset has touched them.
const pristine = (() => {
  const fields = new URLSearchParams(serialize(app));
  fields.delete("mat");
  return fields.toString();
})();

for (const problem of auditPresets(app)) {
  console.warn(`[preset] ${problem}`);
}

applyPreset(Math.max(0, presets.findIndex((p) => p.name === "Blood Ice")));

panel = buildPanel(app);

if (readUrl(app)) panel.sync();

const writeUrl = syncUrl(app);

bindKey("Space", () => setPaused(!state.paused), { preventDefault: true });
const BOUNCE_SECONDS = 2;
let bounceStart = -Infinity;

function bounceScale(now) {
  const t = (now - bounceStart) / 1000;
  if (t >= BOUNCE_SECONDS) return 1;
  return 1 - 0.35 * Math.exp(-2.8 * t) * Math.cos(2 * Math.PI * 2.6 * t);
}

let lookRequest = 0;

async function randomizeWhenReady() {
  const request = ++lookRequest;
  const next = pickLook(app);
  await presetAssets(next);
  if (request !== lookRequest) return;
  randomizeLook(app, next);
  panel?.sync();
  bounceStart = performance.now();
}

bindKey("KeyR", randomizeWhenReady);

const randomizeButton = document.querySelector("#randomize");
randomizeButton.addEventListener("click", () => {
  randomizeButton.classList.toggle("turned");
  randomizeWhenReady();
});
pauseButton.addEventListener("click", () => setPaused(!state.paused));
document.querySelector("#buttons").hidden = false;
bindKey("KeyF", toggleFullscreen);
bindKey("ArrowRight", () => applyPreset(state.preset + 1));
bindKey("ArrowLeft", () => applyPreset(state.preset - 1));
const uiToggle = document.querySelector("#ui-toggle");

function setUiHidden(hidden) {
  document.body.classList.toggle("ui-hidden", hidden);
  uiToggle.setAttribute("aria-pressed", String(hidden));
  const label = hidden ? "Show the interface" : "Hide the interface";
  uiToggle.setAttribute("aria-label", label);
  uiToggle.title = `${label} (Tab)`;
}

uiToggle.addEventListener("click", () => setUiHidden(!document.body.classList.contains("ui-hidden")));

bindKey("Tab", (event) => {
  // Inside the panel and the buttons Tab still moves focus between controls.
  if (event.target.closest?.("#panel, #buttons")) return;
  event.preventDefault();
  setUiHidden(!document.body.classList.contains("ui-hidden"));
});

// Fullscreen

// The whole page, not the canvas: the buttons and panel have to stay reachable,
// or nothing on screen could leave fullscreen again.
function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

const fullscreenButton = document.querySelector("#fullscreen");
fullscreenButton.hidden = !document.fullscreenEnabled;
fullscreenButton.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => {
  const on = document.fullscreenElement !== null;
  fullscreenButton.setAttribute("aria-pressed", String(on));
  fullscreenButton.setAttribute("aria-label", on ? "Exit fullscreen" : "Fullscreen");
});

// Touch gets its own double tap: dblclick is unreliable on phones, and where a
// browser does fire it too, the two would enter and leave fullscreen at once.
let lastPointer = "mouse";
let tapStart = null;
let lastTap = null;

container.addEventListener("pointerdown", (e) => {
  lastPointer = e.pointerType;
  tapStart = e.pointerType === "touch" && e.isPrimary ? { x: e.clientX, y: e.clientY, t: e.timeStamp } : null;
});

container.addEventListener("pointerup", (e) => {
  if (!tapStart || e.pointerType !== "touch" || !e.isPrimary) return;
  const isTap = e.timeStamp - tapStart.t < 250 && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) < 10;
  tapStart = null;
  if (!isTap) {
    lastTap = null;
    return;
  }
  const isDouble =
    lastTap && e.timeStamp - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40;
  if (isDouble) {
    lastTap = null;
    toggleFullscreen();
  } else {
    lastTap = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  }
});

container.addEventListener("dblclick", () => {
  if (lastPointer !== "touch") toggleFullscreen();
});

// Resize

function resize() {
  const width = fixedSize || window.innerWidth;
  const height = fixedSize || window.innerHeight;
  const dpr = fixedSize ? 1 : Math.min(window.devicePixelRatio, 2);

  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  pipeline.setSize(width, height, dpr);

  for (const m of [material, coreMaterial]) {
    m.uniforms.resolution.value.set(
      Math.round(width * dpr),
      Math.round(height * dpr),
    );
  }
}

window.addEventListener("resize", resize);
resize();

trackPointer(renderer.domElement, camera, (hit, forward) => {
  twistCenter.copy(hit).multiplyScalar(0.5).addScalar(0.5);
  twistAxis.copy(forward);
  if (state.twistStrength !== 0) twisted = true;
});

// Loop

let last = performance.now();
let time = 0;

function render() {
  const now = performance.now();
  const elapsed = now - last;
  last = now;

  renderer.info.reset();

  let fieldMs = 0;
  let polyMs = 0;

  // Holding `last` current keeps the animation from jumping by the length of
  // the pause.
  // Anything but the clock can reshape the surface by more than the pyramid's
  // margin in one frame.
  const edited = dirty;

  if (twisted) {
    twisted = false;
    dirty = true;
  }

  if (!state.paused) {
    time += 0.0005 * state.speed * elapsed;
    dirty = true;
  }

  if (dirty) {
    dirty = false;

    const fieldStart = performance.now();

    gpuTimer.begin("volume");

    if (modelField && state.shape === "suzanne") {
      smoothMeshField(modelField, state.shapeRounding * MODEL_SMOOTHING_CELLS);
    }

    volume.setSize(state.resolution);
    const fitted = fitShape(
      state.shape,
      {
        size: state.shapeSize,
        thickness: state.shapeThickness,
        height: state.shapeHeight,
        rounding: state.shapeRounding,
        width: state.shapeWidth,
      },
      {
        offset: surfaceOffset(state.numBlobs, state.isolation),
        minThickness: 1 / state.resolution,
      },
    );

    volume.update(renderer, {
      time,
      numBlobs: state.numBlobs,
      blobs: state.blobs,
      motion: state.motion,
      shape: shapeIndex(state.shape),
      shapeSize: fitted.size,
      shapeThickness: fitted.thickness,
      shapeRounding: fitted.rounding,
      shapeHeight: fitted.height,
      shapeWidth: fitted.width,
      shapeAngle: state.shapeAngle,
      isolation: state.isolation,
      smoothing: state.smoothing,
      twistCenter,
      twistAxis,
      twistStrength: state.twistStrength,
      twistRadius: state.twistRadius,
      axisTwist: state.axisTwist,
      modelSDF: modelField?.texture ?? null,
    });
    pipeline.setField(volume.fieldTexture, state.isolation, volume.size);
    const polyStart = performance.now();
    fieldMs = polyStart - fieldStart;

    {
      shellPyramid.setGrid(state.resolution);
      if (edited) shellPyramid.invalidate();
      shellPyramid.build(renderer, volume.fieldTexture, state.isolation);
      shellPyramid.bind(material.uniforms);
      material.uniforms.gridSize.value = state.resolution;
      material.uniforms.isolation.value = state.isolation;
      material.uniforms.fieldTexture.value = volume.fieldTexture;

      if (core.visible) {
        const coreRes = coreFieldResolution();
        corePyramid.setGrid(coreRes);
        if (edited) corePyramid.invalidate();
        corePyramid.build(renderer, volume.fieldTexture, state.coreIsolation);
        corePyramid.bind(coreMaterial.uniforms);
        coreMaterial.uniforms.gridSize.value = coreRes;
        coreMaterial.uniforms.isolation.value = state.coreIsolation;
        coreMaterial.uniforms.fieldTexture.value = volume.fieldTexture;
      }
    }

    gpuTimer.end();



    polyMs = performance.now() - polyStart;
  }

  shellPyramid.poll();
  corePyramid.poll();
  marchGeometry.setVertexCount(shellPyramid.vertexBudget);
  coreMarchGeometry.setVertexCount(core.visible ? corePyramid.vertexBudget : 0);

  const scale = bounceScale(now);
  mesh.scale.setScalar(scale);
  core.scale.setScalar(scale);
  pipeline.aoShader.uniforms.fieldScale.value = scale;

  controls.update();
  writeUrl(now);
  checkPreset(now);

  pipeline.render(renderer, scene, camera);

  // A backgrounded tab stops being given frames, so the first one after it
  // returns carries the whole gap. That is not a frame time, and it would
  // flatten every real sample against the graph's scale, so the timings sit out
  // that frame. The counts are still true.
  if (elapsed < 1000) {
    stats.fps.tick();
    stats.frame.sample(elapsed);
    stats.field.sample(fieldMs);
    stats.poly.sample(polyMs);
    stats.rest.sample(Math.max(0, elapsed - fieldMs - polyMs));
  }

  gpuTimer.poll();
  stats.gpuVolume.sample(gpuTimer.take("volume"));
  stats.gpuScene.sample(gpuTimer.take("scene"));
  stats.gpuAo.sample(gpuTimer.take("ao"));
  stats.gpuBloom.sample(gpuTimer.take("bloom"));
  stats.gpuGrade.sample(gpuTimer.take("grade"));

  stats.coreGrid.sample(coreFieldResolution());
  stats.triangles.sample(renderer.info.render.triangles);
  stats.calls.sample(renderer.info.render.calls);
  stats.geometries.sample(renderer.info.memory.geometries);
  stats.textures.sample(renderer.info.memory.textures);
  stats.programs.sample(renderer.info.programs?.length ?? 0);
  stats.flush();

  requestAnimationFrame(render);
}

render();

// For driving the sketch from outside: the console, or a recorder.
window.app = app;
