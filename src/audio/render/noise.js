// Noise beds, textures (water, fire, ash, wood) and the hall impulse response.
// Pure JS renderers: (sampleRate, ...) -> Float32Array | [Float32Array, Float32Array].

import {
  TAU, mulberry32, alloc, onePole, bq, normalize, normalizeMulti, makeLoopable,
  fadeIn, fadeOut, dcBlock, lpNoiseStd, addPartial, clamp,
} from '../dsp.js';

const expRand = (r, rate) => -Math.log(1 - r() * 0.999) / rate;

export function white(sr, sec = 2, seed = 101) {
  const out = alloc(sr, sec);
  const r = mulberry32(seed);
  for (let i = 0; i < out.length; i++) out[i] = r() * 2 - 1;
  return out;
}

/** Pink noise (Paul Kellet's refined filter), loopable. */
export function pink(sr, sec = 2, seed = 102) {
  const xf = Math.floor(0.05 * sr);
  const out = new Float32Array(Math.floor(sr * sec) + xf);
  const r = mulberry32(seed);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  dcBlock(out, sr, 10);
  return normalize(makeLoopable(out, xf), 0.95);
}

/** Brown (red) noise, loopable. */
export function brown(sr, sec = 3, seed = 103) {
  const xf = Math.floor(0.08 * sr);
  const out = new Float32Array(Math.floor(sr * sec) + xf);
  const r = mulberry32(seed);
  let last = 0;
  for (let i = 0; i < out.length; i++) {
    last = (last + 0.02 * (r() * 2 - 1)) / 1.02;
    out[i] = last * 3.5;
  }
  dcBlock(out, sr, 12);
  return normalize(makeLoopable(out, xf), 0.95);
}

/** Stream of water bubbles (rising damped sinusoids). */
export function bubbles(sr, sec = 2.5, seed = 104, density = 55) {
  const out = alloc(sr, sec);
  const n = out.length;
  const r = mulberry32(seed);
  let t = r() * 0.01;
  while (t < sec) {
    const f0 = 380 * Math.pow(2, r() * 2.6);
    const tau = (0.004 + r() * 0.018) * Math.sqrt(900 / f0);
    let amp = 0.15 + r() * 0.85;
    amp *= amp;
    const rise = 0.4 + r() * 1.2;
    const start = Math.floor(t * sr);
    const len = Math.min(n - start, Math.floor(tau * 7 * sr));
    const inv = 1 / Math.max(1, len);
    const d = Math.exp(-1 / (tau * sr));
    let ph = 0;
    let env = amp;
    for (let k = 0; k < len; k++) {
      ph += (TAU * f0 * (1 + rise * k * inv)) / sr;
      out[start + k] += env * (k < 24 ? k / 24 : 1) * Math.sin(ph);
      env *= d;
    }
    t += expRand(r, density);
  }
  dcBlock(out, sr, 60);
  return normalize(out, 0.9);
}

/** Turbulent fire roar bed (loopable). */
export function fireTexture(sr, sec = 3, seed = 105) {
  const xf = Math.floor(0.08 * sr);
  const n = Math.floor(sr * sec) + xf;
  const out = new Float32Array(n);
  const r = mulberry32(seed);
  const aS = onePole(sr, 2.5), aF = onePole(sr, 11);
  const sS = lpNoiseStd(aS), sF = lpNoiseStd(aF);
  const aL = onePole(sr, 1500);
  let mS = 0, mF = 0, br = 0, lp1 = 0, lp2 = 0, p0 = 0, p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    mS += aS * (r() * 2 - 1 - mS);
    mF += aF * (r() * 2 - 1 - mF);
    const am = clamp(0.62 + 0.16 * (mS / sS) + 0.17 * (mF / sF), 0.05, 1.5);
    br = (br + 0.02 * w) / 1.02;
    p0 = 0.99765 * p0 + w * 0.099046;
    p1 = 0.963 * p1 + w * 0.2965164;
    p2 = 0.57 * p2 + w * 1.0526913;
    const pk = (p0 + p1 + p2 + w * 0.1848) * 0.12;
    const x = (br * 3.2 + pk * 0.9) * am;
    lp1 += aL * (x - lp1);
    lp2 += aL * (lp1 - lp2);
    out[i] = lp2;
  }
  dcBlock(out, sr, 40);
  return normalize(makeLoopable(out, xf), 0.9);
}

/** Rushing water bed: broad band noise with slow surges and a bubble layer (loopable). */
export function waterTexture(sr, sec = 3, seed = 106, bub = null) {
  const xf = Math.floor(0.08 * sr);
  const n = Math.floor(sr * sec) + xf;
  const out = new Float32Array(n);
  const r = mulberry32(seed);
  const band = bq('bp', sr, 1100, 0.55);
  const hp = bq('hp', sr, 4200, 0.7);
  const low = bq('lp', sr, 380, 0.7);
  const aS = onePole(sr, 1.6), sS = lpNoiseStd(aS);
  let mS = 0, p0 = 0, p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    p0 = 0.99765 * p0 + w * 0.099046;
    p1 = 0.963 * p1 + w * 0.2965164;
    p2 = 0.57 * p2 + w * 1.0526913;
    const pk = (p0 + p1 + p2 + w * 0.1848) * 0.12;
    mS += aS * (r() * 2 - 1 - mS);
    const am = clamp(0.65 + 0.18 * (mS / sS), 0.1, 1.4);
    const x = band.run(pk) * 1.5 + hp.run(w) * 0.1 + low.run(pk) * 0.45;
    out[i] = x * am + (bub ? bub[i % bub.length] * 0.2 : 0);
  }
  dcBlock(out, sr, 30);
  return normalize(makeLoopable(out, xf), 0.9);
}

/** Sparse fire crackles / pops. */
export function crackle(sr, sec = 2, seed = 107, rate = 38) {
  const out = alloc(sr, sec);
  const n = out.length;
  const r = mulberry32(seed);
  let t = 0;
  for (;;) {
    t += expRand(r, rate);
    if (t >= sec - 0.01) break;
    const cluster = r() < 0.25 ? 2 + Math.floor(r() * 3) : 1;
    let tt = t;
    for (let c = 0; c < cluster; c++) {
      const start = Math.floor(tt * sr);
      let amp = r();
      amp = amp * amp * amp * (c === 0 ? 1 : 0.6) + 0.02;
      const tau = (0.00015 + r() * 0.0008) * sr;
      const len = Math.min(n - start, Math.floor(tau * 6));
      const d = Math.exp(-1 / tau);
      let e = amp;
      for (let k = 0; k < len; k++) {
        out[start + k] += e * (r() * 2 - 1);
        e *= d;
      }
      tt += 0.001 + r() * 0.006;
    }
  }
  bq('hp', sr, 1200, 0.7).apply(out);
  return normalize(out, 0.9);
}

/** Dry granular hiss: a body crumbling into ash. */
export function ashGrains(sr, sec = 2, seed = 108) {
  const out = alloc(sr, sec);
  const n = out.length;
  const r = mulberry32(seed);
  let t = 0;
  for (;;) {
    t += expRand(r, 1100);
    if (t >= sec - 0.002) break;
    const start = Math.floor(t * sr);
    const amp = r() * r();
    const len = Math.max(3, Math.floor((0.00008 + r() * 0.0003) * sr));
    for (let k = 0; k < len && start + k < n; k++) {
      const wnd = Math.sin((Math.PI * k) / len);
      out[start + k] += amp * wnd * (r() * 2 - 1);
    }
  }
  const aS = onePole(sr, 6), sS = lpNoiseStd(aS);
  let m = 0;
  for (let i = 0; i < n; i++) {
    m += aS * (r() * 2 - 1 - m);
    out[i] = (out[i] + (r() * 2 - 1) * 0.04) * clamp(0.75 + 0.25 * (m / sS), 0.2, 1.3);
  }
  bq('hp', sr, 2600, 0.7).apply(out);
  bq('hp', sr, 1800, 0.6).apply(out);
  return normalize(out, 0.9);
}

/**
 * Modal wood knock. o = { f, ratios, amps, decays, dur, noise, noiseF, noiseQ, noiseTau, thump, second }
 */
export function woodKnock(sr, o, seed = 109) {
  const out = alloc(sr, o.dur);
  const r = mulberry32(seed);
  const hit = (t0, gain) => {
    for (let k = 0; k < o.ratios.length; k++) {
      const f = o.f * o.ratios[k] * (1 + (r() - 0.5) * 0.05);
      addPartial(out, sr, f, gain * o.amps[k] * (0.8 + 0.4 * r()), o.decays[k] * (0.85 + 0.3 * r()), t0, 0.0004, r() * TAU);
    }
    if (o.thump) addPartial(out, sr, o.thump[0], gain * o.thump[1], o.thump[2], t0, 0.001, 0);
    const nb = bq('bp', sr, o.noiseF, o.noiseQ);
    const tau = o.noiseTau * sr;
    const d = Math.exp(-1 / tau);
    const i0 = Math.floor(t0 * sr);
    const len = Math.min(out.length - i0, Math.floor(tau * 7));
    let e = o.noise * gain * 3;
    for (let i = 0; i < len; i++) {
      out[i0 + i] += nb.run(r() * 2 - 1) * e;
      e *= d;
    }
  };
  hit(0, 1);
  if (o.second) hit(o.second.t, o.second.amp);
  dcBlock(out, sr, 30);
  fadeOut(out, Math.floor(0.01 * sr));
  return normalize(out, 0.9);
}

/** Splintering wood: a burst of cracks that slows down, through wood resonances. */
export function splinter(sr, sec = 0.8, seed = 110) {
  const n = Math.floor(sr * sec);
  const out = new Float32Array(n);
  const exc = new Float32Array(n);
  const r = mulberry32(seed);
  const res = [];
  for (let k = 0; k < 5; k++) res.push([bq('bp', sr, 700 * Math.pow(6, r()), 5 + r() * 7), 0.8 + r() * 0.6]);
  let t = 0;
  let interval = 0.0022;
  while (t < sec * 0.85) {
    const amp = Math.exp(-t / 0.2) * (0.3 + 0.7 * r());
    const i0 = Math.floor(t * sr);
    const len = Math.max(4, Math.floor((0.0002 + r() * 0.0012) * sr));
    for (let k = 0; k < len && i0 + k < n; k++) exc[i0 + k] += amp * (r() * 2 - 1) * (1 - k / len);
    interval *= 1.1 + r() * 0.22;
    t += interval * (0.5 + r());
  }
  // initial low crunch
  const lp = bq('lp', sr, 900, 0.7);
  const crunchLen = Math.floor(0.04 * sr);
  for (let i = 0; i < n; i++) {
    const x = exc[i];
    let s = x * 0.55;
    for (let k = 0; k < res.length; k++) s += res[k][0].run(x) * res[k][1];
    if (i < crunchLen) s += lp.run((r() * 2 - 1) * (1 - i / crunchLen)) * 0.9;
    out[i] = s;
  }
  dcBlock(out, sr, 40);
  fadeOut(out, Math.floor(0.03 * sr));
  return normalize(out, 0.9);
}

/** Bouncing debris rattle (many tiny knocks, thinning out). */
export function debris(sr, sec = 1.3, seed = 111) {
  const out = alloc(sr, sec);
  const r = mulberry32(seed);
  let t = 0;
  for (;;) {
    const rate = 70 * Math.exp(-t / 0.35) + 6;
    t += expRand(r, rate);
    if (t >= sec - 0.05) break;
    const amp = (0.2 + 0.8 * r()) ** 2 * Math.exp(-t / 0.6);
    const f = 900 * Math.pow(5, r());
    const dec = 0.004 + r() * 0.02;
    addPartial(out, sr, f, amp, dec, t, 0.0002, r() * TAU);
    addPartial(out, sr, f * (2.2 + r() * 0.4), amp * 0.5, dec * 0.6, t, 0.0002, r() * TAU);
  }
  dcBlock(out, sr, 80);
  fadeOut(out, Math.floor(0.05 * sr));
  return normalize(out, 0.9);
}

/** Wood creaks from stick-slip friction exciting plank resonances. */
export function creak(sr, sec = 2.2, seed = 112) {
  const n = Math.floor(sr * sec);
  const exc = new Float32Array(n);
  const out = new Float32Array(n);
  const r = mulberry32(seed);
  let t = 0.02;
  while (t < sec - 0.25) {
    const segDur = 0.22 + r() * 0.5;
    const fA = 30 + r() * 60;
    const fB = fA * (0.6 + r() * 1.2);
    const i0 = Math.floor(t * sr);
    const i1 = Math.min(n, Math.floor((t + segDur) * sr));
    let ph = 0;
    for (let i = i0; i < i1; i++) {
      const u = (i - i0) / (i1 - i0);
      const env = Math.pow(Math.sin(Math.PI * u), 0.7);
      ph += (fA + (fB - fA) * u) / sr;
      if (ph >= 1) {
        ph -= 1 + (r() - 0.5) * 0.3;
        exc[i] += env * (0.6 + 0.4 * r());
      }
      exc[i] += env * (r() * 2 - 1) * 0.02;
    }
    t += segDur + 0.05 + r() * 0.4;
  }
  const res = [[480, 9, 1], [1040, 11, 0.6], [1850, 13, 0.35], [2900, 14, 0.2]].map(
    ([f, q, g]) => [bq('bp', sr, f * (0.9 + r() * 0.2), q), g]
  );
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < res.length; k++) s += res[k][0].run(exc[i]) * res[k][1];
    out[i] = s;
  }
  dcBlock(out, sr, 60);
  fadeOut(out, Math.floor(0.05 * sr));
  return normalize(out, 0.9);
}

/** Shoji frame rolling/sliding in its wooden groove. */
export function roll(sr, sec = 0.5, seed = 113) {
  const n = Math.floor(sr * sec);
  const exc = new Float32Array(n);
  const out = new Float32Array(n);
  const r = mulberry32(seed);
  let t = 0;
  for (;;) {
    const rate = 180 + 240 * Math.min(1, t / 0.12);
    t += expRand(r, rate);
    if (t >= sec) break;
    exc[Math.floor(t * sr)] += (0.3 + 0.7 * r()) * (r() < 0.5 ? -1 : 1);
  }
  const res = [[900, 3, 1], [1700, 4, 0.7], [2800, 5, 0.45]].map(([f, q, g]) => [bq('bp', sr, f, q), g]);
  const hiss = bq('bp', sr, 1500, 0.6);
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    const x = exc[i] + w * 0.05;
    let s = hiss.run(w) * 0.35;
    for (let k = 0; k < res.length; k++) s += res[k][0].run(x) * res[k][1];
    out[i] = s;
  }
  fadeIn(out, Math.floor(0.015 * sr));
  fadeOut(out, Math.floor(0.02 * sr));
  return normalize(out, 0.9);
}

/**
 * Stereo impulse response of a large wooden hall (~3 s).
 * Early reflections + diffuse tail whose high frequencies die faster (warm wood absorption).
 */
export function hallIR(sr, sec = 3.2, rt60 = 2.9, seed = 120) {
  const n = Math.floor(sr * sec);
  const chans = [new Float32Array(n), new Float32Array(n)];
  const pre = Math.floor(0.012 * sr);
  for (let ch = 0; ch < 2; ch++) {
    const out = chans[ch];
    const r = mulberry32(seed + ch * 7919);
    let lp1 = 0, lp2 = 0, a = 0.5;
    const dStep = Math.exp(-6.9078 / (rt60 * sr));
    const bStep = Math.exp(-1 / (0.018 * sr));
    const eStep = Math.exp(-1 / (0.2 * sr));
    let decay = 1, bld = 1, early = 1;
    for (let i = pre; i < n; i++) {
      if (((i - pre) & 127) === 0) a = onePole(sr, 950 + 7600 * Math.exp(-(i - pre) / sr / 0.45));
      const w = r() * 2 - 1;
      lp1 += a * (w - lp1);
      lp2 += a * (lp1 - lp2);
      out[i] = (lp2 * 0.8 + lp1 * 0.35 * early) * decay * (1 - bld);
      decay *= dStep;
      bld *= bStep;
      early *= eStep;
    }
    // early reflections off wooden walls and floor
    for (let k = 0; k < 16; k++) {
      const tt = 0.005 + Math.pow(r(), 1.2) * 0.09;
      const amp = (0.85 - tt * 6) * (r() < 0.5 ? -1 : 1) * (0.35 + 0.65 * r());
      const i0 = pre + Math.floor(tt * sr);
      for (let j = 0; j < 90 && i0 + j < n; j++) out[i0 + j] += amp * Math.exp(-j / 11) * (1 - j / 90);
    }
    bq('peak', sr, 230, 0.8, 2.5).apply(out);
    bq('hp', sr, 70, 0.7).apply(out);
    fadeOut(out, Math.floor(0.1 * sr));
  }
  return normalizeMulti(chans, 0.9);
}
