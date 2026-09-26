// Pre-rendered sample bank. Everything expensive (Karplus-Strong strings, drums, bells, voices,
// textures, the hall impulse response) is rendered once into AudioBuffers at unlock time.

import * as N from './render/noise.js';
import * as S from './render/strings.js';
import * as D from './render/drums.js';
import * as M from './render/metal.js';
import * as V from './render/voice.js';

export const BIWA_LO = 38; // D2
export const BIWA_HI = 74; // D5
export const SHAMI_LO = 50; // D3
export const SHAMI_HI = 86; // D6
export const BIWA_STEP = 2;
export const SHAMI_STEP = 3;

const stepKnock = (k) => ({
  f: 150 + k * 19, ratios: [1, 2.25, 3.8, 5.3], amps: [1, 0.55, 0.35, 0.2],
  decays: [0.045, 0.03, 0.018, 0.012], dur: 0.16, noise: 0.5, noiseF: 1400 + k * 230, noiseQ: 0.9,
  noiseTau: 0.004, thump: [78 + k * 4, 0.7, 0.03],
});

/** Ordered render jobs: [key, (sr, raw) => Float32Array | Float32Array[]]. Keys ending in [] collect into arrays. */
export function renderJobs() {
  const jobs = [];
  const add = (key, fn) => jobs.push([key, fn]);
  add('white', (sr) => N.white(sr, 2));
  add('pink', (sr) => N.pink(sr, 2));
  add('brown', (sr) => N.brown(sr, 3));
  add('ir', (sr) => N.hallIR(sr));
  add('bubbles', (sr) => N.bubbles(sr, 2.5));
  add('fire', (sr) => N.fireTexture(sr, 3));
  add('water', (sr, raw) => N.waterTexture(sr, 3, 106, raw.bubbles));
  add('crackle', (sr) => N.crackle(sr, 2));
  add('grains', (sr) => N.ashGrains(sr, 2));
  add('creak', (sr) => N.creak(sr, 2.2));
  add('roll', (sr) => N.roll(sr, 0.5));
  add('debris', (sr) => N.debris(sr, 1.3));
  add('splinter[]', (sr) => N.splinter(sr, 0.8, 110));
  add('splinter[]', (sr) => N.splinter(sr, 0.8, 117));
  for (let k = 0; k < 6; k++) add('step[]', (sr) => N.woodKnock(sr, stepKnock(k), 401 + k));
  add('uiClick', (sr) => N.woodKnock(sr, {
    f: 1150, ratios: [1, 2.6, 4.4], amps: [1, 0.4, 0.2], decays: [0.025, 0.012, 0.007], dur: 0.08,
    noise: 0.3, noiseF: 3000, noiseQ: 1, noiseTau: 0.0015,
  }, 411));
  add('slam', (sr) => N.woodKnock(sr, {
    f: 320, ratios: [1, 2.35, 3.9, 6.1, 8.3], amps: [1, 0.7, 0.5, 0.3, 0.2],
    decays: [0.07, 0.05, 0.035, 0.02, 0.012], dur: 0.3, noise: 0.8, noiseF: 1800, noiseQ: 0.7,
    noiseTau: 0.006, thump: [110, 0.8, 0.05], second: { t: 0.028, amp: 0.35 },
  }, 412));
  for (const k of Object.keys(D.DRUMS)) add(k, (sr) => D.drum(sr, D.DRUMS[k], 500 + k.length));
  for (let k = 0; k < 4; k++) add('punch[]', (sr) => D.punchTick(sr, 520 + k));
  add('clang[]', (sr) => M.clang(sr, 1900, 201));
  add('clang[]', (sr) => M.clang(sr, 2150, 202));
  add('clang[]', (sr) => M.clang(sr, 2450, 203));
  add('shing[]', (sr) => M.shing(sr, 4200, 211));
  add('shing[]', (sr) => M.shing(sr, 4700, 212));
  add('chime', (sr) => M.chime(sr));
  add('crystal', (sr) => M.crystal(sr));
  add('gong', (sr) => M.gong(sr));
  add('revSwell', (sr) => M.revSwell(sr));
  add('heart', (sr) => M.heartbeat(sr));
  add('roar[]', (sr) => V.roar(sr, 0, 301));
  add('roar[]', (sr) => V.roar(sr, 1, 302));
  for (let k = 0; k < 3; k++) add('growl[]', (sr) => V.growl(sr, k, 311));
  for (let k = 0; k < 3; k++) add('snarl[]', (sr) => V.snarl(sr, k, 321));
  for (let k = 0; k < 3; k++) add('grunt[]', (sr) => V.grunt(sr, k, 331));
  add('choir', (sr) => V.choir(sr, [50, 57, 62, 65, 69], 2.8));
  for (let m = BIWA_LO; m <= BIWA_HI; m += BIWA_STEP) add('biwa[]', (sr) => S.renderBiwa(sr, m, 600 + m));
  for (let m = SHAMI_LO; m <= SHAMI_HI; m += SHAMI_STEP) add('shami[]', (sr) => S.renderShami(sr, m, 700 + m));
  return jobs;
}

function store(obj, key, val) {
  if (key.endsWith('[]')) {
    const k = key.slice(0, -2);
    (obj[k] || (obj[k] = [])).push(val);
  } else obj[key] = val;
}

/** Synchronous render of all raw sample data (used by Node tests). */
export function renderAllRaw(sr) {
  const raw = {};
  const times = {};
  for (const [key, fn] of renderJobs()) {
    const t0 = performance.now();
    store(raw, key, fn(sr, raw));
    const k = key.replace('[]', '');
    times[k] = (times[k] || 0) + performance.now() - t0;
  }
  return { raw, times };
}

const yieldNow = () =>
  new Promise((res) => {
    if (typeof MessageChannel !== 'undefined') {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        ch.port1.close();
        res();
      };
      ch.port2.postMessage(0);
    } else setTimeout(res, 0);
  });

function toBuffer(ctx, data, sr) {
  const chans = Array.isArray(data) ? data : [data];
  const len = chans[0].length;
  const buf = ctx
    ? ctx.createBuffer(chans.length, len, sr)
    : new AudioBuffer({ numberOfChannels: chans.length, length: len, sampleRate: sr });
  for (let c = 0; c < chans.length; c++) buf.copyToChannel(chans[c], c);
  return buf;
}

/** Nearest pre-rendered note + playback-rate correction. */
function noteLookup(list, lo, hi, step, midi) {
  const m = Math.max(lo - 12, Math.min(hi + 12, midi));
  const idx = Math.max(0, Math.min(list.length - 1, Math.round((m - lo) / step)));
  const base = lo + idx * step;
  return { buf: list[idx], rate: Math.pow(2, (m - base) / 12) };
}

/**
 * Build the bank of AudioBuffers. Yields to the event loop between jobs so the page stays responsive.
 * ctx may be null (then the AudioBuffer constructor is used).
 */
export async function buildBank(ctx, sampleRate) {
  const sr = sampleRate || ctx.sampleRate;
  const raw = {};
  const bank = { sr };
  const t0 = performance.now();
  let lastYield = t0;
  for (const [key, fn] of renderJobs()) {
    const data = fn(sr, raw);
    store(raw, key, data);
    store(bank, key, toBuffer(ctx, data, sr));
    const now = performance.now();
    // Yield to keep the page responsive; skip when hidden (background tabs throttle task scheduling).
    const hidden = typeof document !== 'undefined' && document.hidden;
    if (!hidden && now - lastYield > 12) {
      await yieldNow();
      lastYield = performance.now();
    }
  }
  bank.renderMs = Math.round(performance.now() - t0);
  bank.noise = { white: bank.white, pink: bank.pink, brown: bank.brown };
  bank.biwaFor = (midi) => noteLookup(bank.biwa, BIWA_LO, BIWA_HI, BIWA_STEP, midi);
  bank.shamiFor = (midi) => noteLookup(bank.shami, SHAMI_LO, SHAMI_HI, SHAMI_STEP, midi);
  return bank;
}
