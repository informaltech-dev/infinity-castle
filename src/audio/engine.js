// Context-agnostic audio engine: buses, reverb, master dynamics, voice management, positional audio,
// ducking / slow-motion / danger processing. Works on a live AudioContext or an OfflineAudioContext.

import { SOUNDS } from './sfx/index.js';
import { VoiceBuilder } from './voice.js';
import { clamp, clamp01, lerp } from './dsp.js';

export const MAX_VOICES = 40;
export const REVERB_RETURN = 0.5;
export const MUSIC_LEVEL = 0.123;
const MASTER_PRE = 1.0;

function softClipCurve(n = 4096) {
  const c = new Float32Array(n);
  const knee = 0.82;
  const room = 0.16;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
    c[i] = x < 0 ? -y : y;
  }
  return c;
}

const expLerp = (a, b, t) => a * Math.pow(b / a, t);

/** Shared tanh curve for per-voice impact saturation (unity small-signal gain after the 0.45 pre-gain). */
function saturationCurve(n = 1024, drive = 2.5) {
  const c = new Float32Array(n);
  const k = 1 / (0.45 * (drive / Math.tanh(drive)));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = (Math.tanh(drive * x) / Math.tanh(drive)) * k;
  }
  return c;
}

export class Engine {
  /** @param {BaseAudioContext} ctx  @param bank pre-rendered buffers  @param {{offline?: boolean, raw?: boolean}} o */
  constructor(ctx, bank, o = {}) {
    this.ctx = ctx;
    this.bank = bank;
    this.offline = !!o.offline;
    this.voices = [];
    this.lastByName = new Map();
    this.warned = new Set();
    this.L = { pos: { x: 0, y: 0, z: 0 }, fwd: { x: 0, y: 0, z: -1 }, right: { x: 1, y: 0, z: 0 }, ver: 0 };
    this.posVer = 0;
    this.duckState = null;
    this.slow = 0;
    this.danger = 0;
    this.dangerTarget = 0;
    this.dangerApplied = 0;
    this.nextBeat = 0;
    this.music = null;
    this.peakVoices = 0;
    this.satCurve = saturationCurve();
    this._build(!!o.raw);
  }

  _build(raw) {
    const c = this.ctx;
    const G = (v = 1) => {
      const g = c.createGain();
      g.gain.value = v;
      return g;
    };
    const F = (type, f, q = 0.5) => {
      const b = c.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q;
      return b;
    };
    const chain = (...n) => {
      for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]);
      return n[0];
    };

    // Master: glue compressor -> limiter -> soft clipper (safety) -> master volume.
    this.masterIn = G(MASTER_PRE);
    this.masterVol = G(1);
    if (raw) {
      chain(this.masterIn, this.masterVol);
    } else {
      const comp = c.createDynamicsCompressor();
      // Transparent at nominal levels; only stacked hits get squeezed.
      comp.threshold.value = -6;
      comp.knee.value = 6;
      comp.ratio.value = 2.5;
      comp.attack.value = 0.003;
      comp.release.value = 0.12;
      const lim = c.createDynamicsCompressor();
      lim.threshold.value = -1.5;
      lim.knee.value = 0;
      lim.ratio.value = 20;
      lim.attack.value = 0.001;
      lim.release.value = 0.06;
      const clip = c.createWaveShaper();
      clip.curve = softClipCurve();
      chain(this.masterIn, comp, lim, clip, this.masterVol);
      this.comp = comp;
      this.limiter = lim;
    }
    this.masterVol.connect(c.destination);

    // Shared hall reverb.
    this.reverbIn = G(1);
    this.convolver = c.createConvolver();
    if (this.bank && this.bank.ir) this.convolver.buffer = this.bank.ir;
    this.reverbLP = F('lowpass', 9000, 0.5);
    this.reverbOut = G(REVERB_RETURN);
    chain(this.reverbIn, F('highpass', 110, 0.6), this.convolver, this.reverbLP, this.reverbOut, this.masterIn);

    // SFX: world (ducked + slow-mo muffled), hero (always clear), ui.
    this.sfxVol = G(1);
    this.sfxVol.connect(this.masterIn);
    this.worldIn = G(1);
    this.sfxDuck = G(1);
    this.sfxLP = F('lowpass', 20000, 0.6);
    chain(this.worldIn, this.sfxDuck, this.sfxLP, this.sfxVol);
    this.heroIn = G(1);
    this.heroIn.connect(this.sfxVol);
    this.uiIn = G(1);
    this.uiIn.connect(this.sfxVol);
    this.sfxSendVol = G(1);
    this.sfxSendVol.connect(this.reverbIn);
    this.worldSend = G(1);
    this.worldSendDuck = G(1);
    chain(this.worldSend, this.worldSendDuck, this.sfxSendVol);
    this.heroSend = G(1);
    this.heroSend.connect(this.sfxSendVol);

    // Music.
    this.musicVol = G(1);
    this.musicVol.connect(this.masterIn);
    this.musicIn = G(MUSIC_LEVEL);
    this.musicDuck = G(1);
    this.musicLP = F('lowpass', 20000, 0.6);
    this.musicDanger = G(1);
    chain(this.musicIn, this.musicDuck, this.musicLP, this.musicDanger, this.musicVol);
    this.musicSend = G(MUSIC_LEVEL);
    this.musicSendDuck = G(1);
    this.musicSendVol = G(1);
    chain(this.musicSend, this.musicSendDuck, this.musicSendVol, this.reverbIn);

    // Ambience (follows the sfx volume).
    this.ambIn = G(1);
    this.ambVol = G(1);
    chain(this.ambIn, this.ambVol, this.masterIn);
    this.ambSend = G(1);
    this.ambSendVol = G(1);
    chain(this.ambSend, this.ambSendVol, this.reverbIn);

    // Shared detune (cents) for long music voices: slow-motion pitch-down.
    this.musicDetune = c.createConstantSource();
    this.musicDetune.offset.value = 0;
    this.musicDetune.start();
    this.detuneCents = 0;

    this.paths = {
      world: [this.worldIn, this.worldSend],
      hero: [this.heroIn, this.heroSend],
      ui: [this.uiIn, this.heroSend],
    };
    this.hasPanner = typeof c.createStereoPanner === 'function';
  }

  /** Attach the pre-rendered bank (the graph can be built earlier so the dynamics settle meanwhile). */
  setBank(bank) {
    this.bank = bank;
    if (!this.convolver.buffer && bank && bank.ir) this.convolver.buffer = bank.ir;
  }

  warnOnce(key, ...msg) {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    console.warn(...msg);
  }

  // ---------------------------------------------------------------- positional

  setListener(pos, fwd, right) {
    const L = this.L;
    const cp = (dst, src, norm) => {
      if (!src || !Number.isFinite(src.x)) return false;
      let x = +src.x, y = +src.y || 0, z = +src.z || 0;
      if (norm) {
        const m = Math.hypot(x, y, z);
        if (m < 1e-6) return false;
        x /= m; y /= m; z /= m;
      }
      const changed = Math.abs(dst.x - x) + Math.abs(dst.y - y) + Math.abs(dst.z - z) > 1e-3;
      dst.x = x; dst.y = y; dst.z = z;
      return changed;
    };
    const a = cp(L.pos, pos, false);
    const b = cp(L.fwd, fwd, true);
    const d = cp(L.right, right, true);
    if (a || b || d) L.ver++;
  }

  /** gain = 1 / (1 + d / 12), pan = clamp(dot(dir, right)) * 0.8; far sounds get a wetter mix. */
  spatial(p) {
    const L = this.L;
    const dx = p.x - L.pos.x, dy = p.y - L.pos.y, dz = p.z - L.pos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    let pan = 0;
    if (dist > 1e-4) pan = clamp((dx * L.right.x + dy * L.right.y + dz * L.right.z) / dist, -1, 1) * 0.8;
    return { gain: 1 / (1 + dist / 12), pan, sendMul: 1 + Math.min(dist / 30, 1) * 0.6 };
  }

  // ---------------------------------------------------------------- voices

  /** Start a sound `at` seconds from now. Returns a handle or null. Never throws. */
  play(name, opts = {}, at = 0) {
    const def = SOUNDS[name];
    if (!def) {
      this.warnOnce('unknown:' + name, `[audio] Unknown sound "${name}" (ignored).`);
      return null;
    }
    if (!this.bank) return null;
    const c = this.ctx;
    const now = c.currentTime;
    const delay = Number.isFinite(opts.delay) ? Math.max(0, opts.delay) : 0;
    const t0 = now + Math.max(0, at) + delay + (this.offline ? 0 : 0.002);

    // Rate limiting: the same name within minInterval collapses into the voice already sounding
    // (which gets a small level boost). Its handle is returned so long sounds always stay stoppable.
    const last = this.lastByName.get(name);
    if (last && t0 >= last.t && t0 - last.t < def.minInterval) {
      const v = last.voice;
      if (!v || v.dead) return null;
      if (v.boost < 1.5 && def.minInterval <= 0.03) {
        v.boost *= 1.2;
        v.out.gain.setTargetAtTime(v.baseGain * v.boost, Math.max(now, v.t0), 0.004);
      }
      return v.dur >= 0.8 ? v.handle : null;
    }

    let vol = Number.isFinite(opts.volume) ? clamp(opts.volume, 0, 2) : 1;
    let pan = Number.isFinite(opts.pan) ? clamp(opts.pan, -1, 1) : 0;
    let sendMul = 1;
    let pos = null;
    let spGain = 1;
    if (opts.pos && Number.isFinite(opts.pos.x)) {
      pos = { x: +opts.pos.x, y: +opts.pos.y || 0, z: +opts.pos.z || 0 };
      const sp = this.spatial(pos);
      spGain = sp.gain;
      pan = sp.pan;
      sendMul = sp.sendMul;
    }
    const volBase = vol * def.gain;
    const baseGain = volBase * spGain;
    if (baseGain < 0.002) return null;

    this._prune(now);
    this._enforceCaps(name, def, t0);

    const out = c.createGain();
    out.gain.value = baseGain;
    const [dry, wet] = this.paths[def.path] || this.paths.world;
    let head = out;
    let panner = null;
    if (this.hasPanner && (pan !== 0 || pos)) {
      panner = c.createStereoPanner();
      panner.pan.value = pan;
      out.connect(panner);
      head = panner;
    }
    head.connect(dry);

    const vb = new VoiceBuilder(this, out, t0, opts, def.jitter, !!pos);
    let dur;
    try {
      dur = def.fn(vb);
    } catch (e) {
      this.warnOnce('err:' + name, `[audio] Sound "${name}" failed:`, e);
      for (const s of vb.sources) {
        try { s.stop(); } catch (_) { /* ignore */ }
      }
      try { head.disconnect(); out.disconnect(); } catch (_) { /* ignore */ }
      return null;
    }
    if (!(dur > 0)) dur = 0.5;
    dur = Math.max(dur, vb.maxEnd - t0);

    let sendNode = null;
    const send = def.send * sendMul * vb.sendMul;
    if (send > 0.005) {
      sendNode = c.createGain();
      sendNode.gain.value = send;
      head.connect(sendNode);
      sendNode.connect(wet);
    }

    const voice = {
      name, t0, end: t0 + dur, dur, out, panner, sendNode, sources: vb.sources,
      volBase, baseGain, boost: 1, pos, dead: false, disposed: false, priority: def.priority,
    };
    voice.handle = {
      name,
      duration: dur,
      stop: (fade = 0.1) => this.stopVoice(voice, fade),
    };
    this.voices.push(voice);
    this.lastByName.set(name, { t: t0, voice });
    return voice.handle;
  }

  _prune(t) {
    const vs = this.voices;
    for (let i = vs.length - 1; i >= 0; i--) {
      const v = vs[i];
      if (v.end + 0.25 < t) {
        this._dispose(v);
        vs.splice(i, 1);
      }
    }
  }

  _dispose(v) {
    if (v.disposed) return;
    v.disposed = true;
    v.dead = true;
    try {
      v.out.disconnect();
      if (v.panner) v.panner.disconnect();
      if (v.sendNode) v.sendNode.disconnect();
    } catch (_) { /* ignore */ }
  }

  _enforceCaps(name, def, t) {
    let active = 0;
    let sameCount = 0;
    let oldestSame = null;
    for (const v of this.voices) {
      if (v.dead || v.end <= t) continue;
      active++;
      if (v.name === name) {
        sameCount++;
        if (!oldestSame || v.t0 < oldestSame.t0) oldestSame = v;
      }
    }
    if (def.maxVoices && sameCount >= def.maxVoices && oldestSame) {
      this.stopVoice(oldestSame, 0.012, t);
      active--;
    }
    if (active + 1 > this.peakVoices) this.peakVoices = Math.min(MAX_VOICES, active + 1);
    if (active < MAX_VOICES) return;
    // Steal the quietest / most finished voice.
    let best = null;
    let bestScore = Infinity;
    for (const v of this.voices) {
      if (v.dead || v.end <= t) continue;
      const rem = clamp01((v.end - t) / Math.max(0.01, v.dur));
      const score = v.baseGain * v.boost * (0.2 + rem) * v.priority;
      if (score < bestScore) {
        bestScore = score;
        best = v;
      }
    }
    if (best) this.stopVoice(best, 0.015, t);
  }

  stopVoice(v, fade = 0.1, when = 0) {
    if (!v || v.dead) return;
    v.dead = true;
    const c = this.ctx;
    const t = Math.max(c.currentTime, when, 0);
    const f = Math.max(0.005, Number.isFinite(fade) ? fade : 0.1);
    try {
      const g = v.out.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(t < v.t0 ? 0 : g.value, t);
      g.linearRampToValueAtTime(0, t + f);
      for (const s of v.sources) {
        try { s.stop(t + f + 0.02); } catch (_) { /* already stopped */ }
      }
    } catch (_) { /* ignore */ }
    v.end = Math.min(v.end, t + f + 0.03);
  }

  activeVoiceCount() {
    const t = this.ctx.currentTime;
    let n = 0;
    for (const v of this.voices) if (!v.dead && v.end > t) n++;
    return n;
  }

  // ---------------------------------------------------------------- mix controls

  setVolumes(o = {}) {
    const now = this.ctx.currentTime;
    const curve = (x) => {
      const v = clamp01(+x);
      return v * v;
    };
    const set = (p, v) => p.setTargetAtTime(v, now, 0.03);
    if (o.master != null && Number.isFinite(+o.master)) set(this.masterVol.gain, curve(o.master));
    if (o.sfx != null && Number.isFinite(+o.sfx)) {
      const g = curve(o.sfx);
      set(this.sfxVol.gain, g);
      set(this.sfxSendVol.gain, g);
      set(this.ambVol.gain, g);
      set(this.ambSendVol.gain, g);
    }
    if (o.music != null && Number.isFinite(+o.music)) {
      const g = curve(o.music);
      set(this.musicVol.gain, g);
      set(this.musicSendVol.gain, g);
    }
  }

  duckValue(t) {
    const d = this.duckState;
    if (!d) return 1;
    if (t <= d.t) return d.from;
    if (t < d.atkEnd) return d.from + ((d.target - d.from) * (t - d.t)) / (d.atkEnd - d.t);
    if (t < d.holdEnd) return d.target;
    return 1 - (1 - d.target) * Math.exp(-(t - d.holdEnd) / d.tau);
  }

  /** Momentary ducking of world sfx + music (hero/ui sounds are exempt so the impact itself cuts through). */
  duck(amount = 0.6, duration = 0.4) {
    const a = clamp01(Number.isFinite(+amount) ? +amount : 0.6);
    const dur = clamp(Number.isFinite(+duration) ? +duration : 0.4, 0.05, 10);
    const now = this.ctx.currentTime;
    const cur = this.duckValue(now);
    const target = Math.max(0.0001, Math.min(cur, 1 - a));
    const atk = 0.012;
    const hold = dur * 0.3;
    const tau = Math.max(0.05, dur - atk - hold) / 3;
    this.duckState = { t: now, from: cur, target, atkEnd: now + atk, holdEnd: now + atk + hold, tau };
    for (const p of [this.sfxDuck.gain, this.worldSendDuck.gain, this.musicDuck.gain, this.musicSendDuck.gain]) {
      p.cancelScheduledValues(now);
      p.setValueAtTime(cur, now);
      p.linearRampToValueAtTime(target, now + atk);
      p.setValueAtTime(target, now + atk + hold);
      p.setTargetAtTime(1, now + atk + hold, tau);
    }
  }

  setSlowmo(x) {
    const s = clamp01(Number.isFinite(+x) ? +x : 0);
    const edge = (s === 0 || s === 1) && s !== this.slow;
    if (!edge && Math.abs(s - this.slow) < 0.004) return;
    this.slow = s;
    this._applyFilters();
  }

  _applyFilters() {
    const now = this.ctx.currentTime;
    const tc = 0.06;
    const s = this.slow;
    const d = this.danger;
    this.sfxLP.frequency.setTargetAtTime(expLerp(20000, 1500, Math.pow(s, 0.8)), now, tc);
    const mSlow = expLerp(20000, 650, Math.pow(s, 0.7));
    const mDanger = expLerp(20000, 2800, Math.pow(d, 1.6));
    this.musicLP.frequency.setTargetAtTime(Math.min(mSlow, mDanger), now, tc);
    this.detuneCents = -140 * s;
    this.musicDetune.offset.setTargetAtTime(this.detuneCents, now, tc * 1.5);
    this.reverbLP.frequency.setTargetAtTime(expLerp(9000, 2400, s), now, tc);
    this.reverbOut.gain.setTargetAtTime(REVERB_RETURN * (1 + 0.45 * s), now, tc);
  }

  setDanger(x) {
    this.dangerTarget = clamp01(Number.isFinite(+x) ? +x : 0);
  }

  /** Periodic housekeeping (live context only): danger smoothing + heartbeat, positional updates, pruning. */
  tick(dt) {
    const c = this.ctx;
    const now = c.currentTime;
    // danger smoothing
    const k = 1 - Math.exp(-dt / 0.3);
    this.danger += (this.dangerTarget - this.danger) * k;
    if (this.dangerTarget === 0 && this.danger < 0.005) this.danger = 0;
    if (Math.abs(this.danger - this.dangerApplied) > 0.01 || (this.danger === 0 && this.dangerApplied !== 0)) {
      this.dangerApplied = this.danger;
      this.musicDanger.gain.setTargetAtTime(1 - 0.3 * this.danger, now, 0.2);
      this._applyFilters();
    }
    // heartbeat loop
    if (this.danger > 0.04) {
      if (this.nextBeat < now) this.nextBeat = now + 0.03;
      while (this.nextBeat < now + 0.15) {
        const d = this.danger;
        this.play('heartbeat', { intensity: d, volume: 0.35 + 0.65 * d }, this.nextBeat - now);
        this.nextBeat += lerp(1.15, 0.42, d);
      }
    } else this.nextBeat = 0;
    // follow the listener for long positional voices
    if (this.L.ver !== this.posVer) {
      this.posVer = this.L.ver;
      for (const v of this.voices) {
        if (!v.pos || v.dead || v.end - now < 0.15 || v.t0 > now) continue;
        const sp = this.spatial(v.pos);
        v.baseGain = v.volBase * sp.gain;
        v.out.gain.setTargetAtTime(v.baseGain * v.boost, now, 0.05);
        if (v.panner) v.panner.pan.setTargetAtTime(sp.pan, now, 0.05);
      }
    }
    this._prune(now);
  }
}
