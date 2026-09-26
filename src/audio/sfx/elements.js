// Water Breathing and Hinokami Kagura technique sounds.

import { whoosh, thump } from './common.js';

export default {
  waterSplash: {
    gain: 0.572, send: 0.28, maxDur: 0.7, jitter: 0.06,
    fn(v) {
      thump(v, { f0: 360, f1: 140, drop: 0.05, dur: 0.08, level: 0.5, atk: 0.003 });
      v.noise('white', { type: 'highpass', f: 1400 * v.p, env: [[0, 0], [0.006, 1], [0.4, 0.001]], level: 0.5 });
      v.layer(v.b.bubbles, {
        offset: 'rand', rate: v.rnd(0.9, 1.2) * v.p, type: 'bandpass', f: 1800, Q: 0.6,
        env: [[0, 0], [0.03, 1], [0.5, 0.001]],
      });
      v.layer(v.b.water, { offset: 'rand', type: 'lowpass', f: 3000, env: [[0, 0], [0.02, 1.1], [0.4, 0.001]] });
      return 0.6;
    },
  },

  waterWave: {
    path: 'hero', gain: 0.572, send: 0.32, maxDur: 1.2, jitter: 0.04,
    fn(v) {
      const d = 1.05;
      const pan = v.panSweep([[0, -0.45], [d, 0.45]]);
      v.layer(v.b.water, {
        offset: 'rand', type: 'bandpass', Q: 0.6, f: v.F([[0, 500], [0.45, 2200], [d, 900]]),
        env: [[0, 0], [0.35, 1], [0.6, 0.8], [d, 0.001]], level: 1.3, to: pan,
      });
      v.noise('white', { type: 'highpass', f: 3500, env: [[0, 0], [0.4, 0.28], [d, 0.001]], to: pan });
      v.layer(v.b.bubbles, {
        offset: 'rand', type: 'bandpass', f: 1200, Q: 0.7, env: [[0, 0], [0.5, 0.6], [d, 0.001]], to: pan,
      });
      v.noise('brown', { type: 'lowpass', f: 300, env: [[0, 0], [0.4, 1.2], [d, 0.001]] });
      return d + 0.05;
    },
  },

  waterDragon: {
    path: 'hero', gain: 0.392, send: 0.4, maxDur: 1.8, jitter: 0.03,
    fn(v) {
      const d = 1.55;
      v.noise('brown', {
        type: 'lowpass', f: v.F([[0, 150], [0.5, 420], [d, 200]]),
        env: [[0, 0], [0.3, 1.2], [1.0, 1.0], [d, 0.001]], level: 1.2,
      });
      v.layer(v.b.water, {
        offset: 'rand', type: 'bandpass', Q: 0.7, f: v.F([[0, 400], [0.6, 1700], [d, 700]]),
        env: [[0, 0], [0.25, 1], [1.1, 0.9], [d, 0.001]], level: 1.3, am: [7.5, 0.3],
      });
      v.noise('white', { type: 'highpass', f: 3000, env: [[0, 0], [0.5, 0.5], [d, 0.001]] });
      v.layer(v.b.bubbles, { offset: 'rand', type: 'bandpass', f: 900, Q: 0.7, env: [[0, 0], [0.4, 0.7], [d, 0.001]] });
      v.layer(v.pick(v.b.roar), {
        rate: 0.55 * v.p, type: 'lowpass', f: 900, env: [[0, 0], [0.3, 0.45], [1.2, 0.35], [d, 0.001]],
      });
      thump(v, { f0: 56, f1: 38, drop: d, dur: d, level: 0.8, atk: 0.3 });
      return d + 0.05;
    },
  },

  calm: {
    path: 'hero', gain: 0.738, send: 0.5, maxDur: 3.5, jitter: 0.01,
    fn(v) {
      // Dead Calm: the world hushes (world sfx + music ducked; this voice is on the hero path).
      v.e.duck(0.6, 2.2);
      v.tone('sine', { f: v.F([[0, 1150], [0.035, 2350]]), env: [[0, 0], [0.002, 0.9], [0.09, 0.001]] });
      v.layer(v.b.chime, {
        at: 0.08, rate: v.pick([1, 1.335, 1.498]) * v.p, env: [[0, 0], [0.02, 0.35], [3.0, 0.001]],
      });
      thump(v, { f0: 66, f1: 31, drop: 1.8, dur: 1.9, level: 0.3, atk: 0.2 });
      v.sendMul = 5;
      return 3.12;
    },
  },

  fireBurst: {
    path: 'hero', gain: 0.747, send: 0.28, maxDur: 0.75, jitter: 0.05,
    fn(v) {
      v.saturate();
      v.noise('white', {
        type: 'bandpass', Q: 0.7, f: v.F([[0, 4000], [0.5, 600]]),
        env: [[0, 0], [0.008, 1], [0.55, 0.001]], level: 0.9,
      });
      v.layer(v.b.fire, {
        offset: 'rand', rate: v.p, type: 'lowpass', f: v.F([[0, 2600], [0.6, 500]]),
        env: [[0, 0], [0.02, 1.3], [0.6, 0.001]],
      });
      v.layer(v.b.crackle, { offset: 'rand', type: 'highpass', f: 2000, env: [[0, 0.9], [0.6, 0.001]] });
      thump(v, { f0: 100, f1: 45, drop: 0.1, dur: 0.26, level: 0.8 });
      return 0.65;
    },
  },

  fireWhoosh: {
    path: 'hero', gain: 0.832, send: 0.24, maxDur: 0.75, jitter: 0.05,
    fn(v) {
      const d = 0.6;
      whoosh(v, { kind: 'pink', dur: d, f0: 400, f1: 1400, f2: 650, peakAt: 0.35, Q: 0.9, level: 1.2 });
      v.layer(v.b.fire, {
        offset: 'rand', rate: v.p, type: 'lowpass', f: 1800,
        env: [[0, 0], [0.15, 1.2], [d, 0.001]], am: [11, 0.25],
      });
      v.layer(v.b.crackle, { offset: 'rand', type: 'highpass', f: 2200, env: [[0, 0], [0.1, 0.7], [d, 0.001]] });
      return d + 0.05;
    },
  },

  fireDragon: {
    path: 'hero', gain: 0.482, send: 0.38, maxDur: 2.0, jitter: 0.03,
    fn(v) {
      const d = 1.8;
      v.layer(v.b.fire, {
        offset: 'rand', rate: v.p, type: 'lowpass', f: v.F([[0, 600], [0.6, 2800], [d, 700]]),
        env: [[0, 0], [0.3, 1.3], [1.3, 1.1], [d, 0.001]], am: [9, 0.3],
      });
      v.noise('brown', { type: 'lowpass', f: 260, env: [[0, 0], [0.3, 1.2], [d, 0.001]] });
      whoosh(v, { dur: d, f0: 300, f1: 2500, f2: 900, peakAt: 0.45, Q: 0.8, level: 0.6 });
      v.layer(v.b.crackle, { offset: 'rand', type: 'highpass', f: 2000, env: [[0, 0], [0.2, 0.9], [d, 0.001]] });
      v.layer(v.pick(v.b.roar), {
        rate: 0.62 * v.p, type: 'lowpass', f: 1200, env: [[0, 0], [0.25, 0.55], [1.3, 0.45], [d, 0.001]],
      });
      thump(v, { f0: 52, f1: 36, drop: d, dur: d, level: 0.8, atk: 0.25 });
      return d + 0.05;
    },
  },
};
