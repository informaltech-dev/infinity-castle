// Plucked strings: biwa and shamisen with the characteristic "sawari" bridge buzz.
// Karplus-Strong loop + displacement-dependent delay modulation (jawari) + one-sided bridge contact.

import { TAU, mulberry32, bq, normalize, fadeOut, dcBlock, addPartial, lerp, clamp01, mtof } from '../dsp.js';

/**
 * o = {
 *   t60        decay time (s) at the fundamental
 *   damp       loop one-pole pole 0..0.7 (higher = darker, faster high-partial decay)
 *   exBright   excitation smoothing coefficient 0..1 (1 = raw noise burst)
 *   pos        pluck position (fraction of the string), 0..0.5
 *   jaw        sawari buzz depth, jawTh = displacement threshold, clipK = bridge energy absorption (<1)
 *   tension    initial pitch glide (fraction) for heavy plectrum strokes
 *   body       [[f, Q, dB], ...] peaking resonances of the instrument body
 *   slap/slapF plectrum slap noise level & centre, knock/knockF body knock level & frequency
 * }
 */
export function pluck(sr, freq, dur, o, seed = 1) {
  const r = mulberry32(seed);
  const n = Math.floor(sr * dur);
  const out = new Float32Array(n);
  const P = sr / freq;
  const b = o.damp;
  const w0 = (TAU * freq) / sr;
  // phase delay and magnitude of the loop filter at f0 (for tuning and decay compensation)
  const pd = Math.atan2(b * Math.sin(w0), 1 - b * Math.cos(w0)) / w0;
  const Hm = (1 - b) / Math.sqrt(1 - 2 * b * Math.cos(w0) + b * b);
  const g = Math.min(0.99995, Math.pow(0.001, 1 / (freq * o.t60)) / Hm);
  const Ld = P - pd;
  const size = 1 << Math.ceil(Math.log2(P + 64));
  const mask = size - 1;
  const dl = new Float32Array(size);

  // Excitation: smoothed noise burst, comb-filtered by the pluck position.
  const exLen = Math.max(8, Math.floor(P));
  const ex = new Float32Array(exLen);
  let s = 0;
  for (let i = 0; i < exLen; i++) {
    s += o.exBright * (r() * 2 - 1 - s);
    ex[i] = s;
  }
  const pp = Math.max(1, Math.floor(P * o.pos));
  const exc = new Float32Array(exLen);
  for (let i = 0; i < exLen; i++) exc[i] = ex[i] - (i >= pp ? ex[i - pp] : 0);
  normalize(exc, 1);

  const jd = o.jaw * P * 0.03;
  const th = o.jawTh;
  const ck = o.clipK;
  const glideD = Math.exp(-1 / (0.07 * sr));
  let glide = o.tension;
  let lpS = 0;
  let jaw = 0;
  let w = 0;
  for (let i = 0; i < n; i++) {
    let D = Ld * (1 - glide) - jaw;
    glide *= glideD;
    if (D < 2) D = 2;
    const rp = w - D;
    const ri = rp | 0;
    const fr = rp - ri;
    const y0 = dl[ri & mask];
    const del = y0 + (dl[(ri + 1) & mask] - y0) * fr;
    lpS = (1 - b) * del + b * lpS;
    let v = g * lpS;
    const e = v - th;
    if (e > 0) {
      // string wraps onto the curved bridge: effective length shortens -> buzz
      jaw += (jd * e - jaw) * 0.5;
      v = th + e * ck;
    } else {
      jaw *= 0.6;
    }
    const y = v + (i < exLen ? exc[i] : 0);
    dl[w & mask] = y;
    w++;
    out[i] = y;
  }

  dcBlock(out, sr, 25);
  for (const [f, q, db] of o.body) bq('peak', sr, f, q, db).apply(out);
  if (o.slap) {
    const bp = bq('bp', sr, o.slapF, 1.1);
    const len = Math.min(n, Math.floor(0.014 * sr));
    const d = Math.exp(-1 / (0.0028 * sr));
    let e = o.slap * 3;
    for (let i = 0; i < len; i++) {
      out[i] += bp.run(r() * 2 - 1) * e;
      e *= d;
    }
  }
  if (o.knock) addPartial(out, sr, o.knockF, o.knock, 0.024, 0, 0.0008, 0);
  fadeOut(out, Math.floor(0.06 * sr));
  return normalize(out, 0.9);
}

/** Biwa (heavy bachi, long buzzy sustain). */
export function biwaParams(midi) {
  const u = clamp01((midi - 38) / 36);
  return {
    t60: lerp(3.3, 1.7, u),
    damp: lerp(0.24, 0.18, u),
    exBright: 0.62,
    pos: 0.11,
    jaw: 1.0,
    jawTh: 0.12,
    clipK: 0.96,
    tension: 0.005,
    body: [[190, 1.2, 4], [460, 1.4, 3], [1250, 2, 2], [2600, 2.2, 3.5]],
    slap: 0.45,
    slapF: 2300,
    knock: 0.3,
    knockF: 175,
  };
}

/** Shamisen (bright, snappy, skin "tsun" attack, strong sawari). */
export function shamiParams(midi) {
  const u = clamp01((midi - 50) / 36);
  return {
    t60: lerp(1.15, 0.6, u),
    damp: 0.1,
    exBright: 0.8,
    pos: 0.07,
    jaw: 1.4,
    jawTh: 0.08,
    clipK: 0.94,
    tension: 0.004,
    body: [[240, 1.5, 3], [950, 1.6, 3], [3000, 2, 4.5]],
    slap: 0.8,
    slapF: 1200,
    knock: 0.45,
    knockF: 230,
  };
}

export const biwaDur = (midi) => lerp(2.6, 1.2, clamp01((midi - 38) / 36));
export const shamiDur = (midi) => lerp(1.1, 0.55, clamp01((midi - 50) / 36));

export function renderBiwa(sr, midi, seed) {
  return pluck(sr, mtof(midi), biwaDur(midi), biwaParams(midi), seed);
}

export function renderShami(sr, midi, seed) {
  return pluck(sr, mtof(midi), shamiDur(midi), shamiParams(midi), seed);
}
