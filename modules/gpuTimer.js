// How long the GPU actually spent, not how long the CPU spent asking.
//
// Wall clock around GL calls measures the time to queue commands and nothing
// else: the driver may return immediately and do the work later, which is how
// the volume build looked like 0.62ms while costing several times that. A
// gl.finish() per span is honest but stalls the pipeline it measures.
const EXTENSION = "EXT_disjoint_timer_query_webgl2";

class GpuTimer {
  constructor(renderer) {
    const gl = renderer.getContext();
    this.gl = gl;
    this.ext = gl.getExtension(EXTENSION);

    // Absent on plenty of drivers, and wherever the browser treats timing as a
    // fingerprinting risk. Everything below turns into a no-op.
    this.supported = Boolean(this.ext);

    this.pending = [];
    this.results = new Map();
    this.active = null;
    this.pool = [];
  }

  // Only one TIME_ELAPSED query can be open at a time: they cannot nest, and
  // beginning a second is an error rather than a stack, so a span already
  // inside another is ignored.
  begin(name) {
    if (!this.supported || this.active) return;

    const gl = this.gl;
    const query = this.pool.pop() ?? gl.createQuery();
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.active = { name, query };
  }

  end() {
    if (!this.supported || !this.active) return;

    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  // Collects whatever has finished, generally a frame or two behind.
  poll() {
    if (!this.supported) return;

    const gl = this.gl;

    // A disjoint means the GPU was interrupted and every result in flight is
    // nonsense rather than merely late.
    if (gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
      for (const { query } of this.pending) this.pool.push(query);
      this.pending.length = 0;
      return;
    }

    const still = [];

    for (const entry of this.pending) {
      if (!gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE)) {
        still.push(entry);
        continue;
      }

      const nanoseconds = gl.getQueryParameter(entry.query, gl.QUERY_RESULT);
      const previous = this.results.get(entry.name) ?? 0;

      // Spans sharing a name add rather than replace.
      this.results.set(entry.name, previous + nanoseconds / 1e6);
      this.pool.push(entry.query);
    }

    this.pending = still;
  }

  // Read and clear, so a name that stopped being measured reads zero rather
  // than holding its last value.
  take(name) {
    const value = this.results.get(name) ?? 0;
    this.results.set(name, 0);
    return value;
  }

  dispose() {
    if (!this.supported) return;
    for (const { query } of this.pending) this.gl.deleteQuery(query);
    for (const query of this.pool) this.gl.deleteQuery(query);
    this.pending.length = 0;
    this.pool.length = 0;
  }
}

export { GpuTimer };
