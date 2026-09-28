import * as THREE from 'three';
import { LAYER_FX } from '../render/pipeline.js';

// Style ids shared by trails / arcs / dragons
export const STYLE = { STEEL: 0, WATER: 1, FIRE: 2, CALM: 3, DEMON: 4, COMPASS: 5, SERPENT: 6, MOON: 7 };
export const styleId = (s) => (typeof s === 'number' ? s : STYLE[(s || 'steel').toUpperCase()] ?? 0);
/** Ink-painted styles (dark outlines) are drawn with normal blending; the glowing ones add light. */
const inked = (sid) => sid === STYLE.WATER || sid === STYLE.SERPENT;

const commonGLSL = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return noise(p) * 0.55 + noise(p * 2.1 + 3.1) * 0.3 + noise(p * 4.3 + 7.7) * 0.15; }
// u: along the stroke (0 = head/newest, 1 = tail), v: across (0 inner, 1 outer)
vec4 styleColor(int style, float u, float v, float t, float alpha) {
  vec4 c = vec4(0.0);
  if (style == 1) {
    // ukiyo-e water: indigo body, azure bands, white foam crest and dark ink edges
    float wave = sin(u * 26.0 - t * 14.0 + v * 3.0) * 0.5 + 0.5;
    float n = fbm(vec2(u * 8.0 - t * 3.0, v * 3.0));
    float band = v + (n - 0.5) * 0.35;
    vec3 deep = vec3(0.07, 0.2, 0.55), mid = vec3(0.16, 0.5, 0.92), light = vec3(0.55, 0.85, 1.0);
    vec3 col = band < 0.35 ? deep : band < 0.7 ? mid : light;
    float foam = smoothstep(0.78, 0.84, band + wave * 0.12) ;
    col = mix(col, vec3(1.0), foam);
    float inkO = smoothstep(0.9, 0.97, v + (n - 0.5) * 0.1);
    float inkI = 1.0 - smoothstep(0.02, 0.08, v);
    col = mix(col, vec3(0.02, 0.05, 0.16), max(inkO, inkI) * 0.9);
    float edge = 1.0 - smoothstep(0.97, 1.0, v + (n - 0.5) * 0.12);
    float tail = 1.0 - smoothstep(0.55 + n * 0.35, 1.0, u);
    c = vec4(col * 1.25, edge * tail * alpha);
  } else if (style == 2) {
    float n = fbm(vec2(u * 6.0 - t * 6.0, v * 2.5 + t));
    float heat = (1.0 - u) * 0.8 + (1.0 - abs(v - 0.55) * 1.6) * 0.5 + (n - 0.5) * 0.9;
    vec3 col = heat > 0.95 ? vec3(1.0, 0.95, 0.6) : heat > 0.65 ? vec3(1.0, 0.58, 0.12) : heat > 0.35 ? vec3(0.92, 0.18, 0.05) : vec3(0.35, 0.03, 0.02);
    float shape = smoothstep(0.08, 0.3, heat) * (1.0 - smoothstep(0.92, 1.0, v + (n - 0.5) * 0.4));
    float tail = 1.0 - smoothstep(0.35 + n * 0.5, 1.0, u);
    c = vec4(col * 1.6, shape * tail * alpha);
  } else if (style == 3) {
    float n = noise(vec2(u * 10.0, v * 4.0 + t));
    vec3 col = mix(vec3(0.7, 0.9, 1.0), vec3(1.0), smoothstep(0.4, 0.9, v));
    float a = smoothstep(0.0, 0.3, v) * (1.0 - smoothstep(0.85, 1.0, v)) * (1.0 - u) * (0.6 + n * 0.4);
    c = vec4(col * 1.4, a * alpha);
  } else if (style == 4) {
    float n = fbm(vec2(u * 5.0 - t * 4.0, v * 3.0));
    vec3 col = mix(vec3(0.95, 0.35, 0.6), vec3(0.55, 0.95, 1.0), smoothstep(0.4, 0.9, v + (n - 0.5) * 0.4));
    float a = smoothstep(0.0, 0.2, v) * (1.0 - smoothstep(0.85, 1.0, v)) * (1.0 - smoothstep(0.3, 1.0, u + n * 0.3));
    c = vec4(col * 1.5, a * alpha);
  } else if (style == 6) {
    // serpent: pale lilac scales with violet ink edges and a white sheen along the belly
    float n = fbm(vec2(u * 7.0 - t * 4.0, v * 3.0));
    vec2 sc = vec2(u * 30.0 - t * 5.0, v * 4.0);
    vec2 cell = fract(vec2(sc.x + sc.y, sc.x - sc.y) * 0.5) - 0.5;
    float scale = smoothstep(0.3, 0.46, max(abs(cell.x), abs(cell.y)));
    float band = v + (n - 0.5) * 0.3;
    vec3 deep = vec3(0.3, 0.13, 0.52), mid = vec3(0.64, 0.47, 0.96), light = vec3(0.95, 0.91, 1.0);
    vec3 col = band < 0.32 ? deep : band < 0.74 ? mid : light;
    col = mix(col, deep * 0.85, scale * 0.5 * step(0.32, band) * (1.0 - step(0.74, band)));
    float inkO = smoothstep(0.9, 0.97, v + (n - 0.5) * 0.1);
    float inkI = 1.0 - smoothstep(0.02, 0.08, v);
    col = mix(col, vec3(0.09, 0.02, 0.17), max(inkO, inkI) * 0.88);
    float edge = 1.0 - smoothstep(0.97, 1.0, v + (n - 0.5) * 0.12);
    float tail = 1.0 - smoothstep(0.5 + n * 0.35, 1.0, u);
    c = vec4(col * 1.2, edge * tail * alpha);
  } else if (style == 7) {
    // moon: a violet body under a pale gold cutting edge, flecked like moonlight on water
    float n = fbm(vec2(u * 6.0 - t * 5.0, v * 3.0 + t * 0.5));
    float band = v + (n - 0.5) * 0.3;
    vec3 col = mix(vec3(0.32, 0.1, 0.62), vec3(0.72, 0.5, 1.0), smoothstep(0.2, 0.7, band));
    col = mix(col, vec3(1.0, 0.93, 0.7), smoothstep(0.78, 0.95, band));
    float a = smoothstep(0.0, 0.18, v) * (1.0 - smoothstep(0.93, 1.0, v)) * (1.0 - smoothstep(0.35, 1.0, u + n * 0.25));
    c = vec4(col * 1.55, a * alpha);
  } else if (style == 5) {
    vec3 col = vec3(0.5, 0.92, 1.0);
    float a = (1.0 - smoothstep(0.7, 1.0, u)) * smoothstep(0.0, 0.2, v) * (1.0 - smoothstep(0.8, 1.0, v));
    c = vec4(col * 1.8, a * alpha);
  } else {
    // steel: bright white core with a pale blue smear
    float core = smoothstep(0.55, 0.95, v);
    vec3 col = mix(vec3(0.55, 0.7, 1.0), vec3(1.0), core);
    float a = smoothstep(0.0, 0.5, v) * (1.0 - smoothstep(0.96, 1.0, v)) * pow(1.0 - u, 1.6);
    c = vec4(col * 1.3, a * alpha);
  }
  return c;
}
`;

// ---------------------------------------------------------------------------
// Sword trail (ribbon from blade base to tip, smoothed with Catmull-Rom)
// ---------------------------------------------------------------------------
const trailVert = /* glsl */ `
attribute vec2 aUV;
varying vec2 vUv;
void main() {
  vUv = aUV;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;
const trailFrag = /* glsl */ `
uniform int uStyle;
uniform float uTime;
uniform float uAlpha;
varying vec2 vUv;
${commonGLSL}
void main() {
  vec4 c = styleColor(uStyle, vUv.x, vUv.y, uTime, uAlpha);
  if (c.a < 0.01) discard;
  gl_FragColor = c;
}
`;

const MAX_SAMPLES = 48;
const SUB = 4;

export class SwordTrail {
  constructor(scene, opts = {}) {
    this.life = opts.life ?? 0.16;
    this.style = styleId(opts.style);
    this.extend = opts.extend ?? 0;
    this.samples = [];
    this.active = false;
    const maxVerts = MAX_SAMPLES * SUB * 2;
    this.positions = new Float32Array(maxVerts * 3);
    this.uvs = new Float32Array(maxVerts * 2);
    const idx = [];
    for (let i = 0; i < MAX_SAMPLES * SUB - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.uvAttr = new THREE.BufferAttribute(this.uvs, 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('aUV', this.uvAttr);
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: trailVert,
      fragmentShader: trailFrag,
      uniforms: { uStyle: { value: this.style }, uTime: { value: 0 }, uAlpha: { value: 1 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYER_FX);
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);
  }

  setStyle(style, opts = {}) {
    this.style = styleId(style);
    this.mat.uniforms.uStyle.value = this.style;
    this.mat.blending = inked(this.style) ? THREE.NormalBlending : THREE.AdditiveBlending;
    const broad = inked(this.style) || this.style === STYLE.FIRE;
    this.life = opts.life ?? (broad ? 0.26 : 0.14);
    this.extend = opts.extend ?? (broad ? 0.55 : 0.05);
    this.inner = opts.inner ?? (broad ? 0.15 : 0.35);
  }

  push(base, tip, time) {
    const b = base.clone(), t = tip.clone();
    if (this.extend) {
      const d = t.clone().sub(b);
      t.addScaledVector(d, this.extend);
      b.addScaledVector(d, this.inner ?? 0.2);
    }
    this.samples.unshift({ b, t, time });
    if (this.samples.length > MAX_SAMPLES) this.samples.length = MAX_SAMPLES;
  }

  update(time, emitting) {
    this.mat.uniforms.uTime.value = time;
    while (this.samples.length && time - this.samples[this.samples.length - 1].time > this.life) this.samples.pop();
    const s = this.samples;
    if (s.length < 2) {
      this.geo.setDrawRange(0, 0);
      return;
    }
    let v = 0;
    const P = this.positions, U = this.uvs;
    const cr = (p0, p1, p2, p3, t, out) => {
      const t2 = t * t, t3 = t2 * t;
      out.x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      out.y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      out.z = 0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
      return out;
    };
    const n = s.length;
    for (let i = 0; i < n - 1; i++) {
      const s0 = s[Math.max(0, i - 1)], s1 = s[i], s2 = s[i + 1], s3 = s[Math.min(n - 1, i + 2)];
      const steps = i === n - 2 ? SUB + 1 : SUB;
      for (let k = 0; k < steps; k++) {
        if (v >= MAX_SAMPLES * SUB * 2 - 2) break;
        const t = k / SUB;
        cr(s0.b, s1.b, s2.b, s3.b, t, _a);
        cr(s0.t, s1.t, s2.t, s3.t, t, _b);
        const age = (time - (s1.time + (s2.time - s1.time) * t)) / this.life;
        P[v * 3] = _a.x; P[v * 3 + 1] = _a.y; P[v * 3 + 2] = _a.z;
        U[v * 2] = age; U[v * 2 + 1] = 0;
        v++;
        P[v * 3] = _b.x; P[v * 3 + 1] = _b.y; P[v * 3 + 2] = _b.z;
        U[v * 2] = age; U[v * 2 + 1] = 1;
        v++;
      }
    }
    this.posAttr.needsUpdate = true;
    this.uvAttr.needsUpdate = true;
    this.geo.setDrawRange(0, Math.max(0, (v / 2 - 1) * 6));
    void emitting;
  }

  clear() {
    this.samples.length = 0;
    this.geo.setDrawRange(0, 0);
  }
}
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Crescent slash arc (anime smear) — wipes in along the arc, then dissolves
// ---------------------------------------------------------------------------
const arcVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const arcFrag = /* glsl */ `
uniform int uStyle;
uniform float uTime;
uniform float uProg;
uniform float uFade;
varying vec2 vUv;
${commonGLSL}
void main() {
  // vUv.x along the arc (0 start .. 1 end), vUv.y across (0 inner .. 1 outer)
  float head = uProg;
  float u = clamp((head - vUv.x) / max(head, 0.001), 0.0, 1.0); // 0 at the leading edge
  if (vUv.x > head) discard;
  // pointed leading edge: the band narrows toward the head
  float taper = smoothstep(0.0, 0.14, head - vUv.x);
  if (abs(vUv.y - 0.55) > 0.55 * taper + 0.02) discard;
  float n = noise(vUv * vec2(18.0, 4.0) + uTime);
  float dissolve = smoothstep(uFade - 0.15, uFade, n * 0.5 + (1.0 - vUv.x) * 0.5);
  vec4 c = styleColor(uStyle, u * 0.8, vUv.y, uTime, 1.0 - dissolve);
  if (c.a < 0.01) discard;
  gl_FragColor = c;
}
`;

function crescentGeometry(radius, width, arc, seg = 48) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const a = t * arc;
    // thick in the middle, thin at ends (crescent)
    const w = width * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.7);
    const r0 = radius - w * 0.35, r1 = radius + w * 0.65;
    pos.push(Math.cos(a) * r0, Math.sin(a) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0);
    uv.push(t, 0, t, 1);
    if (i < seg) {
      const b = i * 2;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------
// Tube "dragon" following a path (water dragon / fire dragon)
// ---------------------------------------------------------------------------
const dragonFrag = /* glsl */ `
uniform int uStyle;
uniform float uTime;
uniform float uProg;
uniform float uFade;
varying vec2 vUv;
${commonGLSL}
void main() {
  // vUv.x along the path (0 tail .. 1 head), vUv.y around
  if (vUv.x > uProg) discard;
  float fromHead = (uProg - vUv.x) / max(uProg, 0.001);
  float around = abs(vUv.y * 2.0 - 1.0);
  float v = 1.0 - around; // 1 on one side, 0 on the other: creates banding across the tube
  float n = noise(vUv * vec2(30.0, 6.0) - uTime * 2.0);
  float dissolve = smoothstep(uFade - 0.1, uFade, n * 0.4 + fromHead * 0.6);
  vec4 c = styleColor(uStyle, fromHead * 0.7, v, uTime, 1.0 - dissolve);
  if (c.a < 0.01) discard;
  gl_FragColor = c;
}
`;

// ---------------------------------------------------------------------------
// Ground / air ring shockwave
// ---------------------------------------------------------------------------
const ringFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uTime;
uniform float uThick;
varying vec2 vUv;
${commonGLSL}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float ang = atan(p.y, p.x);
  float n = noise(vec2(ang * 6.0, uTime * 3.0));
  float inner = 1.0 - uThick - n * 0.08;
  float a = smoothstep(inner, inner + 0.08, r) * (1.0 - smoothstep(0.94, 1.0, r));
  // streaky brush texture
  a *= 0.55 + 0.45 * noise(vec2(ang * 40.0, r * 3.0));
  a *= uAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * (1.0 + (1.0 - r) * 0.5), a);
}
`;

// ---------------------------------------------------------------------------
// Decal (textured or procedural telegraph) on the floor
// ---------------------------------------------------------------------------
const decalFrag = /* glsl */ `
uniform sampler2D uMap;
uniform int uMode; // 0 texture alpha, 1 texture additive(lum), 2 telegraph circle, 3 telegraph line, 4 ripple
uniform vec3 uColor;
uniform float uAlpha;
uniform float uFill;
uniform float uTime;
uniform float uRot;
varying vec2 vUv;
${commonGLSL}
void main() {
  vec2 uv = vUv;
  vec4 c = vec4(0.0);
  if (uMode == 0) {
    vec4 t = texture2D(uMap, uv);
    c = vec4(t.rgb * uColor, t.a * uAlpha);
  } else if (uMode == 1) {
    vec2 p = uv - 0.5;
    float cs = cos(uRot), sn = sin(uRot);
    p = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y) + 0.5;
    vec4 t = texture2D(uMap, p);
    c = vec4(t.rgb * uColor * 1.6, max(t.a, dot(t.rgb, vec3(0.33))) * uAlpha);
  } else if (uMode == 2) {
    vec2 p = uv * 2.0 - 1.0;
    float r = length(p);
    float rim = smoothstep(0.9, 0.95, r) * (1.0 - smoothstep(0.98, 1.0, r));
    float fill = (1.0 - step(uFill, r)) * (1.0 - step(1.0, r)) * 0.35;
    float hatch = step(0.5, fract((p.x + p.y) * 10.0 + uTime * 2.0)) * 0.12 * (1.0 - step(1.0, r));
    c = vec4(uColor, (rim + fill + hatch) * uAlpha);
  } else if (uMode == 3) {
    vec2 p = uv;
    float side = smoothstep(0.0, 0.06, p.x) * (1.0 - smoothstep(0.94, 1.0, p.x));
    float edge = 1.0 - smoothstep(0.03, 0.08, min(p.x, 1.0 - p.x));
    float fill = step(p.y, uFill) * 0.35 * side;
    float arrows = step(0.5, fract(p.y * 6.0 - uTime * 3.0 + abs(p.x - 0.5))) * 0.15 * side;
    c = vec4(uColor, (edge * 0.9 + fill + arrows) * uAlpha);
  } else {
    vec2 p = uv * 2.0 - 1.0;
    float r = length(p);
    float rings = 0.0;
    for (int i = 0; i < 3; i++) {
      float rr = fract(uTime * 0.35 + float(i) / 3.0);
      rings += smoothstep(0.02, 0.0, abs(r - rr)) * (1.0 - rr);
    }
    float disk = (1.0 - smoothstep(0.85, 1.0, r)) * 0.25;
    c = vec4(uColor, (rings * 0.8 + disk) * uAlpha);
  }
  if (c.a < 0.004) discard;
  gl_FragColor = c;
}
`;

// ---------------------------------------------------------------------------
// Camera-facing sprite (textures: waveCurl, splash, flame, smoke)
// ---------------------------------------------------------------------------
const spriteVert = /* glsl */ `
uniform vec2 uSize;
uniform float uRot;
uniform float uAxis; // 1 = only rotate around world Y
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float c = cos(uRot), s = sin(uRot);
  vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * uSize;
  if (uAxis > 0.5) {
    vec3 up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    vec3 right = normalize(cross(up, vec3(0.0, 0.0, 1.0)));
    center.xyz += right * -q.x + up * q.y;
  } else {
    center.xy += q;
  }
  gl_Position = projectionMatrix * center;
}
`;
const spriteFrag = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uCut;
uniform float uAdd;
varying vec2 vUv;
${commonGLSL}
void main() {
  vec4 t = texture2D(uMap, vUv);
  float n = noise(vUv * 9.0);
  float a = t.a * uAlpha * smoothstep(uCut, uCut + 0.12, n * 0.6 + t.a * 0.4);
  if (a < 0.01) discard;
  gl_FragColor = vec4(t.rgb * uColor * (1.0 + uAdd), a);
}
`;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();

/**
 * Manages short-lived mesh effects. Each effect: { obj, age, life, update(t, dt) }
 */
export class Effects {
  constructor(scene, textures) {
    this.scene = scene;
    this.T = textures || {};
    this.list = [];
    this.time = 0;
    this.quad = new THREE.PlaneGeometry(1, 1);
    this.ringGeo = new THREE.PlaneGeometry(2, 2);
    this.arcCache = new Map();
  }

  _add(obj, life, update, onEnd) {
    obj.traverse((o) => {
      o.layers.set(LAYER_FX);
      o.frustumCulled = false;
    });
    this.scene.add(obj);
    const e = { obj, age: 0, life, update, onEnd, dead: false };
    this.list.push(e);
    return e;
  }

  update(dt) {
    this.time += dt;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      // (an effect an actor owns keeps that actor's clock: see BossBase.own)
      const edt = e.clock ? dt * e.clock.rate : dt;
      e.age += edt;
      const t = Math.min(1, e.age / e.life);
      e.update?.(t, edt, e);
      if (e.age >= e.life || e.dead) {
        this.scene.remove(e.obj);
        e.obj.traverse((o) => {
          if (o.material && o.material.userData.dispose !== false) o.material.dispose?.();
          if (o.geometry && o.geometry.userData.own) o.geometry.dispose();
        });
        e.onEnd?.();
        this.list.splice(i, 1);
      }
    }
  }

  clear() {
    for (const e of this.list) this.scene.remove(e.obj);
    this.list.length = 0;
  }

  /**
   * Crescent slash in a plane: center, basis vectors f (arc start dir) and s (arc sweep dir), radius, arc radians.
   * style: 'steel' | 'water' | 'fire' | 'calm' | 'demon' | 'serpent'
   */
  arc({ center, f, s, radius = 1.4, width = 0.5, arc = Math.PI * 0.9, style = 'steel', life = 0.32, wipe = 0.07 }) {
    const key = `${radius.toFixed(2)}|${width.toFixed(2)}|${arc.toFixed(2)}`;
    let g = this.arcCache.get(key);
    if (!g) {
      g = crescentGeometry(radius, width, arc);
      this.arcCache.set(key, g);
    }
    const sid = styleId(style);
    const mat = new THREE.ShaderMaterial({
      vertexShader: arcVert,
      fragmentShader: arcFrag,
      uniforms: { uStyle: { value: sid }, uTime: { value: this.time }, uProg: { value: 0 }, uFade: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: inked(sid) ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(g, mat);
    _x.copy(f).normalize();
    _y.copy(s).addScaledVector(_x, -s.dot(_x)).normalize();
    _z.crossVectors(_x, _y);
    _m.makeBasis(_x, _y, _z);
    mesh.quaternion.setFromRotationMatrix(_m);
    mesh.position.copy(center);
    mesh.renderOrder = 9;
    return this._add(mesh, life, (t) => {
      mat.uniforms.uTime.value = this.time;
      mat.uniforms.uProg.value = Math.min(1, (t * life) / wipe);
      mat.uniforms.uFade.value = Math.max(0, (t - 0.35) / 0.65) * 1.3;
    });
  }

  /** Water / fire dragon along points. */
  dragon(points, { style = 'water', radius = 0.45, life = 1.4, grow = 0.5, seg = 120 } = {}) {
    const curve = new THREE.CatmullRomCurve3(points);
    const tube = new THREE.TubeGeometry(curve, seg, 1, 10, false);
    // taper: tail thin, body thick, head bulge
    const pos = tube.attributes.position;
    const uv = tube.attributes.uv;
    const center = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i);
      curve.getPointAt(Math.min(1, u), center);
      _v.fromBufferAttribute(pos, i).sub(center);
      const prof = Math.pow(Math.sin(Math.min(1, u * 1.08) * Math.PI * 0.5), 0.6) * (0.55 + 0.45 * Math.sin(u * Math.PI)) + (u > 0.88 ? (u - 0.88) * 4 : 0);
      _v.multiplyScalar(radius * prof);
      pos.setXYZ(i, center.x + _v.x, center.y + _v.y, center.z + _v.z);
    }
    tube.computeVertexNormals();
    tube.userData.own = true;
    const sid = styleId(style);
    const mat = new THREE.ShaderMaterial({
      vertexShader: arcVert,
      fragmentShader: dragonFrag,
      uniforms: { uStyle: { value: sid }, uTime: { value: this.time }, uProg: { value: 0 }, uFade: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: inked(sid) ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(tube, mat);
    mesh.renderOrder = 8;
    return this._add(mesh, life, (t) => {
      mat.uniforms.uTime.value = this.time;
      mat.uniforms.uProg.value = Math.min(1, t / grow);
      mat.uniforms.uFade.value = Math.max(0, (t - 0.55) / 0.45) * 1.2;
    });
  }

  /** Expanding ring. normal: world normal of the ring plane (default up = ground ring). */
  ring(pos, { color = 0xffffff, from = 0.3, to = 4, life = 0.45, normal = null, thick = 0.25, additive = true, alpha = 1 } = {}) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: arcVert,
      fragmentShader: ringFrag,
      uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 }, uTime: { value: this.time }, uThick: { value: thick } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.copy(pos);
    if (normal) mesh.quaternion.setFromUnitVectors(_z.set(0, 0, 1), _v.copy(normal).normalize());
    else mesh.rotation.x = -Math.PI / 2;
    return this._add(mesh, life, (t) => {
      const e = 1 - Math.pow(1 - t, 3);
      const r = from + (to - from) * e;
      mesh.scale.setScalar(r);
      mat.uniforms.uAlpha.value = (1 - t) * alpha;
      mat.uniforms.uTime.value = this.time;
    });
  }

  /** Floor decal. kind: 'crack' | 'compass' | 'shadow' | 'circle' | 'line' | 'ripple' */
  decal(pos, { kind = 'crack', size = 2, life = 6, color = 0xffffff, alpha = 1, rot = 0, length = 0, fillTime = 0, fadeIn = 0.1, spin = 0, y = 0.02 } = {}) {
    const mode = kind === 'crack' || kind === 'shadow' ? 0 : kind === 'compass' ? 1 : kind === 'circle' ? 2 : kind === 'line' ? 3 : 4;
    const map = kind === 'crack' ? this.T.crack : kind === 'compass' ? this.T.compass : kind === 'shadow' ? this.T.shadow : null;
    if ((mode === 0 || mode === 1) && !map) return null;
    const mat = new THREE.ShaderMaterial({
      vertexShader: arcVert,
      fragmentShader: decalFrag,
      uniforms: {
        uMap: { value: map }, uMode: { value: mode }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: 0 },
        uFill: { value: 0 }, uTime: { value: 0 }, uRot: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: mode === 1 || mode === 4 ? THREE.AdditiveBlending : THREE.NormalBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const mesh = new THREE.Mesh(this.quad, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rot;
    mesh.position.set(pos.x, (pos.y ?? 0) + y, pos.z);
    if (kind === 'line') {
      mesh.scale.set(size, length, 1);
      // anchor at start: shift forward by half length along the rotated local y
      mesh.position.x += -Math.sin(rot) * length * 0.5;
      mesh.position.z += -Math.cos(rot) * length * 0.5;
    } else mesh.scale.set(size, size, 1);
    mesh.renderOrder = 2;
    const e = this._add(mesh, life, (t, dt, self) => {
      const a = self.age;
      const fin = fadeIn > 0 ? Math.min(1, a / fadeIn) : 1;
      // (reads self.life, so shortening it fades the decal out over the same window)
      const fout = Math.min(1, (self.life - a) / Math.min(1.2, life * 0.4));
      mat.uniforms.uAlpha.value = alpha * fin * Math.max(0, fout);
      mat.uniforms.uTime.value = a;
      mat.uniforms.uFill.value = fillTime > 0 ? Math.min(1, a / fillTime) : 1;
      if (spin) mat.uniforms.uRot.value += spin * dt;
    });
    e.mesh = mesh;
    return e;
  }

  /** Textured camera-facing sprite. */
  sprite(pos, { tex = 'splash', size = 1.5, life = 0.5, color = 0xffffff, rot = 0, spin = 0, grow = 0.6, axis = false, additive = false, rise = 0, add = 0, alpha = 1 } = {}) {
    const map = this.T[tex];
    if (!map) return null;
    const aspect = map.image ? map.image.height / map.image.width : 1;
    const mat = new THREE.ShaderMaterial({
      vertexShader: spriteVert,
      fragmentShader: spriteFrag,
      uniforms: {
        uMap: { value: map }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 }, uCut: { value: 0 },
        uSize: { value: new THREE.Vector2(size, size * aspect) }, uRot: { value: rot }, uAxis: { value: axis ? 1 : 0 }, uAdd: { value: add },
      },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(this.quad, mat);
    mesh.position.copy(pos);
    mesh.renderOrder = 7;
    return this._add(mesh, life, (t, dt) => {
      const s = size * (1 + grow * (1 - Math.pow(1 - t, 2)));
      mat.uniforms.uSize.value.set(s, s * aspect);
      mat.uniforms.uRot.value += spin * dt;
      mat.uniforms.uCut.value = Math.max(0, (t - 0.4) / 0.6);
      mat.uniforms.uAlpha.value = Math.min(1, t * 8) * alpha;
      mesh.position.y += rise * dt;
    });
  }

  /** Ghost snapshot of a character (afterimage). */
  afterimage(model, { color = 0xff6aa0, life = 0.35, alpha = 0.5 } = {}) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthWrite: false, blending: THREE.AdditiveBlending });
    mat.userData.dispose = true;
    model.root.updateMatrixWorld(true);
    model.root.traverse((o) => {
      if (o.isMesh && o.visible && o.geometry.attributes.position.count > 20) {
        const m = new THREE.Mesh(o.geometry, mat);
        o.matrixWorld.decompose(m.position, m.quaternion, m.scale);
        g.add(m);
      }
    });
    return this._add(g, life, (t) => {
      mat.opacity = alpha * (1 - t);
    });
  }

  /** Generic updater without a mesh (timelines) */
  timer(life, update, onEnd) {
    const o = new THREE.Object3D();
    return this._add(o, life, update, onEnd);
  }
}
