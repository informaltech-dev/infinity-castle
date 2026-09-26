// Metallic and crystalline voices: sword clang, blade shing, rin chime, ice shimmer, gong, reverse swell.

import { TAU, mulberry32, alloc, bq, normalize, fadeOut, dcBlock, addPartial, mtof, onePole } from '../dsp.js';

/** Add a partial plus a slightly detuned twin (beating shimmer). */
function pair(out, sr, r, f, amp, decay, beat, start = 0, attack = 0.0004) {
  addPartial(out, sr, f, amp, decay, start, attack, r() * TAU);
  if (beat) addPartial(out, sr, f + beat * (r() < 0.5 ? -1 : 1), amp * 0.6, decay * 0.9, start, attack, r() * TAU);
}

/** Short noise strike (bright contact transient) added at t=0. */
function strike(out, sr, r, hpHz, level, tau) {
  const hp = bq('hp', sr, hpHz, 0.7);
  const len = Math.min(out.length, Math.floor(tau * 8 * sr));
  const d = Math.exp(-1 / (tau * sr));
  let e = level;
  for (let i = 0; i < len; i++) {
    out[i] += hp.run(r() * 2 - 1) * e;
    e *= d;
  }
}

/** Sword-on-sword clash: the anime "KIN!" with long inharmonic ringing. */
export function clang(sr, base = 2100, seed = 201) {
  const r = mulberry32(seed);
  const out = alloc(sr, 2.1);
  const table = [
    [0.52, 0.35, 0.5], [0.71, 0.3, 0.45], [1.0, 1.0, 1.5], [1.47, 0.6, 1.1], [2.09, 0.75, 0.9],
    [2.76, 0.4, 0.62], [3.52, 0.35, 0.45], [4.43, 0.22, 0.32], [5.4, 0.15, 0.22],
  ];
  for (const [ratio, amp, dec] of table) {
    pair(out, sr, r, base * ratio * (1 + (r() - 0.5) * 0.01), amp, dec * (0.9 + r() * 0.2), 1.5 + r() * 3);
  }
  strike(out, sr, r, 3000, 1.2, 0.0012);
  strike(out, sr, r, 7000, 0.6, 0.006);
  dcBlock(out, sr, 200);
  fadeOut(out, Math.floor(0.15 * sr));
  return normalize(out, 0.9);
}

/** High, short blade "shing". */
export function shing(sr, base = 4200, seed = 211) {
  const r = mulberry32(seed);
  const out = alloc(sr, 0.8);
  const table = [[1, 1, 0.42], [1.27, 0.7, 0.34], [1.64, 0.5, 0.26], [2.1, 0.3, 0.18], [0.61, 0.25, 0.2]];
  for (const [ratio, amp, dec] of table) pair(out, sr, r, base * ratio, amp, dec, 2 + r() * 5);
  strike(out, sr, r, 8000, 0.7, 0.004);
  dcBlock(out, sr, 400);
  fadeOut(out, Math.floor(0.08 * sr));
  return normalize(out, 0.9);
}

/** Temple rin / small bell (bowl modes), base ~D6. */
export function chime(sr, base = 1174.66, seed = 221) {
  const r = mulberry32(seed);
  const out = alloc(sr, 3.6);
  pair(out, sr, r, base, 1.0, 1.6, 1.3, 0, 0.002);
  pair(out, sr, r, base * 2.71, 0.5, 0.75, 2.1, 0, 0.001);
  pair(out, sr, r, base * 5.15, 0.25, 0.32, 3.3, 0, 0.001);
  pair(out, sr, r, base * 0.5, 0.12, 1.2, 0.7, 0, 0.004);
  const lp = bq('lp', sr, 3000, 0.7);
  const len = Math.floor(0.004 * sr);
  for (let i = 0; i < len; i++) out[i] += lp.run(r() * 2 - 1) * 0.4 * (1 - i / len);
  fadeOut(out, Math.floor(0.2 * sr));
  return normalize(out, 0.9);
}

/** Ice-crystal shimmer: staggered, twinkling high partials from the miyako-bushi scale. */
export function crystal(sr, seed = 231) {
  const r = mulberry32(seed);
  const dur = 2.2;
  const out = alloc(sr, dur);
  const n = out.length;
  const notes = [86, 87, 91, 93, 94, 98, 99, 103, 105, 106, 110, 98, 93];
  for (let p = 0; p < notes.length; p++) {
    const f = mtof(notes[p]) * (1 + (r() - 0.5) * 0.006);
    if (f > sr * 0.45) continue;
    const amp = (0.25 + 0.75 * r()) * (f > 4000 ? 0.6 : 1);
    const decay = 0.35 + r() * 0.7;
    const start = r() * 0.35;
    const twRate = 3 + r() * 8;
    const twPh = r() * TAU;
    const w = (TAU * f) / sr;
    const c2 = 2 * Math.cos(w);
    let y1 = Math.sin(-w), y2 = Math.sin(-2 * w);
    const d = Math.exp(-1 / (decay * sr));
    let env = amp;
    let am = 1;
    const i0 = Math.floor(start * sr);
    const atk = Math.floor(0.01 * sr);
    for (let i = i0, k = 0; i < n; i++, k++) {
      if ((k & 31) === 0) {
        const s = 0.55 + 0.45 * Math.sin(twPh + (TAU * twRate * k) / sr);
        am = s * s;
      }
      const y = c2 * y1 - y2;
      y2 = y1;
      y1 = y;
      out[i] += y * env * am * (k < atk ? k / atk : 1);
      env *= d;
      if (env < 1e-4) break;
    }
  }
  fadeOut(out, Math.floor(0.2 * sr));
  return normalize(out, 0.9);
}

/** Large gong / tam-tam with a blooming high end. */
export function gong(sr, seed = 241) {
  const r = mulberry32(seed);
  const out = alloc(sr, 4.0);
  const lo = 90, hi = 4200;
  const count = 26;
  for (let k = 0; k < count; k++) {
    const u = (k + r() * 0.8) / count;
    const f = lo * Math.pow(hi / lo, u);
    const amp = Math.pow(f / lo, -0.3) * (0.4 + 0.6 * r());
    const decay = 1.6 * Math.pow(f / 100, -0.35) * (0.8 + 0.4 * r());
    const bloom = 0.002 + 0.45 * Math.pow(u, 1.4) * (0.6 + 0.8 * r());
    addPartial(out, sr, f, amp, decay, 0, bloom, r() * TAU);
  }
  // fundamental hum around D2 and a strike thump
  addPartial(out, sr, 73.42, 0.8, 1.8, 0, 0.01, 0);
  addPartial(out, sr, 110.0 * 1.003, 0.35, 1.4, 0, 0.02, 0);
  addPartial(out, sr, 58, 0.6, 0.12, 0, 0.002, 0);
  const lp = bq('lp', sr, 1200, 0.7);
  const len = Math.floor(0.012 * sr);
  for (let i = 0; i < len; i++) out[i] += lp.run(r() * 2 - 1) * 0.8 * (1 - i / len);
  dcBlock(out, sr, 30);
  fadeOut(out, Math.floor(0.3 * sr));
  return normalize(out, 0.9);
}

/** Reverse swell: rising filtered noise + reversed chime partials, ends abruptly (time-slow cue). */
export function revSwell(sr, seed = 251) {
  const r = mulberry32(seed);
  const dur = 0.6;
  const out = alloc(sr, dur);
  const n = out.length;
  const band = bq('bp', sr, 400, 1.2);
  const parts = [mtof(86), mtof(93), mtof(98), mtof(105)].map((f) => [(TAU * f) / sr, r() * TAU, 0.2 + r() * 0.3]);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if ((i & 31) === 0) band.set('bp', sr, 400 * Math.pow(12, t / dur), 1.4);
    const env = Math.exp((t - dur) / 0.13);
    let s = band.run(r() * 2 - 1) * 1.6;
    for (let k = 0; k < parts.length; k++) s += Math.sin(parts[k][1] + parts[k][0] * i) * parts[k][2];
    out[i] = s * env;
  }
  fadeOut(out, Math.floor(0.004 * sr));
  return normalize(out, 0.9);
}

/** Heart "lub-dub" source (used for pre-rendered heartbeat). */
export function heartbeat(sr, seed = 261) {
  const r = mulberry32(seed);
  const out = alloc(sr, 0.55);
  const thump = (t0, amp, f) => {
    const n = out.length;
    const i0 = Math.floor(t0 * sr);
    let ph = 0;
    const lp = onePole(sr, 120);
    let nz = 0;
    for (let i = i0, k = 0; i < n; i++, k++) {
      const t = k / sr;
      const fr = f * (0.72 + 0.28 * Math.exp(-t / 0.03));
      ph += (TAU * fr) / sr;
      const env = amp * (1 - Math.exp(-t / 0.004)) * Math.exp(-t / 0.055);
      nz += lp * (r() * 2 - 1 - nz);
      out[i] += env * (Math.sin(ph) + 0.6 * Math.sin(ph * 2.02) + 0.25 * Math.sin(ph * 3.1) + nz * 2);
      if (t > 0.35) break;
    }
  };
  thump(0.0, 1.0, 62);
  thump(0.25, 0.72, 56);
  dcBlock(out, sr, 20);
  fadeOut(out, Math.floor(0.03 * sr));
  return normalize(out, 0.9);
}
