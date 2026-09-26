// Pre-recorded music (public/music/*.mp3), played through the same music bus as the synthesized score, so
// ducking, the slow-motion muffle, the danger filter and the music volume all still apply.
//
// The recordings were not written to loop. Each loop jumps from B back to A between two bars of the same
// section (measured offline: matching harmony, orchestration and beat phase) with an equal-power crossfade
// centred on the join. The loop lengths are whole bars at the pieces' tempi (battle 132 BPM: 48 bars;
// opening 128 BPM: 72 bars), so the beat carries straight through the crossfade.

const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';

export const MUSIC_FILES = {
  opening: 'music/opening.mp3',
  appear: 'music/appear.mp3',
  battle: 'music/akaza-battle.mp3',
};

const BATTLE_LOOP = { a: 9.288, b: 96.5607, x: 2 };

/**
 * Track name -> recording. `gain` (on top of the music bus input level) sets the loudness: measured K-weighted,
 * the battle loop -12.6, the entrance theme -19.1 and the opening loop -7.9 LUFS raw, levelled to about
 * -23.5 / -23 / -24, i.e. a touch above the synthesized score they replace (-24.2 boss, -27.7 title).
 * `next`: a one-shot that hands over to another track `nextFade` seconds before it ends.
 * `fallback`: synthesized track used when the recording cannot be loaded.
 */
export const FILE_TRACKS = {
  title: { src: 'opening', gain: 1.27, fadeIn: 2, loop: { a: 53.592, b: 188.592, x: 3 } },
  appear: { src: 'appear', gain: 5.2, next: 'boss', nextFade: 1.4, fallback: 'boss' },
  boss: { src: 'battle', gain: 2.32, loop: BATTLE_LOOP },
  // the phase change keeps the same recording running
  boss2: { src: 'battle', gain: 2.32, loop: BATTLE_LOOP },
};

function decodeAudio(ctx, raw) {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(raw, resolve, reject);
    if (p && p.then) p.then(resolve, reject);
  });
}

/** Downloads the recordings early and decodes them once an AudioContext exists. */
export class MusicFiles {
  constructor() {
    this.bufs = Object.create(null);
    this.state = Object.create(null); // 'loading' | 'ready' | 'failed'
    this._raw = Object.create(null);
  }

  /** Starts the downloads (no AudioContext needed). Idempotent. */
  prefetch() {
    if (typeof fetch !== 'function') return;
    for (const [k, path] of Object.entries(MUSIC_FILES)) {
      if (this._raw[k]) continue;
      this.state[k] = 'loading';
      this._raw[k] = fetch(BASE + path).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${path}`);
        return r.arrayBuffer();
      });
      this._raw[k].catch(() => {}); // reported by decode()
    }
  }

  /** Decodes for `ctx`, the title recording first so the menu music starts as early as possible. */
  async decode(ctx, first = 'opening') {
    this.prefetch();
    const one = async (k) => {
      try {
        this.bufs[k] = await decodeAudio(ctx, await this._raw[k]);
        this.state[k] = 'ready';
      } catch (e) {
        this.state[k] = 'failed';
        console.warn(`[audio] Music file "${MUSIC_FILES[k]}" unavailable; using the synthesized score.`, e);
      } finally {
        this._raw[k] = null;
      }
    };
    await one(first);
    await Promise.all(Object.keys(MUSIC_FILES).filter((k) => k !== first).map(one));
  }

  get(k) {
    return this.bufs[k] || null;
  }

  failed(k) {
    return this.state[k] === 'failed' || !(k in this.state);
  }
}

const eqCurve = (fadeOut) => {
  const n = 128;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * Math.PI * 0.5;
    c[i] = fadeOut ? Math.cos(x) : Math.sin(x);
  }
  return c;
};
const EQ_IN = eqCurve(false);
const EQ_OUT = eqCurve(true);

/** One playing recording. Same surface as the synthesized Track as far as MusicEngine is concerned. */
export class FileTrack {
  constructor(me, name, def, start) {
    this.me = me;
    this.c = me.c;
    this.name = name;
    this.def = def;
    this.src = def.src;
    this.isFile = true;
    this.startTime = start;
    this.out = this.c.createGain();
    this.out.gain.value = 0;
    this.out.connect(me.e.musicIn);
    this.segs = [];
    this.buf = null;
    this.begun = false;
    this.dead = false;
    this.fader = null;
    this.fadeReq = null;
    this.endAt = Infinity;
    this.nextFired = false;
    this.disposeAt = Infinity;
    this.mixI = 0;
  }

  applyMix() {}

  faderAt(t) {
    const f = this.fader;
    if (!f) return 0;
    if (t <= f.t0) return f.from;
    if (t >= f.t1) return f.to;
    return f.from + ((f.to - f.from) * (t - f.t0)) / (f.t1 - f.t0);
  }

  fadeTo(level, t, dur) {
    const now = this.c.currentTime;
    t = Math.max(t, now);
    const vNow = this.faderAt(now);
    const vT = this.faderAt(t);
    const t1 = t + Math.max(0.01, dur);
    const p = this.out.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(vNow, now);
    if (t > now + 0.001) p.linearRampToValueAtTime(vT, t);
    p.linearRampToValueAtTime(level, t1);
    this.fader = { from: vT, to: level, t0: t, t1 };
  }

  fadeIn(t, dur) {
    const d = this.def.fadeIn ?? dur;
    if (this.begun) this.fadeTo(this.def.gain, Math.max(t, this.startTime), d);
    else this.fadeReq = d;
  }

  fadeOut(t, dur) {
    this.fadeReq = null;
    if (this.begun) this.fadeTo(0, t, dur);
    this.disposeAt = t + dur + 0.3;
  }

  _begin(buf, t) {
    this.buf = buf;
    this.begun = true;
    this.startTime = t;
    const first = this._seg(t, 0, 0);
    this.endAt = first.end;
    if (this.fadeReq != null) this.fadeTo(this.def.gain, t, this.fadeReq);
    this.fadeReq = null;
  }

  /** One pass through the recording from buffer offset `off`, fading in over `xIn` seconds. */
  _seg(t, off, xIn) {
    const src = this.c.createBufferSource();
    src.buffer = this.buf;
    const g = this.c.createGain();
    if (xIn > 0) {
      g.gain.value = 0;
      g.gain.setValueCurveAtTime(EQ_IN, t, xIn);
    }
    src.connect(g);
    g.connect(this.out);
    src.start(t, off);
    const L = this.def.loop;
    const seg = { src, g, t, x: L ? t + (L.b - L.x / 2 - off) : Infinity, end: t + (this.buf.duration - off), chained: false };
    this.segs.push(seg);
    return seg;
  }

  /** Crossfade `seg` out at its loop point into a fresh pass starting just before A. */
  _chain(seg) {
    const L = this.def.loop;
    seg.chained = true;
    seg.g.gain.setValueCurveAtTime(EQ_OUT, seg.x, L.x);
    seg.end = seg.x + L.x + 0.05;
    try {
      seg.src.stop(seg.end);
    } catch (_) { /* ignore */ }
    this._seg(seg.x, L.a - L.x / 2, L.x);
  }

  schedule(horizon, now) {
    if (this.dead) return;
    if (!this.begun) {
      if (this.disposeAt < Infinity) return; // faded out before the recording was ready
      const buf = this.me.files?.get(this.src);
      if (buf) this._begin(buf, Math.max(now + 0.05, this.startTime));
      return;
    }
    // keep the next pass queued: chain the newest one as soon as it has started (a whole loop ahead)
    const last = this.segs[this.segs.length - 1];
    if (this.def.loop && last && !last.chained && now >= last.t - 0.5) this._chain(last);
    for (let i = this.segs.length - 1; i >= 0; i--) {
      const s = this.segs[i];
      if (now > s.end + 0.2) {
        try {
          s.src.disconnect();
          s.g.disconnect();
        } catch (_) { /* ignore */ }
        this.segs.splice(i, 1);
      }
    }
    // a one-shot (entrance theme) hands over to the next track before it runs out
    const d = this.def;
    if (d.next && !this.nextFired && this.me.current === this) {
      const fade = d.nextFade ?? 1.5;
      if (now >= this.endAt - fade - 0.15) {
        this.nextFired = true;
        this.me.queue(d.next, fade);
      }
    }
  }

  dispose() {
    this.dead = true;
    const now = this.c.currentTime;
    const segs = this.segs;
    this.segs = [];
    for (const s of segs) {
      try {
        s.src.stop(now + 0.05);
      } catch (_) { /* ignore */ }
    }
    const out = this.out;
    setTimeout(() => {
      for (const s of segs) {
        try {
          s.src.disconnect();
          s.g.disconnect();
        } catch (_) { /* ignore */ }
      }
      try {
        out.disconnect();
      } catch (_) { /* ignore */ }
    }, 250);
  }
}
