import { Vector2, Vector3 } from "three";

// The ray through the cursor meets the plane through the origin facing the
// camera, which is where the blobs live. onMove gets that point and the view
// direction.
function trackPointer(element, camera, onMove) {
  const ndc = new Vector2();
  const ray = new Vector3();
  const forward = new Vector3();
  const toOrigin = new Vector3();
  const hit = new Vector3();

  element.addEventListener("pointermove", (event) => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

    ray.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position).normalize();

    camera.getWorldDirection(forward);
    toOrigin.set(0, 0, 0).sub(camera.position);

    const denom = ray.dot(forward);
    if (Math.abs(denom) < 1e-6) return;

    hit.copy(ray).multiplyScalar(toOrigin.dot(forward) / denom).add(camera.position);
    onMove(hit, forward, event);
  });
}

export { trackPointer };
