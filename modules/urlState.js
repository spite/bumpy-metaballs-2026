import { presets } from "modules/presets.js";

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
        const wanted = name.toLowerCase();
        const i = presets.findIndex((p) => p.name.toLowerCase() === wanted);
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
    smooth: num(() => app.state.smoothing, app.setSmoothing),
    shape: {
      get: () => app.state.shape,
      set: (name) => app.setShape(name),
      parse: String,
      print: String,
    },
    ssize: num(() => app.state.shapeSize, app.setShapeSize),
    sthick: num(() => app.state.shapeThickness, app.setShapeThickness),

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
  "smooth",
  "shape",
  "ssize",
  "sthick",
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
  apply(app, query);
  return true;
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

// A link preset has to name every field but mat, or selecting it keeps whatever
// the previous look left in the missing ones.
function auditPresets(app) {
  const expected = Object.keys(schema(app)).filter((key) => key !== "mat");
  const names = new Set(presets.map((preset) => preset.name.toLowerCase()));
  const problems = [];

  for (const preset of presets) {
    if (!preset.url) continue;

    const fields = new URLSearchParams(preset.url);
    const missing = expected.filter((key) => !fields.has(key));
    if (missing.length) {
      problems.push(`${preset.name} is missing ${missing.join(", ")}`);
    }

    // A link preset is a valid name here: a url copied from the address bar
    // names whichever preset was selected.
    const base = fields.get("mat");
    if (base !== null && !names.has(base.toLowerCase())) {
      problems.push(`${preset.name} names mat=${base}, which is not a preset`);
    }
  }

  return problems;
}

export { serialize, apply, auditPresets, readUrl, syncUrl, GEOMETRY_FIELDS };
