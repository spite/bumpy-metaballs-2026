
const mrtOutputs = `
layout(location = 0) out vec4 fragColor;
layout(location = 1) out vec4 fragPosition;
layout(location = 2) out vec4 fragNormal;
layout(location = 3) out vec4 fragDiffuse;
`;

// pow() of a negative is NaN, and the shading can go below zero honestly. One
// NaN here spreads: into the copy the glass reads, then the blur smears it
// across the whole shell and the frame goes black. So it is floored.
const sRGBToLinear = `
vec3 sRGBToLinear(vec3 rgb) {
  vec3 value = max(rgb, vec3(0.0));
  return mix(
    pow((value + 0.055) / 1.055, vec3(2.4)),
    value / 12.92,
    vec3(lessThanEqual(value, vec3(0.04045)))
  );
}
`;

const linearToSRGB = `
vec3 linearToSRGB(vec3 rgb) {
  vec3 value = max(rgb, vec3(0.0));
  return mix(
    pow(value, vec3(0.41666)) * 1.055 - vec3(0.055),
    value * 12.92,
    vec3(lessThanEqual(value, vec3(0.0031308)))
  );
}
`;

const tonemap = `
vec3 tonemap(vec3 c) {
  return c / (c + vec3(1.0));
}
`;

// A direction in two channels, folded onto an octahedron.
const octahedral = `
vec2 octEncode(vec3 n) {
  n /= abs(n.x) + abs(n.y) + abs(n.z);
  vec2 e = n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * sign(n.xy);
  return e * 0.5 + 0.5;
}

vec3 octDecode(vec2 e) {
  e = e * 2.0 - 1.0;
  vec3 n = vec3(e.xy, 1.0 - abs(e.x) - abs(e.y));
  float t = max(-n.z, 0.0);
  n.xy += vec2(n.x >= 0.0 ? -t : t, n.y >= 0.0 ? -t : t);
  return normalize(n);
}
`;

const viewDepth = `
float viewDepth(float dist, float near, float far) {
  return clamp((dist - near) / (far - near), 1e-3, 1.0);
}
`;

// No UVs, so no interpolated tangents. Each projection plane implies one: its
// texture axes are two object space axes, so the sampled normal swizzles
// straight into object space. sign() keeps the detail from mirroring.
const triplanarNormal = `
vec3 triplanarNormal(
  sampler2D map,
  vec3 position,
  vec3 geometricNormal,
  float texScale,
  float normalScale
) {
  vec3 n = normalize(geometricNormal);

  vec3 blendWeights = abs(n);
  blendWeights = max((blendWeights - 0.2) * 7.0, 0.0);
  blendWeights /= blendWeights.x + blendWeights.y + blendWeights.z;

  vec3 sx = texture(map, position.yz * texScale).rgb * 2.0 - 1.0;
  vec3 sy = texture(map, position.zx * texScale).rgb * 2.0 - 1.0;
  vec3 sz = texture(map, position.xy * texScale).rgb * 2.0 - 1.0;

  sx.xy *= normalScale;
  sy.xy *= normalScale;
  sz.xy *= normalScale;

  sx.y *= -1.0;
  sy.y *= -1.0;
  sz.y *= -1.0;

  // A perturbation is added rather than whole normals blended: the weights are
  // sharpened and so are not |n|, and blending whole normals therefore snapped
  // towards whichever axis dominated even at zero scale -- the normal mapping
  // never fully switched off. Adding does switch off.
  vec3 ox = vec3(0.0, sx.x, sx.y);   // uv = (y, z), plane normal x
  vec3 oy = vec3(sy.y, 0.0, sy.x);   // uv = (z, x), plane normal y
  vec3 oz = vec3(sz.x, sz.y, 0.0);   // uv = (x, y), plane normal z

  vec3 perturbation = ox * blendWeights.x +
                      oy * blendWeights.y +
                      oz * blendWeights.z;

  return normalize(n + perturbation);
}
`;


// Taken from three's cube_uv_reflection_fragment.glsl.js and left as written
// so it can be diffed against the original.
const environment = `
uniform sampler2D envMap;
uniform float envIntensity;
uniform float cubeUV_maxMip;
uniform float cubeUV_texelWidth;
uniform float cubeUV_texelHeight;

#define cubeUV_minMipLevel 4.0
#define cubeUV_minTileSize 16.0

float getFace( vec3 direction ) {
    vec3 absDirection = abs( direction );
    float face = - 1.0;
    if ( absDirection.x > absDirection.z ) {
        if ( absDirection.x > absDirection.y )
            face = direction.x > 0.0 ? 0.0 : 3.0;
        else
            face = direction.y > 0.0 ? 1.0 : 4.0;
    } else {
        if ( absDirection.z > absDirection.y )
            face = direction.z > 0.0 ? 2.0 : 5.0;
        else
            face = direction.y > 0.0 ? 1.0 : 4.0;
    }
    return face;
}

vec2 getUV( vec3 direction, float face ) {
    vec2 uv;
    if ( face == 0.0 ) {
        uv = vec2( direction.z, direction.y ) / abs( direction.x );
    } else if ( face == 1.0 ) {
        uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
    } else if ( face == 2.0 ) {
        uv = vec2( - direction.x, direction.y ) / abs( direction.z );
    } else if ( face == 3.0 ) {
        uv = vec2( - direction.z, direction.y ) / abs( direction.x );
    } else if ( face == 4.0 ) {
        uv = vec2( - direction.x, direction.z ) / abs( direction.y );
    } else {
        uv = vec2( direction.x, direction.y ) / abs( direction.z );
    }
    return 0.5 * ( uv + 1.0 );
}

vec3 bilinearCubeUV( sampler2D envMapSampler, vec3 direction, float mipInt ) {
    float face = getFace( direction );
    float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
    mipInt = max( mipInt, cubeUV_minMipLevel );
    float faceSize = exp2( mipInt );
    
    highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
    
    if ( face > 2.0 ) {
        uv.y += faceSize;
        face -= 3.0;
    }
    
    uv.x += face * faceSize;
    uv.x += filterInt * 3.0 * cubeUV_minTileSize;
    uv.y += 4.0 * ( exp2( cubeUV_maxMip ) - faceSize );
    
    uv.x *= cubeUV_texelWidth;
    uv.y *= cubeUV_texelHeight;

    return texture( envMapSampler, uv ).rgb;
}

#define cubeUV_r0 1.0
#define cubeUV_m0 - 2.0
#define cubeUV_r1 0.8
#define cubeUV_m1 - 1.0
#define cubeUV_r4 0.4
#define cubeUV_m4 2.0
#define cubeUV_r5 0.305
#define cubeUV_m5 3.0
#define cubeUV_r6 0.21
#define cubeUV_m6 4.0

float roughnessToMip( float roughness ) {
    float mip = 0.0;
    if ( roughness >= cubeUV_r1 ) {
        mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
    } else if ( roughness >= cubeUV_r4 ) {
        mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
    } else if ( roughness >= cubeUV_r5 ) {
        mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
    } else if ( roughness >= cubeUV_r6 ) {
        mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
    } else {
        mip = - 2.0 * log2( 1.16 * roughness );
    }
    return mip;
}

vec4 textureCubeUV( sampler2D envMapSampler, vec3 sampleDir, float roughness ) {
    float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, cubeUV_maxMip );
    float mipF = fract( mip );
    float mipInt = floor( mip );
    
    vec3 color0 = bilinearCubeUV( envMapSampler, sampleDir, mipInt );
    if ( mipF == 0.0 ) {
        return vec4( color0, 1.0 );
    } else {
        vec3 color1 = bilinearCubeUV( envMapSampler, sampleDir, mipInt + 1.0 );
        return vec4( mix( color0, color1, mipF ), 1.0 );
    }
}
`;

export {
  environment,
  linearToSRGB,
  tonemap,
  mrtOutputs,
  octahedral,
  sRGBToLinear,
  triplanarNormal,
  viewDepth,
};
