// Offline soundtrack for the trailer, rendered as two stems (mixed and levelled by capture.mjs with ffmpeg):
//   music: the edit of the recordings in public/music, with its gain automation;
//   sfx:   the game's sound effects, replayed from the capture log through the real audio engine, each call at
//          the exact frame time that made it, plus the trailer's own cues.
import { Engine } from '../src/audio/engine.js';
import { getSharedBank } from '../src/audio/debug.js';
import { MUSIC_FILES } from '../src/audio/music/files.js';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';
const QUANTUM = 128;

async function decode(ctx, key) {
  const r = await fetch(BASE + MUSIC_FILES[key]);
  if (!r.ok) throw new Error(`${r.status} ${MUSIC_FILES[key]}`);
  return ctx.decodeAudioData(await r.arrayBuffer());
}

/** Piecewise-linear automation [[t, v], ...] written onto an AudioParam. */
function automate(param, keys, t0 = 0) {
  param.setValueAtTime(keys[0][1], 0);
  for (const [t, v] of keys) param.linearRampToValueAtTime(v, Math.max(0, t0 + t));
}

async function renderMusic(TL, sr) {
  const dur = TL.duration + (TL.tail || 0);
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
  const bus = ctx.createGain();
  bus.connect(ctx.destination);
  if (TL.musicKeys?.length) automate(bus.gain, TL.musicKeys);
  const bufs = {};
  for (const m of TL.music) if (!bufs[m.src]) bufs[m.src] = await decode(ctx, m.src);
  for (const m of TL.music) {
    const len = m.to - m.from;
    const src = ctx.createBufferSource();
    src.buffer = bufs[m.src];
    const g = ctx.createGain();
    const lvl = m.gain ?? 1;
    const fi = Math.max(0.005, m.fadeIn ?? 0.01);
    const fo = Math.max(0.005, m.fadeOut ?? 0.02);
    g.gain.setValueAtTime(0, 0);
    g.gain.setValueAtTime(0, m.at);
    g.gain.linearRampToValueAtTime(lvl, m.at + fi);
    if (m.keys) for (const [t, v] of m.keys) g.gain.linearRampToValueAtTime(lvl * v, m.at + t);
    g.gain.setValueAtTime(m.keys ? lvl * m.keys[m.keys.length - 1][1] : lvl, m.at + len - fo);
    g.gain.linearRampToValueAtTime(0, m.at + len);
    src.connect(g);
    g.connect(bus);
    src.start(m.at, m.from, len + 0.05);
  }
  return ctx.startRendering();
}

async function renderSfx(events, TL, sr) {
  const dur = TL.duration + (TL.tail || 0);
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
  const bank = await getSharedBank(sr);
  const eng = new Engine(ctx, bank, { offline: true });
  // group the log per render quantum (one group per frame) and replay each group at its time
  const groups = new Map();
  const ordered = events.map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i);
  for (const { e } of ordered) {
    if (e.t < 0 || e.t >= dur - 0.01) continue;
    const q = Math.round((e.t * sr) / QUANTUM);
    if (!groups.has(q)) groups.set(q, []);
    groups.get(q).push(e);
  }
  const handles = new Map();
  let last = 0;
  let plays = 0;
  const apply = (list, now) => {
    eng.tick(Math.max(0, now - last));
    last = now;
    for (const e of list) {
      switch (e.m) {
        case 'play': {
          const h = eng.play(e.name, e.o || {});
          plays++;
          if (h) handles.set(e.id, h);
          break;
        }
        case 'stop':
          handles.get(e.id)?.stop(e.fade);
          break;
        case 'L':
          eng.setListener(e.p, e.f, e.r);
          break;
        case 'slow':
          eng.setSlowmo(e.x);
          break;
        case 'danger':
          eng.setDanger(e.x);
          break;
        case 'duck':
          eng.duck(e.a, e.d);
          break;
      }
    }
  };
  for (const [q, list] of groups) {
    const t = (q * QUANTUM) / sr;
    if (t <= 0) {
      apply(list, 0);
      continue;
    }
    ctx.suspend(t).then(() => {
      apply(list, t);
      ctx.resume();
    });
  }
  const buffer = await ctx.startRendering();
  return { buffer, plays, groups: groups.size };
}

/** 32-bit float WAV. */
function encodeWav(buffer) {
  const ch = buffer.numberOfChannels;
  const n = buffer.length;
  const bytes = 44 + n * ch * 4;
  const ab = new ArrayBuffer(bytes);
  const dv = new DataView(ab);
  const str = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  dv.setUint32(4, bytes - 8, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 3, true);
  dv.setUint16(22, ch, true);
  dv.setUint32(24, buffer.sampleRate, true);
  dv.setUint32(28, buffer.sampleRate * ch * 4, true);
  dv.setUint16(32, ch * 4, true);
  dv.setUint16(34, 32, true);
  str(36, 'data');
  dv.setUint32(40, n * ch * 4, true);
  const data = [];
  for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      dv.setFloat32(o, data[c][i], true);
      o += 4;
    }
  }
  return ab;
}

function peakOf(buffer) {
  let p = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > p) p = a;
    }
  }
  return p;
}

export async function renderSoundtrack(events, TL, { stem = 'sfx', sampleRate = 48000 } = {}) {
  const t0 = performance.now();
  let buffer;
  let stats = {};
  if (stem === 'music') buffer = await renderMusic(TL, sampleRate);
  else {
    const r = await renderSfx(events, TL, sampleRate);
    buffer = r.buffer;
    stats = { plays: r.plays, groups: r.groups };
  }
  stats.peak = peakOf(buffer);
  stats.ms = Math.round(performance.now() - t0);
  return { sampleRate, wav: encodeWav(buffer), stats };
}
