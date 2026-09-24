// The three block looks, then the saved links.
//
// `transmission.amount` is the same 0 to 1 the panel's slider shows: 0 leaves
// a solid blob and draws no core. `tint` is the absorption colour. `inside`
// overrides the core's material.
//
// The RGB triplets were tuned against shading that ran in display space, so
// they go to the shader untouched rather than decoded as sRGB.
const environments = [
  { name: "studio", url: "assets/studio.hdr" },
  { name: "sunrise", url: "assets/sunrise.hdr" },
  { name: "street", url: "assets/street.hdr" },
  { name: "sunset", url: "assets/sunset.hdr" },
  { name: "overcast", url: "assets/overcast.hdr" },
  { name: "room", url: "assets/room.hdr" },
];

const normalMaps = [
  { name: "organic", url: "assets/723-normal.jpg" },
  { name: "cells", url: "assets/cells-normal.jpg" },
  { name: "crinkle", url: "assets/ice-snow.jpg" },
  { name: "crumple", url: "assets/crumple-normal.jpg" },
  { name: "cracked", url: "assets/cracked-normal.jpg" },
  { name: "rock", url: "assets/rock-normal.jpg" },
  { name: "ridges", url: "assets/ridges-normal.jpg" },
  { name: "weave", url: "assets/carbon-fiber.jpg" },
  { name: "tread", url: "assets/tread-normal.jpg" },
  { name: "quilted", url: "assets/quilted-normal.jpg" },
];

const presets = [
  {
    name: "flesh",
    normalMap: "assets/ice-snow.jpg",
    normalScale: 1,
    texScale: 5,
    useSSS: 1,
    useScreen: 0,
    color: [181, 65, 52],
    ground: [181, 65, 52],
    sky: [255, 145, 132],
    transmission: {
      amount: 0,
      // The core takes its colour as an albedo (strength 1), the outer surface adds
      // it at strength 0, so one swatch cannot serve both.
      inside: { color: [255, 92, 73] },
    },
  },
  {
    name: "carbon",
    normalMap: "assets/carbon-fiber.jpg",
    normalScale: 1,
    texScale: 10,
    useSSS: 0,
    useScreen: 1,
    color: [0, 0, 0],
    ground: [36, 70, 106],
    sky: [116, 150, 186],
    transmission: {
      amount: 0,
      // The core takes its colour as an albedo (strength 1) while the outer
      // surface adds the preset's own colour at strength 0, so the two want
      // different values out of one swatch. Stating the core's separately is
      // what lets the albedo carry the brightness without the outer's rim term
      // changing with it. This is that colour normalised, which is exactly what
      // the shader used to do to it on the way past.
      inside: { color: [87, 168, 255] },
    },
  },
  {
    name: "amoeba",
    normalMap: "assets/723-normal.jpg",
    normalScale: 0.5,
    texScale: 10,
    useSSS: 0.15,
    useScreen: 0,
    color: [18, 72, 85],
    ground: [18, 72, 85],
    sky: [98, 152, 165],
    // Kept low because roughness now also frosts the interior, and this preset
    // is meant to read as clear glass over a visible core.
    roughness: 0.08,
    transmission: {
      amount: 0.63,
      // What one unit of glass lets through, so it wants to be a colour you
      // could see something through, not the dark additive shading tint.
      tint: [130, 225, 195],
      coreIsolation: 130,
      thickness: 1.1,
      refraction: 0.35,
      dispersion: 0.25,
      blurStrength: 2.5,
      density: 1.8,
      fresnel: 1,
      // How much of the rim is the backdrop reflected off the shell rather than
      // the matcap's baked studio. 1 is all environment, 0 all matcap.
      reflection: 0.65,
      // The core is its own material. Anything left out here falls back to the
      // outer material's value, so only the differences need stating.
      inside: {
        roughness: 0.2,
        normalScale: 0.8,
        texScale: 14,
        useSSS: 0.4,
        color: [60, 223, 255],
      },
    },
  },
  // Link presets must name every url field except mat, which is optional and
  // applies that preset first as a base. Picking one from the panel skips
  // GEOMETRY_FIELDS in modules/urlState.js; only loading a url applies those.
  {
    name: "blood ice",
    url: "mat=flesh&trans=1&res=50&blobson=1&blobs=20&iso=80&speed=1&smooth=0.69&shape=icosahedron&ssize=0.2&sthick=0.12&onrgh=0&onmet=0&env=studio&envi=1&onmap=crinkle&onrm=1&otex=5&otint=ffcccc&oalb=1&ospec=1&sss=0&scrn=0.24&sky=ff9184&gnd=b54134&inrgh=0.25&inmet=0&inmap=crinkle&inrm=1&intex=5&inalb=1&inspec=1&insss=1&inscrn=0&intint=ff5c49&corelv=170&oabs=ffffff&thick=1&refr=0.35&disp=0.2&iblur=12.4&scat=0.45&dens=1.8&rim=1.16&refl=1&gloss=0&indens=1.8&farwall=1&aostr=3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=6&vig=0.35&grain=0.05&dith=1&aces=1&expo=1&fxaa=1&cres=50&wire=0&dbg=off&dbgs=1&aocore=1&term=off",
  },
  {
    name: "lagoon",
    url: "mat=flesh&trans=1&res=50&cres=32&blobson=1&blobs=22&iso=36&speed=0.95&smooth=0.59&shape=icosahedron&ssize=0.285&sthick=0.125&onrgh=0&onmet=0&env=sunrise&envi=0.48&term=off&wire=0&dbg=off&dbgs=1&onmap=weave&onrm=0&otex=6.9&otint=17ffc7&oalb=0.39&ospec=1&sss=0&scrn=0.1&sky=3386c2&gnd=002933&inrgh=0.13&inmet=0.12&inmap=weave&inrm=0&intex=9.7&inalb=1&inspec=1&insss=1&inscrn=1&intint=000000&corelv=80&oabs=5170e7&thick=0.15&refr=0.25&disp=1&iblur=32&scat=1.85&dens=2&rim=2.83&refl=1&gloss=0&indens=1.8&farwall=1&aostr=7.5&aorad=16&aobias=0.08&aonear=1.65&aofar=21.3&aocol=187b9f&aocore=1&bloom=2.39&bloomr=0.3&bloomt=1.55&ab=10.5&vig=0.1&grain=0.05&dith=0.3&aces=1&expo=2.03&fxaa=1",
  },
  {
    name: "Life",
    url: "mat=flesh&trans=1&res=50&cres=46&blobson=1&blobs=34&iso=21&speed=1.37&smooth=0.1&shape=none&ssize=0.23&sthick=0.09&onrgh=0.01&onmet=0.14&env=overcast&envi=2.18&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0.19&otex=9.4&otint=ba3b9e&oalb=0.88&ospec=0.45&sss=0.09&scrn=0.48&sky=be96e4&gnd=b8545e&inrgh=1&inmet=0.95&inmap=crinkle&inrm=0&intex=1&inalb=1&inspec=1&insss=0.96&inscrn=0&intint=000000&corelv=169&oabs=54872c&thick=0.68&refr=0.38&disp=0.33&iblur=12&scat=0.35&dens=1&rim=2.33&refl=1&gloss=0.41&indens=1.8&farwall=1&aostr=9.9&aorad=109&aobias=0.105&aonear=0.1&aofar=18.1&aocol=bfaebd&aocore=0&bloom=2.55&bloomr=0.07&bloomt=0.74&ab=21&vig=0.45&grain=0.075&dith=2.4&aces=1&expo=2.37&fxaa=1",
  },
  {
    name: "iris",
    url: "mat=iris&trans=1&res=50&cres=50&blobson=1&blobs=22&iso=36&speed=0.95&smooth=0.59&shape=icosahedron&ssize=0.285&sthick=0.125&onrgh=0.28&onmet=0.46&env=sunrise&envi=0.48&term=off&wire=0&dbg=off&dbgs=1&onmap=crinkle&onrm=0.19&otex=1&otint=8a0063&oalb=1&ospec=1&sss=0.1&scrn=0&sky=febef5&gnd=600094&inrgh=0.39&inmet=0&inmap=organic&inrm=0&intex=23.8&inalb=0.96&inspec=1&insss=0.44&inscrn=0&intint=9900ff&corelv=80&oabs=000000&thick=0.41&refr=1.05&disp=1&iblur=26.4&scat=0.65&dens=0&rim=3&refl=1&gloss=0&indens=1.8&farwall=1&aostr=7.5&aorad=16&aobias=0.08&aonear=1.65&aofar=21.3&aocol=187b9f&aocore=1&bloom=2.39&bloomr=0.3&bloomt=1.55&ab=10.5&vig=0.1&grain=0.05&dith=0.3&aces=1&expo=2.03&fxaa=1",
  },
  {
    name: "water droplets",
    url: "mat=carbon&trans=0.59&res=50&cres=50&blobson=1&blobs=20&iso=80&speed=1&smooth=0&shape=none&ssize=0.2&sthick=0.055&onrgh=0.25&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=crinkle&onrm=1.01&otex=1&otint=000000&oalb=1&ospec=1&sss=0&scrn=1&sky=7496ba&gnd=24466a&inrgh=0.25&inmet=0&inmap=weave&inrm=1&intex=10&inalb=1&inspec=1&insss=0&inscrn=1&intint=57a8ff&corelv=170&oabs=607790&thick=1&refr=0.35&disp=0.2&iblur=2.5&scat=0.35&dens=1.8&rim=0.94&refl=0.51&gloss=0&indens=1.8&farwall=1&aostr=3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=6&vig=0.35&grain=0.05&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "lizard couch",
    url: "mat=flesh&trans=1&res=50&cres=50&blobson=1&blobs=20&iso=80&speed=1&smooth=1&shape=torus&ssize=0.34&sthick=0.12&onrgh=0&onmet=0&env=sunrise&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=cells&onrm=0.11&otex=14.1&otint=000000&oalb=1&ospec=1&sss=1&scrn=0&sky=85fff1&gnd=10754e&inrgh=0.28&inmet=0.45&inmap=quilted&inrm=0.94&intex=5&inalb=1&inspec=1&insss=1&inscrn=0&intint=03b076&corelv=132&oabs=b8fffa&thick=0.71&refr=0.05&disp=0&iblur=3.2&scat=1&dens=3.7&rim=0&refl=1&gloss=0.09&indens=1.8&farwall=1&aostr=3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=6&vig=0.35&grain=0.05&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "chlorophyll",
    url: "mat=carbon&trans=1&res=50&cres=50&blobson=1&blobs=20&iso=80&speed=1&smooth=0&shape=none&ssize=0.375&sthick=0.055&onrgh=0.16&onmet=0.53&env=sunrise&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=weave&onrm=0.83&otex=24.9&otint=af7d60&oalb=0.14&ospec=1&sss=0&scrn=0&sky=f8fec8&gnd=5b6a24&inrgh=0.59&inmet=0.75&inmap=cells&inrm=1.42&intex=11.8&inalb=0.74&inspec=1&insss=1&inscrn=1&intint=eaff00&corelv=124&oabs=80901b&thick=0.11&refr=0.23&disp=0.41&iblur=31.2&scat=1.25&dens=1.7&rim=0&refl=0.73&gloss=0&indens=1.8&farwall=1&aostr=3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=6&vig=0.35&grain=0.05&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "organic",
    url: "mat=amoeba&trans=1&res=50&cres=50&blobson=1&blobs=40&iso=80&speed=1&smooth=0&shape=none&ssize=0.195&sthick=0.055&onrgh=0.19&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0.08&otex=10&otint=ff6600&oalb=1&ospec=1&sss=0.35&scrn=0&sky=f3eebf&gnd=fe9162&inrgh=0.05&inmet=0&inmap=organic&inrm=0.45&intex=14&inalb=1&inspec=0.65&insss=0.38&inscrn=0&intint=00030f&corelv=130&oabs=ffffff&thick=1.5&refr=0.25&disp=0.26&iblur=5.2&scat=0.9&dens=1.8&rim=0.68&refl=0.69&gloss=0&indens=1.8&farwall=1&aostr=3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=6&vig=0.35&grain=0.05&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Protected",
    url: "mat=flesh&trans=1&res=50&cres=50&blobson=1&blobs=21&iso=80&speed=1&smooth=0&shape=torus&ssize=0.34&sthick=0.055&onrgh=0&onmet=0.29&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=tread&onrm=1.27&otex=7&otint=b000b3&oalb=0.86&ospec=0.24&sss=0.12&scrn=0.81&sky=8589ff&gnd=b63593&inrgh=0.26&inmet=0&inmap=cracked&inrm=0.26&intex=2.8&inalb=1&inspec=1&insss=1&inscrn=0&intint=7e47ff&corelv=216&oabs=db95cb&thick=0.34&refr=0.35&disp=0.19&iblur=11.6&scat=0&dens=1.4&rim=0.41&refl=0.52&gloss=0.32&indens=1.8&farwall=0&aostr=3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=6&vig=0.35&grain=0.05&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Blue glass",
    url: "trans=1&res=50&cres=50&blobson=1&blobs=20&iso=80&speed=1&smooth=0&shape=box&ssize=0.16&sthick=0.055&onrgh=0&onmet=0&env=sunrise&envi=1.15&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=ffffff&oalb=0.2&ospec=1&sss=0&scrn=0&sky=c2ddff&gnd=005ebd&inrgh=0.94&inmet=0&inmap=crinkle&inrm=0.3&intex=1&inalb=1&inspec=0.23&insss=1&inscrn=0&intint=1a4fcd&corelv=80&oabs=2465ff&thick=1.39&refr=0.3&disp=0.21&iblur=6&scat=0.2&dens=0.5&rim=1&refl=0.5&gloss=0&indens=5&farwall=1&aostr=2&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=0&bloom=0.3&bloomr=0.5&bloomt=0.35&ab=16&vig=0.4&grain=0.02&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Breakfast",
    url: "trans=1&res=50&cres=50&blobson=1&blobs=40&iso=38&speed=1&smooth=0.55&shape=box&ssize=0.195&sthick=0.055&onrgh=0&onmet=0&env=studio&envi=1.15&term=off&wire=0&dbg=off&dbgs=1&onmap=crinkle&onrm=0.56&otex=1&otint=ffffff&oalb=0.2&ospec=0&sss=0&scrn=0&sky=ffffff&gnd=b07003&inrgh=0&inmet=0&inmap=crinkle&inrm=0&intex=2.8&inalb=1&inspec=1&insss=1&inscrn=1&intint=8a5000&corelv=95&oabs=fefce1&thick=0.94&refr=0.08&disp=0.31&iblur=9.6&scat=1.2&dens=1.5&rim=0&refl=0&gloss=0&indens=5&farwall=0&aostr=2&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=0&bloom=0.3&bloomr=0.5&bloomt=0.35&ab=16&vig=0.4&grain=0.02&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "new flesh",
    url: "mat=flesh&trans=0.4&res=50&cres=50&blobson=1&blobs=20&iso=80&speed=1&smooth=0&shape=none&ssize=0.2&sthick=0.055&onrgh=0.25&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=crinkle&onrm=1&otex=5&otint=b54134&oalb=1&ospec=1&sss=1&scrn=0&sky=ff9184&gnd=b54134&inrgh=0.25&inmet=0&inmap=crinkle&inrm=1&intex=5&inalb=1&inspec=1&insss=1&inscrn=0&intint=ff0000&corelv=170&oabs=b54134&thick=1.13&refr=0&disp=0.29&iblur=9.2&scat=1&dens=1.1&rim=1&refl=0.65&gloss=0&indens=1.8&farwall=1&aostr=3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=6&vig=0.35&grain=0.05&dith=1&aces=1&expo=1&fxaa=1",
  },
];

export { environments, normalMaps, presets };
