import * as THREE from 'three';

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential smoothing factor. */
export const dampT = (k, dt) => 1 - Math.exp(-k * dt);
export const damp = (a, b, k, dt) => lerp(a, b, dampT(k, dt));

export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}
export const angleDiff = (a, b) => wrapAngle(b - a);
export const dampAngle = (a, b, k, dt) => a + angleDiff(a, b) * dampT(k, dt);
export function approachAngle(a, b, maxStep) {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}
export function approach(a, b, step) {
  if (a < b) return Math.min(a + step, b);
  return Math.max(a - step, b);
}

export const ease = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  in3: (t) => t * t * t,
  out3: (t) => 1 - Math.pow(1 - t, 3),
  inOut3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out5: (t) => 1 - Math.pow(1 - t, 5),
  in5: (t) => t * t * t * t * t,
  // Snappy anime strike: almost instant, tiny settle.
  snap: (t) => 1 - Math.pow(1 - t, 7),
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  hold: () => 0,
  step: (t) => (t < 1 ? 0 : 1),
};

/** Deterministic PRNG */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randSign = () => (Math.random() < 0.5 ? -1 : 1);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/** Smooth 1D value noise for camera shake and idle variation. */
const PERM = new Float32Array(512);
{
  const r = mulberry32(1337);
  for (let i = 0; i < 512; i++) PERM[i] = r() * 2 - 1;
}
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = PERM[i & 511], b = PERM[(i + 1) & 511];
  return a + (b - a) * u;
}

export const tmpV = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
export const tmpQ = new THREE.Quaternion();

export function yawToDir(yaw, out = new THREE.Vector3()) {
  return out.set(Math.sin(yaw), 0, Math.cos(yaw));
}
export function dirToYaw(x, z) {
  return Math.atan2(x, z);
}
export function flatDist(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
export function yawTo(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}
