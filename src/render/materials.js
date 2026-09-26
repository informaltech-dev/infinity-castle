import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Shared lighting state. Every toon material references these same uniform
// objects, so updating a value here updates the whole scene.
// ---------------------------------------------------------------------------
export const Lighting = {
  uLightDir: { value: new THREE.Vector3(0.45, 0.8, 0.35).normalize() },
  uLightColor: { value: new THREE.Color(1.0, 0.9, 0.78) },
  uAmbTop: { value: new THREE.Color(0.62, 0.55, 0.62) },
  uAmbBottom: { value: new THREE.Color(0.38, 0.28, 0.3) },
  uRimColor: { value: new THREE.Color(1.0, 0.72, 0.45) },
  uFogColor: { value: new THREE.Color(0.07, 0.035, 0.05) },
  uFogRange: { value: new THREE.Vector2(35, 150) },
  uFogAmt: { value: 1.0 },
  uVoidY: { value: -4.0 },
  uPointPos: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
  uPointColor: { value: [new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0)] },
  uPointRange: { value: [1, 1, 1, 1] },
  uTime: { value: 0 },
  uGlobalTint: { value: new THREE.Color(1, 1, 1) },
  // camera-relative key light (keeps characters readable from every camera angle)
  uCamLight: { value: new THREE.Vector3(0, 1, 0) },
};

const _cl = new THREE.Vector3();
const _cu = new THREE.Vector3();
const _cr = new THREE.Vector3();
/** Call once per frame with the active camera. */
export function updateCameraLight(camera) {
  camera.getWorldDirection(_cl).negate(); // toward the viewer
  _cu.set(0, 1, 0);
  _cr.crossVectors(_cu, _cl).normalize(); // camera left-ish
  Lighting.uCamLight.value.copy(_cl).multiplyScalar(0.55).addScaledVector(_cu, 0.75).addScaledVector(_cr, 0.35).normalize();
}

export function setPreset(p) {
  if (p.lightDir) Lighting.uLightDir.value.copy(p.lightDir).normalize();
  if (p.lightColor) Lighting.uLightColor.value.set(p.lightColor);
  if (p.ambTop) Lighting.uAmbTop.value.set(p.ambTop);
  if (p.ambBottom) Lighting.uAmbBottom.value.set(p.ambBottom);
  if (p.rimColor) Lighting.uRimColor.value.set(p.rimColor);
  if (p.fogColor) Lighting.uFogColor.value.set(p.fogColor);
  if (p.fogRange) Lighting.uFogRange.value.set(p.fogRange[0], p.fogRange[1]);
  if (p.voidY !== undefined) Lighting.uVoidY.value = p.voidY;
}

const toonVert = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;
#ifdef USE_COLOR
varying vec3 vColor;
#endif
#ifdef USE_INSTANCING_COLOR
varying vec3 vInstColor;
#endif
void main() {
  vec4 pos = vec4(position, 1.0);
  vec3 objN = normal;
#ifdef USE_INSTANCING
  pos = instanceMatrix * pos;
  mat3 im = mat3(instanceMatrix);
  objN /= vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2]));
  objN = im * objN;
#endif
  vec4 wp = modelMatrix * pos;
  vWorldPos = wp.xyz;
  vec3 viewN = normalMatrix * objN;
  vWorldNormal = normalize((vec4(viewN, 0.0) * viewMatrix).xyz);
  vUv = uv;
#ifdef USE_COLOR
  vColor = color;
#endif
#ifdef USE_INSTANCING_COLOR
  vInstColor = instanceColor;
#endif
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const toonFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uAlphaTest;
#ifdef USE_TOON_MAP
uniform sampler2D uMap;
uniform vec4 uMapTransform;
uniform float uMapScale;
#endif
uniform vec3 uShade;
uniform float uThreshold;
uniform float uSoftness;
uniform vec3 uEmissive;
uniform float uGlow;
uniform float uRim;
uniform float uSpec;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uDissolve;
uniform vec3 uDissolveColor;
uniform vec3 uDissolveOrigin;
uniform float uPaint;

uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbTop;
uniform vec3 uAmbBottom;
uniform vec3 uRimColor;
uniform vec3 uFogColor;
uniform vec2 uFogRange;
uniform float uFogAmt;
uniform float uVoidY;
uniform vec3 uPointPos[4];
uniform vec3 uPointColor[4];
uniform float uPointRange[4];
uniform float uTime;
uniform vec3 uGlobalTint;
uniform vec3 uCamLight;
uniform float uCamMix;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;
#ifdef USE_COLOR
varying vec3 vColor;
#endif
#ifdef USE_INSTANCING_COLOR
varying vec3 vInstColor;
#endif

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1, 0, 0));
  float n010 = hash13(i + vec3(0, 1, 0));
  float n110 = hash13(i + vec3(1, 1, 0));
  float n001 = hash13(i + vec3(0, 0, 1));
  float n101 = hash13(i + vec3(1, 0, 1));
  float n011 = hash13(i + vec3(0, 1, 1));
  float n111 = hash13(i + vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

void main() {
  vec3 N = normalize(vWorldNormal);
#ifdef DOUBLE_SIDED
  if (!gl_FrontFacing) N = -N;
#endif
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec4 albedo = vec4(uColor, uOpacity);
#ifdef USE_TOON_MAP
  vec2 uv;
  #ifdef WORLD_UV
    vec3 an = abs(N);
    if (an.y > an.x && an.y > an.z) uv = vWorldPos.xz;
    else if (an.x > an.z) uv = vec2(vWorldPos.z, vWorldPos.y);
    else uv = vec2(vWorldPos.x, vWorldPos.y);
    uv = uv * uMapScale + uMapTransform.zw;
  #else
    uv = vUv * uMapTransform.xy + uMapTransform.zw;
  #endif
  #ifdef MAP_BIAS
    vec4 tex = texture2D(uMap, uv, MAP_BIAS);
  #else
    vec4 tex = texture2D(uMap, uv);
  #endif
  albedo *= tex;
#endif
#ifdef USE_COLOR
  albedo.rgb *= vColor;
#endif
#ifdef USE_INSTANCING_COLOR
  albedo.rgb *= vInstColor;
#endif
  if (albedo.a < uAlphaTest) discard;

  float edgeGlow = 0.0;
#ifdef USE_DISSOLVE
  if (uDissolve > 0.001) {
    float h = clamp((vWorldPos.y - uDissolveOrigin.y) / 2.0, 0.0, 1.0);
    float dn = vnoise(vWorldPos * 7.0) * 0.55 + vnoise(vWorldPos * 19.0) * 0.15 + (1.0 - h) * 0.3;
    if (dn < uDissolve) discard;
    edgeGlow = 1.0 - smoothstep(uDissolve, uDissolve + 0.07, dn);
  }
#endif

#ifdef UNLIT
  vec3 col = albedo.rgb;
#else
  vec3 L = normalize(mix(uLightDir, uCamLight, uCamMix));
  float hl = dot(N, L) * 0.5 + 0.5;
  // painterly wobble of the terminator so the shadow edge looks brushed, not computed
  float wob = (vnoise(vWorldPos * 3.1) - 0.5) * uPaint;
  float lit = smoothstep(uThreshold - uSoftness, uThreshold + uSoftness, hl + wob);
  vec3 amb = mix(uAmbBottom, uAmbTop, N.y * 0.5 + 0.5);
  vec3 col = albedo.rgb * mix(uShade * amb, uLightColor, lit);

  for (int i = 0; i < 4; i++) {
    vec3 d = uPointPos[i] - vWorldPos;
    float dist = length(d);
    float att = clamp(1.0 - dist / max(uPointRange[i], 0.001), 0.0, 1.0);
    att *= att;
    float pl = smoothstep(-0.05, 0.15, dot(N, d / max(dist, 1e-4)));
    col += albedo.rgb * uPointColor[i] * att * pl;
  }

  float fres = 1.0 - clamp(dot(N, V), 0.0, 1.0);
  float rim = smoothstep(0.58, 0.64, fres) * uRim;
  col += uRimColor * albedo.rgb * rim * mix(1.6, 0.5, lit);

  vec3 H = normalize(L + V);
  col += uLightColor * smoothstep(0.955, 0.975, dot(N, H)) * uSpec;
#endif

  col += uEmissive;
#ifdef USE_TOON_MAP
  col += tex.rgb * tex.rgb * uGlow;
#endif
  col *= uGlobalTint;

#ifdef USE_DISSOLVE
  col = mix(col, uDissolveColor, edgeGlow);
#endif
  col = mix(col, uFlashColor, uFlash);

#ifndef NO_FOG
  float fd = length(cameraPosition - vWorldPos);
  float fog = smoothstep(uFogRange.x, uFogRange.y, fd);
  float hf = clamp((uVoidY - vWorldPos.y) / 40.0, 0.0, 1.0);
  fog = max(fog, hf * 0.92);
  col = mix(col, uFogColor, fog * uFogAmt);
#endif
  gl_FragColor = vec4(col, albedo.a);
}
`;

/**
 * Cel-shaded material.
 * opts: color, map, repeat [u,v], offset [u,v], worldUV (scale), shade (tint of shadow side), threshold, softness,
 *       emissive, glow, rim, spec, paint, alphaTest, opacity, transparent, side, vertexColors,
 *       unlit, fog (default true), dissolve (bool), depthWrite, blending
 */
export function toonMaterial(opts = {}) {
  const defines = {};
  const uniforms = {
    uColor: { value: new THREE.Color(opts.color ?? 0xffffff) },
    uOpacity: { value: opts.opacity ?? 1 },
    uAlphaTest: { value: opts.alphaTest ?? 0 },
    uShade: { value: new THREE.Color(opts.shade ?? 0x9a8aa8) },
    uThreshold: { value: opts.threshold ?? 0.5 },
    uSoftness: { value: opts.softness ?? 0.025 },
    uEmissive: { value: new THREE.Color(opts.emissive ?? 0x000000) },
    uGlow: { value: opts.glow ?? 0 },
    uRim: { value: opts.rim ?? 0.35 },
    uSpec: { value: opts.spec ?? 0 },
    uPaint: { value: opts.paint ?? 0.06 },
    uCamMix: { value: opts.camLight ?? 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uDissolve: { value: 0 },
    uDissolveColor: { value: new THREE.Color(opts.dissolveColor ?? 0xff5a1f) },
    uDissolveOrigin: { value: new THREE.Vector3() },
    ...Lighting,
  };
  if (opts.map) {
    defines.USE_TOON_MAP = '';
    const r = opts.repeat || [1, 1];
    const o = opts.offset || [0, 0];
    uniforms.uMap = { value: opts.map };
    uniforms.uMapTransform = { value: new THREE.Vector4(r[0], r[1], o[0], o[1]) };
    uniforms.uMapScale = { value: opts.worldUV ?? 1 };
    if (opts.worldUV) defines.WORLD_UV = '';
  }
  if (opts.unlit) defines.UNLIT = '';
  if (opts.mapBias) defines.MAP_BIAS = opts.mapBias.toFixed(2);
  if (opts.fog === false) defines.NO_FOG = '';
  if (opts.dissolve) defines.USE_DISSOLVE = '';
  const mat = new THREE.ShaderMaterial({
    uniforms,
    defines,
    vertexShader: toonVert,
    fragmentShader: toonFrag,
    transparent: !!opts.transparent,
    side: opts.side ?? THREE.FrontSide,
    vertexColors: !!opts.vertexColors,
    depthWrite: opts.depthWrite ?? true,
    blending: opts.blending ?? THREE.NormalBlending,
  });
  mat.isToon = true;
  return mat;
}

/** Normal prepass override (view-space normals packed to RGB). */
export function createNormalOverride() {
  const m = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
  return m;
}

// Small helpers for per-actor effects on a list of toon materials
export function setFlash(mats, amount, color) {
  for (const m of mats) {
    if (!m.uniforms?.uFlash) continue;
    m.uniforms.uFlash.value = amount;
    if (color) m.uniforms.uFlashColor.value.copy(color);
  }
}
export function setDissolve(mats, amount, origin) {
  for (const m of mats) {
    if (!m.uniforms?.uDissolve) continue;
    m.uniforms.uDissolve.value = amount;
    if (origin) m.uniforms.uDissolveOrigin.value.copy(origin);
  }
}

/** Unlit additive/alpha material for simple glowing things that are part of the world (lantern cores). */
export function glowMaterial(color, opts = {}) {
  return toonMaterial({ color, unlit: true, fog: opts.fog ?? true, ...opts });
}
