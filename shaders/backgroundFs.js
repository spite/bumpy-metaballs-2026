import { mrtOutputs, sRGBToLinear } from "shaders/common.js";

const shader = `precision highp float;
precision highp sampler2D;

uniform vec3 cameraPosition;
uniform vec3 sky;
uniform vec3 ground;

in vec3 vWorldPosition;

${mrtOutputs}
${sRGBToLinear}
void main() {
  // Ground to sky along the world vertical, so the gradient stays put as the
  // camera orbits instead of being painted onto the screen. threejs-conf does
  // this by reconstructing the view ray out of the inverse matrices; here the
  // backdrop is real geometry, so the direction is just where the fragment sits
  // as seen from the camera.
  vec3 dir = normalize(vWorldPosition - cameraPosition);
  vec3 base = mix(ground, sky, dir.y * 0.5 + 0.5);

  fragColor = vec4(sRGBToLinear(base), 1.0);

  // w = 0 marks these fragments as background, so the AO pass leaves them alone
  fragPosition = vec4(0.0);
  fragNormal = vec4(0.0);

  // No diffuse light of its own to occlude. Left unwritten the attachment keeps
  // whatever was last in it, and the resolve would subtract that from the sky.
  fragDiffuse = vec4(0.0);
}
`;

export { shader };
