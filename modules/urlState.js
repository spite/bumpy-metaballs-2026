import { surfaceOffset } from "modules/volume.js";
import { presets, findPreset } from "modules/presets.js";

// Every tweakable value in one table. Order matters on the way in: the
// material resets everything else, and transmission decides which material
// counts as the outer one, so both are applied first.
function parseHex(raw) {
  return [
    parseInt(raw.slice(0, 2), 16),
    parseInt(raw.slice(2, 4), 16),
    parseInt(raw.slice(4, 6), 16),
  ];
}

function printColor(c) {
  return [c.r, c.g, c.b]
    .map((v) => Math.round(v * 255).toString(16).padStart(2, "0"))
    .join("");
}

function buildSchema(app) {
  const grade = app.pipeline.finalShader.uniforms;
  const ao = app.pipeline.aoShader.uniforms;
  const aoOut = app.pipeline.aoResolveShader.uniforms;
  const aoTint = app.pipeline.aoCompositeShader.uniforms;
  const chroma = app.pipeline.finalShader.uniforms;
  const fxaa = app.pipeline.fxaaShader.uniforms;
  const core = app.coreMaterial.uniforms;
  const outer = app.material.uniforms;
  const bg = app.backgroundMaterial.uniforms;

  const num = (get, set) => ({ get, set: (v) => set(v), parse: Number });
  const bool = (get, set) => ({
    get,
    set: (v) => set(v),
    parse: (raw) => raw === "1" || raw === "true",
    print: (v) => (v ? "1" : "0"),
  });
  const color = (uniform) => ({
    get: () => uniform.value,
    set: (v) => app.setColor(uniform, ...v),
    parse: parseHex,
    print: printColor,
  });
  const uniformNum = (u) => num(() => u.value, (v) => (u.value = v));

  return {
    mat: {
      get: () => presets[app.state.preset].name,
      set: (name) => {
        // Case insensitive, and a miss is dropped rather than applied: a link that
        // missed would otherwise layer the rest of itself over whichever preset
        // happened to be up.
        const i = findPreset(name);
        if (i >= 0) app.applyPreset(i);
      },
      parse: String,
      print: String,
    },
    trans: num(() => app.state.transmission, app.setTransmission),

    res: num(() => app.state.resolution, app.setResolution),
    cres: num(() => app.state.coreResolution, app.setCoreResolution),
    blobson: bool(() => app.state.blobs, app.setBlobs),
    blobs: num(() => app.state.numBlobs, app.setNumBlobs),
    iso: num(() => app.state.isolation, app.setIsolation),
    speed: num(() => app.state.speed, (v) => (app.state.speed = v)),
    motion: {
      get: () => app.state.motion,
      set: (name) => app.setMotion(name),
      parse: String,
      print: String,
    },
    smooth: num(() => app.state.smoothing, app.setSmoothing),
    shape: {
      get: () => app.state.shape,
      set: (name) => app.setShape(name),
      parse: String,
      print: String,
    },
    ssize: num(() => app.state.shapeSize, app.setShapeSize),
    sthick: num(() => app.state.shapeThickness, app.setShapeThickness),
    sround: num(() => app.state.shapeRounding, app.setShapeRounding),
    sheight: num(() => app.state.shapeHeight, app.setShapeHeight),
    swidth: num(() => app.state.shapeWidth, app.setShapeWidth),
    sangle: num(() => app.state.shapeAngle, app.setShapeAngle),
    twx: num(() => app.state.axisTwist[0], (v) => app.setAxisTwist(0, v)),
    twy: num(() => app.state.axisTwist[1], (v) => app.setAxisTwist(1, v)),
    twz: num(() => app.state.axisTwist[2], (v) => app.setAxisTwist(2, v)),

    onrgh: uniformNum(outer.roughness),
    onmet: uniformNum(outer.metalness),
    env: {
      get: () => app.state.environment,
      set: (name) => app.setEnvironment(name),
      parse: String,
      print: String,
    },
    envi: uniformNum(app.envUniforms.envIntensity),
    term: {
      get: () => app.state.term,
      set: (name) => app.setTerm(name),
      parse: String,
      print: String,
    },
    wire: bool(() => app.state.wireframe, app.setWireframe),

    dbg: {
      get: () => app.state.debug,
      set: (name) => app.setDebug(name),
      parse: String,
      print: String,
    },
    dbgs: uniformNum(app.pipeline.debugShader.uniforms.debugScale),
    onmap: {
      get: () => app.state.outerNormalMap,
      set: (name) => app.setNormalMap("outer", name),
      parse: String,
      print: String,
    },
    onrm: num(
      () => app.outerMaterial().uniforms.normalScale.value,
      (v) => (app.outerMaterial().uniforms.normalScale.value = v),
    ),
    otex: num(
      () => app.outerMaterial().uniforms.texScale.value,
      (v) => (app.outerMaterial().uniforms.texScale.value = v),
    ),
    otint: {
      get: () => app.outerMaterial().uniforms.color.value,
      set: (v) => app.setColor(app.outerMaterial().uniforms.color, ...v),
      parse: parseHex,
      print: printColor,
    },
    oalb: uniformNum(outer.tint),
    ospec: uniformNum(outer.specular),
    sss: uniformNum(outer.useSSS),
    scrn: uniformNum(outer.useScreen),

    sky: color(bg.sky),
    gnd: color(bg.ground),

    inrgh: uniformNum(core.roughness),
    inmet: uniformNum(core.metalness),
    inmap: {
      get: () => app.state.innerNormalMap,
      set: (name) => app.setNormalMap("inner", name),
      parse: String,
      print: String,
    },
    inrm: uniformNum(core.normalScale),
    intex: uniformNum(core.texScale),
    inalb: uniformNum(core.tint),
    inspec: uniformNum(core.specular),
    insss: uniformNum(core.useSSS),
    inscrn: uniformNum(core.useScreen),
    intint: color(core.color),

    corelv: num(() => app.state.coreIsolation, app.setCoreIsolation),

    oabs: color(outer.absorption),
    thick: uniformNum(outer.thickness),
    refr: uniformNum(outer.refraction),
    disp: uniformNum(outer.dispersion),
    iblur: uniformNum(outer.blurStrength),
    scat: uniformNum(outer.scatter),
    dens: uniformNum(outer.density),
    rim: uniformNum(outer.fresnel),
    // Still `refl` in a link: only the label was ever wrong.
    refl: uniformNum(outer.backdropMix),
    gloss: uniformNum(outer.gloss),

    indens: uniformNum(core.density),
    farwall: bool(() => app.state.farWall, app.setFarWall),

    aostr: uniformNum(aoOut.strength),
    aorad: uniformNum(ao.radius),
    aobias: uniformNum(ao.bias),
    aonear: num(() => ao.attenuation.value.x, (v) => (ao.attenuation.value.x = v)),
    aofar: num(() => ao.attenuation.value.y, (v) => (ao.attenuation.value.y = v)),
    aocol: color(aoTint.aoColor),
    aocore: bool(() => app.state.coreOcclusion, app.setCoreOcclusion),

    bloom: uniformNum(grade.bloomStrength),
    bloomr: uniformNum(grade.bloomRadius),
    bloomt: num(
      () => app.pipeline.bloom.threshold,
      (v) => (app.pipeline.bloom.threshold = v),
    ),
    ab: uniformNum(chroma.aberration),
    vig: uniformNum(grade.vignette),
    grain: uniformNum(grade.grain),
    dith: uniformNum(grade.dither),
    aces: bool(
      () => grade.toneMapping.value > 0,
      (v) => (grade.toneMapping.value = v ? 1 : 0),
    ),
    expo: uniformNum(grade.toneMappingExposure),
    fxaa: bool(() => fxaa.fxaa.value > 0, (v) => (fxaa.fxaa.value = v ? 1 : 0)),
  };
}

// Built once: serialize runs on a timer, and rebuilding every field's
// closures twice a second is wasted work.
let cachedApp = null;
let cachedSchema = null;

function schema(app) {
  if (cachedApp !== app) {
    cachedApp = app;
    cachedSchema = buildSchema(app);
  }
  return cachedSchema;
}

function printValue(entry) {
  const raw = entry.get();
  if (entry.print) return entry.print(raw);
  return String(Math.round(raw * 1000) / 1000);
}

function serialize(app) {
  const fields = schema(app);
  const out = new URLSearchParams();
  for (const [key, entry] of Object.entries(fields)) out.set(key, printValue(entry));
  return out.toString();
}

// Skipped by a material preset, never by a url: a link has to reproduce what it
// was saved from.
const GEOMETRY_FIELDS = new Set([
  "res",
  "cres",
  "blobson",
  "blobs",
  "iso",
  "speed",
  "motion",
  "smooth",
  "shape",
  "ssize",
  "sthick",
  "sround",
  "sheight",
  "swidth",
  "sangle",
  "twx",
  "twy",
  "twz",
]);

function apply(app, query, { keep } = {}) {
  const fields = schema(app);
  const params = new URLSearchParams(query);

  // Schema order, not url order, so the material and the transmission mode land
  // before anything they would reset.
  for (const [key, entry] of Object.entries(fields)) {
    if (keep && keep.has(key)) continue;
    if (!params.has(key)) continue;
    const value = entry.parse(params.get(key));
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    entry.set(value);
  }
}

function readUrl(app) {
  const query = location.hash.replace(/^#/, "") || location.search.replace(/^\?/, "");
  if (!query) return false;

  // Every saved link names speed; one missing a newer field predates it.
  const params = new URLSearchParams(query);
  const saved = params.has("speed");
  if (saved && !params.has("motion")) params.set("motion", "legacy");

  apply(app, params.toString());

  if (saved && !params.has("sround")) app.setShapeRounding(legacyRounding(app.state));
  if (saved && !params.has("sheight")) legacyDimensions(app);
  if (saved && !params.has("swidth")) {
    const { numBlobs, isolation, shapeSize } = app.state;
    app.setShapeWidth(0.4 * (shapeSize + surfaceOffset(numBlobs, isolation)));
  }
  return true;
}

function legacyDimensions(app) {
  const { shape, numBlobs, isolation, shapeSize, shapeThickness } = app.state;
  const offset = surfaceOffset(numBlobs, isolation);
  if (shape === "box" || shape.endsWith("hedron")) app.setShapeSize(shapeSize + shapeThickness);
  if (shape === "cylinder") app.setShapeHeight(2 * (shapeThickness + offset));
  if (shape === "torus" || shape === "trefoil") {
    app.setShapeSize(Math.max(shapeSize - offset, 0));
    app.setShapeThickness(shapeThickness + offset);
  }
  if (shape === "mobius") {
    app.setShapeSize(Math.max(shapeSize - offset, 0));
    app.setShapeThickness(shapeThickness + offset / 0.8);
  }
}

function legacyRounding({ shape, numBlobs, isolation, shapeThickness }) {
  const offset = surfaceOffset(numBlobs, isolation);
  if (shape === "box") return offset + shapeThickness;
  if (shape === "cylinder") return offset;
  return 0;
}

// Polled rather than subscribed: the controls write straight into uniforms, so
// there is no signal to listen to.
function syncUrl(app, interval = 500) {
  let last = serialize(app);
  let due = 0;

  return (now) => {
    if (now < due) return;
    due = now + interval;

    const next = serialize(app);
    if (next === last) return;
    last = next;
    history.replaceState(null, "", `#${next}`);
  };
}

// A link preset has to name every field but mat and the geometry, or selecting
// it keeps whatever the previous look left in the missing ones. Selecting one
// never applies geometry, so naming it would only mislead.
function auditPresets(app) {
  const expected = Object.keys(schema(app)).filter(
    (key) => key !== "mat" && !GEOMETRY_FIELDS.has(key),
  );
  const problems = [];

  for (const preset of presets) {
    if (!preset.url) continue;

    const fields = new URLSearchParams(preset.url);
    const missing = expected.filter((key) => !fields.has(key));
    if (missing.length) {
      problems.push(`${preset.name} is missing ${missing.join(", ")}`);
    }

    const ignored = [...fields.keys()].filter((key) => GEOMETRY_FIELDS.has(key));
    if (ignored.length) {
      problems.push(`${preset.name} names ${ignored.join(", ")}, which selecting it never applies`);
    }

    // A link preset is a valid name here: a url copied from the address bar
    // names whichever preset was selected.
    const base = fields.get("mat");
    if (base !== null && findPreset(base) < 0) {
      problems.push(`${preset.name} names mat=${base}, which is not a preset`);
    }
  }

  return problems;
}

export { serialize, apply, auditPresets, readUrl, syncUrl, GEOMETRY_FIELDS };
