// Akaza (Upper Moon Three): fists, shockwaves, the compass-needle technique, roars.

import { whoosh, thump, click } from './common.js';

export default {
  punchWhoosh: {
    gain: 0.304, send: 0.1, maxDur: 0.2, jitter: 0.06,
    fn(v) {
      const d = v.rnd(0.11, 0.15);
      whoosh(v, { dur: d, f0: 700, f1: 2600, f2: 1800, peakAt: 0.6, Q: 1.3 });
      v.tone('sine', { f: v.F([[0, 130], [d, 70]]), env: [[0, 0], [d * 0.5, 0.3], [d, 0.001]] });
      return d + 0.03;
    },
  },

  punchHit: {
    gain: 0.601, send: 0.22, maxDur: 0.6, jitter: 0.04,
    fn(v) {
      v.saturate(0.7);
      const I = v.I;
      click(v, { hp: 2000, dur: 0.01, level: 1.1 });
      // air-pressure pop
      thump(v, { f0: 270, f1: 90, drop: 0.03, dur: 0.07, level: 0.9, atk: 0.0015 });
      v.noise('white', { type: 'bandpass', f: 600, Q: 0.6, env: [[0, 0], [0.004, 1], [0.09, 0.001]], level: 1.4 });
      thump(v, { at: 0.008, f0: 108, f1: 42, drop: 0.07, dur: 0.22, level: 0.5 + 0.2 * I });
      v.noise('pink', { type: 'lowpass', f: 1600, env: [[0, 1], [0.07, 0.001]], level: 1.8 });
      v.noise('pink', { type: 'bandpass', f: 240 * v.p, Q: 1.2, env: [[0, 1], [0.08, 0.001]], level: 2.2 });
      if (I > 0.35) thump(v, { at: 0.014, f0: 62, f1: 30, drop: 0.3, dur: 0.5, level: (I - 0.35) * 1.2, atk: 0.006 });
      return 0.56;
    },
  },

  shockwave: {
    gain: 0.94, send: 0.32, maxDur: 1.0, jitter: 0.04,
    fn(v) {
      v.saturate();
      thump(v, { f0: 66, f1: 28, drop: 0.4, dur: 0.9, level: 1.1, atk: 0.005 });
      v.noise('white', {
        type: 'lowpass', Q: 0.6, f: v.F([[0, 9000], [0.6, 300]]),
        env: [[0, 0], [0.004, 1], [0.65, 0.001]], level: 0.9,
      });
      v.noise('pink', {
        type: 'bandpass', Q: 1.2, f: v.F([[0, 800], [0.12, 2600], [0.5, 1000]]),
        env: [[0, 0], [0.08, 0.8], [0.5, 0.001]],
      });
      click(v, { hp: 3000, dur: 0.015, level: 0.7 });
      return 0.95;
    },
  },

  groundSlam: {
    gain: 1.2, send: 0.38, maxDur: 1.8, jitter: 0.03,
    fn(v) {
      v.saturate();
      thump(v, { f0: 58, f1: 26, drop: 0.6, dur: 1.3, level: 1.0, atk: 0.004 });
      thump(v, { f0: 125, f1: 48, drop: 0.08, dur: 0.36, level: 1.0 });
      v.noise('white', {
        type: 'lowpass', Q: 0.6, f: v.F([[0, 3500], [0.8, 220]]),
        env: [[0, 0], [0.004, 1], [0.85, 0.001]], level: 1.3,
      });
      v.layer(v.pick(v.b.splinter), {
        rate: v.rnd(0.85, 1.05) * v.p, type: 'highpass', f: 600, env: [[0, 1], [0.7, 0.001]], level: 1.3,
      });
      v.layer(v.b.debris, { at: 0.12, rate: v.rnd(0.9, 1.1), env: [[0, 1.0], [1.2, 0.001]] });
      v.layer(v.b.taikoBig, { rate: 0.8 * v.p, env: [[0, 0.5], [1.3, 0.15], [1.55, 0.001]] });
      return 1.6;
    },
  },

  crack: {
    gain: 0.791, send: 0.3, maxDur: 0.8, jitter: 0.06,
    fn(v) {
      v.saturate(0.8);
      v.layer(v.pick(v.b.splinter), {
        rate: v.rnd(1.0, 1.25) * v.p, type: 'highpass', f: 800, env: [[0, 1], [0.6, 0.001]],
      });
      v.layer(v.b.creak, {
        offset: 'rand', rate: v.rnd(0.9, 1.1), type: 'bandpass', f: 700, Q: 1,
        env: [[0, 0], [0.05, 0.6], [0.5, 0.001]],
      });
      thump(v, { f0: 140, f1: 60, drop: 0.06, dur: 0.12, level: 0.3 });
      return 0.65;
    },
  },

  barrage: {
    gain: 0.171, send: 0.04, maxDur: 0.12, jitter: 0.08, minInterval: 0.04, maxVoices: 6, priority: 0.5,
    fn(v) {
      v.layer(v.pick(v.b.punch), { rate: v.rnd(0.85, 1.2) * v.p, level: v.rnd(0.6, 1) });
      return 0.1;
    },
  },

  compass: {
    path: 'hero', gain: 0.425, send: 0.45, maxDur: 1.8, jitter: 0.01,
    fn(v) {
      const d = 1.6;
      const lp = v.filter('lowpass', 200, 6);
      v.pts(lp.frequency, v.F([[0, 200], [0.9, 950], [d, 300]]), 0, 1, true);
      const hum = v.gain(0);
      v.pts(hum.gain, [[0, 0], [0.8, 0.5], [1.2, 0.45], [d, 0.001]]);
      lp.connect(hum);
      hum.connect(v.dest);
      v.tone('sawtooth', { f: 73.42 * v.p, dur: d, to: lp });
      v.tone('sawtooth', { f: 110.3 * v.p, dur: d, level: 0.7, to: lp });
      thump(v, { f0: 36.7, f1: 36.7, dur: d, level: 0.55, atk: 0.8 });
      v.layer(v.b.chime, { rate: 2 * v.p, env: [[0, 0.6], [1.0, 0.001]] });
      v.layer(v.b.crystal, { at: 0.05, rate: v.p, env: [[0, 0], [0.1, 1], [d, 0.001]] });
      v.layer(v.b.crystal, { at: 0.4, rate: 1.5 * v.p, env: [[0, 0], [0.2, 0.55], [1.2, 0.001]] });
      return d + 0.05;
    },
  },

  bossCharge: {
    path: 'hero', gain: 0.284, send: 0.3, maxDur: 1.15, jitter: 0.02,
    fn(v) {
      const d = 1.0;
      const lp = v.filter('lowpass', 200, 4);
      v.pts(lp.frequency, v.F([[0, 200], [d, 3000]]), 0, 1, true);
      const g = v.gain(0);
      v.pts(g.gain, [[0, 0], [0.1, 0.5], [d * 0.95, 0.9], [d, 0.001]]);
      lp.connect(g);
      g.connect(v.dest);
      const f = v.F([[0, 48], [d, 150]]);
      v.tone('sawtooth', { f, dur: d, to: lp });
      v.tone('sawtooth', { f, dur: d, level: 0.8, detune: 21, to: lp });
      v.noise('white', {
        type: 'bandpass', Q: 2, f: v.F([[0, 300], [d, 5000]]),
        env: [[0, 0], [d * 0.9, 0.7], [d, 0.001]], am: [9, 0.35],
      });
      v.noise('brown', { type: 'lowpass', f: 200, env: [[0, 0], [0.3, 0.8], [d, 0.001]] });
      return d + 0.03;
    },
  },

  bossRoar: {
    path: 'hero', gain: 0.306, send: 0.32, maxDur: 1.45, jitter: 0.03,
    fn(v) {
      v.layer(v.pick(v.b.roar), { rate: v.rnd(0.94, 1.04) * v.p });
      thump(v, { f0: 55, f1: 45, drop: 1.2, dur: 1.25, level: 0.5, atk: 0.1 });
      v.noise('pink', { type: 'lowpass', f: 900, env: [[0, 0], [0.05, 0.35], [1.2, 0.001]] });
      return 1.4;
    },
  },
};
