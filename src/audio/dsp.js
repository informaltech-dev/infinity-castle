// Small, dependency-free DSP helpers used by the offline pre-renderers.
// Everything here is pure JS operating on Float32Arrays, so it also runs in Node for testing.

export const TAU = Math.PI * 2;

/** Deterministic, fast PRNG (returns floats in [0, 1)). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const expLerp = (a, b, t) => a * Math.pow(b / a, t);
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const dbToGain = (db) => Math.pow(10, db / 20);
export const gainToDb = (g) => (g > 0 ? 20 * Math.log10(g) : -Infinity);
export function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Coefficient for a one-pole smoother/lowpass: y += a * (x - y). */
export const onePole = (sr, fc) => 1 - Math.exp((-TAU * fc) / sr);

/** Allocate a mono sample array of `sec` seconds. */
export const alloc = (sr, sec) => new Float32Array(Math.max(1, Math.floor(sr * sec)));

/** RBJ-cookbook biquad, transposed direct form II. */
export class Biquad {
  constructor() {
    this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0;
    this.z1 = 0; this.z2 = 0;
  }
  /** type: 'lp' | 'hp' | 'bp' (0 dB peak) | 'peak' | 'hs' */
  set(type, sr, f, Q = 0.7071, db = 0) {
    const w = (TAU * clamp(f, 5, sr * 0.49)) / sr;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const alpha = sw / (2 * Q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') {
      b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    } else if (type === 'hp') {
      b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    } else if (type === 'bp') {
      b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    } else if (type === 'peak') {
      const A = Math.pow(10, db / 40);
      b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A;
    } else {
      // high shelf
      const A = Math.pow(10, db / 40);
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 + (A - 1) * cw + s);
      b1 = -2 * A * (A - 1 + (A + 1) * cw);
      b2 = A * (A + 1 + (A - 1) * cw - s);
      a0 = A + 1 - (A - 1) * cw + s;
      a1 = 2 * (A - 1 - (A + 1) * cw);
      a2 = A + 1 - (A - 1) * cw - s;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  run(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
  /** Filter a whole array in place. */
  apply(arr) {
    for (let i = 0; i < arr.length; i++) arr[i] = this.run(arr[i]);
    return arr;
  }
}

export const bq = (type, sr, f, Q, db) => new Biquad().set(type, sr, f, Q, db);

export function peakOf(x) {
  let m = 0;
  for (let i = 0; i < x.length; i++) {
    const a = x[i] < 0 ? -x[i] : x[i];
    if (a > m) m = a;
  }
  return m;
}

/** Scale to the given peak. Non-finite samples are zeroed first (defensive). */
export function normalize(x, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (!Number.isFinite(v)) { x[i] = 0; continue; }
    const a = v < 0 ? -v : v;
    if (a > m) m = a;
  }
  if (m > 1e-12) {
    const k = peak / m;
    for (let i = 0; i < x.length; i++) x[i] *= k;
  }
  return x;
}

/** Normalize several channels together (keeps their balance). */
export function normalizeMulti(chs, peak = 0.9) {
  let m = 0;
  for (const c of chs) m = Math.max(m, peakOf(c));
  if (m > 1e-12) for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= peak / m;
  return chs;
}

export function fadeIn(x, n) {
  n = Math.min(n, x.length);
  for (let i = 0; i < n; i++) x[i] *= i / n;
  return x;
}

export function fadeOut(x, n) {
  n = Math.min(n, x.length);
  const L = x.length;
  for (let i = 0; i < n; i++) x[L - 1 - i] *= i / n;
  return x;
}

/** One-pole DC blocker / gentle highpass, in place. */
export function dcBlock(x, sr, fc = 20) {
  const R = Math.exp((-TAU * fc) / sr);
  let xp = 0, yp = 0;
  for (let i = 0; i < x.length; i++) {
    const y = x[i] - xp + R * yp;
    xp = x[i];
    yp = y;
    x[i] = y;
  }
  return x;
}

/** tanh saturation normalised so that input 1 maps to 1. */
export function saturate(x, drive) {
  const k = 1 / Math.tanh(drive);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive) * k;
  return x;
}

/**
 * Make a buffer loop seamlessly: the last `xf` samples are cross-faded into the head.
 * Returns a new array of length x.length - xf.
 */
export function makeLoopable(x, xf) {
  const n = x.length - xf;
  const out = x.slice(0, n);
  for (let i = 0; i < xf; i++) {
    const a = i / xf;
    out[i] = x[i] * a + x[n + i] * (1 - a);
  }
  return out;
}

/**
 * Add an exponentially decaying sinusoid (recursive oscillator, no Math.sin in the loop).
 * decay = time constant in seconds (amplitude falls to 1/e), attack = linear fade-in time.
 */
export function addPartial(out, sr, f, amp, decay, start = 0, attack = 0.0005, phase = 0) {
  if (!(f > 0) || f >= sr * 0.49 || amp === 0) return;
  const n = out.length;
  const i0 = Math.max(0, Math.floor(start * sr));
  const w = (TAU * f) / sr;
  const c2 = 2 * Math.cos(w);
  let y1 = Math.sin(phase - w);
  let y2 = Math.sin(phase - 2 * w);
  const d = Math.exp(-1 / (decay * sr));
  const atkN = Math.max(1, Math.floor(attack * sr));
  // stop once the envelope is ~70 dB down
  const end = Math.min(n, i0 + atkN + Math.ceil(8.1 * decay * sr));
  const atkEnd = Math.min(end, i0 + atkN);
  const inv = 1 / atkN;
  let env = amp;
  let i = i0;
  for (; i < atkEnd; i++) {
    const y = c2 * y1 - y2;
    y2 = y1;
    y1 = y;
    out[i] += env * (i - i0) * inv * y;
    env *= d;
  }
  for (; i < end; i++) {
    const y = c2 * y1 - y2;
    y2 = y1;
    y1 = y;
    out[i] += env * y;
    env *= d;
  }
}

/** Band-limited sawtooth correction (PolyBLEP). */
export function polyblep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

/** Piecewise-linear contour lookup: pts = [[t, v], ...] sorted by t. */
export function contour(pts, t) {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, v0] = pts[i - 1];
      const [t1, v1] = pts[i];
      return v0 + ((v1 - v0) * (t - t0)) / Math.max(1e-9, t1 - t0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Contour of arrays (e.g. formant sets). */
export function contourVec(pts, t, out) {
  if (t <= pts[0][0]) {
    for (let k = 0; k < out.length; k++) out[k] = pts[0][1][k];
    return out;
  }
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, a] = pts[i - 1];
      const [t1, b] = pts[i];
      const u = (t - t0) / Math.max(1e-9, t1 - t0);
      for (let k = 0; k < out.length; k++) out[k] = a[k] + (b[k] - a[k]) * u;
      return out;
    }
  }
  const last = pts[pts.length - 1][1];
  for (let k = 0; k < out.length; k++) out[k] = last[k];
  return out;
}

/** Standard deviation of one-pole-lowpassed unit white noise (used to normalise smoothed noise). */
export const lpNoiseStd = (a) => Math.sqrt(a / (2 - a)) * 0.57735; // white noise in [-1,1] has std 1/sqrt(3)
