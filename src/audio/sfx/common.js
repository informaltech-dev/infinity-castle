// Shared layer recipes used by several sounds.

/** Band-passed noise whoosh: centre sweeps f0 -> f1 (peak) -> f2 while the level swells and dies. */
export function whoosh(v, { kind = 'white', at = 0, dur, f0, f1, f2, peakAt = 0.45, Q = 1.1, level = 1, to }) {
  return v.noise(kind, {
    at, dur, type: 'bandpass', Q, to,
    f: v.F([[0, f0], [dur * peakAt, f1], [dur, f2]]),
    env: [[0, 0], [dur * peakAt, 1], [dur, 0.001]],
    level,
  });
}

/** Pitch-dropping sine body: the "weight" of an impact. */
export function thump(v, { at = 0, f0, f1, drop = 0.06, dur, level = 1, atk = 0.002, type = 'sine', to }) {
  return v.tone(type, {
    at, to, level,
    f: v.F([[0, f0], [Math.max(0.005, drop), f1]]),
    env: [[0, 0], [atk, 1], [dur, 0.001]],
  });
}

/** Very short bright noise transient (the crisp front edge of a hit). */
export function click(v, { at = 0, hp = 2500, dur = 0.012, level = 1, type = 'highpass', Q = 0.7, to }) {
  return v.noise('white', { at, to, type, f: hp, Q, env: [[0, 1], [dur, 0.001]], level });
}

/** Pre-rendered biwa note by MIDI number. */
export function biwaNote(v, midi, o = {}) {
  const { buf, rate } = v.b.biwaFor(midi);
  return v.layer(buf, { ...o, rate: rate * (o.rate || 1) });
}
