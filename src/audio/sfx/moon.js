// Kokushibo (Upper Moon One): Moon Breathing's cuts and the crescents they leave, the draw, the blade growing.

import { whoosh, thump, click } from './common.js';

export default {
  // a long cut with the moonlight ringing along it
  moonSlash: {
    gain: 0.5, send: 0.24, maxDur: 0.9, jitter: 0.05,
    fn(v) {
      const d = v.rnd(0.3, 0.36);
      whoosh(v, { kind: 'pink', dur: d, f0: 380, f1: 1700, f2: 600, peakAt: 0.45, Q: 0.9, level: 1.3 });
      whoosh(v, { at: d * 0.2, dur: d * 0.6, f0: 2400, f1: 5200, f2: 3000, peakAt: 0.4, Q: 1.6, level: 0.35 });
      v.layer(v.pick(v.b.shing), { at: d * 0.3, rate: v.rnd(0.72, 0.8) * v.p, env: [[0, 0], [0.02, 0.5], [0.6, 0.001]] });
      v.tone('sine', { f: v.F([[0, 90], [d, 56]]), env: [[0, 0], [d * 0.5, 0.16], [d, 0.001]] });
      return 0.7;
    },
  },

  // one crescent cutting someone
  moonCut: {
    gain: 0.5, send: 0.22, maxDur: 0.6, jitter: 0.06, minInterval: 0.04,
    fn(v) {
      v.saturate(0.5);
      click(v, { hp: 3500, dur: 0.01, level: 0.8 });
      v.noise('white', { type: 'bandpass', Q: 2.4, f: v.F([[0, 7000], [0.08, 2200]]), env: [[0, 0], [0.003, 1], [0.08, 0.001]], level: 1.1 });
      v.layer(v.b.crystal, { rate: v.rnd(1.3, 1.6) * v.p, env: [[0, 0.5], [0.4, 0.001]] });
      thump(v, { f0: 160, f1: 70, drop: 0.04, dur: 0.12, level: 0.4 });
      return 0.5;
    },
  },

  // crescents bursting into the air: a glassy shimmer
  moonCrescent: {
    gain: 0.3, send: 0.35, maxDur: 1.0, jitter: 0.05, minInterval: 0.05,
    fn(v) {
      v.layer(v.b.crystal, { rate: v.pick([1, 1.19, 1.335]) * v.p, env: [[0, 0], [0.01, 0.6], [0.8, 0.001]] });
      v.layer(v.b.crystal, { at: 0.03, rate: v.pick([1.5, 1.78, 2]) * v.p, env: [[0, 0], [0.01, 0.35], [0.5, 0.001]] });
      whoosh(v, { dur: 0.22, f0: 3000, f1: 7000, f2: 4000, peakAt: 0.3, Q: 1.2, level: 0.25 });
      return 0.9;
    },
  },

  // 壹之型: the draw -- steel leaving the scabbard and a cut too fast to hear coming
  moonDraw: {
    path: 'hero', gain: 0.62, send: 0.3, maxDur: 1.2, jitter: 0.03,
    fn(v) {
      v.layer(v.pick(v.b.shing), { rate: v.rnd(0.92, 1.0) * v.p, env: [[0, 0.9], [0.9, 0.001]] });
      click(v, { hp: 4000, dur: 0.008, level: 1 });
      whoosh(v, { at: 0.02, dur: 0.14, f0: 1200, f1: 6000, f2: 2500, peakAt: 0.3, Q: 1.3, level: 1.1 });
      v.layer(v.b.crystal, { at: 0.05, rate: 0.9 * v.p, env: [[0, 0.5], [0.9, 0.001]] });
      thump(v, { at: 0.04, f0: 120, f1: 50, drop: 0.12, dur: 0.3, level: 0.5 });
      return 1.1;
    },
  },

  // the sword grows: flesh and steel groaning, a rising swell
  moonTransform: {
    path: 'hero', gain: 0.8, send: 0.45, maxDur: 3.2, jitter: 0.02,
    fn(v) {
      v.saturate(0.8);
      v.layer(v.b.revSwell, { rate: 0.7 * v.p, level: 0.9 });
      v.layer(v.pick(v.b.growl), { at: 0.2, rate: 0.55 * v.p, type: 'lowpass', f: 900, env: [[0, 0], [0.3, 0.8], [1.8, 0.001]] });
      v.tone('sawtooth', { at: 0.1, f: v.F([[0, 38], [2.2, 62]]), env: [[0, 0], [0.6, 0.35], [2.4, 0.001]], level: 0.6 });
      v.noise('pink', { at: 0.3, type: 'bandpass', Q: 1.5, f: v.F([[0, 300], [2, 1400]]), env: [[0, 0], [1.2, 0.5], [2.2, 0.001]], level: 0.9 });
      v.layer(v.b.taikoBig, { at: 2.1, rate: 0.7 * v.p, env: [[0, 0.8], [1, 0.001]] });
      return 3.1;
    },
  },

  // a moon dropping out of the sky onto its mark
  moonFall: {
    gain: 0.55, send: 0.3, maxDur: 1.0, jitter: 0.05, minInterval: 0.05,
    fn(v) {
      v.saturate(0.6);
      thump(v, { f0: 90, f1: 36, drop: 0.2, dur: 0.5, level: 0.9, atk: 0.003 });
      v.noise('white', { type: 'lowpass', Q: 0.6, f: v.F([[0, 5000], [0.4, 300]]), env: [[0, 0], [0.004, 1], [0.45, 0.001]], level: 0.8 });
      v.layer(v.b.crystal, { rate: v.rnd(0.8, 1.0) * v.p, env: [[0, 0.45], [0.6, 0.001]] });
      return 0.8;
    },
  },

  // his six eyes on you: a thin, cold ring
  moonRead: {
    path: 'hero', gain: 0.4, send: 0.5, maxDur: 1.6, jitter: 0.02,
    fn(v) {
      v.layer(v.b.chime, { rate: 1.498 * v.p, env: [[0, 0], [0.01, 0.5], [1.2, 0.001]] });
      v.tone('sine', { f: v.F([[0, 1800], [0.4, 1700]]), env: [[0, 0], [0.01, 0.25], [0.5, 0.001]] });
      v.noise('white', { type: 'highpass', f: 8000, env: [[0, 0], [0.02, 0.3], [0.25, 0.001]] });
      return 1.4;
    },
  },

  // moons whirling round him
  moonVortex: {
    gain: 0.55, send: 0.35, maxDur: 1.4, jitter: 0.04,
    fn(v) {
      const d = 0.9;
      v.noise('pink', { dur: d, type: 'bandpass', Q: 1.4, f: v.F([[0, 500], [d * 0.5, 2200], [d, 900]]), env: [[0, 0], [d * 0.3, 1], [d, 0.001]], level: 1.1, am: [v.rnd(9, 13), 0.6] });
      v.layer(v.b.crystal, { rate: 0.8 * v.p, env: [[0, 0], [0.05, 0.4], [1.0, 0.001]] });
      v.layer(v.b.crystal, { at: 0.15, rate: 1.2 * v.p, env: [[0, 0], [0.05, 0.3], [0.8, 0.001]] });
      return 1.2;
    },
  },
};
