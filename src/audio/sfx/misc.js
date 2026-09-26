// Demons, player voice, Nakime's biwa, castle sounds, UI and ultimate / finisher stings.

import { thump, biwaNote } from './common.js';

const MIYAKO = [0, 1, 5, 7, 8, 12, 13];

export default {
  demonGrowl: {
    gain: 0.232, send: 0.22, maxDur: 1.05, jitter: 0.05,
    fn(v) {
      const dur = v.rnd(0.6, 1.0);
      v.layer(v.pick(v.b.growl), {
        rate: v.rnd(0.85, 1.1) * v.p, offset: v.rnd(0, 0.08),
        env: [[0, 1], [dur - 0.12, 1], [dur, 0.001]],
      });
      return dur + 0.02;
    },
  },

  demonHurt: {
    gain: 0.149, send: 0.18, maxDur: 0.45, jitter: 0.06,
    fn(v) {
      v.layer(v.pick(v.b.snarl), { rate: v.rnd(0.9, 1.15) * v.p });
      thump(v, { f0: 120, f1: 60, drop: 0.05, dur: 0.12, level: 0.35 });
      return 0.42;
    },
  },

  demonDeath: {
    gain: 0.713, send: 0.3, maxDur: 1.4, jitter: 0.04,
    fn(v) {
      const d = 1.25;
      v.layer(v.b.grains, {
        offset: 'rand', rate: v.p, type: 'highpass', f: 2500,
        env: [[0, 0], [0.08, 0.7], [0.5, 0.55], [d, 0.001]],
      });
      v.noise('white', { type: 'highpass', f: 5000, env: [[0, 0], [0.1, 0.15], [d, 0.001]] });
      v.noise('pink', { type: 'bandpass', Q: 0.8, f: v.F([[0, 1100], [d, 350]]), env: [[0, 0], [0.25, 1.0], [d, 0.001]] });
      v.layer(v.pick(v.b.snarl), { rate: 0.6 * v.p, type: 'lowpass', f: 800, env: [[0, 0.4], [0.4, 0.001]] });
      return d + 0.05;
    },
  },

  spawn: {
    gain: 0.45, send: 0.35, maxDur: 1.1, jitter: 0.05,
    fn(v) {
      const d = 1.0;
      v.noise('brown', {
        type: 'bandpass', Q: 0.9, f: v.F([[0, 180], [0.6, 800], [d, 250]]),
        env: [[0, 0], [0.55, 1.2], [d, 0.001]],
      });
      v.noise('white', { type: 'bandpass', f: 3200, Q: 1.5, env: [[0, 0], [0.5, 0.35], [d, 0.001]] });
      thump(v, { f0: 45, f1: 60, drop: d, dur: d, level: 0.6, atk: 0.6 });
      v.layer(v.pick(v.b.growl), { rate: 0.7, type: 'lowpass', f: 600, env: [[0, 0], [0.5, 0.3], [d, 0.001]] });
      return d + 0.05;
    },
  },

  playerHurt: {
    path: 'hero', gain: 0.361, send: 0.14, maxDur: 0.4, jitter: 0.03,
    fn(v) {
      v.layer(v.pick(v.b.grunt), { rate: v.rnd(0.95, 1.08) * v.p });
      thump(v, { f0: 110, f1: 55, drop: 0.05, dur: 0.16, level: 0.8 });
      v.noise('white', { type: 'bandpass', f: 1500, Q: 0.9, env: [[0, 0.8], [0.02, 0.001]] });
      return 0.34;
    },
  },

  playerDeath: {
    path: 'hero', gain: 0.913, send: 0.4, maxDur: 3.2, jitter: 0.02,
    fn(v) {
      v.saturate();
      thump(v, { f0: 78, f1: 35, drop: 0.12, dur: 0.6, level: 1.1, atk: 0.004 });
      v.noise('pink', { type: 'lowpass', f: 500, env: [[0, 0], [0.01, 1], [0.35, 0.001]] });
      v.layer(v.pick(v.b.step), { rate: 0.6 });
      thump(v, { at: 0.18, f0: 92, f1: 45, drop: 0.05, dur: 0.25, level: 0.5 });
      v.tone('sine', { at: 0.1, f: 3150, env: [[0, 0], [0.3, 0.07], [2.8, 0.001]] });
      v.layer(v.b.chime, { at: 0.05, rate: 0.5, env: [[0, 0], [0.1, 0.3], [2.9, 0.001]] });
      return 3.0;
    },
  },

  biwa: {
    path: 'hero', gain: 0.901, send: 0.38, maxDur: 2.8, jitter: 0.003,
    fn(v) {
      const note = v.note !== undefined ? v.note : v.pick(MIYAKO);
      const { buf, rate } = v.b.biwaFor(50 + note);
      const r = rate * v.p;
      v.layer(buf, { rate: r });
      return buf.duration / r;
    },
  },

  biwaShift: {
    path: 'hero', gain: 1.135, send: 0.45, maxDur: 2.0, jitter: 0.01,
    fn(v) {
      v.saturate();
      const chord = v.pick([[38, 45, 50], [38, 50, 57], [39, 46, 50]]);
      chord.forEach((m, i) => {
        const lv = 1 - i * 0.12;
        biwaNote(v, m, { at: i * v.rnd(0.012, 0.018), rate: v.p, env: [[0, lv], [1.6, 0.4 * lv], [1.92, 0.001]] });
      });
      v.noise('white', { type: 'bandpass', f: 2400, Q: 1, env: [[0, 1], [0.03, 0.001]], level: 0.9 });
      thump(v, { f0: 190, f1: 120, drop: 0.03, dur: 0.08, level: 0.8, atk: 0.001 });
      v.noise('brown', {
        at: 0.25, type: 'lowpass', f: v.F([[0, 120], [0.8, 300], [1.6, 150]]),
        env: [[0, 0], [0.5, 0.9], [1.6, 0.001]],
      });
      v.layer(v.b.creak, {
        at: 0.3, offset: 'rand', rate: v.rnd(0.9, 1.1), type: 'bandpass', f: 600, Q: 0.8,
        env: [[0, 0], [0.2, 0.8], [1.5, 0.001]],
      });
      v.layer(v.b.taikoBig, { at: 0.35, rate: 0.7, env: [[0, 0.35], [1.4, 0.001]] });
      return 1.95;
    },
  },

  taiko: {
    path: 'hero', gain: 1.007, send: 0.35, maxDur: 2.3, jitter: 0.03,
    fn(v) {
      v.layer(v.b.taikoBig, { rate: v.p });
      return v.b.taikoBig.duration / v.p;
    },
  },

  doorSlide: {
    gain: 0.357, send: 0.3, maxDur: 0.7, jitter: 0.04,
    fn(v) {
      v.layer(v.b.roll, {
        rate: v.rnd(0.95, 1.1), type: 'bandpass', f: 1400, Q: 0.6,
        env: [[0, 0], [0.02, 1], [0.33, 0.9], [0.36, 0.001]],
      });
      v.noise('pink', { type: 'bandpass', Q: 0.9, f: v.F([[0, 800], [0.34, 2200]]), env: [[0, 0], [0.05, 0.4], [0.34, 0.001]] });
      v.layer(v.b.slam, { at: 0.35, rate: v.rnd(0.95, 1.05) * v.p, level: 1.2 });
      thump(v, { at: 0.35, f0: 130, f1: 70, drop: 0.05, dur: 0.15, level: 0.7 });
      return 0.68;
    },
  },

  uiHover: {
    path: 'ui', gain: 0.058, send: 0.03, maxDur: 0.08, jitter: 0.02, minInterval: 0.04, maxVoices: 2,
    fn(v) {
      v.tone('sine', { f: 2600 * v.p, env: [[0, 0], [0.002, 1], [0.03, 0.001]] });
      v.layer(v.b.uiClick, { rate: 1.6, level: 0.25 });
      return 0.06;
    },
  },

  uiSelect: {
    path: 'ui', gain: 0.177, send: 0.08, maxDur: 0.2, jitter: 0.02,
    fn(v) {
      v.layer(v.b.uiClick, { rate: v.p });
      v.tone('sine', { f: 1500 * v.p, env: [[0, 0], [0.001, 0.4], [0.05, 0.001]] });
      return 0.12;
    },
  },

  uiConfirm: {
    path: 'ui', gain: 0.573, send: 0.28, maxDur: 1.6, jitter: 0.01,
    fn(v) {
      v.layer(v.b.taikoMid, { rate: v.p, env: [[0, 0.9], [1.1, 0.3], [1.28, 0.001]] });
      biwaNote(v, 50, { at: 0.005, rate: v.p, env: [[0, 0.75], [1.3, 0.2], [1.5, 0.001]] });
      v.layer(v.b.ka, { level: 0.3 });
      return 1.55;
    },
  },

  uiBack: {
    path: 'ui', gain: 0.168, send: 0.08, maxDur: 0.2, jitter: 0.02,
    fn(v) {
      v.layer(v.b.uiClick, { rate: 0.78 * v.p });
      v.tone('sine', { f: v.F([[0, 900], [0.06, 600]]), env: [[0, 0], [0.001, 0.35], [0.08, 0.001]] });
      return 0.13;
    },
  },

  gaugeFull: {
    path: 'ui', gain: 0.507, send: 0.42, maxDur: 2.4, jitter: 0.01,
    fn(v) {
      v.layer(v.b.chime, { rate: v.p, env: [[0, 0.9], [2.1, 0.001]] });
      v.layer(v.b.chime, { at: 0.06, rate: 1.498 * v.p, env: [[0, 0.5], [1.8, 0.001]] });
      v.layer(v.b.gong, { rate: 1.6 * v.p, env: [[0, 0], [0.35, 0.5], [2.2, 0.001]] });
      v.layer(v.b.crystal, { at: 0.1, rate: v.p, env: [[0, 0], [0.2, 0.5], [2.0, 0.001]] });
      return 2.3;
    },
  },

  ultimate: {
    path: 'hero', gain: 0.569, send: 0.48, maxDur: 1.5, jitter: 0.01,
    fn(v) {
      v.noise('white', {
        type: 'bandpass', Q: 0.9, f: v.F([[0, 300], [0.35, 3500], [1.2, 800]]),
        env: [[0, 0], [0.3, 1], [1.2, 0.001]], level: 0.9,
      });
      v.layer(v.b.gong, { at: 0.25, rate: v.p, env: [[0, 1], [0.9, 0.7], [1.15, 0.001]] });
      v.layer(v.b.choir, { at: 0.1, rate: v.p, env: [[0, 0], [0.3, 0.9], [1.0, 0.8], [1.3, 0.001]] });
      thump(v, { at: 0.25, f0: 62, f1: 30, drop: 0.8, dur: 1.0, level: 1.0, atk: 0.005 });
      v.layer(v.b.taikoBig, { at: 0.25, rate: v.p, env: [[0, 0.8], [1.0, 0.3], [1.15, 0.001]] });
      return 1.42;
    },
  },

  heartbeat: {
    path: 'hero', gain: 0.759, send: 0.04, maxDur: 0.6, jitter: 0.02, minInterval: 0.2, maxVoices: 2,
    fn(v) {
      v.layer(v.b.heart, { rate: v.p, level: 0.6 + 0.5 * v.I });
      return v.b.heart.duration / v.p;
    },
  },

  waveStart: {
    path: 'hero', gain: 0.832, send: 0.38, maxDur: 2.0, jitter: 0.01,
    fn(v) {
      v.layer(v.b.taikoBig, { rate: v.p, env: [[0, 1], [0.9, 0.35], [1.2, 0.001]] });
      v.layer(v.b.taikoBig, { at: 0.24, rate: 1.05 * v.p, env: [[0, 0.85], [1.2, 0.3], [1.5, 0.001]] });
      [50, 57, 62].forEach((m, i) => {
        biwaNote(v, m, { at: 0.5 + i * 0.014, env: [[0, 0.8 - i * 0.1], [1.2, 0.25], [1.4, 0.001]] });
      });
      v.noise('white', { at: 0.5, type: 'bandpass', f: 2400, Q: 1, env: [[0, 0.8], [0.03, 0.001]] });
      return 1.95;
    },
  },

  victory: {
    path: 'hero', gain: 0.708, send: 0.48, maxDur: 3.4, jitter: 0,
    fn(v) {
      v.layer(v.b.taikoBig, { rate: 0.95, env: [[0, 0.8], [1.5, 0.2], [2.0, 0.001]] });
      [50, 57, 62, 65, 69].forEach((m, i) => {
        biwaNote(v, m, { at: i * 0.13, env: [[0, 0.75], [2.2, 0.15], [2.6, 0.001]] });
      });
      v.layer(v.b.choir, { at: 0.2, env: [[0, 0], [0.6, 0.7], [2.2, 0.5], [2.78, 0.001]] });
      v.layer(v.b.chime, { at: 0.5, rate: 0.5, env: [[0, 0.5], [2.5, 0.001]] });
      v.layer(v.b.gong, { rate: 1.2, env: [[0, 0.3], [3.0, 0.001]] });
      return 3.2;
    },
  },
};
