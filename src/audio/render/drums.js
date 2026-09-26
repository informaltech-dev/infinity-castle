// Membrane drums (taiko family) and short impact ticks, rendered with modal synthesis.

import { TAU, mulberry32, alloc, onePole, bq, normalize, fadeOut, dcBlock, saturate, addPartial } from '../dsp.js';

/**
 * o = {
 *   dur, f0, glide (start pitch ratio), glideTau (s),
 *   modes: [[ratio, amp, decay], ...],
 *   stick: [amp, lowpassHz, tau], slap: [amp, bandHz, Q, tau], sub: [amp, hz, tau] | null, drive
 * }
 */
export function drum(sr, o, seed = 1) {
  const r = mulberry32(seed);
  const out = alloc(sr, o.dur);
  const n = out.length;
  const M = o.modes.length;
  const ph = new Float64Array(M);
  const env = new Float64Array(M);
  const dec = new Float64Array(M);
  const ratio = new Float64Array(M);
  for (let m = 0; m < M; m++) {
    ratio[m] = o.modes[m][0] * (1 + (r() - 0.5) * 0.01);
    env[m] = o.modes[m][1];
    dec[m] = Math.exp(-1 / (o.modes[m][2] * sr));
  }
  let gl = o.glide - 1;
  const glD = Math.exp(-1 / (o.glideTau * sr));
  const atk = Math.max(1, Math.floor(0.0012 * sr));
  const [sA, sF, sT] = o.stick;
  const aS = onePole(sr, sF);
  const sD = Math.exp(-1 / (sT * sr));
  let sEnv = sA;
  let sLp = 0;
  const [pA, pF, pQ, pT] = o.slap;
  const slapBq = bq('bp', sr, pF, pQ);
  const pD = Math.exp(-1 / (pT * sr));
  let pEnv = pA * 2.5;
  const sub = o.sub;
  const subD = sub ? Math.exp(-1 / (sub[2] * sr)) : 0;
  let subEnv = sub ? sub[0] : 0;
  let subPh = 0;
  const k2 = TAU / sr;
  for (let i = 0; i < n; i++) {
    const f = o.f0 * (1 + gl);
    gl *= glD;
    let s = 0;
    for (let m = 0; m < M; m++) {
      if (env[m] < 1e-5) continue;
      ph[m] += k2 * f * ratio[m];
      s += env[m] * Math.sin(ph[m]);
      env[m] *= dec[m];
    }
    if (i < atk) s *= i / atk;
    if (sEnv > 1e-5 || pEnv > 1e-5) {
      const w = r() * 2 - 1;
      sLp += aS * (w - sLp);
      s += sEnv * sLp * 2 + pEnv * slapBq.run(w);
      sEnv *= sD;
      pEnv *= pD;
    }
    if (sub && subEnv > 1e-5) {
      subPh += k2 * sub[1] * (1 + gl * 0.5);
      s += subEnv * Math.sin(subPh) * (i < atk * 3 ? i / (atk * 3) : 1);
      subEnv *= subD;
    }
    out[i] = s;
  }
  normalize(out, 1);
  if (o.drive) saturate(out, o.drive);
  dcBlock(out, sr, 20);
  fadeOut(out, Math.floor(0.03 * sr));
  return normalize(out, 0.9);
}

export const DRUMS = {
  // big odaiko "DON"
  taikoBig: {
    dur: 2.2, f0: 56, glide: 1.45, glideTau: 0.03,
    modes: [
      [1, 1, 0.75], [1.52, 0.6, 0.4], [1.98, 0.45, 0.28], [2.44, 0.3, 0.18], [2.9, 0.2, 0.12], [3.36, 0.14, 0.08],
      [4.1, 0.12, 0.06], [5.3, 0.09, 0.045], [6.8, 0.07, 0.03], [8.9, 0.05, 0.02],
    ],
    stick: [1.6, 2200, 0.007], slap: [1.2, 420, 1.1, 0.03], sub: [0.6, 40, 0.55], drive: 1.8,
  },
  // nagado-daiko "don"
  taikoMid: {
    dur: 1.3, f0: 98, glide: 1.3, glideTau: 0.025,
    modes: [[1, 1, 0.42], [1.55, 0.45, 0.25], [2.02, 0.3, 0.16], [2.5, 0.18, 0.1], [3.1, 0.12, 0.07], [4.3, 0.09, 0.04], [5.9, 0.06, 0.025]],
    stick: [1.6, 3000, 0.006], slap: [1.2, 600, 1.2, 0.022], sub: [0.25, 62, 0.25], drive: 1.7,
  },
  // rim / shell "KA"
  ka: {
    dur: 0.25, f0: 820, glide: 1.02, glideTau: 0.005,
    modes: [[1, 1, 0.035], [1.83, 0.7, 0.025], [3.1, 0.45, 0.016], [4.6, 0.25, 0.01]],
    stick: [1.2, 6000, 0.0025], slap: [0.4, 2400, 1.5, 0.008], sub: null, drive: 1.2,
  },
  // shime-daiko "tsu"
  shime: {
    dur: 0.4, f0: 360, glide: 1.08, glideTau: 0.012,
    modes: [[1, 1, 0.09], [1.59, 0.55, 0.06], [2.14, 0.4, 0.045], [2.65, 0.25, 0.03], [3.2, 0.15, 0.02]],
    stick: [1.1, 5000, 0.003], slap: [0.6, 1800, 1.2, 0.01], sub: null, drive: 1.3,
  },
};

/** Ultra-short punch tick for barrages: click + tight low thump. */
export function punchTick(sr, seed = 1) {
  const r = mulberry32(seed);
  const out = alloc(sr, 0.09);
  const n = out.length;
  const f0 = 130 + r() * 40;
  addPartial(out, sr, f0, 1.0, 0.024, 0, 0.0008, 0);
  addPartial(out, sr, f0 * 2.1, 0.35, 0.012, 0, 0.0005, 0);
  const lp = bq('lp', sr, 1400 + r() * 600, 0.7);
  const hp = bq('hp', sr, 2500, 0.7);
  const bodyD = Math.exp(-1 / (0.009 * sr));
  const clickD = Math.exp(-1 / (0.0012 * sr));
  let be = 1.4;
  let ce = 1.2;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    out[i] += lp.run(w) * be + hp.run(w) * ce;
    be *= bodyD;
    ce *= clickD;
  }
  // tiny downward pitch drop on the thump for "punch"
  normalize(out, 1);
  saturate(out, 1.8);
  fadeOut(out, Math.floor(0.012 * sr));
  return normalize(out, 0.9);
}
