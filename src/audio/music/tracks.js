// Procedural music tracks, rooted on D. Each track is a step sequencer on a 16th-note grid:
// step(track, stepIndex, time) is called ahead of time by the look-ahead scheduler.
// Structure is derived from the step index, so tracks loop forever without seams.

import { smoothstep as ss } from '../dsp.js';

const MIYAKO = [0, 1, 5, 7, 8]; // D Eb G A Bb
const HIRA = [0, 2, 3, 7, 8]; // D E F A Bb

/** Scale degree (any integer) -> semitones from the tonic. */
export function semi(scale, d) {
  const n = scale.length;
  const o = Math.floor(d / n);
  return scale[((d % n) + n) % n] + 12 * o;
}
const M3 = (d) => 50 + semi(MIYAKO, d); // degrees around D3
const H4 = (d) => 62 + semi(HIRA, d); // degrees around D4

/** notes: [[step, degree, lengthSteps, bendSemitones], ...] */
function flutePhrase(tr, t, phrase, toMidi, vel) {
  for (const [st, d, len, bend] of phrase) {
    tr.band.flute(t + st * tr.stepDur, toMidi(d), len * tr.stepDur, vel, { bend });
  }
}

/** notes: [[step, degree, velocity, dampSteps?], ...] */
function biwaMotif(tr, t, motif, toMidi, vel = 1) {
  for (const [st, d, v, damp] of motif) {
    tr.band.biwa(t + st * tr.stepDur, toMidi(d), v * vel, damp ? damp * tr.stepDur : undefined);
  }
}

// ------------------------------------------------------------------ title

const TITLE_BIWA = [
  [[0, 5, 0.9], [3, 6, 0.55], [4, 5, 0.7], [10, 3, 0.8]],
  [[0, 3, 0.8], [2, 4, 0.55], [4, 3, 0.7], [8, 2, 0.8], [14, 0, 0.9]],
  [[0, 8, 0.7], [2, 7, 0.5], [3, 6, 0.6], [6, 5, 0.9], [12, 6, 0.5], [13, 5, 0.75]],
  [[0, 0, 0.9], [1, 1, 0.5], [2, 0, 0.6], [8, -2, 0.8], [12, -1, 0.6], [13, -2, 0.7]],
];
const TITLE_FLUTE = [
  [[0, 8, 10, -1], [10, 9, 4, 0], [14, 8, 14, -0.5], [30, 7, 12, -1]],
  [[0, 10, 12, -1.5], [12, 9, 3, 0], [15, 8, 5, 0], [20, 6, 16, -1]],
  [[0, 5, 8, -1], [8, 6, 4, 0], [12, 5, 16, -0.7], [30, 3, 10, -1]],
];

// ------------------------------------------------------------------ stage

const STAGE_ROOTS = [[0, 0, 1, 0, -1, -1, -2, 0], [0, 0, 2, 2, 1, 1, -2, -2]];
const STAGE_OST = [[0, 0, 1.0, 5], [3, 0, 0.55, 2], [6, 1, 0.8, 2], [8, 0, 0.7, 2], [10, -1, 0.75, 2], [12, 0, 0.6, 2], [14, 2, 0.8, 2]];
const STAGE_SHAMI = [5, 5, 6, 5, 3, 5, 4, 3, 5, 5, 6, 7, 8, 7, 6, 5];
const STAGE_FLUTE = [
  [[0, 8, 12, -1], [12, 7, 4, 0], [16, 6, 6, 0], [22, 5, 20, -0.7], [44, 3, 12, -1]],
  [[0, 10, 16, -1.5], [16, 9, 4, 0], [20, 8, 12, -0.5], [34, 6, 4, 0], [38, 5, 24, -1]],
];

// ------------------------------------------------------------------ boss

const BOSS_ROOTS = {
  A: [0, 0, -1, -1, 2, 2, -2, -2],
  A2: [0, 0, -1, -1, 2, 2, -2, -2],
  B: [1, 1, 0, 0, -1, -1, -2, -2],
  C: [0, 0, 0, 0, 1, 1, -2, -2],
};
const BOSS_SECTIONS = ['A', 'A2', 'B', 'C'];
const BOSS2_SECTIONS = ['A', 'B', 'A2', 'B'];
const RIFF_A = [5, 5, 6, 5, 4, 5, 3, 4, 5, 5, 6, 5, 7, 6, 5, 3];
const RIFF_B = [5, 7, 6, 5, 7, 8, 7, 6, 5, 7, 6, 5, 8, 7, 6, 5];
const ACCENT = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]; // 3-3-2 / 3-3-2
const BIG1 = { 0: 1, 3: 0.75, 6: 0.85, 8: 0.9, 11: 0.7, 14: 0.8 };
const BIG2 = { 0: 1, 3: 0.8, 6: 0.85, 8: 0.9, 10: 0.7, 11: 0.75, 14: 0.85 };
const BOSS_FLUTE = [[0, 10, 12, -1.5], [12, 11, 4, 0], [16, 10, 16, -0.5], [32, 9, 8, -1], [40, 8, 24, -1]];

function bossStep(tr, s, t, two) {
  const b = tr.band;
  const I = tr.I;
  const sd = tr.stepDur;
  const bar = s >> 4;
  const p = s & 15;
  const ph = bar & 7;
  const sec = (two ? BOSS2_SECTIONS : BOSS_SECTIONS)[(bar >> 3) & 3];
  const r = BOSS_ROOTS[sec][ph];
  const root2 = 38 + semi(MIYAKO, r);
  const root3 = root2 + 12;
  const brk = sec === 'C';
  const last = ph === 7;
  const roll = last && p >= 8;

  if (p === 0 && ph === 0) {
    b.gong(t, 0.4, 0.72);
    b.sub(t, 1.0);
    b.drone(t, [38, 45], 8 * 16 * sd + 1, 0.45, { cut: 380, atk: 1.2, rel: 1.5 });
  }
  // taiko
  if (!brk) {
    const big = two ? BIG2 : BIG1;
    if (big[p] && !roll) b.drum(t, 'taikoBig', big[p]);
    if (two) {
      if ((p & 1) === 1 && !roll) b.drum(t, 'taikoMid', 0.35);
      if (p === 4 || p === 12) b.drum(t, 'ka', 0.95);
      else if (p === 7 || p === 15) b.drum(t, 'ka', 0.4);
    } else {
      if ((p === 2 || p === 5 || p === 10 || p === 13) && !roll) b.drum(t, 'taikoMid', 0.45);
      if (p === 4 || p === 12) b.drum(t, 'ka', 0.9);
    }
    if (roll) b.drum(t, 'taikoMid', 0.45 + (p - 8) * 0.07);
    if (p === 0 && (bar & 1) === 0) b.sub(t, 0.7);
  } else {
    if (p === 0 || p === 8) b.drum(t, 'taikoBig', p === 0 ? 0.9 : 0.6);
    if (ph >= 6 && (p & 1) === 0) b.drum(t, 'taikoMid', 0.3 + (ph - 6) * 0.25 + p * 0.02);
  }
  // shime-daiko and atarigane
  if (!brk || ph >= 6) b.drum(t, 'shime', (p & 3) === 0 ? 0.7 : two ? 0.48 : 0.38);
  if (two && (p & 3) !== 1) b.kane(t, (p & 3) === 0 ? 0.5 : 0.3);
  // shamisen riff
  if (!brk) {
    const riff = two || sec !== 'A' ? RIFF_B : RIFF_A;
    const oct = two ? 5 : 0;
    b.shami(t, M3(r + riff[p] + oct), ACCENT[p] ? 0.95 : 0.55, 2 * sd);
    if (two && (p === 7 || p === 15)) b.shami(t + sd * 0.5, M3(r + riff[p] + oct + 1), 0.5, sd);
  }
  // biwa strums ("BEN!")
  if (p === 0 && (two || (bar & 1) === 0)) b.strum(t, [root2, root2 + 7, root3], 1.0, 0.012, brk ? undefined : 12 * sd);
  if (brk && p === 8 && (bar & 1) === 1) b.biwa(t, M3(r + 5), 0.7);
  // brass stabs
  if (!brk) {
    const chord = two ? [root2, root2 + 7, root3, root3 + 7] : [root2, root2 + 7, root3];
    if (two) {
      if (ACCENT[p]) b.brass(t, chord, p === 0 ? 0.32 : 0.12, p === 0 ? 0.9 : 0.72, 1.1);
    } else if (sec === 'A') {
      if (p === 0 && (bar & 1) === 0) b.brass(t, chord, 0.35, 0.8);
    } else {
      if ((bar & 1) === 0 && (p === 0 || p === 6)) b.brass(t, chord, p === 0 ? 0.3 : 0.16, 0.8);
      if ((bar & 1) === 1 && p === 14) b.brass(t, chord, 0.14, 0.7);
    }
  }
  // choir pad
  if (p === 0 && (bar & 1) === 0) {
    const v = brk ? 0.5 : two ? 0.6 : sec === 'B' ? 0.55 : 0.4;
    const notes = two ? [root3, root3 + 7, root3 + 12, root3 + 15] : [root3, root3 + 7, root3 + 12];
    b.choir(t, notes, 2 * 16 * sd + 0.3, v, brk ? 'o' : 'a');
  }
  // breakdown: a lone shakuhachi cry over the taiko
  if (brk && ph === 0 && p === 0) flutePhrase(tr, t, BOSS_FLUTE, M3, 0.6);
  // riser into the next phrase (boss2: every 4 bars)
  if (p === 0 && (last || (two && (bar & 3) === 3))) b.riser(t, 16 * sd, 0.45 + 0.25 * I);
}

// ------------------------------------------------------------------ victory

const VIC_MEL = [
  [2, 3, 6, -1], [8, 4, 4, 0], [12, 3, 4, 0], [16, 2, 8, -1], [24, 1, 4, 0], [28, 2, 4, 0], [32, 0, 12, -0.5],
  [48, 1, 4, 0], [52, 2, 4, 0], [56, 3, 8, -1], [64, 4, 6, 0], [70, 3, 2, 0], [72, 2, 4, 0], [76, 1, 4, 0],
  [80, 0, 16, -0.7],
];
const VIC_ARP = [null, [46, 53, 62], [50, 57, 62], [41, 45, 53], [46, 53, 58], [50, 57, 62, 65]];

// ------------------------------------------------------------------ track table

export const TRACKS = {
  title: {
    level: 0.84,
    bpm: 60,
    ambience: 'wind',
    buses: { biwa: [0.9, 0.65], flute: [0.5, 0.65], drone: [0.32, 0.45], drum: [0.8, 0.8], choir: [0.22, 0.6] },
    step(tr, s, t) {
      const b = tr.band;
      const bar = s >> 4;
      const p = s & 15;
      const ph = bar & 7;
      if (p === 0 && (bar & 3) === 0) b.drone(t, ph === 0 ? [38, 45, 50] : [38, 45, 51], 19, 0.5, { cut: 420, atk: 3, rel: 3 });
      if (p === 0 && (ph === 0 || ph === 2 || ph === 5)) {
        if (ph === 0 && tr.r() < 0.6) b.strum(t, [38, 45, 50], 0.85, 0.02);
        else biwaMotif(tr, t, tr.pick(TITLE_BIWA), M3, 0.9);
      }
      if (p === 0 && (ph === 1 || ph === 4) && tr.r() < 0.8) flutePhrase(tr, t, tr.pick(TITLE_FLUTE), M3, 0.55);
      if (ph === 7 && (p === 0 || p === 6)) b.drum(t, 'taikoBig', p === 0 ? 0.45 : 0.32, { lp: 600 });
      if (p === 0 && ph === 4 && ((bar >> 3) & 1) === 1) b.choir(t, [50, 57, 62], 16, 0.3, 'u');
      if (p === 8 && tr.r() < 0.1) b.creak(t, 0.3);
    },
  },

  stage: {
    level: 0.79,
    bpm: 100,
    ambience: 'hall',
    buses: {
      biwa: [0.85, 0.35], drum: [0.9, 0.2], perc: [0, 0.15], shami: [0, 0.2], choir: [0, 0.45],
      flute: [0.45, 0.5], drone: [0.34, 0.35], fx: [0.45, 0.4],
    },
    mix: (I) => ({
      perc: 0.5 * ss(0.2, 0.5, I),
      shami: 0.45 * ss(0.45, 0.75, I),
      choir: 0.3 * ss(0.6, 0.9, I),
      drum: 0.75 + 0.25 * I,
      flute: 0.5 - 0.3 * ss(0.5, 0.8, I),
    }),
    step(tr, s, t) {
      const b = tr.band;
      const I = tr.I;
      const sd = tr.stepDur;
      const bar = s >> 4;
      const p = s & 15;
      const ph = bar & 7;
      const cyc = (bar >> 3) & 1;
      const r = STAGE_ROOTS[cyc][ph];
      if (p === 0 && ph === 0) b.drone(t, [38, 45], 8 * 16 * sd + 1.5, 0.5, { cut: 450 });
      if (p === 0 && bar % 16 === 0) b.clap(t, 0.5);
      for (const [st, d, v, damp] of STAGE_OST) if (st === p) b.biwa(t, M3(r + d), v, damp * sd);
      const fill = ph === 3 || ph === 7;
      if (p === 0) b.drum(t, 'taikoBig', 1.0);
      if (p === 10) b.drum(t, 'taikoBig', 0.7);
      if (p === 6) b.drum(t, 'taikoMid', 0.6);
      if (!fill && p === 12) b.drum(t, 'taikoMid', 0.8);
      if (fill && p >= 12) b.drum(t, 'taikoMid', 0.5 + (p - 12) * 0.12);
      if (p === 4 || p === 14) b.drum(t, 'ka', 0.45);
      if (I > 0.6 && p === 8) b.drum(t, 'taikoBig', 0.55);
      if ((p & 1) === 0) b.drum(t, 'shime', (p & 3) === 0 ? 0.75 : 0.5);
      else if (I > 0.6 && tr.r() < (I - 0.6) * 2.5) b.drum(t, 'shime', 0.3);
      if (I > 0.4 && (ph === 2 || ph === 3 || ph === 6 || ph === 7)) {
        b.shami(t, M3(r + STAGE_SHAMI[p]), (p & 3) === 0 ? 0.9 : 0.55, 2 * sd);
      }
      if (I > 0.55 && p === 0 && (ph & 1) === 0) {
        const root = M3(r);
        b.choir(t, [root, root + 7, root + 12], 2 * 16 * sd + 0.4, 0.45, 'a');
      }
      if (p === 0 && ph === 4 && cyc === 0 && I < 0.8) flutePhrase(tr, t, tr.pick(STAGE_FLUTE), M3, 0.5);
      if (ph === 7 && p === 0 && I > 0.45) b.riser(t, 16 * sd, 0.3 + 0.3 * I);
      if (ph === 0 && p === 0 && bar > 0 && I > 0.5) b.gong(t, 0.2 + 0.2 * I, 0.7);
      if (p === 8 && tr.r() < 0.06) b.creak(t, 0.35);
    },
  },

  boss: {
    level: 0.78,
    bpm: 150,
    family: 'boss',
    ambience: 'hall',
    buses: {
      biwa: [0.8, 0.3], shami: [0.5, 0.18], drum: [1.0, 0.2], perc: [0.45, 0.15], brass: [0.42, 0.22],
      choir: [0.35, 0.45], drone: [0.34, 0.3], flute: [0.5, 0.55], fx: [0.55, 0.4],
    },
    mix: (I) => ({
      perc: 0.35 + 0.3 * I,
      choir: 0.28 + 0.2 * I,
      brass: 0.34 + 0.16 * I,
      drum: 0.85 + 0.15 * I,
      shami: 0.42 + 0.12 * I,
    }),
    step: (tr, s, t) => bossStep(tr, s, t, false),
  },

  boss2: {
    level: 0.6,
    bpm: 150,
    family: 'boss',
    ambience: 'hall',
    buses: {
      biwa: [0.8, 0.3], shami: [0.5, 0.18], drum: [1.0, 0.2], perc: [0.5, 0.15], brass: [0.5, 0.22],
      choir: [0.42, 0.45], drone: [0.34, 0.3], flute: [0.5, 0.55], fx: [0.6, 0.4],
    },
    mix: (I) => ({
      perc: 0.45 + 0.25 * I,
      choir: 0.36 + 0.14 * I,
      brass: 0.44 + 0.14 * I,
      drum: 0.9 + 0.1 * I,
      shami: 0.46 + 0.1 * I,
    }),
    step: (tr, s, t) => bossStep(tr, s, t, true),
  },

  victory: {
    level: 0.95,
    bpm: 72,
    ambience: 'wind',
    buses: { biwa: [0.8, 0.5], flute: [0.55, 0.6], choir: [0.3, 0.6], drone: [0.28, 0.45], drum: [0.7, 0.4] },
    step(tr, s, t) {
      const b = tr.band;
      const sd = tr.stepDur;
      const bar = s >> 4;
      const p = s & 15;
      if (s === 0) {
        b.drum(t, 'taikoMid', 0.55);
        b.strum(t, [50, 57, 62], 0.9, 0.02);
        b.choir(t, [50, 57, 65], 2 * 16 * sd, 0.35, 'a');
        b.drone(t, [38, 45], 6 * 16 * sd + 2, 0.4, { cut: 500 });
        flutePhrase(tr, t, VIC_MEL, H4, 0.6);
        return;
      }
      if (bar < 6) {
        if (p === 0 && VIC_ARP[bar]) VIC_ARP[bar].forEach((m, i) => b.biwa(t + i * 0.09, m, 0.7 - i * 0.08));
        if (p === 0 && bar === 2) b.choir(t, [46, 53, 62], 2 * 16 * sd, 0.32, 'a');
        if (p === 0 && bar === 4) b.choir(t, [50, 57, 65], 2 * 16 * sd, 0.3, 'a');
        return;
      }
      // after ~20 s: a quiet, bittersweet loop
      const q = (bar - 6) & 7;
      if (p === 0 && q === 0) {
        b.drone(t, [38, 45], 8 * 16 * sd + 2, 0.28, { cut: 420 });
        b.choir(t, [50, 57, 62], 2 * 16 * sd, 0.16, 'u');
      }
      if (p === 0 && (q & 1) === 0) b.biwa(t, tr.pick([62, 69, 65, 64, 57]), 0.45);
      if (p === 8 && (q & 1) === 1 && tr.r() < 0.5) b.biwa(t, tr.pick([57, 62, 64]), 0.35);
      if (p === 0 && q === 4) flutePhrase(tr, t, [[0, 3, 8, -1], [8, 2, 8, 0], [16, 0, 16, -0.5]], H4, 0.35);
    },
  },

  defeat: {
    level: 0.94,
    bpm: 50,
    ambience: 'wind',
    buses: { biwa: [0.8, 0.6], drone: [0.4, 0.45], choir: [0.2, 0.6], drum: [0.6, 0.7] },
    step(tr, s, t) {
      const b = tr.band;
      const sd = tr.stepDur;
      const bar = s >> 4;
      const p = s & 15;
      const ph = bar & 7;
      if (p === 0 && (bar & 3) === 0) b.drone(t, [38, 45], 4 * 16 * sd + 2.5, 0.5, { cut: 340, atk: 3, rel: 3 });
      if ((p === 0 || p === 8) && tr.r() < 0.45) {
        if (tr.r() < 0.25) {
          b.biwa(t, 51, 0.6);
          b.biwa(t + 2 * sd, 50, 0.7);
        } else b.biwa(t, tr.pick([50, 45, 46, 38, 50]), 0.55 + tr.r() * 0.25);
      }
      if (p === 0 && ph === 2) b.choir(t, [50, 57, 62], 2 * 16 * sd, 0.2, 'u');
      if (p === 0 && ph === 7) b.drum(t, 'taikoBig', 0.3, { lp: 500 });
    },
  },
};

export const MUSIC_TRACKS = Object.keys(TRACKS);
