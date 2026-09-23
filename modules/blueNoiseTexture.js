import {
  DataTexture,
  NearestFilter,
  RGFormat,
  RepeatWrapping,
  UnsignedByteType,
} from "three";
import { generateBlueNoise } from "modules/blueNoise.js";

// One texture for everything that needs a well distributed random number per
// pixel: the occlusion kernel's rotation, and the scattering lobe the glass
// samples. Blue noise rather than a hash because a single sample per pixel is
// all any of them take, and this is the distribution that looks least like a
// pattern at one sample.
const BLUE_NOISE_SIZE = 64;

function makeBlueNoiseTexture() {
  const total = BLUE_NOISE_SIZE * BLUE_NOISE_SIZE;
  const angle = generateBlueNoise(BLUE_NOISE_SIZE, 0x9e3779b1);
  const jitter = generateBlueNoise(BLUE_NOISE_SIZE, 0x85ebca6b);
  const data = new Uint8Array(total * 2);
  for (let i = 0; i < total; i++) {
    data[i * 2] = angle[i];
    data[i * 2 + 1] = jitter[i];
  }
  const texture = new DataTexture(
    data,
    BLUE_NOISE_SIZE,
    BLUE_NOISE_SIZE,
    RGFormat,
    UnsignedByteType,
  );
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.minFilter = texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
}


const blueNoiseTexture = makeBlueNoiseTexture();

export { BLUE_NOISE_SIZE, blueNoiseTexture };
