// Shown only for loads that outlast the delay, so a quick or cached one never
// flashes it.
const DELAY = 250;

const pending = new Set();
let waiting = [];

function update() {
  const element = document.getElementById("loading");
  if (!element) return;

  const shown = [...pending].filter((entry) => entry.visible);
  element.hidden = shown.length === 0;
  if (!shown.length) return;

  const more = shown.length > 1 ? ` and ${shown.length - 1} more` : "";
  element.querySelector(".loading-label").textContent = `${shown.at(-1).label}${more}`;
}

// immediate is for work that blocks the main thread: no timer fires during it,
// so a delayed indicator would only appear once it was over.
function trackLoad(label, promise, { immediate = false } = {}) {
  const entry = { label, visible: immediate, timer: 0 };
  pending.add(entry);

  if (!immediate) {
    entry.timer = setTimeout(() => {
      entry.visible = true;
      update();
    }, DELAY);
  }
  update();

  const done = () => {
    clearTimeout(entry.timer);
    pending.delete(entry);
    update();
    if (!pending.size) {
      waiting.forEach((resolve) => resolve());
      waiting = [];
    }
  };
  promise.then(done, done);

  return promise;
}

// Two hops, not one: a requestAnimationFrame callback runs before that frame
// paints, so work started inside it would still block the paint.
function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

function idle() {
  return pending.size ? new Promise((resolve) => waiting.push(resolve)) : Promise.resolve();
}

export { trackLoad, nextPaint, idle };
