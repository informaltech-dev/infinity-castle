// Virtual clock for frame-exact capture. A classic (non-module) script so it runs before any game code.
//
// performance.now / Date.now / timers / requestAnimationFrame all follow a virtual time that only moves when
// advance() is called, and every Web Animation / CSS animation / CSS transition is pinned to that time too.
// The capture driver sets window.__VCLOCK_MANUAL before the page loads and advances one frame per capture;
// opened normally, the clock follows real time so the trailer can be watched live.
//
// Math.random is replaced with a seedable generator so every shot simulates identically on every render.
(function () {
  'use strict';
  const W = window;
  const realRAF = W.requestAnimationFrame.bind(W);
  const realNow = performance.now.bind(performance);
  const realDateNow = Date.now;

  const V = {
    now: 0,
    frame: 0,
    manual: !!W.__VCLOCK_MANUAL,
    timers: new Map(),
    seq: 0,
    rafs: new Map(),
    anims: new WeakMap(),
    dateBase: realDateNow(),
  };

  performance.now = () => V.now;
  Date.now = () => Math.floor(V.dateBase + V.now);

  W.setTimeout = (fn, ms, ...args) => {
    const id = ++V.seq;
    V.timers.set(id, { at: V.now + Math.max(0, Number(ms) || 0), fn, args, every: 0, order: id });
    return id;
  };
  W.setInterval = (fn, ms, ...args) => {
    const id = ++V.seq;
    const every = Math.max(1, Number(ms) || 0);
    V.timers.set(id, { at: V.now + every, fn, args, every, order: id });
    return id;
  };
  W.clearTimeout = W.clearInterval = (id) => {
    V.timers.delete(id);
  };
  W.requestAnimationFrame = (fn) => {
    const id = ++V.seq;
    V.rafs.set(id, fn);
    return id;
  };
  W.cancelAnimationFrame = (id) => {
    V.rafs.delete(id);
  };

  function runTimers(until) {
    for (let guard = 0; guard < 20000; guard++) {
      let best = null;
      let bestId = 0;
      for (const [id, t] of V.timers) {
        if (t.at <= until && (!best || t.at < best.at || (t.at === best.at && t.order < best.order))) {
          best = t;
          bestId = id;
        }
      }
      if (!best) return;
      if (best.at > V.now) V.now = best.at;
      if (best.every) {
        best.at += best.every;
        best.order = ++V.seq;
      } else V.timers.delete(bestId);
      try {
        if (typeof best.fn === 'function') best.fn(...best.args);
      } catch (e) {
        console.error(e);
      }
    }
  }

  // Pin every animation to virtual time: paused, with currentTime set from the moment it was first seen.
  // Past its end it is finished for real, so onfinish handlers and `finished` promises still run.
  function syncAnimations() {
    if (!document.getAnimations) return;
    for (const a of document.getAnimations()) {
      let s = V.anims.get(a);
      if (!s) {
        s = { start: V.now, done: false };
        V.anims.set(a, s);
        try {
          a.pause();
        } catch (_) { /* ignore */ }
      }
      if (s.done) continue;
      const rate = a.playbackRate || 1;
      const local = (V.now - s.start) * rate;
      let end = Infinity;
      try {
        end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
      } catch (_) { /* ignore */ }
      if (Number.isFinite(end) && local >= end) {
        s.done = true;
        try {
          a.finish();
        } catch (_) {
          try {
            a.currentTime = end;
          } catch (_) { /* ignore */ }
        }
      } else {
        try {
          a.currentTime = local;
        } catch (_) { /* ignore */ }
      }
    }
  }

  /** Advance by `ms`: due timers, then one animation frame, then animation pinning. */
  V.advance = (ms = 1000 / 60) => {
    const target = V.now + ms;
    runTimers(target);
    V.now = target;
    V.frame++;
    const cbs = Array.from(V.rafs.values());
    V.rafs.clear();
    for (const cb of cbs) {
      try {
        cb(V.now);
      } catch (e) {
        console.error(e);
      }
    }
    runTimers(V.now);
    syncAnimations();
    return V.now;
  };

  // seedable Math.random (mulberry32)
  let seed = 0x2545f491;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  V.seed = (s) => {
    seed = (s >>> 0) || 1;
  };

  if (!V.manual) {
    let last = realNow();
    const pump = () => {
      const n = realNow();
      V.advance(Math.min(50, n - last));
      last = n;
      realRAF(pump);
    };
    realRAF(pump);
  }

  W.__vclock = V;
})();
