import { createStats } from "guspira";

// Frame timings are raw: a window would smooth away the spike that shows a
// rebuild landing. Only the frame rate is windowed, and it counts frames in
// the window rather than inverting one duration.
const source = createStats();

const stats = {
  fps: source.fps({ window: 500 }),

  // `rest` is the exact remainder, frame minus the two spans, so the stack adds
  // up to the frame time instead of to something near it.
  frame: source.counter("frame"),
  field: source.counter("field"),
  poly: source.counter("poly"),
  rest: source.counter("rest"),

  gpuVolume: source.counter("gpuVolume"),
  gpuScene: source.counter("gpuScene"),
  gpuAo: source.counter("gpuAo"),
  gpuBloom: source.counter("gpuBloom"),
  gpuGrade: source.counter("gpuGrade"),

  // The grid the core is actually polygonised on, which is not always the one
  // asked for.
  coreGrid: source.counter("coreGrid"),

  triangles: source.counter("triangles"),
  calls: source.counter("calls"),
  geometries: source.counter("geometries"),
  textures: source.counter("textures"),
  programs: source.counter("programs"),

  flush: () => source.flush(),
};

export { stats };
