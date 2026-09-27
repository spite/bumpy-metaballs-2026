import { createStats, signal } from "guspira";

// Frame timings are raw: a window would smooth away the spike that shows a
// rebuild landing. Only the frame rate is windowed, and it counts frames in
// the window rather than inverting one duration.
const source = createStats();

const WINDOW = 1000;
const REFRESH = 250;

function windowed(counter) {
  const samples = [];
  const summary = signal({ mean: 0, min: 0, max: 0 });
  const record = (value) => {
    samples.push(performance.now(), value);
  };
  setInterval(() => {
    const cutoff = performance.now() - WINDOW;
    let first = 0;
    while (first < samples.length && samples[first] < cutoff) first += 2;
    samples.splice(0, first);
    if (!samples.length) return;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 1; i < samples.length; i += 2) {
      sum += samples[i];
      min = Math.min(min, samples[i]);
      max = Math.max(max, samples[i]);
    }
    summary.set({ mean: sum / (samples.length / 2), min, max });
  }, REFRESH);

  if (counter.sample) {
    const sample = counter.sample.bind(counter);
    counter.sample = (value) => {
      record(value);
      return sample(value);
    };
  }
  if (counter.tick) {
    const tick = counter.tick.bind(counter);
    counter.tick = () => {
      tick();
      record(counter.peek());
      return counter;
    };
  }
  counter.summary = summary;
  return counter;
}

const stats = {
  fps: windowed(source.fps({ window: 500 })),

  // `rest` is the exact remainder, frame minus the two spans, so the stack adds
  // up to the frame time instead of to something near it.
  frame: source.counter("frame"),
  field: windowed(source.counter("field")),
  poly: windowed(source.counter("poly")),
  rest: windowed(source.counter("rest")),

  gpuVolume: windowed(source.counter("gpuVolume")),
  gpuScene: windowed(source.counter("gpuScene")),
  gpuAo: windowed(source.counter("gpuAo")),
  gpuBloom: windowed(source.counter("gpuBloom")),
  gpuGrade: windowed(source.counter("gpuGrade")),

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
