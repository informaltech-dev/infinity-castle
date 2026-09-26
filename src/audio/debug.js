// Debug / verification helpers: render sounds and music offline and measure them.
// Not needed by the game at runtime (tree-shaken unless imported).

import { Engine } from './engine.js';
import { MusicEngine } from './music/music.js';
import { MUSIC_TRACKS } from './music/tracks.js';
import { SOUNDS, SOUND_NAMES } from './sfx/index.js';
import { buildBank } from './bank.js';
import { Biquad } from './dsp.js';

const bankCache = new Map();

/** Build (once per sample rate) a bank without a live AudioContext. */
export function getSharedBank(sampleRate = 48000) {
  if (!bankCache.has(sampleRate)) bankCache.set(sampleRate, buildBank(null, sampleRate));
  return bankCache.get(sampleRate);
}

const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

/** Offline renders start sounds after this pre-roll: DynamicsCompressorNode needs ~0.1 s to settle. */
export const PRE_ROLL = 0.25;

/** K-weighted loudness (LUFS-style, ITU-R BS.1770 filters) of one channel over [0, n). Returns mean square. */
function kWeightedMeanSquare(data, sr, i0, n) {
  const shelf = new Biquad().set('hs', sr, 1681.97, 0.7071, 4.0);
  const hp = new Biquad().set('hp', sr, 38.13, 0.5003);
  let sum = 0;
  for (let i = i0; i < n; i++) {
    const v = data[i];
    if (!Number.isFinite(v)) continue;
    const z = hp.run(shelf.run(v));
    sum += z * z;
  }
  return sum / Math.max(1, n - i0);
}

/**
 * Peak / RMS / loudness / tail / NaN statistics.
 * RMS and loudness (K-weighted, LUFS-like) are measured over the first `activeDur` seconds (plus 50 ms).
 */
export function analyzeBuffer(buffer, activeDur = 0, start = 0) {
  const sr = buffer.sampleRate;
  const n = buffer.length;
  const chans = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
  const i0 = Math.min(n - 1, Math.max(0, Math.floor(start * sr)));
  const actN = activeDur > 0 ? Math.min(n, i0 + Math.ceil((activeDur + 0.05) * sr)) : n;
  const thr = Math.pow(10, -60 / 20);
  let peak = 0, nan = 0, sum = 0, last = i0, peakAt = i0;
  for (let i = i0; i < n; i++) {
    let m = 0;
    for (let c = 0; c < chans.length; c++) {
      const v = chans[c][i];
      if (!Number.isFinite(v)) {
        nan++;
        continue;
      }
      const a = v < 0 ? -v : v;
      if (a > m) m = a;
      if (i < actN) sum += v * v;
    }
    if (m > peak) {
      peak = m;
      peakAt = i;
    }
    if (m > thr) last = i;
  }
  let ms = 0;
  for (const ch of chans) ms += kWeightedMeanSquare(ch, sr, i0, actN);
  return {
    peak,
    peakDb: db(peak),
    peakAt: (peakAt - i0) / sr,
    rmsDb: db(Math.sqrt(sum / Math.max(1, (actN - i0) * chans.length))),
    lufs: ms > 0 ? -0.691 + 10 * Math.log10(ms) : -Infinity,
    tail: (last - i0) / sr,
    nan,
    len: (n - i0) / sr,
  };
}

async function resolveBank(cfg) {
  return cfg.bank || getSharedBank(cfg.sampleRate || 48000);
}

/** Render one sound through the full mix chain (or raw, without master dynamics). */
export async function renderSoundOffline(name, opts = {}, cfg = {}) {
  const def = SOUNDS[name];
  if (!def) return null;
  const bank = await resolveBank(cfg);
  const sr = bank.sr;
  const seconds = PRE_ROLL + def.maxDur + (cfg.tail ?? 3.4) + 0.1;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
  const eng = new Engine(ctx, bank, { offline: true, raw: !!cfg.raw });
  const h = eng.play(name, opts, PRE_ROLL);
  const t0 = performance.now();
  const buffer = await ctx.startRendering();
  return { buffer, voiceDur: h ? h.duration : 0, start: PRE_ROLL, renderMs: performance.now() - t0 };
}

/** Render `seconds` of a music track at a fixed intensity. */
export async function renderMusicOffline(track, seconds = 12, cfg = {}) {
  const bank = await resolveBank(cfg);
  const sr = bank.sr;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
  const eng = new Engine(ctx, bank, { offline: true, raw: !!cfg.raw });
  const me = new MusicEngine(eng);
  me.intensity = me.target = cfg.intensity ?? 0.6;
  me.play(track, 0.05);
  me.tick(seconds);
  const t0 = performance.now();
  const buffer = await ctx.startRendering();
  return { buffer, renderMs: performance.now() - t0 };
}

/** boss -> boss2 switch in the middle of a render (checks the bar-aligned handover). */
export async function renderTransitionOffline(cfg = {}) {
  const bank = await resolveBank(cfg);
  const sr = bank.sr;
  const seconds = cfg.seconds ?? 9;
  const at = cfg.at ?? 4;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
  const eng = new Engine(ctx, bank, { offline: true });
  const me = new MusicEngine(eng);
  me.play(cfg.from || 'boss', 0.05);
  me.tick(at + 0.2);
  let switchInfo = null;
  ctx.suspend(at).then(() => {
    me.play(cfg.to || 'boss2', 1.5);
    const tr = me.current;
    switchInfo = { requestedAt: ctx.currentTime, startsAt: tr.startTime, bar: tr.startStep / 16 };
    me.tick(seconds);
    ctx.resume();
  });
  const t0 = performance.now();
  const buffer = await ctx.startRendering();
  return { buffer, renderMs: performance.now() - t0, switchInfo };
}

/** Busy combat scene: boss2 music + 20/s barrage + dense hits. Measures render speed and peak voices. */
export async function renderStressOffline(cfg = {}) {
  const bank = await resolveBank(cfg);
  const sr = bank.sr;
  const seconds = cfg.seconds ?? 4;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * (seconds + 2)), sr);
  const eng = new Engine(ctx, bank, { offline: true });
  const me = new MusicEngine(eng);
  me.intensity = me.target = 1;
  me.play('boss2', 0.05);
  me.tick(seconds + 2);
  const names = ['hitSlash', 'punchHit', 'swingLight', 'swingHeavy', 'hitBlunt', 'block', 'step', 'demonHurt', 'punchWhoosh'];
  let plays = 0, started = 0;
  for (let t = 0; t < seconds; t += 0.05) {
    plays++;
    if (eng.play('barrage', { pos: { x: Math.sin(t) * 6, y: 0, z: -4 } }, t)) started++;
    for (const n of names) {
      if (Math.random() < 0.25) {
        plays++;
        if (eng.play(n, { intensity: Math.random(), pos: { x: (Math.random() - 0.5) * 20, y: 0, z: -Math.random() * 15 } }, t + Math.random() * 0.05)) started++;
      }
    }
  }
  eng.play('groundSlam', {}, 1.0);
  eng.play('shockwave', {}, 2.0);
  eng.play('finisher', {}, 3.0);
  const t0 = performance.now();
  const buffer = await ctx.startRendering();
  const renderMs = performance.now() - t0;
  return { buffer, renderMs, realtime: (seconds + 2) / (renderMs / 1000), plays, started, peakVoices: eng.peakVoices };
}

export { SOUND_NAMES, MUSIC_TRACKS };
