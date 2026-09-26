// Formant voice synthesis: roars, growls, snarls, grunts and a choir "ah" swell. No words, just vocal energy.

import {
  TAU, mulberry32, alloc, onePole, Biquad, normalize, fadeOut, dcBlock, saturate, polyblep,
  contour, contourVec, lpNoiseStd, mtof,
} from '../dsp.js';

/**
 * o = {
 *   dur, f0: [[t, hz], ...], jitter (0..0.1), sub (0..1 period-doubling), fry: [rateHz, depth] | null,
 *   noise (aspiration 0..1), formants: [[t, [F1..F4]], ...], bw: [b1..b4], gains: [g1..g4],
 *   tilt (source lowpass Hz), drive, env: [[t, amp], ...]
 * }
 */
export function formantVoice(sr, o, seed = 1) {
  const r = mulberry32(seed);
  const out = alloc(sr, o.dur);
  const n = out.length;
  const F = new Float64Array(4);
  const filters = [new Biquad(), new Biquad(), new Biquad(), new Biquad()];
  const aJ = onePole(sr, 30);
  const sJ = lpNoiseStd(aJ);
  const aT = onePole(sr, o.tilt || 2800);
  let jit = 0, ph = 0, parity = 0, tilt = 0, tilt2 = 0;
  let shimmer = 1;
  let baseF0 = 0, amp = 0, fryAm = 1;
  const fry = o.fry;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if ((i & 15) === 0) {
      if ((i & 63) === 0) {
        contourVec(o.formants, t, F);
        for (let k = 0; k < 4; k++) filters[k].set('bp', sr, F[k], Math.max(0.8, F[k] / o.bw[k]));
      }
      baseF0 = contour(o.f0, t);
      amp = contour(o.env, t);
      fryAm = fry ? 1 - fry[1] * 0.5 * (1 + Math.sin(TAU * fry[0] * t)) : 1;
    }
    jit += aJ * (r() * 2 - 1 - jit);
    const f0 = baseF0 * (1 + (o.jitter * jit) / sJ);
    const dt = Math.min(0.45, f0 / sr);
    ph += dt;
    if (ph >= 1) {
      ph -= 1;
      parity ^= 1;
      shimmer = 1 - (o.jitter * 2) * r();
    }
    let src = (2 * ph - 1 - polyblep(ph, dt)) * shimmer;
    if (parity) src *= 1 - o.sub;
    tilt += aT * (src - tilt);
    tilt2 += aT * (tilt - tilt2);
    const exc = tilt2 * 2.2 + (r() * 2 - 1) * o.noise;
    let y = 0;
    for (let k = 0; k < 4; k++) y += filters[k].run(exc) * o.gains[k];
    out[i] = y * amp * fryAm;
  }
  normalize(out, 1);
  if (o.drive) saturate(out, o.drive);
  dcBlock(out, sr, 40);
  fadeOut(out, Math.floor(0.02 * sr));
  return normalize(out, 0.9);
}

const jitterPts = (r, pts, amt) => pts.map(([t, v]) => [t, v * (1 + (r() - 0.5) * amt)]);

/** Akaza battle shout (two contours). */
export function roar(sr, variant = 0, seed = 301) {
  const r = mulberry32(seed);
  const A = variant === 0;
  return formantVoice(sr, {
    dur: 1.35,
    f0: jitterPts(r, A
      ? [[0, 120], [0.12, 168], [0.8, 178], [1.1, 150], [1.35, 105]]
      : [[0, 140], [0.1, 192], [0.5, 205], [0.9, 172], [1.35, 118]], 0.06),
    jitter: 0.03,
    sub: A ? 0.22 : 0.3,
    fry: null,
    noise: A ? 0.35 : 0.42,
    formants: A
      ? [[0, [700, 1150, 2500, 3400]], [0.5, [760, 1100, 2450, 3300]], [1.35, [600, 950, 2400, 3300]]]
      : [[0, [650, 1600, 2500, 3500]], [0.3, [750, 1200, 2500, 3400]], [1.35, [640, 1000, 2400, 3300]]],
    bw: [110, 130, 180, 250],
    gains: [1, 0.75, 0.4, 0.25],
    tilt: 3200,
    drive: A ? 3.0 : 3.5,
    env: [[0, 0], [0.06, 1], [0.9, 0.92], [1.2, 0.35], [1.35, 0]],
  }, seed + 1);
}

/** Low demon growl with period doubling and vocal fry. */
export function growl(sr, variant = 0, seed = 311) {
  const r = mulberry32(seed + variant * 17);
  const base = 55 + variant * 8 + r() * 6;
  return formantVoice(sr, {
    dur: 1.1,
    f0: [[0, base], [0.4, base * (1.2 + r() * 0.15)], [0.8, base * 1.05], [1.1, base * 0.85]],
    jitter: 0.07,
    sub: 0.55 + r() * 0.15,
    fry: [18 + r() * 8, 0.55],
    noise: 0.5,
    formants: [[0, [420, 780, 2000, 2800]], [0.5, [460 + r() * 60, 820, 2050, 2850]], [1.1, [380, 700, 1900, 2700]]],
    bw: [90, 110, 160, 220],
    gains: [1, 0.7, 0.35, 0.2],
    tilt: 1800,
    drive: 2.2,
    env: [[0, 0], [0.12, 1], [0.7, 0.8], [1.1, 0]],
  }, seed + 3 + variant);
}

/** Short hurt snarl / yelp. */
export function snarl(sr, variant = 0, seed = 321) {
  const r = mulberry32(seed + variant * 31);
  const k = 0.85 + variant * 0.15;
  return formantVoice(sr, {
    dur: 0.38,
    f0: [[0, 190 * k], [0.06, 320 * k * (0.9 + r() * 0.2)], [0.2, 260 * k], [0.38, 150 * k]],
    jitter: 0.05,
    sub: 0.35,
    fry: null,
    noise: 0.55,
    formants: [[0, [800, 1700, 2600, 3500]], [0.38, [650, 1200, 2400, 3300]]],
    bw: [120, 150, 200, 260],
    gains: [1, 0.8, 0.45, 0.3],
    tilt: 3000,
    drive: 2.5,
    env: [[0, 0], [0.015, 1], [0.12, 0.8], [0.38, 0]],
  }, seed + 5 + variant);
}

/** Player hurt grunt ("uh!"). */
export function grunt(sr, variant = 0, seed = 331) {
  const r = mulberry32(seed + variant * 13);
  const k = 0.92 + variant * 0.08;
  return formantVoice(sr, {
    dur: 0.26,
    f0: [[0, 170 * k], [0.05, 192 * k], [0.26, 118 * k * (0.95 + r() * 0.1)]],
    jitter: 0.02,
    sub: 0.1,
    fry: null,
    noise: 0.3,
    formants: [[0, [640, 1190, 2390, 3300]], [0.26, [560, 1050, 2350, 3200]]],
    bw: [90, 110, 160, 220],
    gains: [1, 0.7, 0.35, 0.2],
    tilt: 2600,
    drive: 1.6,
    env: [[0, 0], [0.012, 1], [0.08, 0.7], [0.26, 0]],
  }, seed + 7 + variant);
}

/**
 * Choir "ah" swell: several voices per note (detuned saws + vibrato) through a vowel formant bank.
 * notes = MIDI numbers.
 */
export function choir(sr, notes = [50, 57, 62, 65, 69], dur = 2.8, seed = 341) {
  const r = mulberry32(seed);
  const out = alloc(sr, dur);
  const n = out.length;
  const voices = [];
  for (const m of notes) {
    for (let v = 0; v < 2; v++) {
      voices.push({
        f: mtof(m) * Math.pow(2, ((v ? 1 : -1) * (5 + r() * 6)) / 1200),
        ph: r(),
        vr: 4.8 + r() * 1.2,
        vp: r() * TAU,
        amp: 0.7 + 0.3 * r(),
        dt: 0,
      });
    }
  }
  const fb = [
    [new Biquad().set('bp', sr, 800, 800 / 90), 1.0],
    [new Biquad().set('bp', sr, 1150, 1150 / 100), 0.6],
    [new Biquad().set('bp', sr, 2900, 2900 / 140), 0.3],
    [new Biquad().set('lp', sr, 500, 0.7), 0.35],
  ];
  const aT = onePole(sr, 3500);
  let tl = 0;
  const atk = 0.4, rel = 0.8;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    const upd = (i & 15) === 0;
    for (let k = 0; k < voices.length; k++) {
      const vo = voices[k];
      if (upd) vo.dt = (vo.f * (1 + 0.006 * Math.sin(vo.vp + TAU * vo.vr * t) * Math.min(1, t / 0.6))) / sr;
      const dt = vo.dt;
      vo.ph += dt;
      if (vo.ph >= 1) vo.ph -= 1;
      s += (2 * vo.ph - 1 - polyblep(vo.ph, dt)) * vo.amp;
    }
    tl += aT * (s - tl);
    let y = 0;
    for (let k = 0; k < fb.length; k++) y += fb[k][0].run(tl) * fb[k][1];
    const env = Math.min(1, t / atk) * Math.min(1, Math.max(0, (dur - t) / rel));
    out[i] = y * env * env;
  }
  dcBlock(out, sr, 40);
  return normalize(out, 0.9);
}
