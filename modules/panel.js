import { GUI, random } from "guspira";
import { environments, normalMaps, presets } from "modules/presets.js";
import { shapeNames, shapeUses, shapeDefaults, shapeMaxSize } from "modules/sdf.js";
import { surfaceOffset } from "modules/volume.js";
import { motionNames } from "modules/blobMotion.js";

function usedBy(control) {
  const names = shapeNames.filter((name) => shapeUses(name, control));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
}

// Hover text for each control. guspira puts its randomise hint in this same
// title slot, so the hint is appended at the end of the build instead.
const DESCRIPTIONS = {
  // Material
  "Material": "The preset the whole panel starts from. Everything below can then be changed freely.",

  // Scene
  "Sky": "Colour at the top of the backdrop gradient behind the blobs.",
  "Ground": "Colour at the bottom of the backdrop gradient behind the blobs.",
  "Environment": "The lighting the surface reflects. Its shape matters more than its scene: a mostly black room makes a glossy surface read dark rather than wet.",
  "Env intensity": "How brightly the environment lights the surface.",

  // Debug
  "Wireframe": "Draw the marching cubes mesh as its triangle edges, so the grid the surface was built on is visible.",
  "Term": "Show one stage of the material's colour path on its own instead of the finished shading.",
  "View": "Show one of the pipeline's intermediate buffers instead of the rendered frame.",
  "View scale": "Brightness multiplier for the buffer view, so buffers with very different ranges are all readable. Logarithmic, and only active for the views that need it.",

  // Shape
  "Resolution": "Grid the surface is polygonised on. Higher is finer and slower; a cost setting rather than a look, so it is never randomised.",
  "Blobs": "Whether the moving metaballs contribute to the field at all.",
  "Blob count": "How many metaballs are in the field.",
  "Isolation": "The field value the surface is drawn at. Higher puts the surface closer to the blob centres, so the shape shrinks and separates.",
  "Speed": "How fast the blobs move. 0 freezes them, which also collapses them into a degenerate pose.",
  "Motion": "How the blobs move. Legacy is the original, which travels mostly along one axis and leaves the middle empty. Drift wanders evenly in every direction and fills the middle. Orbit circles the centre on slowly turning paths and gathers into a few larger clumps.",
  "Smoothing": "Blurs the field before polygonising, rounding off detail and merging nearby blobs.",
  "Shape": "A fixed signed-distance shape added to the field alongside the blobs.",
  "Shape size": "How big the shape is: its radius, half its width or how far it reaches, depending on the shape. The range stops where the shape would leave the volume, and settings that would still push it out scale it down to fit.",
  "Shape thickness": `The thickness of a tube, band, sheet or spike. Used by ${usedBy("thickness")}.`,
  "Shape height": `Height of the shape. Used by ${usedBy("height")}.`,
  "Shape width": `Width of the band. Used by ${usedBy("width")}.`,
  "Shape angle": `How much of the ring is kept, in degrees. Used by ${usedBy("angle")}.`,
  "Shape rounding": `Radius of the edges and corners, from sharp at 0, without changing the size. On Suzanne it smooths the model; on the sphube it goes from a cube to a sphere. Used by ${usedBy("rounding")}.`,
  "Twist": "Rotates the field around the cursor, so the surface swirls where the mouse is. The axis is the camera's own, so it always turns in the plane of the screen. 0 is off.",
  "Twist X": "Twists the whole scene around the X axis: the total turn, in degrees, from one side of the volume to the other.",
  "Twist Y": "Twists the whole scene around the Y axis: the total turn, in degrees, from one side of the volume to the other.",
  "Twist Z": "Twists the whole scene around the Z axis: the total turn, in degrees, from one side of the volume to the other.",
  "Twist radius": "How far from the cursor the twist reaches. The angle falls off smoothly to nothing, so there is no seam at the edge.",

  // Shading
  "Roughness": "How blurred the reflection is. 0 is a mirror, 1 is matte.",
  "Metalness": "Whether the surface reflects its own colour like metal, or reflects white and keeps its colour in the diffuse like plastic.",

  // Surface
  "Normal map": "The texture whose bumps are applied to the surface. Projected triplanar, since the blobs have no UVs.",
  "Normal scale": "How deep the normal map's bumps read.",
  "Texture scale": "How many times the normal map repeats across the surface.",

  // Colour
  "Tint": "The surface's own colour. Greys out only when nothing is left for it to reach: fully transparent, non-metallic, and no rim colour.",
  "Colour strength": "How much of the tint reaches the diffuse. Rim colour takes the swatch directly and ignores this.",
  "Specular": "Strength of the reflected highlight.",
  "Rim colour": "Adds the tint back around the edges, standing in for light scattering through a thin surface.",
  "Screen blend": "Blends the shading back over itself to lift the midtones, brightening without clipping the highlights.",

  // Reflection
  "Rim": "How much more reflective the surface becomes at grazing angles.",
  "Gloss": "Sharpens the reflection towards a mirror independently of roughness.",
  "Backdrop mix": "What the surface reflects: 0 is the environment, 1 the flat backdrop gradient.",

  // Transmission
  "Transmission": "How much light passes through the body. 0 is a solid blob; above 0 the surface becomes a glass shell with a separate core inside it, and the controls below come alive.",
  "Absorption": "The colour one unit of the body lets through. What survives the crossing, so it tints what is seen through the glass.",
  "Density": "How much of the body the light has to cross. Scales the absorption; at 0 no colour is absorbed whatever the swatch.",
  "Thickness": "How far light is treated as travelling through the body.",
  "Refraction": "How far the view is bent as it enters the glass.",
  "Dispersion": "Splits the refraction per colour channel, so edges fringe the way real glass does.",
  "Interior blur": "Frosts what is seen through the glass.",
  "Scatter": "How much light spreads sideways inside the body instead of passing straight through.",

  // Glass, in the Inside tab
  "Core resolution": "Grid the core is polygonised on. Its own, because the core is only ever seen through blurred glass.",
  "Core grid": "The grid actually in use. Falls back to the shell's when the core level is too close to the shell's isolation for the two to be meshed apart.",
  "Core level": "The field value the core is drawn at. Higher makes the core smaller and deeper inside the shell.",
  "Far wall": "Whether the shell's own back face goes into the buffer its front face reads.",

  // Occlusion
  "Strength": "How dark the occlusion and shadow go. An exponent, so raising it deepens the contact shading rather than flattening it.",
  "Radius": "How far the occlusion looks for nearby surfaces, in pixels.",
  "Bias": "Pushes samples off the surface before testing, to stop it shadowing itself.",
  "Falloff near": "How quickly occlusion fades with distance close to the surface.",
  "Falloff far": "The distance past which a surface no longer occludes.",
  "Occlusion tint": "The colour the surface is shaded towards where it is occluded or in shadow.",
  "Occlude core": "Occlude the core as well as the shell. Costs a second occlusion pass, and only shows when there is glass to see the core through.",

  // Post
  "Bloom": "Strength of the glow bled out of the bright parts of the frame.",
  "Bloom radius": "How far that glow spreads.",
  "Bloom threshold": "How bright a pixel has to be before it blooms at all.",
  "Aberration": "Splits the colour channels apart towards the corners, like a lens.",
  "Vignette": "Darkens the corners of the frame.",
  "Grain": "Film grain over the finished frame.",
  "Dither": "Adds noise below one colour step to break up banding in the gradients.",
  "ACES tone mapping": "Maps high dynamic range down with a filmic curve. Its deep toe can take an already dim frame to black.",
  "Exposure": "Overall brightness going into the tone mapping.",
  "FXAA": "Smooths the jagged edges of the finished frame.",

  // Stats
  "FPS": "Frames per second.",
  "Frame": "Total time per frame. The line marks 16.7ms, the budget for 60fps.",
  "Frame breakdown": "Where the frame went on the CPU. The three bands are a partition of it -- field and polygonise are measured, rest is the remainder -- so the stack's height is the frame time.",
  "GPU breakdown": "Where the frame went on the GPU, one band per pass.",
  "Field": "CPU time spent building the field this frame.",
  "Polygonise": "CPU time spent turning the field into triangles.",
  "Rest": "The remainder of the frame: everything that is neither field nor polygonise.",
  "GPU volume": "GPU time building the field volume and its marching-cubes mesh.",
  "GPU scene": "GPU time drawing the scene into the G-buffer.",
  "GPU occlusion": "GPU time on the occlusion and shadow pass.",
  "GPU bloom": "GPU time on the bloom pass.",
  "GPU grade": "GPU time on the final grade: chromatic aberration, tone mapping, vignette, grain, FXAA.",
  "Triangles": "Triangles drawn this frame.",
  "Draw calls": "Draw calls issued this frame.",
  "Geometries": "Geometries currently allocated on the GPU.",
  "Textures": "Textures currently allocated on the GPU.",
  "Programs": "Shader programs currently compiled.",
};

// Controls write straight into their uniform; the ones a preset overwrites
// are collected in `bound` so switching preset can push the values back.
function buildPanel(app) {
  const gui = new GUI("Bumpy metaballs 2026", document.querySelector("#panel"), {
    storageKey: "bumpy-metaballs",
  });

  const help = document.getElementById("help");
  gui.rows.prepend(help);
  help.hidden = false;

  // Overrides the remembered open state, which would otherwise win.
  if (matchMedia("(max-width: 600px)").matches) gui.rowsExpanded.set(false);

  const mat = app.material.uniforms;
  const bg = app.backgroundMaterial.uniforms;
  const ao = app.pipeline.aoShader.uniforms;
  const aoOut = app.pipeline.aoResolveShader.uniforms;
  const aoTint = app.pipeline.aoCompositeShader.uniforms;
  const grade = app.pipeline.finalShader.uniforms;
  const fxaa = app.pipeline.fxaaShader.uniforms;
  const core = app.coreMaterial.uniforms;

  const bound = [];

  // Inside a brightness band: unconstrained, both ends can land dark at once.
  function randomColor(minL, maxL) {
    const h = random();
    const sat = 0.3 + random() * 0.45;
    const l = minL + random() * (maxL - minL);
    const c = (1 - Math.abs(2 * l - 1)) * sat;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = l - c / 2;
    const rgb =
      h < 1 / 6 ? [c, x, 0] :
      h < 2 / 6 ? [x, c, 0] :
      h < 3 / 6 ? [0, c, x] :
      h < 4 / 6 ? [0, x, c] :
      h < 5 / 6 ? [x, 0, c] : [c, 0, x];
    return rgb.map((v) => Math.round((v + m) * 255));
  }

  // The uniforms carry authored display values, so the picker speaks the same
  // 0-255 sRGB the presets are written in and nothing gets decoded.
  function toRGB255(color) {
    return [
      Math.round(color.r * 255),
      Math.round(color.g * 255),
      Math.round(color.b * 255),
    ];
  }

  function addColorRow(label, uniform, { light = null } = {}) {
    const row = gui.addColor(label, toRGB255(uniform.value), {
      format: "rgb255",
      title: DESCRIPTIONS[label],
      onChange: ([r, g, b]) => app.setColor(uniform, r, g, b),
    });

    if (light) {
      row.randomize = () => {
        const c = randomColor(light[0], light[1]);
        row.signal.set(c);
        app.setColor(uniform, ...c);
      };
    }

    bound.push(() => row.signal.set(toRGB255(uniform.value)));
    return row;
  }

  function addNormalMap(which) {
    const names = normalMaps.map((m) => m.name);
    const key = which === "inner" ? "innerNormalMap" : "outerNormalMap";
    const row = gui.addSelect("Normal map", app.state[key], names, {
    title: DESCRIPTIONS["Normal map"],
      title: DESCRIPTIONS["Normal map"],
      onChange: (name) => app.setNormalMap(which, name),
    });
    bound.push(() => row.signal.set(app.state[key]));
    return row;
  }

  // `gates` marks a slider that decides whether some *other* row is enabled.
  // Those states are recomputed in sync, not per frame, so such a slider has to
  // ask for one. Only the three that gate anything pay for it, because sync
  // walks every bound control and this runs on each frame of a drag.
  function addUniformSlider(label, uniform, min, max, step, opts = {}) {
    const write = opts.onChange ?? ((v) => (uniform.value = v));
    const row = gui.addSlider(label, uniform.value, min, max, step, {
      title: DESCRIPTIONS[label],
      onChange: opts.gates
        ? (v) => {
            write(v);
            bound.forEach((update) => update());
          }
        : write,
    });
    bound.push(() => row.signal.set(uniform.value));
    return row;
  }

  // The roll never switches material or mode: either would pull every other
  // control back to a preset's defaults.
  const material = gui.addSelect(
    "Material",
    presets[app.state.preset].name,
    presets.map((p) => p.name),
    {
    title: DESCRIPTIONS["Material"],
      onChange: (name) =>
        app.applyPreset(presets.findIndex((p) => p.name === name)),
    },
  );
  material.randomize = null;
  bound.push(() => material.signal.set(presets[app.state.preset].name));

  gui.addTab("Scene");

  const resolution = gui.addSlider("Resolution", app.state.resolution, 20, 120, 2, {
    title: DESCRIPTIONS["Resolution"],
    onChange: (v) => app.setResolution(v),
  });
  resolution.randomize = null;
  bound.push(() => resolution.signal.set(app.state.resolution));

  const blobsOn = gui.addCheckbox("Blobs", app.state.blobs, {
    title: DESCRIPTIONS["Blobs"],
    onChange: (v) => app.setBlobs(v),
  });
  bound.push(() => blobsOn.signal.set(app.state.blobs));

  const blobs = gui.addSlider("Blob count", app.state.numBlobs, 1, 40, 1, {
    title: DESCRIPTIONS["Blob count"],
    onChange: (v) => app.setNumBlobs(v),
  });
  bound.push(() => {
    blobs.signal.set(app.state.numBlobs);
    blobs.setDisabled(!app.state.blobs);
  });

  const isolation = gui.addSlider("Isolation", app.state.isolation, 10, 200, 1, {
    title: DESCRIPTIONS["Isolation"],
    onChange: (v) => app.setIsolation(v),
  });
  bound.push(() => isolation.signal.set(app.state.isolation));

  const speed = gui.addSlider("Speed", app.state.speed, 0, 4, 0.01, {
    title: DESCRIPTIONS["Speed"],
    onChange: (v) => (app.state.speed = v),
  });
  bound.push(() => speed.signal.set(app.state.speed));

  const motion = gui.addSelect("Motion", app.state.motion, motionNames, {
    title: DESCRIPTIONS["Motion"],
    onChange: (v) => app.setMotion(v),
  });
  bound.push(() => {
    motion.signal.set(app.state.motion);
    motion.setDisabled(!app.state.blobs);
  });

  const smoothing = gui.addSlider("Smoothing", app.state.smoothing, 0, 1, 0.01, {
    title: DESCRIPTIONS["Smoothing"],
    onChange: (v) => app.setSmoothing(v),
  });
  bound.push(() => smoothing.signal.set(app.state.smoothing));

  gui.addSeparator();

  const shape = gui.addSelect("Shape", app.state.shape, ["none", ...shapeNames], {
    title: DESCRIPTIONS["Shape"],
    onChange: (v) => {
      const setters = {
        size: app.setShapeSize,
        thickness: app.setShapeThickness,
        height: app.setShapeHeight,
        rounding: app.setShapeRounding,
        width: app.setShapeWidth,
        angle: app.setShapeAngle,
      };
      for (const [control, value] of Object.entries(shapeDefaults(v))) setters[control](value);
      app.setShape(v);
    },
  });
  bound.push(() => shape.signal.set(app.state.shape));

  const ssize = gui.addSlider("Shape size", app.state.shapeSize, 0.05, 0.45, 0.005, {
    title: DESCRIPTIONS["Shape size"],
    onChange: (v) => app.setShapeSize(v),
  });
  bound.push(() => {
    const s = app.state;
    const max = shapeMaxSize(
      s.shape,
      { thickness: s.shapeThickness, height: s.shapeHeight, rounding: s.shapeRounding, width: s.shapeWidth },
      surfaceOffset(s.numBlobs, s.isolation),
    );
    ssize.el.max = Math.max(0.06, Math.min(0.45, Math.floor(max / 0.005) * 0.005));
    ssize.signal.set(s.shapeSize);
    ssize.setVisible(s.shape !== "none");
  });

  const sthick = gui.addSlider("Shape thickness", app.state.shapeThickness, 0.0, 0.3, 0.001, {
    curve: 2,
    title: DESCRIPTIONS["Shape thickness"],
    onChange: (v) => app.setShapeThickness(v),
  });
  bound.push(() => {
    sthick.signal.set(app.state.shapeThickness);
    sthick.setVisible(shapeUses(app.state.shape, "thickness"));
  });

  const sheight = gui.addSlider("Shape height", app.state.shapeHeight, 0.01, 0.9, 0.005, {
    title: DESCRIPTIONS["Shape height"],
    onChange: (v) => app.setShapeHeight(v),
  });
  bound.push(() => {
    sheight.signal.set(app.state.shapeHeight);
    sheight.setVisible(shapeUses(app.state.shape, "height"));
  });

  const swidth = gui.addSlider("Shape width", app.state.shapeWidth, 0.01, 0.3, 0.001, {
    curve: 2,
    title: DESCRIPTIONS["Shape width"],
    onChange: (v) => app.setShapeWidth(v),
  });
  bound.push(() => {
    swidth.signal.set(app.state.shapeWidth);
    swidth.setVisible(shapeUses(app.state.shape, "width"));
  });

  const sangle = gui.addSlider("Shape angle", app.state.shapeAngle, 30, 350, 1, {
    title: DESCRIPTIONS["Shape angle"],
    onChange: (v) => app.setShapeAngle(v),
  });
  bound.push(() => {
    sangle.signal.set(app.state.shapeAngle);
    sangle.setVisible(shapeUses(app.state.shape, "angle"));
  });

  const sround = gui.addSlider("Shape rounding", app.state.shapeRounding, 0.0, 0.4, 0.001, {
    curve: 2,
    title: DESCRIPTIONS["Shape rounding"],
    onChange: (v) => app.setShapeRounding(v),
  });
  bound.push(() => {
    sround.signal.set(app.state.shapeRounding);
    sround.setVisible(shapeUses(app.state.shape, "rounding"));
  });

  gui.addSeparator();

  ["X", "Y", "Z"].forEach((name, axis) => {
    const slider = gui.addSlider(`Twist ${name}`, app.state.axisTwist[axis], -360, 360, 1, {
      title: DESCRIPTIONS[`Twist ${name}`],
      onChange: (v) => app.setAxisTwist(axis, v),
    });
    bound.push(() => slider.signal.set(app.state.axisTwist[axis]));
  });

  const twist = gui.addSlider("Twist", app.state.twistStrength, 0, 4, 0.01, {
    title: DESCRIPTIONS["Twist"],
    onChange: (v) => app.setTwistStrength(v),
  });
  bound.push(() => twist.signal.set(app.state.twistStrength));

  const twistRadius = gui.addSlider("Twist radius", app.state.twistRadius, 0.05, 1, 0.01, {
    title: DESCRIPTIONS["Twist radius"],
    onChange: (v) => app.setTwistRadius(v),
  });
  bound.push(() => {
    twistRadius.signal.set(app.state.twistRadius);
    twistRadius.setDisabled(app.state.twistStrength === 0);
  });

  gui.addSeparator();

  addColorRow("Sky", bg.sky, { light: [0.45, 0.85] });
  addColorRow("Ground", bg.ground, { light: [0.15, 0.55] });
  const environment = gui.addSelect(
    "Environment",
    app.state.environment,
    environments.map((e) => e.name),
    {
    title: DESCRIPTIONS["Environment"], onChange: (name) => app.setEnvironment(name) },
  );
  bound.push(() => environment.signal.set(app.state.environment));

  addUniformSlider("Env intensity", app.envUniforms.envIntensity, 0, 3, 0.01);

  function addSurface(which) {
    const u = which === "inner" ? core : mat;

    gui.addSection("Shading");
    addUniformSlider("Roughness", u.roughness, 0, 1, 0.01);
    addUniformSlider("Metalness", u.metalness, 0, 1, 0.01, { gates: true });

    gui.addSection("Surface");
    addNormalMap(which);
    addUniformSlider("Normal scale", u.normalScale, 0, 3, 0.01);
    addUniformSlider("Texture scale", u.texScale, 1, 30, 0.1);

    gui.addSection("Colour");
    const tintRow = addColorRow("Tint", u.color);
    const strengthRow = addUniformSlider("Colour strength", u.tint, 0, 1, 0.01);
    const specRow = addUniformSlider("Specular", u.specular, 0, 1, 0.01);
    const rimRow = addUniformSlider("Rim colour", u.useSSS, 0, 1, 0.01, { gates: true });
    const screenRow = addUniformSlider("Screen blend", u.useScreen, 0, 1, 0.01);

    // The albedo has three ways out: the diffuse, weighted by
    // (1 - transmission) * (1 - metalness); F0, weighted by metalness; and the
    // rim colour, which takes the swatch whatever the colour strength is.
    bound.push(() => {
      const transmission = u.transmission.value;
      const metalness = u.metalness.value;
      const rim = u.useSSS.value;

      const toDiffuse = (1 - transmission) * (1 - metalness);
      const toFresnel = metalness;

      strengthRow.setDisabled(toDiffuse <= 0 && toFresnel <= 0);
      tintRow.setDisabled(toDiffuse <= 0 && toFresnel <= 0 && rim <= 0);
    });

    // The core is drawn in the opaque pass, before the copy the transmission
    // reads exists, so it would sample the previous frame's copy -- which already
    // contains the core -- and smear it back over itself.
    if (which === "inner") return;

    gui.addSection("Reflection");
    addUniformSlider("Rim", u.fresnel, 0, 3, 0.01);
    addUniformSlider("Gloss", u.gloss, 0, 1, 0.01);
    // Named for what it mixes in, because as an amount of reflection it runs
    // backwards.
    addUniformSlider("Backdrop mix", u.backdropMix, 0, 1, 0.01);

    gui.addSection("Transmission");
    addUniformSlider("Transmission", u.transmission, 0, 1, 0.01, {
      onChange: (v) => app.setTransmission(v),
    });

    const absorptionRow = addColorRow("Absorption", u.absorption);
    const densityRow = addUniformSlider("Density", u.density, 0, 8, 0.05, { gates: true });
    const thicknessRow = addUniformSlider("Thickness", u.thickness, 0, 3, 0.01);
    const refractionRow = addUniformSlider("Refraction", u.refraction, 0, 2, 0.01);
    const dispersionRow = addUniformSlider("Dispersion", u.dispersion, 0, 1, 0.01);
    const blurRow = addUniformSlider("Interior blur", u.blurStrength, 0, 32, 0.1);
    const scatterRow = addUniformSlider("Scatter", u.scatter, 0, 4, 0.05);

    const crossingRows = [absorptionRow, densityRow, thicknessRow, refractionRow,
      dispersionRow, blurRow, scatterRow];

    bound.push(() => {
      const none = u.transmission.value <= 0;
      for (const row of crossingRows) row.setDisabled(none);

      // Raised to the path length times the density, so a zero exponent is 1
      // whatever the colour.
      if (!none) absorptionRow.setDisabled(u.density.value <= 0);
    });
  }

  gui.addTab("Outside");
  addSurface("outer");

  gui.addTab("Inside");
  addSurface("inner");

  gui.addSection("Glass");

  const coreRes = gui.addSlider("Core resolution", app.state.coreResolution, 20, 120, 2, {
    title: DESCRIPTIONS["Core resolution"],
    onChange: (v) => app.setCoreResolution(v),
  });
  coreRes.randomize = null;
  bound.push(() => coreRes.signal.set(app.state.coreResolution));

  // The guard can overrule this slider: a core level near the shell's isolation
  // has to share the shell's field or the two meshings interpenetrate.
  bound.push(() =>
    coreRes.setDisabled(app.coreFieldResolution() !== app.state.coreResolution),
  );

  gui.addMonitor("Core grid", app.stats.coreGrid, {
    title: DESCRIPTIONS["Core grid"],
    format: (v) => {
      const n = Math.round(v);
      return n === app.state.coreResolution ? String(n) : `${n} — shared with shell`;
    },
  });

  const coreIso = gui.addSlider("Core level", app.state.coreIsolation, 80, 400, 1, {
    title: DESCRIPTIONS["Core level"],
    onChange: (v) => app.setCoreIsolation(v),
  });
  bound.push(() => coreIso.signal.set(app.state.coreIsolation));

  const farWall = gui.addCheckbox("Far wall", app.state.farWall, {
    title: DESCRIPTIONS["Far wall"],
    onChange: (v) => app.setFarWall(v),
  });
  farWall.randomize = null;
  bound.push(() => farWall.signal.set(app.state.farWall));

  gui.addTab("Occlusion");

  addUniformSlider("Strength", aoOut.strength, 0, 10, 0.05);
  addUniformSlider("Radius", ao.radius, 0, 120, 1);
  addUniformSlider("Bias", ao.bias, 0, 0.3, 0.005);
  gui.addSlider("Falloff near", ao.attenuation.value.x, 0.1, 5, 0.05, {
    title: DESCRIPTIONS["Falloff near"],
    onChange: (v) => (ao.attenuation.value.x = v),
  });
  gui.addSlider("Falloff far", ao.attenuation.value.y, 0, 40, 0.1, {
    title: DESCRIPTIONS["Falloff far"],
    onChange: (v) => (ao.attenuation.value.y = v),
  });
  addColorRow("Occlusion tint", aoTint.aoColor);

  // Occluding the core costs a second evaluation of the whole occlusion pass,
  // and only buys anything when there is glass for the core to be seen through.
  const coreAo = gui.addCheckbox("Occlude core", app.state.coreOcclusion, {
    title: DESCRIPTIONS["Occlude core"],
    onChange: (v) => app.setCoreOcclusion(v),
  });
  bound.push(() => coreAo.signal.set(app.state.coreOcclusion));

  gui.addTab("Debug");

  const term = gui.addSelect("Term", app.state.term, app.terms, {
    title: DESCRIPTIONS["Term"],
    onChange: (name) => app.setTerm(name),
  });
  term.randomize = null;
  bound.push(() => term.signal.set(app.state.term));

  const wire = gui.addCheckbox("Wireframe", app.state.wireframe, {
    title: DESCRIPTIONS["Wireframe"],
    onChange: (v) => app.setWireframe(v),
  });
  wire.randomize = null;
  bound.push(() => wire.signal.set(app.state.wireframe));

  const debugView = gui.addSelect(
    "View",
    app.state.debug,
    ["off", ...Object.keys(app.pipeline.debugViews)],
    {
    title: DESCRIPTIONS["View"], onChange: (name) => app.setDebug(name) },
  );
  debugView.randomize = null;
  bound.push(() => debugView.signal.set(app.state.debug));

  // Logarithmic, 0.1 to 1000: a view space position reads around 5 and a
  // normalised depth needs hundreds before it bands.
  const scaleU = app.pipeline.debugShader.uniforms.debugScale;
  const toSlider = (v) => Math.log10(Math.max(v, 0.1)) / 4 + 0.25;
  const fromSlider = (t) => Math.pow(10, (t - 0.25) * 4);

  const debugScale = gui.addSlider("View scale", toSlider(scaleU.value), 0, 1, 0.001, {
    title: DESCRIPTIONS["View scale"],
    onChange: (t) => (scaleU.value = fromSlider(t)),
  });
  debugScale.randomize = null;
  bound.push(() => debugScale.signal.set(toSlider(scaleU.value)));

  const SCALED = new Set([2, 3, 4, 5]);
  bound.push(() => {
    const view = app.pipeline.debugViews[app.state.debug];
    debugScale.setDisabled(!view || !SCALED.has(view.mode));
  });

  gui.addSeparator();

  const ms = (v) => `${v.toFixed(2)} ms`;
  function addRange(label, counter, { digits = 2, unit = " ms", warn = (v) => v > 16.7 } = {}) {
    const controller = gui.addMonitor(label, counter.summary, {
      title: DESCRIPTIONS[label], format: () => "" });
    const value = document.createElement("span");
    value.className = "stat-value";
    const range = document.createElement("span");
    range.className = "stat-range";
    controller.row.append(value, range);
    controller.bind(() => {
      const { mean, min, max } = counter.summary();
      value.textContent = `${mean.toFixed(digits)}${unit}`;
      value.classList.toggle("stat-warn", warn(mean));
      range.textContent = `${min.toFixed(digits)}–${max.toFixed(digits)}`;
    });
    return controller;
  }
  const count = (v) => Math.round(v).toLocaleString();

  addRange("FPS", app.stats.fps, { digits: 0, unit: "", warn: (v) => v < 55 });

  // 16.7ms is the line worth crossing, so both graphs mark it.
  gui.addGraph("Frame", app.stats.frame, {
    title: DESCRIPTIONS["Frame"],
    over: 16.7,
    format: ms,
  });

  // Stacked, and the three series are a partition of the frame rather than
  // three unrelated timings: field and polygonise are measured, rest is the
  // remainder. So the stack's height *is* the frame time, and which band grows
  // says where a frame went. Both CPU bands drop to nothing while paused,
  // because the field is only rebuilt when something moved.
  gui.addGraph("Frame breakdown", [app.stats.field, app.stats.poly, app.stats.rest], {
    title: DESCRIPTIONS["Frame breakdown"],
    stacked: true,
    over: 16.7,
    format: ms,
  });

  addRange("Field", app.stats.field);
  addRange("Polygonise", app.stats.poly);
  addRange("Rest", app.stats.rest);

  gui.addSeparator();

  // What the GPU spent, which is where nearly all of Rest goes. The three CPU
  // bands above only measure how long it took to hand the work over — the
  // driver returns from a draw long before the work is done, so a slow frame
  // shows up as an unexplained Rest rather than against the pass that caused
  // it. These come from timer queries instead, and are a frame or two stale by
  // construction. They read zero where the driver will not report timings.
  gui.addGraph(
    "GPU breakdown",
    [
      app.stats.gpuVolume,
      app.stats.gpuScene,
      app.stats.gpuAo,
      app.stats.gpuBloom,
      app.stats.gpuGrade,
    ],
    {
      title: DESCRIPTIONS["GPU breakdown"],
      stacked: true,
      over: 16.7,
      format: ms,
    },
  );

  // Volume is the only band that does not scale with the pixel count — it is
  // the grid, cubed. If everything except volume grows together, the window got
  // bigger; if one band grows alone, that pass is the one to look at.
  addRange("GPU volume", app.stats.gpuVolume);
  addRange("GPU scene", app.stats.gpuScene);
  addRange("GPU occlusion", app.stats.gpuAo);
  addRange("GPU bloom", app.stats.gpuBloom);
  addRange("GPU grade", app.stats.gpuGrade);

  gui.addSeparator();

  gui.addMonitor("Triangles", app.stats.triangles, {
    title: DESCRIPTIONS["Triangles"], format: count });
  gui.addMonitor("Draw calls", app.stats.calls, {
    title: DESCRIPTIONS["Draw calls"], format: count });
  gui.addMonitor("Geometries", app.stats.geometries, {
    title: DESCRIPTIONS["Geometries"], format: count });
  gui.addMonitor("Textures", app.stats.textures, {
    title: DESCRIPTIONS["Textures"], format: count });
  gui.addMonitor("Programs", app.stats.programs, {
    title: DESCRIPTIONS["Programs"], format: count });

  gui.addTab("Post");

  addUniformSlider("Bloom", grade.bloomStrength, 0, 3, 0.01);
  addUniformSlider("Bloom radius", grade.bloomRadius, 0, 1, 0.01);
  gui.addSlider("Bloom threshold", app.pipeline.bloom.threshold, 0, 2, 0.01, {
    title: DESCRIPTIONS["Bloom threshold"],
    onChange: (v) => (app.pipeline.bloom.threshold = v),
  });

  gui.addSeparator();
  addUniformSlider("Aberration", grade.aberration, 0, 30, 0.5);
  // Full strength is worth having on the slider but not worth rolling into:
  // it leaves almost nothing of the frame outside the middle.
  const vignette = addUniformSlider("Vignette", grade.vignette, 0, 1, 0.01);
  vignette.randomize = () => {
    const v = Math.round(random() * 60) / 100;
    vignette.signal.set(v);
    grade.vignette.value = v;
  };
  addUniformSlider("Grain", grade.grain, 0, 0.3, 0.005);
  addUniformSlider("Dither", grade.dither, 0, 3, 0.1);

  gui.addSeparator();
  // The ACES curve has a deep toe, so rolling it on top of an already dim frame
  // takes the whole thing to black. It is a grade mode rather than a parameter,
  // so like FXAA it stays a deliberate choice.
  const aces = gui.addCheckbox("ACES tone mapping", grade.toneMapping.value > 0, {
    title: DESCRIPTIONS["ACES tone mapping"],
    onChange: (v) => (grade.toneMapping.value = v ? 1 : 0),
  });
  aces.randomize = null;
  bound.push(() => aces.signal.set(grade.toneMapping.value > 0));
  addUniformSlider("Exposure", grade.toneMappingExposure, 0.1, 3, 0.01);
  // Antialiasing is not a look either, so it sits out the randomizer too.
  const aa = gui.addCheckbox("FXAA", fxaa.fxaa.value > 0, {
    title: DESCRIPTIONS["FXAA"],
    onChange: (v) => (fxaa.fxaa.value = v ? 1 : 0),
  });
  aa.randomize = null;
  bound.push(() => aa.signal.set(fxaa.fxaa.value > 0));

  // A randomizable control advertises that by putting the hint in its label's
  // tooltip -- the same slot the description above just filled, and the
  // description wins. So the hint is appended here instead, once the build is
  // over and the controls that opt out have had their randomize cleared, which
  // is what keeps it off the ones that cannot actually be rolled.
  for (const controller of gui._controllers) {
    const label = controller.labelEl;
    if (!controller.randomize || !label || !label.title) continue;
    label.title = `${label.title}\n\nClick to randomise.`;
  }

  return {
    gui,
    sync: () => bound.forEach((update) => update()),
  };
}

export { buildPanel };
