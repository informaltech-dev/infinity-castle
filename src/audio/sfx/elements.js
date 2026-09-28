// Breathing-style technique sounds: water, fire (Hinokami Kagura and Flame Breathing), serpent, wind and stone.

import { whoosh, thump, click } from './common.js';

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

  // Flame Tiger: a roaring beast of fire bursting out of the cut.
  tigerRoar: {
    path: 'hero', gain: 0.52, send: 0.34, maxDur: 1.4, jitter: 0.03,
    fn(v) {
      const d = 1.2;
      v.saturate(0.55);
      v.layer(v.pick(v.b.roar), {
        rate: v.rnd(0.72, 0.8) * v.p, type: 'lowpass', f: v.F([[0, 2400], [d, 700]]),
        env: [[0, 0], [0.06, 1.2], [0.5, 0.9], [d, 0.001]], level: 1.1,
      });
      v.layer(v.b.fire, {
        offset: 'rand', rate: v.p, type: 'lowpass', f: v.F([[0, 1200], [0.3, 3200], [d, 800]]),
        env: [[0, 0], [0.08, 1.3], [d, 0.001]], am: [13, 0.3],
      });
      whoosh(v, { kind: 'pink', dur: 0.8, f0: 300, f1: 1800, f2: 500, peakAt: 0.25, Q: 0.8, level: 0.9 });
      thump(v, { f0: 80, f1: 38, drop: 0.5, dur: 0.9, level: 0.9, atk: 0.02 });
      return d + 0.05;
    },
  },

  // Serpent Breathing: a thin, fast cut with a hissing tail.
  swingSerpent: {
    gain: 0.36, send: 0.14, maxDur: 0.45, jitter: 0.06,
    fn(v) {
      const d = v.rnd(0.18, 0.24);
      whoosh(v, { dur: d, f0: 900, f1: v.rnd(3200, 3900), f2: 1900, peakAt: 0.38, Q: v.rnd(1.2, 1.6), level: 0.9 });
      v.noise('white', {
        at: d * 0.3, type: 'bandpass', Q: 1.2, f: v.F([[0, 5200], [d, 7400]]),
        env: [[0, 0], [d * 0.3, 0.55], [d + 0.14, 0.001]], am: [34, 0.45],
      });
      return d + 0.17;
    },
  },

  // Kaburamaru's hiss.
  serpentHiss: {
    path: 'hero', gain: 0.3, send: 0.2, maxDur: 0.9, jitter: 0.05,
    fn(v) {
      const d = v.rnd(0.55, 0.7);
      v.noise('white', {
        type: 'bandpass', Q: 0.9, f: v.F([[0, 3800], [0.12, 6200], [d, 5200]]),
        env: [[0, 0], [0.05, 1], [d * 0.6, 0.7], [d, 0.001]], am: [22, 0.35],
      });
      v.noise('white', { type: 'highpass', f: 8000, env: [[0, 0], [0.08, 0.35], [d, 0.001]] });
      v.noise('pink', { type: 'bandpass', Q: 1.4, f: 1500, env: [[0, 0], [0.04, 0.25], [0.2, 0.001]] });
      return d + 0.05;
    },
  },

  // Wind Breathing: a sharp cut with the wind whistling behind the blade.
  swingWind: {
    gain: 0.36, send: 0.14, maxDur: 0.45, jitter: 0.06,
    fn(v) {
      const d = v.rnd(0.18, 0.24);
      whoosh(v, { dur: d, f0: 800, f1: v.rnd(3000, 3800), f2: 1500, peakAt: 0.4, Q: v.rnd(1.0, 1.4), level: 0.9 });
      whoosh(v, { at: d * 0.2, dur: d + 0.12, f0: 2400, f1: 5200, f2: 3000, peakAt: 0.35, Q: 4, level: 0.32 });
      v.noise('pink', { type: 'lowpass', f: 900, env: [[0, 0], [d * 0.4, 0.4], [d + 0.1, 0.001]] });
      return d + 0.14;
    },
  },

  // A gust bursting out: a fluttering rush of air.
  windGust: {
    path: 'hero', gain: 0.42, send: 0.3, maxDur: 0.9, jitter: 0.05,
    fn(v) {
      const d = 0.6;
      const pan = v.panSweep([[0, -0.3], [d, 0.3]]);
      v.noise('pink', { type: 'bandpass', Q: 0.8, f: v.F([[0, 400], [0.2, 1600], [d, 500]]), env: [[0, 0], [0.12, 1.2], [d, 0.001]], am: [14, 0.35], to: pan });
      v.noise('white', { type: 'highpass', f: 3000, env: [[0, 0], [0.1, 0.35], [d * 0.8, 0.001]], to: pan });
      whoosh(v, { dur: d * 0.7, f0: 1200, f1: 3400, f2: 1800, peakAt: 0.3, Q: 2.5, level: 0.3 });
      return d + 0.05;
    },
  },

  // Four claws of wind flung off one cut, whistling away one after another.
  windClaw: {
    path: 'hero', gain: 0.4, send: 0.25, maxDur: 0.8, jitter: 0.04,
    fn(v) {
      for (let i = 0; i < 4; i++) {
        whoosh(v, { at: i * 0.035, dur: 0.32, f0: 1500 + i * 200, f1: 4200 + i * 300, f2: 2000, peakAt: 0.25, Q: 2.2, level: 0.55 });
      }
      v.noise('pink', { type: 'bandpass', Q: 0.7, f: v.F([[0, 600], [0.5, 1400]]), env: [[0, 0], [0.06, 0.8], [0.6, 0.001]], am: [18, 0.3] });
      return 0.65;
    },
  },

  // A storm getting up: howling resonances over a low roar.
  windHowl: {
    path: 'hero', gain: 0.46, send: 0.4, maxDur: 1.8, jitter: 0.03,
    fn(v) {
      const d = 1.4;
      v.noise('pink', { type: 'bandpass', Q: 6, f: v.F([[0, 500], [0.35, 900], [0.8, 700], [d, 400]]), env: [[0, 0], [0.25, 1.1], [0.9, 0.8], [d, 0.001]], am: [5, 0.25] });
      v.noise('pink', { type: 'bandpass', Q: 5, f: v.F([[0, 800], [0.4, 1400], [d, 600]]), env: [[0, 0], [0.3, 0.6], [d, 0.001]], am: [7, 0.3] });
      v.noise('brown', { type: 'lowpass', f: 250, env: [[0, 0], [0.2, 1.1], [d, 0.001]] });
      v.noise('white', { type: 'highpass', f: 4000, env: [[0, 0], [0.15, 0.25], [d * 0.7, 0.001]] });
      thump(v, { f0: 60, f1: 40, drop: 0.5, dur: 0.8, level: 0.5, atk: 0.05 });
      return d + 0.05;
    },
  },

  // Stone Breathing: the iron ball whirled on its chain -- a heavy, pulsing rush of air.
  flailWhirl: {
    gain: 0.5, send: 0.2, maxDur: 0.8, jitter: 0.05,
    fn(v) {
      const d = 0.55;
      v.noise('pink', { type: 'bandpass', Q: 0.9, f: v.F([[0, 220], [0.25, 900], [d, 300]]), env: [[0, 0], [0.18, 1.2], [d, 0.001]], am: [9, 0.55] });
      whoosh(v, { kind: 'pink', dur: d, f0: 180, f1: 700, f2: 240, peakAt: 0.4, Q: 0.8, level: 0.8 });
      v.tone('sine', { f: v.F([[0, 70], [d, 52]]), env: [[0, 0], [0.2, 0.25], [d, 0.001]] });
      return d + 0.05;
    },
  },

  // The chain running out through his hands: a jingling rattle of iron links.
  chainRattle: {
    gain: 0.36, send: 0.16, maxDur: 0.6, jitter: 0.06,
    fn(v) {
      for (let i = 0; i < 9; i++) {
        const at = v.rnd(0, 0.32);
        click(v, { at, type: 'bandpass', hp: v.rnd(2600, 5200), Q: 3, dur: 0.018, level: v.rnd(0.4, 0.9) });
        v.tone('sine', { at, f: v.rnd(2400, 4200), env: [[0, 0], [0.002, 0.12], [0.06, 0.001]] });
      }
      return 0.45;
    },
  },

  // The ball striking: a crushing, gritty thud.
  stoneHit: {
    gain: 1.0, send: 0.2, maxDur: 0.6, jitter: 0.05,
    fn(v) {
      v.saturate(0.7);
      const I = v.I;
      thump(v, { f0: 120, f1: 44, drop: 0.09, dur: 0.26 + 0.1 * I, level: 0.6 + 0.3 * I });
      v.noise('pink', { type: 'lowpass', f: 1200, Q: 0.7, env: [[0, 1], [0.1, 0.001]], level: 2 });
      v.noise('pink', { type: 'bandpass', f: 220 * v.p, Q: 1.2, env: [[0, 1], [0.08, 0.001]], level: 2 });
      v.layer(v.b.debris, { rate: v.rnd(1, 1.2), env: [[0, 0.8], [0.3, 0.001]], level: 0.8 });
      v.layer(v.b.crackle, { offset: 'rand', type: 'bandpass', f: 1800, Q: 0.9, env: [[0, 1], [0.12, 0.001]], level: 1.2 });
      return 0.5;
    },
  },

  // The ball coming down on the floor: rock splitting, rubble, a deep boom.
  stoneSmash: {
    path: 'hero', gain: 1.0, send: 0.34, maxDur: 1.6, jitter: 0.04,
    fn(v) {
      v.saturate();
      thump(v, { f0: 72, f1: 30, drop: 0.5, dur: 1.1, level: 1, atk: 0.004 });
      thump(v, { f0: 140, f1: 52, drop: 0.07, dur: 0.3, level: 0.9 });
      v.noise('white', { type: 'lowpass', Q: 0.6, f: v.F([[0, 3000], [0.6, 240]]), env: [[0, 0], [0.004, 1], [0.7, 0.001]], level: 1.2 });
      v.layer(v.pick(v.b.splinter), { rate: v.rnd(0.7, 0.85) * v.p, type: 'highpass', f: 500, env: [[0, 1], [0.6, 0.001]], level: 1.1 });
      v.layer(v.b.debris, { at: 0.08, rate: v.rnd(0.85, 1.0), env: [[0, 1.1], [1.2, 0.001]] });
      v.noise('brown', { type: 'lowpass', f: 200, env: [[0, 0], [0.05, 1], [1.2, 0.001]], level: 1.1 });
      return 1.4;
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
