// Look-ahead music scheduler on the AudioContext clock, with crossfades and bar-aligned switches.

import { TRACKS } from './tracks.js';
import { Band } from './band.js';
import { FILE_TRACKS, FileTrack } from './files.js';
import { mulberry32, clamp01 } from '../dsp.js';

const LOOKAHEAD = 0.2;
const HIDDEN_LOOKAHEAD = 1.2;

class Track {
  constructor(me, name, def, start, startStep) {
    this.me = me;
    this.name = name;
    this.def = def;
    this.stepDur = 60 / def.bpm / 4;
    this.origin = start - startStep * this.stepDur;
    this.startTime = start;
    this.startStep = startStep;
    this.step = startStep;
    this.stopAtStep = Infinity;
    this.rng = mulberry32((Math.random() * 2147483647) | 0);
    this.band = new Band(me.e, def.buses);
    this.disposeAt = Infinity;
    this.mixI = -1;
    this.errors = 0;
    if (def.ambience) this.band.ambience(def.ambience, start);
    this.applyMix(me.intensity);
  }

  get I() {
    return this.me.intensity;
  }

  r() {
    return this.rng();
  }

  pick(a) {
    return a[(this.rng() * a.length) | 0];
  }

  timeOf(step) {
    return this.origin + step * this.stepDur;
  }

  /** First bar boundary at/after time t that has not been scheduled yet. */
  nextBar(t) {
    const cur = Math.max(this.step, Math.ceil((t - this.origin) / this.stepDur - 1e-6));
    const st = Math.ceil(cur / 16) * 16;
    return { step: st, time: this.timeOf(st) };
  }

  applyMix(I) {
    this.mixI = I;
    if (!this.def.mix) return;
    const m = this.def.mix(I);
    for (const k in m) this.band.setBus(k, m[k]);
  }

  schedule(horizon, now) {
    // after a long stall (background tab), jump instead of replaying missed steps
    if (this.timeOf(this.step) < now - 1) this.step = Math.ceil((now - this.origin) / this.stepDur);
    let guard = 0;
    while (this.step < this.stopAtStep && guard++ < 4096) {
      const t = this.timeOf(this.step);
      if (t >= horizon) break;
      if (t >= now - 0.03) {
        try {
          this.def.step(this, this.step, t);
        } catch (e) {
          if (this.errors++ < 3) console.warn('[audio] music step error', e);
        }
      }
      this.step++;
    }
  }

  fadeIn(t, dur) {
    this.band.fadeTo(this.def.level ?? 1, t, dur);
  }

  fadeOut(t, dur) {
    this.band.fadeTo(0, t, dur);
    this.disposeAt = t + dur + 0.3;
  }

  dispose() {
    this.stopAtStep = 0;
    this.band.dispose();
  }
}

export class MusicEngine {
  /** @param files optional MusicFiles: tracks listed in FILE_TRACKS then play the recordings. */
  constructor(engine, files = null) {
    this.e = engine;
    this.c = engine.ctx;
    this.files = files;
    this.tracks = [];
    this.current = null;
    this._queued = null;
    this.intensity = 0.5;
    this.target = 0.5;
    this.lastT = null;
    engine.music = this;
  }

  get currentName() {
    return this.current ? this.current.name : null;
  }

  setIntensity(x) {
    this.target = clamp01(Number.isFinite(+x) ? +x : 0.5);
  }

  /** Switch on the next tick (safe to call from inside a track's schedule()). */
  queue(name, fade) {
    this._queued = { name, fade };
  }

  play(name, fade = 1.5) {
    const want = name || null;
    this._queued = null;
    if (want === this.currentName) return;
    const fdef = want ? FILE_TRACKS[want] : null;
    if (want && !TRACKS[want] && !fdef) {
      this.e.warnOnce('track:' + want, `[audio] Unknown music track "${want}" (ignored).`);
      return;
    }
    const now = this.c.currentTime;
    const f = Math.max(0.02, Number.isFinite(+fade) ? +fade : 1.5);
    const old = this.current;
    if (!want) {
      if (old) old.fadeOut(now, f);
      this.current = null;
      return;
    }
    if (fdef && this.files && !this.files.failed(fdef.src)) {
      // the same recording keeps playing (boss -> boss2)
      if (old && old.isFile && old.src === fdef.src && old.def.loop && !(old.disposeAt < Infinity)) {
        old.name = want;
        return;
      }
      if (old) old.fadeOut(now, f);
      const tr = new FileTrack(this, want, fdef, now + 0.05);
      tr.fadeIn(now, f);
      this.tracks.push(tr);
      this.current = tr;
      this.tick();
      return;
    }
    const def = TRACKS[want] || TRACKS[fdef?.fallback];
    if (!def) return;
    let start = now + 0.05;
    let startStep = 0;
    let fadeIn = f;
    if (old && !old.isFile && def.family && old.def.family === def.family && old.def.bpm === def.bpm) {
      // Same family & tempo (boss -> boss2): switch on the next bar, keeping the phrase position.
      const nb = old.nextBar(now + 0.08);
      start = nb.time;
      startStep = nb.step;
      old.stopAtStep = nb.step;
      old.fadeOut(start, Math.min(f, 0.5));
      fadeIn = 0.02;
    } else if (old) {
      old.fadeOut(now, f);
    }
    const tr = new Track(this, want, def, start, startStep);
    tr.fadeIn(fadeIn <= 0.02 ? start - 0.02 : now, fadeIn);
    this.tracks.push(tr);
    this.current = tr;
    this.tick();
  }

  /** Called every ~25 ms by the system timer (or once with a far horizon for offline renders). */
  tick(horizonOverride) {
    const now = this.c.currentTime;
    const dt = this.lastT == null ? 0 : Math.max(0, now - this.lastT);
    this.lastT = now;
    this.intensity += (this.target - this.intensity) * (1 - Math.exp(-dt / 0.8));
    const hidden = typeof document !== 'undefined' && document.hidden;
    const horizon = horizonOverride ?? now + (hidden ? HIDDEN_LOOKAHEAD : LOOKAHEAD);
    for (let i = this.tracks.length - 1; i >= 0; i--) {
      const tr = this.tracks[i];
      if (now > tr.disposeAt) {
        tr.dispose();
        this.tracks.splice(i, 1);
        continue;
      }
      if (Math.abs(this.intensity - tr.mixI) > 0.01) tr.applyMix(this.intensity);
      tr.schedule(horizon, now);
      // a recording that failed to load hands its slot to the synthesized score
      if (tr.isFile && !tr.begun && this.files?.failed(tr.src) && !(tr.disposeAt < Infinity)) {
        tr.dispose();
        this.tracks.splice(i, 1);
        if (this.current === tr) {
          this.current = null;
          this._queued = { name: tr.name, fade: 1 };
        }
      }
    }
    if (this._queued) {
      const q = this._queued;
      this._queued = null;
      this.play(q.name, q.fade);
    }
  }
}
