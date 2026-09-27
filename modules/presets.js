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
    normalScale: 0.26,
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
      thickness: 0.94,
      refraction: 0.35,
      dispersion: 0.23,
      blurStrength: 9.2,
      density: 1.5,
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
    url: "mat=flesh&trans=1&onrgh=0&onmet=0&env=studio&envi=1&onmap=crinkle&onrm=1&otex=5&otint=ffcccc&oalb=1&ospec=1&sss=0&scrn=0.24&sky=ff9184&gnd=b54134&inrgh=0.25&inmet=0&inmap=crinkle&inrm=1&intex=5&inalb=1&inspec=1&insss=1&inscrn=0&intint=ff5c49&corelv=170&oabs=ffffff&thick=1&refr=0.35&disp=0.2&iblur=12.4&scat=0.45&dens=1.8&rim=1.16&refl=1&gloss=0&indens=1.8&farwall=1&aostr=3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=6&vig=0.35&grain=0.05&dith=1&aces=1&expo=1&fxaa=1&wire=0&dbg=off&dbgs=1&aocore=1&term=off",
  },
  {
    name: "lagoon",
    url: "mat=flesh&trans=1&onrgh=0&onmet=0&env=sunrise&envi=0.48&term=off&wire=0&dbg=off&dbgs=1&onmap=weave&onrm=0&otex=6.9&otint=17ffc7&oalb=0.39&ospec=1&sss=0&scrn=0.1&sky=3386c2&gnd=002933&inrgh=0.13&inmet=0.12&inmap=weave&inrm=0&intex=9.7&inalb=1&inspec=1&insss=1&inscrn=1&intint=000000&corelv=80&oabs=5170e7&thick=0.15&refr=0.25&disp=1&iblur=32&scat=1.85&dens=2&rim=2.83&refl=1&gloss=0&indens=1.8&farwall=1&aostr=7.5&aorad=16&aobias=0.08&aonear=1.65&aofar=21.3&aocol=187b9f&aocore=1&bloom=2.39&bloomr=0.3&bloomt=1.55&ab=10.5&vig=0.1&grain=0.05&dith=0.3&aces=1&expo=2.03&fxaa=1",
  },
  {
    name: "Life",
    url: "mat=flesh&trans=1&onrgh=0.01&onmet=0.14&env=overcast&envi=2.18&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0.19&otex=9.4&otint=ba3b9e&oalb=0.88&ospec=0.45&sss=0.09&scrn=0.48&sky=be96e4&gnd=b8545e&inrgh=1&inmet=0.95&inmap=crinkle&inrm=0&intex=1&inalb=1&inspec=1&insss=0.96&inscrn=0&intint=000000&corelv=169&oabs=54872c&thick=0.68&refr=0.38&disp=0.33&iblur=12&scat=0.35&dens=1&rim=2.33&refl=1&gloss=0.41&indens=1.8&farwall=1&aostr=9.9&aorad=109&aobias=0.105&aonear=0.1&aofar=18.1&aocol=bfaebd&aocore=0&bloom=2.55&bloomr=0.07&bloomt=0.74&ab=21&vig=0.45&grain=0.075&dith=2.4&aces=1&expo=2.37&fxaa=1",
  },
  {
    name: "iris",
    url: "mat=iris&trans=1&onrgh=0.28&onmet=0.46&env=sunrise&envi=0.48&term=off&wire=0&dbg=off&dbgs=1&onmap=crinkle&onrm=0.19&otex=1&otint=8a0063&oalb=1&ospec=1&sss=0.1&scrn=0&sky=febef5&gnd=600094&inrgh=0.39&inmet=0&inmap=organic&inrm=0&intex=23.8&inalb=0.96&inspec=1&insss=0.44&inscrn=0&intint=9900ff&corelv=80&oabs=000000&thick=0.41&refr=1.05&disp=1&iblur=26.4&scat=0.65&dens=0&rim=3&refl=1&gloss=0&indens=1.8&farwall=1&aostr=7.5&aorad=16&aobias=0.08&aonear=1.65&aofar=21.3&aocol=187b9f&aocore=1&bloom=2.39&bloomr=0.3&bloomt=1.55&ab=10.5&vig=0.1&grain=0.05&dith=0.3&aces=1&expo=2.03&fxaa=1",
  },
  {
    name: "water droplets",
    url: "mat=carbon&trans=0.59&onrgh=0.25&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=crinkle&onrm=1.01&otex=1&otint=000000&oalb=1&ospec=1&sss=0&scrn=1&sky=7496ba&gnd=24466a&inrgh=0.25&inmet=0&inmap=weave&inrm=1&intex=10&inalb=1&inspec=1&insss=0&inscrn=1&intint=57a8ff&corelv=170&oabs=607790&thick=1&refr=0.35&disp=0.2&iblur=2.5&scat=0.35&dens=1.8&rim=0.94&refl=0.51&gloss=0&indens=1.8&farwall=1&aostr=3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=6&vig=0.35&grain=0.05&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "lizard couch",
    url: "mat=flesh&trans=1&onrgh=0&onmet=0&env=sunrise&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=cells&onrm=0.11&otex=14.1&otint=000000&oalb=1&ospec=1&sss=1&scrn=0&sky=85fff1&gnd=10754e&inrgh=0.28&inmet=0.45&inmap=quilted&inrm=0.94&intex=5&inalb=1&inspec=1&insss=1&inscrn=0&intint=03b076&corelv=132&oabs=b8fffa&thick=0.71&refr=0.05&disp=0&iblur=3.2&scat=1&dens=3.7&rim=0&refl=1&gloss=0.09&indens=1.8&farwall=1&aostr=3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=6&vig=0.35&grain=0.05&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "chlorophyll",
    url: "mat=carbon&trans=1&onrgh=0.16&onmet=0.53&env=sunrise&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=weave&onrm=0.83&otex=24.9&otint=af7d60&oalb=0.14&ospec=1&sss=0&scrn=0&sky=f8fec8&gnd=5b6a24&inrgh=0.59&inmet=0.75&inmap=cells&inrm=1.42&intex=11.8&inalb=0.74&inspec=1&insss=1&inscrn=1&intint=eaff00&corelv=124&oabs=80901b&thick=0.11&refr=0.23&disp=0.41&iblur=31.2&scat=1.25&dens=1.7&rim=0&refl=0.73&gloss=0&indens=1.8&farwall=1&aostr=3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=6&vig=0.35&grain=0.05&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "organic",
    url: "mat=amoeba&trans=1&onrgh=0.19&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0.08&otex=10&otint=ff6600&oalb=1&ospec=1&sss=0.35&scrn=0&sky=f3eebf&gnd=fe9162&inrgh=0.05&inmet=0&inmap=organic&inrm=0.45&intex=14&inalb=1&inspec=0.65&insss=0.38&inscrn=0&intint=00030f&corelv=130&oabs=ffffff&thick=1.5&refr=0.25&disp=0.26&iblur=5.2&scat=0.9&dens=1.8&rim=0.68&refl=0.69&gloss=0&indens=1.8&farwall=1&aostr=3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=6&vig=0.35&grain=0.05&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Protected",
    url: "mat=flesh&trans=1&onrgh=0&onmet=0.29&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=tread&onrm=1.27&otex=7&otint=b000b3&oalb=0.86&ospec=0.24&sss=0.12&scrn=0.81&sky=8589ff&gnd=b63593&inrgh=0.26&inmet=0&inmap=cracked&inrm=0.26&intex=2.8&inalb=1&inspec=1&insss=1&inscrn=0&intint=7e47ff&corelv=216&oabs=db95cb&thick=0.34&refr=0.35&disp=0.19&iblur=11.6&scat=0&dens=1.4&rim=0.41&refl=0.52&gloss=0.32&indens=1.8&farwall=0&aostr=3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=6&vig=0.35&grain=0.05&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Blue glass",
    url: "trans=1&onrgh=0&onmet=0&env=sunrise&envi=1.15&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=ffffff&oalb=0.2&ospec=1&sss=0&scrn=0&sky=c2ddff&gnd=005ebd&inrgh=0.94&inmet=0&inmap=crinkle&inrm=0.3&intex=1&inalb=1&inspec=0.23&insss=1&inscrn=0&intint=1a4fcd&corelv=80&oabs=2465ff&thick=1.39&refr=0.3&disp=0.21&iblur=6&scat=0.2&dens=0.5&rim=1&refl=0.5&gloss=0&indens=5&farwall=1&aostr=2&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=0&bloom=0.3&bloomr=0.5&bloomt=0.35&ab=16&vig=0.4&grain=0.02&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Breakfast",
    url: "trans=1&onrgh=0&onmet=0&env=studio&envi=1.15&term=off&wire=0&dbg=off&dbgs=1&onmap=crinkle&onrm=0.56&otex=1&otint=ffffff&oalb=0.2&ospec=0&sss=0&scrn=0&sky=ffffff&gnd=b07003&inrgh=0&inmet=0&inmap=crinkle&inrm=0&intex=2.8&inalb=1&inspec=1&insss=1&inscrn=1&intint=8a5000&corelv=95&oabs=fefce1&thick=0.94&refr=0.08&disp=0.31&iblur=9.6&scat=1.2&dens=1.5&rim=0&refl=0&gloss=0&indens=5&farwall=0&aostr=2&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=0&bloom=0.3&bloomr=0.5&bloomt=0.35&ab=16&vig=0.4&grain=0.02&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "new flesh",
    url: "mat=flesh&trans=0.4&onrgh=0.25&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=crinkle&onrm=1&otex=5&otint=b54134&oalb=1&ospec=1&sss=1&scrn=0&sky=ff9184&gnd=b54134&inrgh=0.25&inmet=0&inmap=crinkle&inrm=1&intex=5&inalb=1&inspec=1&insss=1&inscrn=0&intint=ff0000&corelv=170&oabs=b54134&thick=1.13&refr=0&disp=0.29&iblur=9.2&scat=1&dens=1.1&rim=1&refl=0.65&gloss=0&indens=1.8&farwall=1&aostr=3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=6&vig=0.35&grain=0.05&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Opal",
    url: "trans=1&onrgh=0.28&onmet=0&env=studio&envi=1.1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=ffd070&oalb=0&ospec=0.6&sss=0.8&scrn=0&sky=b8c5cf&gnd=a3b1bc&inrgh=0.9&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.3&insss=1&inscrn=0&intint=ff5070&corelv=105&oabs=6fe6ff&thick=1.2&refr=0.35&disp=0.9&iblur=7&scat=1&dens=1.1&rim=1.5&refl=0.3&gloss=0&indens=1&farwall=1&aostr=0.8&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=a8b4c6&aocore=0&bloom=0.5&bloomr=0.6&bloomt=0.3&ab=4&vig=0.15&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Frost",
    url: "trans=1&onrgh=0.45&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=eef0ff&oalb=0&ospec=1&sss=0.2&scrn=0&sky=ffffff&gnd=f2c4b0&inrgh=0.9&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.2&insss=1&inscrn=0&intint=ff6a40&corelv=85&oabs=e6e8f5&thick=1&refr=0.25&disp=0.1&iblur=5&scat=1.2&dens=0.4&rim=0.8&refl=0.3&gloss=0&indens=1.8&farwall=1&aostr=1&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=b8bcc8&aocore=1&bloom=0.45&bloomr=0.5&bloomt=0.35&ab=4&vig=0.1&grain=0.03&dith=1&aces=1&expo=1.05&fxaa=1",
  },
  {
    name: "Gills",
    url: "trans=0.8&onrgh=0.03&onmet=0&env=studio&envi=0.8&term=off&wire=0&dbg=off&dbgs=1&onmap=ridges&onrm=0.52&otex=8&otint=3f6fd8&oalb=0.7&ospec=1&sss=1&scrn=0&sky=99c5ff&gnd=3c589a&inrgh=0.6&inmet=0&inmap=ridges&inrm=0.4&intex=8&inalb=1&inspec=0.3&insss=1&inscrn=0&intint=ff6a10&corelv=105&oabs=fff6ea&thick=1&refr=0.35&disp=0.2&iblur=2&scat=1&dens=0.3&rim=1&refl=0.1&gloss=0&indens=1.8&farwall=1&aostr=1.5&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.12&bloomr=0.5&bloomt=0.35&ab=4&vig=0.3&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Ember",
    url: "trans=1&onrgh=0.35&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=crumple&onrm=0.2&otex=4&otint=ff5a2a&oalb=0&ospec=1&sss=0.3&scrn=0&sky=feec95&gnd=ff2e2e&inrgh=0.6&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=1&inscrn=0&intint=ff8a20&corelv=115&oabs=e84a00&thick=1.2&refr=0.3&disp=0.1&iblur=6&scat=1.5&dens=4&rim=1&refl=0.3&gloss=0&indens=1.8&farwall=1&aostr=1.5&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=4&vig=0.2&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Amber",
    url: "trans=1&onrgh=0.3&onmet=0&env=studio&envi=0.7&term=off&wire=0&dbg=off&dbgs=1&onmap=cracked&onrm=0.35&otex=6&otint=c07020&oalb=0&ospec=1&sss=0.4&scrn=0&sky=2a3a44&gnd=d8dcdf&inrgh=0.6&inmet=0&inmap=cracked&inrm=0.3&intex=1&inalb=1&inspec=0.5&insss=0.2&inscrn=0&intint=c86a20&corelv=220&oabs=e8903a&thick=1.3&refr=0.25&disp=0.05&iblur=3&scat=0.6&dens=3.2&rim=0.4&refl=0.1&gloss=0&indens=1.8&farwall=1&aostr=1.2&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=06070b&aocore=1&bloom=0.3&bloomr=0.5&bloomt=0.35&ab=4&vig=0.3&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Flame",
    url: "trans=1&onrgh=0.05&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=ff7000&oalb=0&ospec=1&sss=0.9&scrn=0&sky=ece8e2&gnd=d8d2c8&inrgh=0.3&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=1&inscrn=0&intint=ff5c00&corelv=140&oabs=ff7000&thick=1.2&refr=0.35&disp=0.1&iblur=1.5&scat=0.5&dens=3.6&rim=1&refl=0.2&gloss=0&indens=1.8&farwall=1&aostr=1&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=8a6a50&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=4&vig=0.15&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Candy",
    url: "trans=1&onrgh=0.02&onmet=0&env=studio&envi=0.8&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=ff4a00&oalb=1&ospec=1&sss=0.5&scrn=0&sky=e8e8e8&gnd=d4d4d4&inrgh=0.5&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=1&insss=0.5&inscrn=0&intint=ff4a00&corelv=130&oabs=ffffff&thick=0&refr=0&disp=0&iblur=0&scat=0&dens=0&rim=1.5&refl=0.4&gloss=0&indens=1.8&farwall=1&aostr=2&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=a02800&aocore=1&bloom=0.25&bloomr=0.5&bloomt=0.35&ab=4&vig=0.1&grain=0.03&dith=1&aces=1&expo=0.9&fxaa=1",
  },
  {
    name: "Prism",
    url: "trans=1&onrgh=0.02&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=ff6ad0&oalb=0&ospec=1&sss=0.7&scrn=0&sky=b4b0c8&gnd=f0c8e0&inrgh=0.3&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=0.8&inscrn=0&intint=c060ff&corelv=150&oabs=e890e8&thick=1&refr=0.5&disp=0.9&iblur=1&scat=0.3&dens=1.4&rim=1.5&refl=0.4&gloss=0&indens=1.8&farwall=1&aostr=0.8&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=a090c0&aocore=1&bloom=0.4&bloomr=0.5&bloomt=0.35&ab=4&vig=0.15&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Gummy",
    url: "trans=0.9&onrgh=0.08&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=ff5060&oalb=0&ospec=1&sss=1&scrn=0&sky=f4f2f0&gnd=e4e0dc&inrgh=0.7&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=1&inscrn=0&intint=ff5040&corelv=95&oabs=ff4050&thick=1.2&refr=0.3&disp=0.1&iblur=5&scat=1.5&dens=4.5&rim=1.2&refl=0.3&gloss=0&indens=1.8&farwall=1&aostr=1&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=d09090&aocore=1&bloom=0.4&bloomr=0.5&bloomt=0.35&ab=4&vig=0.1&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Splash",
    url: "trans=1&onrgh=0.01&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=e0206a&oalb=0&ospec=1&sss=1&scrn=0&sky=d8d0dc&gnd=f4d8ea&inrgh=0.2&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=0.5&inscrn=0&intint=ff70b0&corelv=170&oabs=f070c0&thick=1.2&refr=0.6&disp=1&iblur=0.5&scat=0.2&dens=2.2&rim=1.8&refl=0.35&gloss=0&indens=1.8&farwall=1&aostr=0.6&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=b090b0&aocore=1&bloom=0.4&bloomr=0.5&bloomt=0.35&ab=4&vig=0.1&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Crystal",
    url: "trans=1&onrgh=0.02&onmet=0&env=studio&envi=0.8&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=ff6a20&oalb=0&ospec=1&sss=0.5&scrn=0&sky=f0f0f0&gnd=e4e4e4&inrgh=0.8&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0&insss=1&inscrn=0&intint=ff3000&corelv=110&oabs=ffb080&thick=1&refr=0.4&disp=0.3&iblur=0.5&scat=0.2&dens=1&rim=0.7&refl=0.15&gloss=0&indens=0.3&farwall=1&aostr=0.5&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=909090&aocore=1&bloom=0.7&bloomr=0.5&bloomt=0.2&ab=4&vig=0.1&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Cobalt",
    url: "trans=1&onrgh=0.02&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=2060ff&oalb=0&ospec=1&sss=0.5&scrn=0&sky=eeeeee&gnd=a6a6f2&inrgh=0.3&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=0.2&inscrn=0&intint=0a2090&corelv=200&oabs=0a40e8&thick=1.2&refr=0.5&disp=0.1&iblur=0.5&scat=0.2&dens=3&rim=1.3&refl=0.35&gloss=0&indens=1.8&farwall=1&aostr=1&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=2030a0&aocore=1&bloom=0.3&bloomr=0.5&bloomt=0.35&ab=4&vig=0.15&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Ink",
    url: "trans=1&onrgh=0.3&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=ff0090&oalb=0&ospec=1&sss=0.9&scrn=0&sky=ffffff&gnd=c388b3&inrgh=0.7&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.1&insss=0.2&inscrn=0&intint=500040&corelv=95&oabs=ff30b0&thick=1&refr=0.3&disp=0.1&iblur=6&scat=1.5&dens=2.2&rim=1&refl=0.15&gloss=0&indens=1.8&farwall=1&aostr=0.6&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=909090&aocore=1&bloom=0.4&bloomr=0.5&bloomt=0.35&ab=4&vig=0.1&grain=0.08&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Aura",
    url: "trans=1&onrgh=0.5&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=ff4020&oalb=0&ospec=1&sss=1&scrn=0&sky=70c8f0&gnd=f5a860&inrgh=0.8&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=0.5&inscrn=0&intint=100060&corelv=100&oabs=1040ff&thick=1.2&refr=0.3&disp=0.6&iblur=10&scat=2.5&dens=3.5&rim=1.5&refl=0.3&gloss=0&indens=1.8&farwall=1&aostr=0.5&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=5060a0&aocore=1&bloom=0.6&bloomr=0.8&bloomt=0.35&ab=4&vig=0.1&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Ribbon",
    url: "trans=1&onrgh=0.05&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=4a70ff&oalb=0&ospec=1&sss=0.6&scrn=0&sky=f8faff&gnd=eef2fc&inrgh=0.4&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=0.6&inscrn=0&intint=2a50e0&corelv=150&oabs=6a90ff&thick=1.2&refr=0.4&disp=0.25&iblur=3&scat=0.8&dens=2&rim=1.4&refl=0.35&gloss=0&indens=1.8&farwall=1&aostr=0.4&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=8090c0&aocore=1&bloom=0.5&bloomr=0.5&bloomt=0.35&ab=4&vig=0.05&grain=0.03&dith=1&aces=1&expo=1.1&fxaa=1",
  },
  {
    name: "Satin",
    url: "trans=0&onrgh=0.25&onmet=0.6&env=studio&envi=1.1&term=off&wire=0&dbg=off&dbgs=1&onmap=ridges&onrm=0.2&otex=12&otint=e06a7a&oalb=1&ospec=1&sss=0.8&scrn=0&sky=e2c4ec&gnd=dcbce6&inrgh=0.5&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=0.5&inscrn=0&intint=ffffff&corelv=130&oabs=ffffff&thick=1&refr=0.35&disp=0.2&iblur=5&scat=1&dens=1&rim=1.4&refl=0.3&gloss=0&indens=1.8&farwall=1&aostr=1.2&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=a04050&aocore=1&bloom=0.4&bloomr=0.5&bloomt=0.35&ab=4&vig=0.05&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Bubblegum",
    url: "trans=0.9&onrgh=0.02&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=ff50b0&oalb=0&ospec=1&sss=0.8&scrn=0&sky=f8f4f6&gnd=f0e8ec&inrgh=0.3&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=0.8&inscrn=0&intint=ff40a0&corelv=120&oabs=ff60c0&thick=1.1&refr=0.35&disp=0.5&iblur=1.5&scat=0.5&dens=2.5&rim=1.6&refl=0.35&gloss=0&indens=1.8&farwall=1&aostr=0.8&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=c080a0&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=4&vig=0.05&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Acrylic",
    url: "trans=1&onrgh=0.45&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=ff2080&oalb=0&ospec=1&sss=0.7&scrn=0&sky=ececec&gnd=d8d8d8&inrgh=0.6&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=0.8&inscrn=0&intint=6030d0&corelv=110&oabs=ff3a90&thick=1.2&refr=0.3&disp=0.3&iblur=5&scat=1.2&dens=2.5&rim=1.2&refl=0.25&gloss=0&indens=1.8&farwall=1&aostr=1&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=806070&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=4&vig=0.15&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Pastel",
    url: "trans=0.8&onrgh=0.6&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=8a50ff&oalb=1&ospec=1&sss=1&scrn=0&sky=d8dcf4&gnd=ccd4ee&inrgh=0.9&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.2&insss=1&inscrn=0&intint=ff8a60&corelv=100&oabs=9a70ff&thick=1.2&refr=0.2&disp=0.3&iblur=9&scat=2&dens=3&rim=0.8&refl=0.15&gloss=0&indens=1.8&farwall=1&aostr=0.6&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=7070b0&aocore=1&bloom=0.4&bloomr=0.8&bloomt=0.35&ab=4&vig=0.05&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Mint",
    url: "trans=1&onrgh=0.4&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=6ab8a0&oalb=0&ospec=1&sss=0.3&scrn=0&sky=eeeeee&gnd=e4e6e4&inrgh=0.4&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=0.3&inscrn=0&intint=4a8a74&corelv=110&oabs=a8e0cc&thick=1.2&refr=0.3&disp=0.1&iblur=6&scat=1.2&dens=2&rim=1.2&refl=0.3&gloss=0&indens=1.8&farwall=1&aostr=0.8&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=5a7a70&aocore=1&bloom=0.25&bloomr=0.5&bloomt=0.35&ab=4&vig=0.05&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Sherbet",
    url: "trans=0.85&onrgh=0.3&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=crinkle&onrm=0.15&otex=6&otint=ff8a20&oalb=1&ospec=1&sss=1&scrn=0&sky=c8bcd4&gnd=e8b4a4&inrgh=0.4&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=0.5&inscrn=0&intint=0a6a70&corelv=120&oabs=ff9a30&thick=1.2&refr=0.3&disp=0.2&iblur=4&scat=1&dens=3&rim=1.2&refl=0.25&gloss=0&indens=1.8&farwall=1&aostr=0.8&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=806060&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=4&vig=0.2&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Nacre",
    url: "trans=0.6&onrgh=0.1&onmet=0.3&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=ridges&onrm=0.2&otex=10&otint=ff6a20&oalb=1&ospec=1&sss=1&scrn=0&sky=f0c0a0&gnd=c05a20&inrgh=0.3&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=0.8&inscrn=0&intint=ff7a30&corelv=150&oabs=ff9050&thick=1&refr=0.8&disp=1&iblur=1&scat=0.3&dens=1.5&rim=2.5&refl=0.3&gloss=0&indens=1.8&farwall=1&aostr=1&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=903a10&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=4&vig=0.15&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Smoke",
    url: "trans=1&onrgh=0.01&onmet=0&env=studio&envi=1.2&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=c0a080&oalb=0&ospec=1&sss=0.15&scrn=0&sky=2a323c&gnd=141820&inrgh=0.1&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=1&insss=0.1&inscrn=0&intint=3a3c44&corelv=230&oabs=a8b0c0&thick=1&refr=0.6&disp=0.15&iblur=0.3&scat=0.1&dens=1.2&rim=1.8&refl=0.5&gloss=0&indens=1.8&farwall=1&aostr=1.5&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=05070a&aocore=1&bloom=0.3&bloomr=0.5&bloomt=0.35&ab=4&vig=0.4&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Glow",
    url: "trans=1&onrgh=0.5&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=ff6000&oalb=0&ospec=1&sss=1&scrn=0&sky=8a949c&gnd=5a6068&inrgh=0.8&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=1&inscrn=0&intint=ffa070&corelv=110&oabs=ffb080&thick=1.2&refr=0.2&disp=0.1&iblur=8&scat=2&dens=1.5&rim=1.8&refl=0.2&gloss=0&indens=1.8&farwall=1&aostr=0.8&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=202428&aocore=1&bloom=0.6&bloomr=0.5&bloomt=0.25&ab=4&vig=0.25&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Neon",
    url: "trans=1&onrgh=0.02&onmet=0&env=studio&envi=1.3&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=e030c0&oalb=0&ospec=1&sss=0.35&scrn=0&sky=283450&gnd=000000&inrgh=0.2&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=1&insss=0&inscrn=0&intint=10183a&corelv=160&oabs=5a9aff&thick=1.2&refr=0.7&disp=1&iblur=0.5&scat=0.2&dens=1.5&rim=2.2&refl=0.5&gloss=0&indens=1.8&farwall=1&aostr=1&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=000000&aocore=1&bloom=0.35&bloomr=0.5&bloomt=0.35&ab=4&vig=0.3&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Chrome",
    url: "trans=0.5&onrgh=0.04&onmet=1&env=studio&envi=0.9&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=20c8ff&oalb=1&ospec=1&sss=0.3&scrn=0&sky=0a0a10&gnd=000000&inrgh=0.2&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=1&inscrn=0&intint=c020e0&corelv=110&oabs=d040ff&thick=1&refr=0.8&disp=1&iblur=0.5&scat=0.2&dens=2.5&rim=2&refl=0&gloss=0&indens=1.8&farwall=1&aostr=1.5&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=000000&aocore=1&bloom=0.2&bloomr=0.5&bloomt=0.35&ab=4&vig=0.3&grain=0.03&dith=1&aces=1&expo=0.9&fxaa=1",
  },
  {
    name: "Holo",
    url: "trans=0.6&onrgh=0.25&onmet=0.4&env=studio&envi=1.1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=a070ff&oalb=1&ospec=1&sss=1&scrn=0&sky=ffffff&gnd=ffffff&inrgh=0.4&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=1&inscrn=0&intint=40a0ff&corelv=110&oabs=80a8ff&thick=1&refr=0.5&disp=1&iblur=4&scat=1&dens=2.5&rim=1.8&refl=0.3&gloss=0&indens=1.8&farwall=1&aostr=0.5&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=9090c0&aocore=1&bloom=0.4&bloomr=0.5&bloomt=0.35&ab=4&vig=0&grain=0.03&dith=1&aces=1&expo=1.1&fxaa=1",
  },
  {
    name: "Foil",
    url: "trans=0.6&onrgh=0.03&onmet=0.5&env=studio&envi=1.2&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=3a80ff&oalb=1&ospec=1&sss=1&scrn=0&sky=ffffff&gnd=ffffff&inrgh=0.2&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=1&inscrn=0&intint=ff30e0&corelv=100&oabs=a060ff&thick=1&refr=0.6&disp=1&iblur=1&scat=0.3&dens=3&rim=2&refl=0.2&gloss=0&indens=1.8&farwall=1&aostr=0.6&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=6060c0&aocore=1&bloom=0.4&bloomr=0.5&bloomt=0.35&ab=4&vig=0&grain=0.03&dith=1&aces=1&expo=1.05&fxaa=1",
  },
  {
    name: "Cloud",
    url: "trans=0.8&onrgh=0.6&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=ffd8b0&oalb=0.3&ospec=1&sss=0.4&scrn=0&sky=a8c8ec&gnd=3a78c0&inrgh=0.8&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=0.3&inscrn=0&intint=d87080&corelv=95&oabs=fff0e0&thick=1.2&refr=0.2&disp=0.1&iblur=6&scat=1.2&dens=0.5&rim=1&refl=0.2&gloss=0&indens=1.8&farwall=1&aostr=1.8&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=305070&aocore=1&bloom=0.2&bloomr=0.5&bloomt=0.35&ab=4&vig=0.2&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Foil Frost",
    url: "trans=0.8&onrgh=0.3&onmet=0.3&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=crumple&onrm=1&otex=8&otint=d0c8f0&oalb=0.3&ospec=1&sss=0.3&scrn=0&sky=a8a8c0&gnd=9898b4&inrgh=0.6&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=1&inscrn=0&intint=ff5a70&corelv=95&oabs=c0a8ff&thick=1.2&refr=0.3&disp=0.2&iblur=3&scat=1&dens=1&rim=1.2&refl=0.3&gloss=0&indens=1.8&farwall=1&aostr=1.2&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=403060&aocore=1&bloom=0.3&bloomr=0.5&bloomt=0.35&ab=4&vig=0.1&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Grape",
    url: "trans=0.35&onrgh=0.04&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=4a58f0&oalb=1&ospec=1&sss=0.8&scrn=0&sky=ffffff&gnd=ffffff&inrgh=0.3&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=1&inscrn=0&intint=b040e0&corelv=110&oabs=4050ff&thick=1.2&refr=0.4&disp=0.3&iblur=1&scat=0.3&dens=4&rim=1.5&refl=0.2&gloss=0&indens=1.8&farwall=1&aostr=1.5&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=2020a0&aocore=1&bloom=0.3&bloomr=0.5&bloomt=0.35&ab=4&vig=0&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Pebble",
    url: "trans=0.25&onrgh=0.35&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=crinkle&onrm=1&otex=8&otint=10a8ff&oalb=1&ospec=1&sss=0.8&scrn=0&sky=ffffff&gnd=ffffff&inrgh=0.4&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=1&inscrn=0&intint=0070e0&corelv=110&oabs=0098ff&thick=1.2&refr=0.3&disp=0.1&iblur=2&scat=0.5&dens=4.5&rim=0.8&refl=0.05&gloss=0&indens=1.8&farwall=1&aostr=1.4&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=082060&aocore=1&bloom=0.2&bloomr=0.5&bloomt=0.35&ab=4&vig=0&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Halo",
    url: "trans=1&onrgh=0.5&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=40b080&oalb=0&ospec=1&sss=0.8&scrn=0&sky=eeeeea&gnd=c8c8c4&inrgh=0.9&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=1&inscrn=0&intint=ffc010&corelv=100&oabs=40a078&thick=1.2&refr=0.2&disp=0.8&iblur=6&scat=1.5&dens=3&rim=0.8&refl=0.1&gloss=0&indens=1.8&farwall=1&aostr=1&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=404850&aocore=1&bloom=0.5&bloomr=0.8&bloomt=0.35&ab=4&vig=0.1&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
  {
    name: "Haze",
    url: "trans=1&onrgh=0.6&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=70c8ff&oalb=0&ospec=1&sss=0.8&scrn=0&sky=ffffff&gnd=ffffff&inrgh=0.9&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=0.5&insss=1&inscrn=0&intint=0080ff&corelv=88&oabs=40a8ff&thick=1.2&refr=0.2&disp=0.2&iblur=8&scat=1.5&dens=3&rim=0.6&refl=0.1&gloss=0&indens=1.8&farwall=1&aostr=0.3&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=8090c0&aocore=1&bloom=0.4&bloomr=0.8&bloomt=0.35&ab=4&vig=0&grain=0.03&dith=1&aces=1&expo=1.1&fxaa=1",
  },
  {
    name: "Molecule",
    url: "trans=0.85&onrgh=0.1&onmet=0&env=studio&envi=1&term=off&wire=0&dbg=off&dbgs=1&onmap=organic&onrm=0&otex=1&otint=30c8e8&oalb=0.8&ospec=1&sss=1&scrn=0&sky=ffffff&gnd=f4f4ff&inrgh=0.1&inmet=0&inmap=organic&inrm=0&intex=1&inalb=1&inspec=1&insss=1&inscrn=0&intint=2040e0&corelv=125&oabs=60d0f0&thick=1.2&refr=0.3&disp=0.2&iblur=2&scat=0.5&dens=2.5&rim=1.3&refl=0.2&gloss=0&indens=1.8&farwall=1&aostr=1&aorad=40&aobias=0.05&aonear=1&aofar=4&aocol=5050b0&aocore=1&bloom=0.3&bloomr=0.5&bloomt=0.35&ab=4&vig=0&grain=0.03&dith=1&aces=1&expo=1&fxaa=1",
  },
];

export { environments, normalMaps, presets };
