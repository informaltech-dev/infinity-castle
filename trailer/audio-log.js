// Stand-in for AudioSystem during capture. Nothing is played: every call is recorded against trailer time,
// and trailer/audio-render.js replays the record through the real engine in an OfflineAudioContext, so the
// sound effects land on exactly the frames that triggered them.
import { SOUNDS } from '../src/audio/sfx/index.js';

const xyz = (o) => (o && Number.isFinite(o.x) ? { x: +o.x, y: +o.y || 0, z: +o.z || 0 } : null);
const OPTS = ['volume', 'pitch', 'pan', 'intensity', 'note', 'delay'];

export class AudioLog {
  constructor() {
    this.events = [];
    /** () => current trailer time in seconds (set by the trailer). */
    this.clock = () => 0;
    /** Muted until the trailer runs, and while a shot is being set up. */
    this.muted = true;
    /** Level of the game's sound effects in the current shot. */
    this.gain = 1;
    this._ids = 0;
    this._slow = 0;
    this._danger = 0;
    this._L = '';
  }

  get ready() {
    return true;
  }

  unlock() {
    return Promise.resolve();
  }

  _push(e) {
    if (this.muted) return false;
    e.t = this.clock();
    this.events.push(e);
    return true;
  }

  play(name, opts) {
    if (!SOUNDS[name]) return null;
    const o = {};
    if (opts) for (const k of OPTS) if (Number.isFinite(opts[k])) o[k] = +opts[k];
    const pos = opts && xyz(opts.pos);
    if (pos) o.pos = pos;
    if (this.gain !== 1) o.volume = (o.volume ?? 1) * this.gain;
    const id = ++this._ids;
    if (!this._push({ m: 'play', id, name, o })) return null;
    return { name, duration: SOUNDS[name].maxDur || 1, stop: (fade = 0.1) => this._push({ m: 'stop', id, fade }) };
  }

  /** Trailer-only: a sound that is part of the edit rather than the game (always recorded). */
  cue(t, name, o = {}) {
    this.events.push({ m: 'play', id: ++this._ids, name, o, t, cue: true });
  }

  // The listener follows the camera the trailer actually renders (see commitListener), not the game's.
  setListener() {}

  commitListener(cam) {
    const p = cam.position;
    const e = cam.matrixWorld.elements;
    // camera forward = -Z column, right = X column
    const f = { x: -e[8], y: -e[9], z: -e[10] };
    const r = { x: e[0], y: e[1], z: e[2] };
    const key = [p.x, p.y, p.z, f.x, f.z].map((v) => v.toFixed(2)).join(',');
    if (key === this._L) return;
    this._L = key;
    this._push({ m: 'L', p: xyz(p), f, r });
  }

  setSlowmo(x) {
    if (Math.abs(x - this._slow) < 0.004 && !((x === 0 || x === 1) && x !== this._slow)) return;
    this._slow = x;
    this._push({ m: 'slow', x });
  }

  setDanger(x) {
    if (Math.abs(x - this._danger) < 0.01 && !(x === 0 && this._danger !== 0)) return;
    this._danger = x;
    this._push({ m: 'danger', x });
  }

  duck(a = 0.6, d = 0.4) {
    this._push({ m: 'duck', a, d });
  }

  playMusic(track, fade) {
    this._push({ m: 'music', track: track || null, fade });
  }

  /** Re-records the continuous state (after a muted stretch such as a shot's set-up). */
  resync() {
    this._L = '';
    this._push({ m: 'slow', x: this._slow });
    this._push({ m: 'danger', x: this._danger });
  }

  setMusicIntensity() {}
  setVolumes() {}

  get debug() {
    return { state: 'log', events: this.events.length };
  }
}
