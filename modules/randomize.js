import { presets } from "modules/presets.js";
import { shapeNames, shapeRanges } from "modules/sdf.js";
import { motionNames } from "modules/blobMotion.js";

const between = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Suzanne only once built: building it freezes the page for seconds.
function randomizeScene(app) {
  const shapes = shapeNames.filter((name) => name !== "suzanne" || app.modelLoaded());
  const shape = Math.random() < 0.35 ? "none" : pick(shapes);
  app.setShape(shape);

  app.setBlobs(shape === "none" || Math.random() < 0.85);
  app.setNumBlobs(Math.round(between(8, 32)));
  app.setMotion(pick(motionNames));
  app.setSmoothing(Math.random() < 0.7 ? 0 : between(0.1, 0.5));
  app.setTwistStrength(Math.random() < 0.25 ? between(0.5, 2) : 0);
  for (let axis = 0; axis < 3; axis++) app.setAxisTwist(axis, 0);
  if (Math.random() < 0.25) {
    const degrees = Math.round(between(90, 270) * (Math.random() < 0.5 ? -1 : 1));
    app.setAxisTwist(Math.floor(Math.random() * 3), degrees);
  }

  const setters = {
    size: app.setShapeSize,
    thickness: app.setShapeThickness,
    height: app.setShapeHeight,
    rounding: app.setShapeRounding,
    width: app.setShapeWidth,
    angle: app.setShapeAngle,
  };
  for (const [control, [min, max]] of Object.entries(shapeRanges(shape))) {
    setters[control](between(min, max));
  }
}

// A different material and a new scene of shapes.
function randomizeLook(app) {
  const others = presets.map((_, i) => i).filter((i) => i !== app.state.preset);
  app.applyPreset(pick(others));
  randomizeScene(app);
}

export { randomizeLook };
