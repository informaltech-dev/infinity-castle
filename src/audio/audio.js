// Public audio API for the Infinity Castle demo. Sound effects are synthesized with the Web Audio API; the
// title, Akaza's entrance and the boss fight use recordings (public/music), the rest of the score is synthesized.
//
//   const audio = new AudioSystem();
//   button.onclick = () => audio.unlock();          // from a user gesture
//   audio.play('hitSlash', { intensity: 0.8, pos: enemy.position });
//   audio.playMusic('boss');
//
// Every method is a safe no-op before unlock() (state such as volumes, music track, intensity, slow-mo,
// danger and listener is remembered and applied once unlocked). Nothing here ever throws.

import { Engine } from './engine.js';
import { MusicEngine } from './music/music.js';
import { MusicFiles } from './music/files.js';
import { buildBank } from './bank.js';
import { SOUNDS } from './sfx/index.js';

const TICK_MS = 25;

export class AudioSystem {
  constructor() {
    this._ctx = null;
    this._bank = null;
    this._engine = null;
    this._music = null;
    this._ready = false;
    this._unlocking = null;
    this._timer = null;
    this._lastTick = 0;
    this._warned = new Set();
    // download the recordings while the game boots; they are decoded once the context exists
    this._files = new MusicFiles();
    this._files.prefetch();
    this._pending = {
      volumes: {},
      track: undefined,
      fade: 1.5,
      intensity: undefined,
      slowmo: 0,
      danger: 0,
      listener: null,
    };
  }

  /** True once the context, buses and pre-rendered buffers exist. */
  get ready() {
    return this._ready;
  }

  /** The context exists but is not running (not yet allowed to start, or interrupted). */
  get suspended() {
    return !!this._ctx && this._ctx.state !== 'running' && this._ctx.state !== 'closed' && !this._hiddenSuspend && !this._held;
  }

  /**
   * Freeze every sound (the context stops, and with it all scheduled notes and recordings) until released.
   * The game holds it while paused on a cinematic that is cut to its music.
   */
  hold(on) {
    on = !!on;
    if (on === !!this._held) return;
    this._held = on;
    const c = this._ctx;
    if (!c || c.state === 'closed') return;
    if (on) {
      if (c.state === 'running') c.suspend().catch(() => {});
    } else this._resume();
  }

  /** Call from a user gesture. Idempotent. Creates/resumes the AudioContext, builds buses, pre-renders buffers. */
  unlock() {
    if (this._unlocking) {
      this._resume();
      return this._unlocking;
    }
    const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
    if (!AC) {
      this._warn('noctx', '[audio] Web Audio API not available; audio disabled.');
      this._unlocking = Promise.resolve();
      return this._unlocking;
    }
    let ctx = null;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch (_) {
      try {
        ctx = new AC();
      } catch (e) {
        this._warn('ctxfail', '[audio] Could not create an AudioContext:', e);
        this._unlocking = Promise.resolve();
        return this._unlocking;
      }
    }
    this._ctx = ctx;
    // resume() must be called synchronously inside the user gesture.
    const resumed = this._resume();
    try {
      // a silent one-sample buffer fully unlocks iOS Safari
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      s.connect(ctx.destination);
      s.start();
    } catch (_) { /* ignore */ }

    // Build the mix graph right away: the master dynamics settle while the buffers are pre-rendered.
    try {
      this._engine = new Engine(ctx, null);
    } catch (e) {
      this._warn('graph', '[audio] Could not build the audio graph:', e);
      this._unlocking = Promise.resolve();
      return this._unlocking;
    }

    this._files.decode(ctx);
    this._unlocking = (async () => {
      try {
        this._bank = await buildBank(ctx);
        this._engine.setBank(this._bank);
        this._music = new MusicEngine(this._engine, this._files);
        this._applyPending();
        this._startTimer();
        this._installResumeHooks();
        this._ready = true;
        await Promise.race([resumed, new Promise((r) => setTimeout(r, 400))]);
      } catch (e) {
        this._warn('unlock', '[audio] unlock failed:', e);
      }
    })();
    return this._unlocking;
  }

  /** Each 0..1 (perceptual curve applied). Missing keys are left unchanged. */
  setVolumes(v = {}) {
    if (!v || typeof v !== 'object') return;
    for (const k of ['master', 'sfx', 'music']) {
      if (v[k] != null && Number.isFinite(+v[k])) this._pending.volumes[k] = +v[k];
    }
    if (this._ready) this._safe(() => this._engine.setVolumes(v));
  }

  /**
   * Fire-and-forget. Returns { stop(fade = 0.1), duration, name } or null (not ready, unknown, rate-limited).
   * opts: volume 0..2, pitch (rate multiplier), pan -1..1, pos {x,y,z}, intensity 0..1, note (semitones, biwa),
   *       delay (seconds, optional).
   */
  play(name, opts) {
    if (!SOUNDS[name]) {
      this._warn('unknown:' + name, `[audio] Unknown sound "${name}" (ignored).`);
      return null;
    }
    // Not ready, or the context is suspended/interrupted: drop the sound instead of queueing a burst.
    if (!this._ready || this._ctx.state !== 'running') return null;
    return this._safe(() => this._engine.play(name, opts && typeof opts === 'object' ? opts : {})) || null;
  }

  /** Listener in world space (plain {x,y,z}; THREE.Vector3 works). right = camera right vector. */
  setListener(pos, forward, right) {
    if (!this._ready) {
      const cp = (o) => (o && Number.isFinite(o.x) ? { x: +o.x, y: +o.y || 0, z: +o.z || 0 } : null);
      this._pending.listener = [cp(pos), cp(forward), cp(right)];
      return;
    }
    this._safe(() => this._engine.setListener(pos, forward, right));
  }

  /** Crossfade to a track ('title'|'stage'|'boss'|'boss2'|'moon'|'moon2'|'victory'|'defeat'|null). Same track = no-op. */
  playMusic(track, fade = 1.5) {
    if (!this._ready) {
      this._pending.track = track || null;
      this._pending.fade = fade;
      return;
    }
    this._safe(() => this._music.play(track || null, fade));
  }

  /** 0..1 dynamic intensity inside the current track (smoothed). */
  setMusicIntensity(x) {
    this._pending.intensity = x;
    if (this._ready) this._safe(() => this._music.setIntensity(x));
  }

  /** 0 = normal, 1 = full slow-motion feel. Cheap; call every frame. */
  setSlowmo(x) {
    this._pending.slowmo = x;
    if (this._ready) this._safe(() => this._engine.setSlowmo(x));
  }

  /** Momentary ducking of music + world sfx. */
  duck(amount = 0.6, duration = 0.4) {
    if (this._ready) this._safe(() => this._engine.duck(amount, duration));
  }

  /** Low-HP heartbeat loop. 0 = off, 1 = fast & loud. Smoothed; call every frame. */
  setDanger(x) {
    this._pending.danger = x;
    if (this._ready) this._safe(() => this._engine.setDanger(x));
  }

  /** Debug info (test page). */
  get debug() {
    return {
      ctx: this._ctx,
      bank: this._bank,
      engine: this._engine,
      music: this._music,
      state: this._ctx ? this._ctx.state : 'none',
      sampleRate: this._ctx ? this._ctx.sampleRate : 0,
      prerenderMs: this._bank ? this._bank.renderMs : 0,
      voices: this._ready ? this._engine.activeVoiceCount() : 0,
      track: this._music ? this._music.currentName : null,
      files: { ...this._files.state },
    };
  }

  // ---------------------------------------------------------------- internals

  _resume() {
    const c = this._ctx;
    if (!c || c.state === 'running' || c.state === 'closed' || !c.resume) return Promise.resolve();
    // stays down while the page is hidden or the game holds the sound
    if (this._hiddenSuspend || this._held) return Promise.resolve();
    try {
      return c.resume().catch(() => {});
    } catch (_) {
      return Promise.resolve();
    }
  }

  _applyPending() {
    const p = this._pending;
    const e = this._engine;
    e.setVolumes(p.volumes);
    if (p.listener) e.setListener(...p.listener);
    e.setSlowmo(p.slowmo);
    e.setDanger(p.danger);
    if (p.intensity !== undefined) {
      this._music.setIntensity(p.intensity);
      this._music.intensity = this._music.target;
    }
    if (p.track !== undefined) this._music.play(p.track, p.fade);
  }

  _startTimer() {
    this._lastTick = performance.now();
    this._timer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(1, (now - this._lastTick) / 1000);
      this._lastTick = now;
      this._safe(() => {
        this._engine.tick(dt);
        this._music.tick();
      });
    }, TICK_MS);
  }

  _installResumeHooks() {
    if (typeof window === 'undefined') return;
    const kick = () => {
      if (this._ctx && this._ctx.state !== 'running' && this._ctx.state !== 'closed') this._resume();
    };
    for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchend']) {
      window.addEventListener(ev, kick, { capture: true, passive: true });
    }
    if (typeof document !== 'undefined') {
      // silence everything while the page is in the background (phones keep playing otherwise)
      document.addEventListener('visibilitychange', () => {
        const c = this._ctx;
        if (!c || c.state === 'closed') return;
        if (document.hidden) {
          this._hiddenSuspend = true;
          if (c.state === 'running') c.suspend().catch(() => {});
        } else {
          this._hiddenSuspend = false;
          kick();
        }
      });
      // the page may have gone to the background while the buffers were pre-rendered (before this listener)
      if (document.hidden && this._ctx && this._ctx.state !== 'closed') {
        this._hiddenSuspend = true;
        this._ctx.suspend().catch(() => {});
      }
    }
  }

  _safe(fn) {
    try {
      return fn();
    } catch (e) {
      this._warn('err:' + (e && e.message), '[audio] error (ignored):', e);
      return null;
    }
  }

  _warn(key, ...msg) {
    if (this._warned.has(key)) return;
    this._warned.add(key);
    console.warn(...msg);
  }
}

// Debug / verification exports (used by tests/audio.html).
export { SOUND_NAMES, SOUND_GROUPS } from './sfx/index.js';
export { MUSIC_TRACKS } from './music/tracks.js';
export {
  renderSoundOffline, renderMusicOffline, renderTransitionOffline, renderStressOffline, analyzeBuffer, getSharedBank,
  PRE_ROLL,
} from './debug.js';

export default AudioSystem;
