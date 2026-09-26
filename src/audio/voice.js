// Per-play graph builder handed to every sound recipe. Keeps recipes short and node counts small.
// All times given to helpers are relative to the voice start time (t0).

import { clamp01 } from './dsp.js';

const MIN_EXP = 1e-4;

export class VoiceBuilder {
  constructor(engine, dest, t0, opts, jitter, positional) {
    this.e = engine;
    this.c = engine.ctx;
    this.b = engine.bank;
    this.dest = dest;
    this.t0 = t0;
    this.positional = positional;
    const I = opts.intensity;
    this.I = Number.isFinite(I) ? clamp01(I) : 0.5;
    this.note = Number.isFinite(opts.note) ? opts.note : undefined;
    const pitch = Number.isFinite(opts.pitch) && opts.pitch > 0 ? Math.min(4, Math.max(0.25, opts.pitch)) : 1;
    this.p = pitch * (1 + (Math.random() * 2 - 1) * jitter);
    this.sources = [];
    this.maxEnd = t0;
    this.sendMul = 1;
  }

  rnd(a = 0, b = 1) {
    return a + Math.random() * (b - a);
  }

  pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  /** Scale frequency points by the voice pitch. */
  F(pts) {
    return pts.map(([t, f]) => [t, f * this.p]);
  }

  gain(v = 1) {
    const g = this.c.createGain();
    g.gain.value = v;
    return g;
  }

  filter(type, f, Q = 0.7071) {
    const n = this.c.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    n.Q.value = Q;
    return n;
  }

  /**
   * Automation from points [[t, v], ...] (t relative to t0 + at). The first point is a set;
   * following points ramp exponentially when both ends are > 0 (or `exp` is forced), else linearly.
   */
  pts(param, points, at = 0, scale = 1, exp = false) {
    const base = this.t0 + at;
    let prev = 0;
    for (let i = 0; i < points.length; i++) {
      const t = base + points[i][0];
      const val = points[i][1] * scale;
      if (i === 0) param.setValueAtTime(val, t);
      else if (exp || (prev > 0 && val > 0)) param.exponentialRampToValueAtTime(Math.max(MIN_EXP, val), t);
      else param.linearRampToValueAtTime(val, t);
      prev = val;
    }
  }

  _track(node, start, stop) {
    node.start(start);
    node.stop(stop);
    this.sources.push(node);
    if (stop > this.maxEnd) this.maxEnd = stop;
  }

  /**
   * Play a buffer through an optional filter, envelope and tremolo into dest.
   * o = { at, dur, rate, offset (number | 'rand'), loop, type, f (Hz | points), Q, env (points), level, am: [rateHz, depth], to }
   * If dur is omitted it is derived from the envelope, else from the buffer length.
   */
  layer(buffer, o = {}) {
    const c = this.c;
    const at = o.at || 0;
    const rate = o.rate || 1;
    const bd = buffer.duration;
    let offset = typeof o.offset === 'number' ? o.offset : 0;
    let loop = !!o.loop;
    let dur = o.dur;
    if (dur == null) dur = o.env && o.env.length > 1 ? o.env[o.env.length - 1][0] + 0.02 : (bd - offset) / rate;
    if (o.offset === 'rand') {
      const need = dur * rate;
      if (need < bd * 0.92) offset = Math.random() * (bd - need);
      else {
        offset = Math.random() * bd * 0.5;
        loop = true;
      }
    } else if (!loop && (bd - offset) / rate < dur) {
      dur = (bd - offset) / rate;
    }
    const s = c.createBufferSource();
    s.buffer = buffer;
    if (rate !== 1) s.playbackRate.value = rate;
    if (loop) s.loop = true;
    const t = this.t0 + at;
    s.start(t, Math.max(0, Math.min(offset, bd - 0.001)));
    s.stop(t + dur + 0.005);
    this.sources.push(s);
    if (t + dur > this.maxEnd) this.maxEnd = t + dur;

    let node = s;
    if (o.type) {
      const f = c.createBiquadFilter();
      f.type = o.type;
      f.Q.value = o.Q ?? 0.7071;
      if (Array.isArray(o.f)) this.pts(f.frequency, o.f, at, 1, true);
      else f.frequency.value = o.f;
      node.connect(f);
      node = f;
    }
    const g = c.createGain();
    const level = o.level ?? 1;
    if (o.env) {
      g.gain.value = 0;
      this.pts(g.gain, o.env, at, level);
    } else g.gain.value = level;
    node.connect(g);
    node = g;
    if (o.am) node = this._am(node, o.am[0], o.am[1], t, dur);
    node.connect(o.to || this.dest);
    return g;
  }

  /** Noise layer from the shared noise beds (random offset, loops when needed). */
  noise(kind, o) {
    return this.layer(this.b.noise[kind] || this.b.white, { ...o, offset: 'rand' });
  }

  /** Oscillator layer. o = { at, f (Hz | points, exponential), env, level, dur, to, detune } */
  tone(type, o) {
    const c = this.c;
    const at = o.at || 0;
    const osc = c.createOscillator();
    osc.type = type;
    if (Array.isArray(o.f)) this.pts(osc.frequency, o.f, at, 1, true);
    else osc.frequency.value = o.f;
    if (o.detune) osc.detune.value = o.detune;
    const g = c.createGain();
    g.gain.value = 0;
    const env = o.env || [[0, 1]];
    this.pts(g.gain, env, at, o.level ?? 1);
    osc.connect(g);
    g.connect(o.to || this.dest);
    const dur = o.dur ?? (env.length > 1 ? env[env.length - 1][0] + 0.02 : 0.5);
    const t = this.t0 + at;
    this._track(osc, t, t + dur + 0.005);
    return g;
  }

  /** Tremolo: returns a gain node (1 - depth .. 1) fed by `node`, modulated at `rate` Hz. */
  _am(node, rate, depth, t, dur) {
    const am = this.c.createGain();
    am.gain.value = 1 - depth;
    const l = this.c.createOscillator();
    l.frequency.value = rate;
    const lg = this.c.createGain();
    lg.gain.value = depth;
    l.connect(lg);
    lg.connect(am.gain);
    this._track(l, t, t + dur + 0.01);
    node.connect(am);
    return am;
  }

  /**
   * Per-voice soft saturation (tanh) for impacts: squashes coinciding layer peaks, adds crunch and makes
   * low thumps audible on small speakers. Call first in a recipe (it re-routes this.dest).
   */
  saturate(pre = 0.45) {
    const g = this.gain(pre);
    const ws = this.c.createWaveShaper();
    ws.curve = this.e.satCurve;
    g.connect(ws);
    ws.connect(this.dest);
    this.dest = g;
    return g;
  }

  /** Stereo sweep for non-positional sounds; returns the node recipes should feed. */
  panSweep(points) {
    if (this.positional || !this.c.createStereoPanner) return this.dest;
    const p = this.c.createStereoPanner();
    this.pts(p.pan, points, 0, 1, false);
    p.connect(this.dest);
    return p;
  }
}
