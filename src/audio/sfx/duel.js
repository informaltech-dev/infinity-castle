// 真劍: the sounds that make a duel readable -- the tell before a held blow, the warning before one no guard
// stops -- and the execution of a broken posture.

import { whoosh, thump, click } from './common.js';

export default {
  // a blade's tell: the light running to its point, a thin high ring (just before the cut)
  tellBlade: {
    path: 'hero', gain: 0.34, send: 0.35, maxDur: 0.9, jitter: 0.02, minInterval: 0.08,
    fn(v) {
      v.layer(v.b.crystal, { rate: 1.78 * v.p, env: [[0, 0], [0.006, 0.8], [0.5, 0.001]] });
      v.tone('sine', { f: v.F([[0, 3150], [0.3, 3050]]), env: [[0, 0], [0.004, 0.3], [0.32, 0.001]] });
      click(v, { hp: 6000, dur: 0.008, level: 0.5 });
      return 0.6;
    },
  },

  // a fist's tell: the breath drawn in, a knuckle-crack and a short rush of air
  tellFist: {
    path: 'hero', gain: 0.4, send: 0.22, maxDur: 0.6, jitter: 0.04, minInterval: 0.08,
    fn(v) {
      whoosh(v, { dur: 0.16, f0: 1800, f1: 4200, f2: 2600, peakAt: 0.6, Q: 1.4, level: 0.6 });
      click(v, { at: 0.02, type: 'bandpass', hp: 3200, Q: 1.4, dur: 0.012, level: 0.7 });
      v.layer(v.b.crystal, { at: 0.03, rate: 1.5 * v.p, env: [[0, 0.35], [0.25, 0.001]] });
      return 0.4;
    },
  },

  // 危: a deep bell stroke with a sour edge -- this one cannot be blocked
  peril: {
    path: 'hero', gain: 0.62, send: 0.4, maxDur: 1.6, jitter: 0.01, minInterval: 0.3,
    fn(v) {
      v.saturate(0.4);
      thump(v, { f0: 120, f1: 58, drop: 0.12, dur: 1.2, level: 0.9, atk: 0.003 });
      v.tone('triangle', { f: 233, env: [[0, 0], [0.005, 0.5], [1.1, 0.001]], level: 0.7 });
      v.tone('triangle', { f: 247, env: [[0, 0], [0.005, 0.4], [1.0, 0.001]], level: 0.6 });
      v.layer(v.b.gong, { rate: 1.6 * v.p, env: [[0, 0.6], [0.9, 0.001]] });
      return 1.3;
    },
  },

  // the execution: a drawn-out cut through the silence, and a body blow under it
  execute: {
    path: 'hero', gain: 0.9, send: 0.45, maxDur: 1.8, jitter: 0.02,
    fn(v) {
      v.saturate(0.6);
      whoosh(v, { kind: 'pink', at: 0.18, dur: 0.22, f0: 600, f1: 5200, f2: 1400, peakAt: 0.5, Q: 1.1, level: 1.4 });
      v.layer(v.pick(v.b.shing), { at: 0.26, rate: 0.82 * v.p, env: [[0, 0.9], [0.9, 0.001]] });
      thump(v, { at: 0.3, f0: 110, f1: 36, drop: 0.25, dur: 0.9, level: 1.0 });
      v.layer(v.b.taikoBig, { at: 0.3, rate: 0.8 * v.p, env: [[0, 0.9], [1.1, 0.001]] });
      v.noise('white', { at: 0.3, type: 'lowpass', f: v.F([[0, 6000], [0.5, 400]]), env: [[0, 0.8], [0.5, 0.001]], level: 0.8 });
      return 1.5;
    },
  },
};
