// Music instruments for one track instance. Each track owns a Band: instrument buses -> track fader -> music bus,
// with per-bus reverb sends. Buffer instruments (biwa, shamisen, taiko...) cost 2 nodes per note.

import { mtof } from '../dsp.js';

const BUS_DEFAULTS = {
  // name: [level, reverb send]
  biwa: [0.9, 0.4],
  shami: [0.55, 0.22],
  drum: [1.0, 0.22],
  perc: [0.5, 0.18],
  flute: [0.5, 0.5],
  drone: [0.4, 0.35],
  choir: [0.35, 0.5],
  brass: [0.45, 0.25],
  fx: [0.5, 0.45],
};

// Vowel formant banks: [freq, Q, gain]
const VOWELS = {
  a: [[800, 8, 1], [1150, 9, 0.6], [2900, 12, 0.25], [420, 1.2, 0.35]],
  o: [[500, 7, 1], [850, 8, 0.55], [2800, 12, 0.18], [300, 1.2, 0.35]],
  u: [[330, 6, 1], [800, 8, 0.35], [2700, 12, 0.1], [250, 1.2, 0.3]],
};

export class Band {
  constructor(engine, busCfg = {}) {
    this.e = engine;
    this.c = engine.ctx;
    this.b = engine.bank;
    const c = this.c;
    this.out = c.createGain();
    this.out.gain.value = 0;
    this.out.connect(engine.musicIn);
    this.send = c.createGain();
    this.send.gain.value = 0;
    this.send.connect(engine.musicSend);
    this.ambOut = c.createGain();
    this.ambOut.gain.value = 0;
    this.ambOut.connect(engine.ambIn);
    this.ambSend = c.createGain();
    this.ambSend.gain.value = 0.5;
    this.ambOut.connect(this.ambSend);
    this.ambSend.connect(engine.ambSend);
    this.buses = {};
    this.long = [];
    const cfg = { ...BUS_DEFAULTS, ...busCfg };
    for (const [k, [lvl, snd]] of Object.entries(cfg)) {
      const g = c.createGain();
      g.gain.value = lvl;
      g.connect(this.out);
      const s = c.createGain();
      s.gain.value = snd;
      g.connect(s);
      s.connect(this.send);
      this.buses[k] = g;
    }
  }

  /** Smoothly set an instrument bus level (intensity layers). */
  setBus(name, value, tc = 0.4) {
    const g = this.buses[name];
    if (g) g.gain.setTargetAtTime(value, this.c.currentTime, tc);
  }

  /** Current slow-motion pitch factor for short buffer notes (long voices follow the shared detune node). */
  rate() {
    return Math.pow(2, this.e.detuneCents / 1200);
  }

  _follow(params, endNode) {
    const d = this.e.musicDetune;
    for (const p of params) d.connect(p);
    endNode.onended = () => {
      for (const p of params) {
        try { d.disconnect(p); } catch (_) { /* already gone */ }
      }
    };
  }

  _keep(sources, end) {
    this.long.push({ sources, end });
    if (this.long.length > 24) {
      const now = this.c.currentTime;
      this.long = this.long.filter((l) => l.end > now);
    }
  }

  /** Buffer note: source -> gain -> bus. dur (optional) damps the note. */
  buf(bus, buffer, t, rate = 1, vel = 1, dur, lp) {
    const c = this.c;
    const s = c.createBufferSource();
    s.buffer = buffer;
    const r = rate * this.rate();
    s.playbackRate.value = r;
    const g = c.createGain();
    g.gain.value = vel;
    let node = s;
    if (lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      s.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.buses[bus] || this.buses.fx);
    s.start(t);
    let end = t + buffer.duration / r;
    if (dur != null && t + dur < end) {
      g.gain.setValueAtTime(vel, t + dur);
      g.gain.setTargetAtTime(0, t + dur, 0.035);
      end = t + dur + 0.2;
    }
    s.stop(end);
    return g;
  }

  biwa(t, midi, vel = 1, dur) {
    const { buf, rate } = this.b.biwaFor(midi);
    return this.buf('biwa', buf, t, rate, vel, dur);
  }

  /** Strummed chord with a plectrum slap ("BEN!"). */
  strum(t, midis, vel = 1, spread = 0.014, dur) {
    midis.forEach((m, i) => this.biwa(t + i * spread, m, vel * (1 - i * 0.1), dur));
    this.buf('biwa', this.b.ka, t, 1.6, 0.25 * vel, 0.05);
  }

  shami(t, midi, vel = 1, dur) {
    const { buf, rate } = this.b.shamiFor(midi);
    return this.buf('shami', buf, t, rate, vel, dur);
  }

  drum(t, kind, vel = 1, o = {}) {
    const buf = this.b[kind];
    if (!buf) return null;
    const bus = o.bus || (kind === 'shime' ? 'perc' : 'drum');
    const rate = (o.rate || 1) * (1 + (Math.random() - 0.5) * 0.03);
    return this.buf(bus, buf, t, rate, vel * (0.92 + Math.random() * 0.08), o.dur, o.lp);
  }

  /** Atarigane-like small hand gong ("chan"). */
  kane(t, vel = 0.4) {
    return this.buf('perc', this.b.shing[0], t, 0.82, vel, 0.09);
  }

  /** Hyoshigi wooden clappers (kabuki "kan-kan"). */
  clap(t, vel = 0.7) {
    this.buf('fx', this.b.ka, t, 1.3, vel, 0.2);
    this.buf('fx', this.b.ka, t + 0.11, 1.33, vel * 0.8, 0.2);
  }

  gong(t, vel = 0.5, rate = 0.8) {
    return this.buf('fx', this.b.gong, t, rate, vel, 3.2);
  }

  /** Low sine drop reinforcing the downbeat. */
  sub(t, vel = 0.8) {
    const c = this.c;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(64, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.35);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.006);
    g.gain.setTargetAtTime(0, t + 0.05, 0.14);
    o.connect(g);
    g.connect(this.buses.fx);
    o.start(t);
    o.stop(t + 0.9);
  }

  /** Noise riser (reverse-cymbal feel) leading into a downbeat at t + dur. */
  riser(t, dur, vel = 0.5) {
    const c = this.c;
    const s = c.createBufferSource();
    s.buffer = this.b.white;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.6;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(6500, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.03);
    s.connect(f);
    f.connect(g);
    g.connect(this.buses.fx);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  /** Shakuhachi-like flute: sine + soft triangle, breath noise, delayed vibrato, pitch bend into the note. */
  flute(t, midi, dur, vel = 0.7, o = {}) {
    const c = this.c;
    const f = mtof(midi);
    const bend = o.bend ?? -0.8;
    const end = t + dur + 0.5;
    const g = c.createGain();
    const atk = Math.min(0.12, dur * 0.3);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.75, t + atk);
    g.gain.linearRampToValueAtTime(vel, t + Math.max(atk + 0.02, dur * 0.6));
    g.gain.setTargetAtTime(0, t + dur, 0.09);
    const o1 = c.createOscillator();
    o1.type = 'sine';
    const o2 = c.createOscillator();
    o2.type = 'triangle';
    const bendT = t + Math.min(0.28, dur * 0.4);
    for (const osc of [o1, o2]) {
      osc.frequency.setValueAtTime(f * Math.pow(2, bend / 12), t);
      osc.frequency.exponentialRampToValueAtTime(f, bendT);
    }
    const g2 = c.createGain();
    g2.gain.value = 0.25;
    o1.connect(g);
    o2.connect(g2);
    g2.connect(g);
    const lfo = c.createOscillator();
    lfo.frequency.value = 4.8 + Math.random() * 0.8;
    const lg = c.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.011 * (o.vib ?? 1), t + Math.max(0.3, dur * 0.75));
    lfo.connect(lg);
    lg.connect(o1.frequency);
    lg.connect(o2.frequency);
    // breath: loud "muraiki" puff at the start, then a quiet airy bed
    const nz = c.createBufferSource();
    nz.buffer = this.b.white;
    nz.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(9000, f * 2.2);
    bp.Q.value = 1.1;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(vel * (o.breath ?? 0.55), t + 0.025);
    ng.gain.setTargetAtTime(vel * 0.1, t + 0.05, 0.08);
    ng.gain.setTargetAtTime(0, t + dur, 0.09);
    nz.connect(bp);
    bp.connect(ng);
    ng.connect(this.buses.flute);
    g.connect(this.buses.flute);
    for (const s of [o1, o2, lfo]) {
      s.start(t);
      s.stop(end);
    }
    nz.start(t, Math.random() * 1.5);
    nz.stop(end);
    this._follow([o1.detune, o2.detune], o1);
  }

  /** Sustained drone: detuned saw pairs through a slowly breathing lowpass. */
  drone(t, midis, dur, vel = 0.5, o = {}) {
    const c = this.c;
    const cut = o.cut ?? 480;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cut;
    lp.Q.value = o.q ?? 0.9;
    const g = c.createGain();
    const atk = o.atk ?? Math.min(2.5, dur * 0.3);
    const rel = o.rel ?? Math.min(2.5, dur * 0.3);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + atk);
    g.gain.setValueAtTime(vel, Math.max(t + atk, t + dur - rel));
    g.gain.linearRampToValueAtTime(0, t + dur);
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.06;
    const lg = c.createGain();
    lg.gain.value = cut * 0.35;
    lfo.connect(lg);
    lg.connect(lp.frequency);
    const oscs = [];
    const params = [];
    for (const m of midis) {
      for (const det of [-7, 6]) {
        const osc = c.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = mtof(m);
        osc.detune.value = det + (Math.random() - 0.5) * 4;
        osc.connect(lp);
        oscs.push(osc);
        params.push(osc.detune);
      }
    }
    lp.connect(g);
    g.connect(this.buses.drone);
    const all = [lfo, ...oscs];
    for (const s of all) {
      s.start(t);
      s.stop(t + dur + 0.05);
    }
    this._follow(params, oscs[0]);
    this._keep(all, t + dur);
  }

  /** Choir-ish pad: detuned saws with vibrato through a vowel formant bank. */
  choir(t, midis, dur, vel = 0.4, vowel = 'a') {
    const c = this.c;
    const sum = c.createGain();
    sum.gain.value = 0.55 / Math.sqrt(midis.length);
    const env = c.createGain();
    const atk = Math.min(0.9, dur * 0.35);
    const rel = Math.min(1.2, dur * 0.4);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vel, t + atk);
    env.gain.setValueAtTime(vel, Math.max(t + atk, t + dur - rel));
    env.gain.linearRampToValueAtTime(0, t + dur);
    const lfo = c.createOscillator();
    lfo.frequency.value = 5 + Math.random() * 0.6;
    const lg = c.createGain();
    lg.gain.value = 14;
    lfo.connect(lg);
    const oscs = [];
    const params = [];
    for (const m of midis) {
      for (const det of [-9, 8]) {
        const osc = c.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = mtof(m);
        osc.detune.value = det;
        lg.connect(osc.detune);
        osc.connect(sum);
        oscs.push(osc);
        params.push(osc.detune);
      }
    }
    for (const [f, q, gg] of VOWELS[vowel] || VOWELS.a) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const g = c.createGain();
      g.gain.value = gg;
      sum.connect(bp);
      bp.connect(g);
      g.connect(env);
    }
    env.connect(this.buses.choir);
    const all = [lfo, ...oscs];
    for (const s of all) {
      s.start(t);
      s.stop(t + dur + 0.05);
    }
    this._follow(params, oscs[0]);
    this._keep(all, t + dur);
  }

  /** Low brass-like stab: detuned saws through a snappy filter envelope. */
  brass(t, midis, dur = 0.3, vel = 0.7, bright = 1) {
    const c = this.c;
    const r = this.rate();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2.2;
    const peak = 700 + 2600 * vel * bright;
    lp.frequency.setValueAtTime(220, t);
    lp.frequency.exponentialRampToValueAtTime(peak, t + 0.03);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, peak * 0.3), t + 0.03 + Math.min(0.35, dur));
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.012);
    g.gain.setTargetAtTime(vel * 0.55, t + 0.03, 0.1);
    g.gain.setTargetAtTime(0, t + dur, 0.05);
    const end = t + dur + 0.3;
    for (const m of midis) {
      const f = mtof(m) * r;
      for (const det of [-8, 7]) {
        const osc = c.createOscillator();
        osc.type = 'sawtooth';
        osc.detune.value = det;
        osc.frequency.setValueAtTime(f * 0.985, t);
        osc.frequency.exponentialRampToValueAtTime(f, t + 0.04);
        osc.connect(lp);
        osc.start(t);
        osc.stop(end);
      }
    }
    lp.connect(g);
    g.connect(this.buses.brass);
  }

  /** Distant wood creak into the ambience bus. */
  creak(t, vel = 0.4) {
    const c = this.c;
    const s = c.createBufferSource();
    s.buffer = this.b.creak;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 500 + Math.random() * 400;
    f.Q.value = 0.8;
    const g = c.createGain();
    g.gain.value = vel;
    s.connect(f);
    f.connect(g);
    g.connect(this.ambOut);
    const off = Math.random() * 1.2;
    s.start(t, off);
    s.stop(t + 1.0);
  }

  /** Looping ambience bed: 'hall' (low room tone + air) or 'wind' (whistling drafts). */
  ambience(kind, t) {
    const c = this.c;
    const loop = (buf, rate) => {
      const s = c.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.playbackRate.value = rate;
      s.start(t, Math.random() * buf.duration * 0.5);
      return s;
    };
    const srcs = [];
    const lfoTo = (param, hz, depth) => {
      const l = c.createOscillator();
      l.frequency.value = hz;
      const lg = c.createGain();
      lg.gain.value = depth;
      l.connect(lg);
      lg.connect(param);
      l.start(t);
      srcs.push(l);
    };
    const room = loop(this.b.brown, 1);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const rg = c.createGain();
    rg.gain.value = kind === 'wind' ? 0.12 : 0.2;
    lfoTo(rg.gain, 0.07, 0.06);
    room.connect(lp);
    lp.connect(rg);
    rg.connect(this.ambOut);
    srcs.push(room);
    const air = loop(this.b.pink, 1);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = kind === 'wind' ? 800 : 1000;
    bp.Q.value = kind === 'wind' ? 2.5 : 0.7;
    if (kind === 'wind') lfoTo(bp.frequency, 0.09, 450);
    const ag = c.createGain();
    ag.gain.value = kind === 'wind' ? 0.07 : 0.018;
    lfoTo(ag.gain, 0.11, kind === 'wind' ? 0.04 : 0.008);
    air.connect(bp);
    bp.connect(ag);
    ag.connect(this.ambOut);
    srcs.push(air);
    this._keep(srcs, Infinity);
  }

  faderAt(t) {
    const f = this.fader;
    if (!f) return 0;
    if (t <= f.t0) return f.from;
    if (t >= f.t1) return f.to;
    return f.from + ((f.to - f.from) * (t - f.t0)) / (f.t1 - f.t0);
  }

  /** Track fader (music + ambience) ramp to `level`, starting at time t (may be in the future). */
  fadeTo(level, t, dur) {
    const now = this.c.currentTime;
    t = Math.max(t, now);
    const vNow = this.faderAt(now);
    const vT = this.faderAt(t);
    const t1 = t + Math.max(0.01, dur);
    for (const p of [this.out.gain, this.send.gain, this.ambOut.gain]) {
      p.cancelScheduledValues(now);
      p.setValueAtTime(vNow, now);
      if (t > now + 0.001) p.linearRampToValueAtTime(vT, t);
      p.linearRampToValueAtTime(level, t1);
    }
    this.fader = { from: vT, to: level, t0: t, t1 };
  }

  dispose() {
    const now = this.c.currentTime;
    for (const l of this.long) {
      for (const s of l.sources) {
        try { s.stop(now + 0.05); } catch (_) { /* ignore */ }
      }
    }
    this.long = [];
    const nodes = [this.out, this.send, this.ambOut, this.ambSend];
    setTimeout(() => {
      for (const n of nodes) {
        try { n.disconnect(); } catch (_) { /* ignore */ }
      }
    }, 200);
  }
}
