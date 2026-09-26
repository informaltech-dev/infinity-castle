// Player sword, movement and hit-feel sounds.
// Each entry: { fn(v) -> seconds, path, gain, send, jitter, minInterval, maxVoices, maxDur }

import { whoosh, thump, click } from './common.js';

export default {
  swingLight: {
    gain: 0.288, send: 0.12, maxDur: 0.3, jitter: 0.06,
    fn(v) {
      const d = v.rnd(0.16, 0.22);
      whoosh(v, { dur: d, f0: 700, f1: v.rnd(2800, 3600), f2: 1600, peakAt: 0.42, Q: v.rnd(0.9, 1.4) });
      v.noise('white', {
        at: d * 0.25, type: 'highpass', f: 6500 * v.p,
        env: [[0, 0], [d * 0.2, 1], [d * 0.6, 0.001]], level: 0.3,
      });
      return d + 0.03;
    },
  },

  swingHeavy: {
    gain: 0.49, send: 0.15, maxDur: 0.55, jitter: 0.05,
    fn(v) {
      const d = v.rnd(0.36, 0.44);
      whoosh(v, { kind: 'pink', dur: d, f0: 300, f1: 1500, f2: 500, peakAt: 0.5, Q: 0.8, level: 1.4 });
      whoosh(v, { at: d * 0.3, dur: d * 0.55, f0: 1800, f1: 4200, f2: 2400, peakAt: 0.4, Q: 1.5, level: 0.35 });
      v.tone('sine', { f: v.F([[0, 95], [d, 58]]), env: [[0, 0], [d * 0.5, 0.18], [d, 0.001]] });
      return d + 0.03;
    },
  },

  swingWater: {
    gain: 0.42, send: 0.22, maxDur: 0.6, jitter: 0.05,
    fn(v) {
      const d = v.rnd(0.26, 0.32);
      whoosh(v, { dur: d, f0: 600, f1: 2600, f2: 1300, peakAt: 0.45, Q: 1.1, level: 0.8 });
      v.layer(v.b.bubbles, {
        at: 0.03, offset: 'rand', rate: v.rnd(0.9, 1.25) * v.p, type: 'bandpass', f: 1500 * v.p, Q: 0.7,
        env: [[0, 0], [d * 0.5, 1], [d + 0.12, 0.001]], level: 0.9,
      });
      v.layer(v.b.water, {
        at: 0.02, offset: 'rand', rate: v.p, type: 'highpass', f: 2200, Q: 0.7,
        env: [[0, 0], [d * 0.5, 0.7], [d + 0.1, 0.001]],
      });
      return d + 0.17;
    },
  },

  swingFire: {
    gain: 0.46, send: 0.18, maxDur: 0.65, jitter: 0.05,
    fn(v) {
      const d = v.rnd(0.34, 0.42);
      whoosh(v, { dur: d, f0: 500, f1: 2400, f2: 1000, peakAt: 0.4, Q: 1.0, level: 0.7 });
      v.layer(v.b.fire, {
        offset: 'rand', rate: v.p, type: 'lowpass', Q: 0.7,
        f: v.F([[0, 800], [d * 0.5, 2600], [d + 0.1, 700]]),
        env: [[0, 0], [d * 0.4, 1.3], [d + 0.1, 0.001]],
      });
      v.layer(v.b.crackle, {
        at: 0.05, offset: 'rand', type: 'highpass', f: 1800,
        env: [[0, 0], [0.05, 0.9], [d + 0.15, 0.001]],
      });
      return d + 0.22;
    },
  },

  hitSlash: {
    gain: 0.624, send: 0.2, maxDur: 0.7, jitter: 0.05,
    fn(v) {
      v.saturate(0.7);
      const I = v.I;
      click(v, { hp: 2500, dur: 0.012, level: 0.9 + 0.5 * I });
      const sd = 0.09 + 0.08 * I;
      v.noise('white', {
        type: 'bandpass', Q: 2.2, f: v.F([[0, 6500], [sd, 1800]]),
        env: [[0, 0], [0.003, 1], [sd, 0.001]], level: 1.3,
      });
      v.noise('pink', {
        at: 0.006, type: 'bandpass', Q: 4, f: v.F([[0, 2200], [0.14, 480]]),
        env: [[0, 0], [0.01, 1], [0.14 + 0.07 * I, 0.001]], level: 1.5 + 0.5 * I,
      });
      thump(v, { at: 0.006, f0: 150, f1: 55, drop: 0.06, dur: 0.13 + 0.1 * I, level: 0.42 + 0.38 * I });
      v.noise('pink', { at: 0.004, type: 'bandpass', f: 300 * v.p, Q: 1.2, env: [[0, 1], [0.06, 0.001]], level: 1.2 + 0.8 * I });
      if (I > 0.55) {
        const k = (I - 0.55) / 0.45;
        thump(v, { at: 0.012, f0: 72, f1: 33, drop: 0.25, dur: 0.35 + 0.25 * k, level: 0.8 * k, atk: 0.006 });
      }
      v.layer(v.pick(v.b.shing), { rate: v.rnd(1.05, 1.3) * v.p, env: [[0, 0.1 + 0.2 * I], [0.12, 0.001]] });
      return 0.4 + 0.22 * I;
    },
  },

  hitCrit: {
    path: 'hero', gain: 0.858, send: 0.28, maxDur: 0.8, jitter: 0.04,
    fn(v) {
      v.saturate();
      click(v, { hp: 3000, dur: 0.01, level: 1.4 });
      v.noise('white', {
        type: 'bandpass', Q: 2.5, f: v.F([[0, 8000], [0.16, 2000]]),
        env: [[0, 0], [0.002, 1], [0.17, 0.001]], level: 1.3,
      });
      v.layer(v.pick(v.b.shing), { rate: v.rnd(0.95, 1.08) * v.p, env: [[0, 1], [0.6, 0.001]], level: 1.0 });
      v.noise('pink', {
        at: 0.006, type: 'bandpass', Q: 3.5, f: v.F([[0, 2000], [0.15, 450]]),
        env: [[0, 0], [0.01, 1], [0.2, 0.001]], level: 1.4,
      });
      thump(v, { at: 0.008, f0: 170, f1: 48, drop: 0.07, dur: 0.32, level: 0.75 });
      thump(v, { at: 0.016, f0: 68, f1: 30, drop: 0.3, dur: 0.6, level: 0.65, atk: 0.008 });
      return 0.72;
    },
  },

  hitBlunt: {
    gain: 1.135, send: 0.18, maxDur: 0.55, jitter: 0.05,
    fn(v) {
      v.saturate();
      const I = v.I;
      click(v, { type: 'bandpass', hp: 1800, Q: 0.8, dur: 0.02, level: 1.0 });
      thump(v, { at: 0.005, f0: 115, f1: 42, drop: 0.08, dur: 0.2 + 0.08 * I, level: 0.4 + 0.25 * I });
      v.noise('pink', { type: 'lowpass', f: 1400, Q: 0.7, env: [[0, 1], [0.09, 0.001]], level: 2.0 });
      // mid 'thwack' body: keeps the weight audible on small speakers
      v.noise('pink', { type: 'bandpass', f: 260 * v.p, Q: 1.2, env: [[0, 1], [0.07, 0.001]], level: 2.2 });
      v.layer(v.b.crackle, {
        offset: 'rand', type: 'bandpass', f: 2400, Q: 0.9,
        env: [[0, 1], [0.1, 0.001]], level: 1.4 + 0.6 * I,
      });
      if (I > 0.6) thump(v, { at: 0.012, f0: 60, f1: 30, drop: 0.25, dur: 0.4, level: (I - 0.6) * 1.6, atk: 0.006 });
      return 0.46;
    },
  },

  clang: {
    path: 'hero', gain: 0.583, send: 0.4, maxDur: 2.5, jitter: 0.02,
    fn(v) {
      const rate = v.rnd(0.97, 1.04) * v.p;
      v.layer(v.pick(v.b.clang), { rate, env: [[0, 1], [1.8, 0.5], [2.08, 0.001]] });
      v.layer(v.pick(v.b.clang), { rate: rate * 1.5, env: [[0, 0.3], [0.8, 0.001]] });
      v.noise('white', { type: 'highpass', f: 7000, env: [[0, 1], [0.03, 0.001]], level: 0.6 });
      thump(v, { f0: 190, f1: 80, drop: 0.04, dur: 0.14, level: 0.55 });
      return 2.12;
    },
  },

  block: {
    gain: 0.679, send: 0.18, maxDur: 0.45, jitter: 0.04,
    fn(v) {
      v.saturate();
      v.layer(v.pick(v.b.clang), {
        rate: v.rnd(0.58, 0.66) * v.p, type: 'lowpass', f: 2600, Q: 0.7,
        env: [[0, 1], [0.3, 0.001]], level: 0.9,
      });
      thump(v, { f0: 150, f1: 60, drop: 0.05, dur: 0.16, level: 0.8 });
      v.noise('pink', { type: 'bandpass', f: 900 * v.p, Q: 1.2, env: [[0, 1], [0.06, 0.001]] });
      click(v, { type: 'bandpass', hp: 2500, Q: 1, dur: 0.01, level: 0.5 });
      return 0.36;
    },
  },

  guardBreak: {
    path: 'hero', gain: 0.984, send: 0.32, maxDur: 1.0, jitter: 0.03,
    fn(v) {
      v.saturate();
      thump(v, { f0: 78, f1: 30, drop: 0.3, dur: 0.75, level: 1.0, atk: 0.004 });
      v.noise('white', { type: 'lowpass', Q: 0.6, f: v.F([[0, 7000], [0.5, 500]]), env: [[0, 1], [0.55, 0.001]], level: 0.9 });
      v.layer(v.pick(v.b.splinter), {
        rate: v.rnd(1.0, 1.2) * v.p, type: 'highpass', f: 900, env: [[0, 1], [0.6, 0.001]],
      });
      v.layer(v.pick(v.b.clang), { rate: v.rnd(1.6, 1.8) * v.p, env: [[0, 0.55], [0.45, 0.001]] });
      v.layer(v.b.crackle, { offset: 'rand', type: 'highpass', f: 3500, env: [[0, 0.9], [0.35, 0.001]] });
      return 0.85;
    },
  },

  dodge: {
    gain: 0.547, send: 0.1, maxDur: 0.3, jitter: 0.07,
    fn(v) {
      const d = v.rnd(0.18, 0.24);
      whoosh(v, { kind: 'pink', dur: d, f0: 450, f1: 1700, f2: 800, peakAt: 0.35, Q: 1.0, level: 1.3 });
      v.noise('white', {
        type: 'bandpass', f: 2500 * v.p, Q: 0.9,
        env: [[0, 0], [d * 0.3, 1], [d, 0.001]], level: 0.35, am: [v.rnd(22, 32), 0.45],
      });
      return d + 0.03;
    },
  },

  perfectDodge: {
    path: 'hero', gain: 0.441, send: 0.45, maxDur: 2.2, jitter: 0.02,
    fn(v) {
      v.layer(v.b.revSwell, { rate: v.p, level: 0.9 });
      const lp = v.filter('lowpass', 1800, 1.2);
      v.pts(lp.frequency, [[0, 1800], [0.9, 280]], 0.52, 1, true);
      lp.connect(v.dest);
      v.tone('triangle', { at: 0.52, f: v.F([[0, 220], [0.9, 52]]), env: [[0, 0], [0.02, 0.9], [1.0, 0.001]], to: lp });
      thump(v, { at: 0.52, f0: 95, f1: 34, drop: 0.9, dur: 1.1, level: 0.85, atk: 0.03 });
      v.layer(v.b.crystal, { at: 0.5, rate: v.rnd(0.98, 1.03), env: [[0, 0.85], [1.6, 0.001]] });
      return 2.15;
    },
  },

  step: {
    gain: 0.234, send: 0.08, maxDur: 0.2, jitter: 0.02, minInterval: 0.03, maxVoices: 6,
    fn(v) {
      v.layer(v.pick(v.b.step), { rate: v.rnd(0.88, 1.12) * v.p, level: v.rnd(0.65, 1) });
      return 0.17;
    },
  },

  land: {
    gain: 0.349, send: 0.15, maxDur: 0.4, jitter: 0.04,
    fn(v) {
      v.saturate();
      v.layer(v.pick(v.b.step), { rate: v.rnd(0.7, 0.8) * v.p, level: 1.3 });
      thump(v, { f0: 90, f1: 42, drop: 0.06, dur: 0.2, level: 0.7 });
      v.noise('pink', { type: 'lowpass', f: 1200, env: [[0, 0], [0.01, 0.6], [0.2, 0.001]] });
      return 0.3;
    },
  },

  decap: {
    path: 'hero', gain: 0.941, send: 0.3, maxDur: 0.6, jitter: 0.03,
    fn(v) {
      v.saturate();
      click(v, { hp: 3000, dur: 0.008, level: 1.4 });
      v.noise('white', {
        type: 'bandpass', Q: 3.5, f: v.F([[0, 8500], [0.07, 2600]]),
        env: [[0, 0], [0.002, 1], [0.1, 0.001]], level: 1.5,
      });
      v.layer(v.pick(v.b.shing), { rate: v.rnd(1.05, 1.15) * v.p, env: [[0, 0.8], [0.4, 0.001]] });
      v.noise('pink', {
        at: 0.035, type: 'bandpass', Q: 3, f: v.F([[0, 1300], [0.12, 300]]),
        env: [[0, 0], [0.006, 1.4], [0.2, 0.001]],
      });
      thump(v, { at: 0.04, f0: 125, f1: 45, drop: 0.07, dur: 0.32, level: 0.8 });
      v.layer(v.b.bubbles, { at: 0.04, offset: 'rand', type: 'bandpass', f: 900, Q: 0.8, env: [[0, 1], [0.15, 0.001]] });
      return 0.52;
    },
  },

  impactFrame: {
    path: 'hero', gain: 1.022, send: 0.28, maxDur: 0.9, jitter: 0.02,
    fn(v) {
      v.saturate();
      click(v, { hp: 4000, dur: 0.006, level: 1.3 });
      v.tone('sine', { f: 4200 * v.p, env: [[0, 0], [0.001, 0.35], [0.03, 0.001]] });
      v.noise('white', { type: 'bandpass', f: 1500, Q: 1, env: [[0, 0.9], [0.035, 0.001]] });
      thump(v, { f0: 64, f1: 28, drop: 0.5, dur: 0.8, level: 1.2, atk: 0.004 });
      thump(v, { f0: 155, f1: 60, drop: 0.05, dur: 0.15, level: 0.7 });
      v.noise('pink', { type: 'bandpass', f: 350, Q: 0.8, env: [[0, 1], [0.08, 0.001]], level: 1.2 });
      v.noise('white', { type: 'highpass', f: 3000, env: [[0, 0.8], [0.05, 0.001]] });
      return 0.85;
    },
  },

  finisher: {
    path: 'hero', gain: 0.999, send: 0.5, maxDur: 2.3, jitter: 0.02,
    fn(v) {
      v.saturate();
      v.noise('white', {
        type: 'bandpass', Q: 1.8, f: v.F([[0, 9000], [0.35, 1500]]),
        env: [[0, 0], [0.004, 1.5], [0.4, 0.001]],
      });
      v.noise('pink', {
        type: 'bandpass', Q: 1.2, f: v.F([[0, 5000], [0.35, 800]]),
        env: [[0, 0], [0.01, 1.3], [0.45, 0.001]],
      });
      v.layer(v.pick(v.b.shing), { rate: 0.9 * v.p, env: [[0, 1], [0.8, 0.001]] });
      v.layer(v.pick(v.b.clang), { at: 0.02, rate: 0.75 * v.p, env: [[0, 0.5], [1.8, 0.001]] });
      thump(v, { at: 0.05, f0: 58, f1: 24, drop: 1.2, dur: 1.95, level: 1.2, atk: 0.005 });
      v.layer(v.b.taikoBig, { at: 0.05, rate: 0.75, env: [[0, 0.9], [1.8, 0.2], [2.1, 0.001]] });
      v.sendMul = 2;
      return 2.2;
    },
  },
};
