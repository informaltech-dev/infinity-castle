// What each difficulty changes besides raw damage (combat.js DIFF): how readable the bosses are, and, for
// 真劍 (a real duel), a whole different set of rules for both sides. (The recovery after a boss's string is set
// per difficulty in BossBase._recoverLen; the posture bar, the 危 mark and his leaps landing on their marks
// are the same on every difficulty.)
//
//   tell   how long a boss holds the wind-up of a blow (times the move's own hold; 1 = as authored)
//   delay  how often a blow is held back on purpose (a late swing to catch an early dodge);
//          'read' = learned from how early this player has been dodging
//   duel   the 真劍 ruleset below, or undefined

/**
 * 真劍: the boss is fully readable (every blow held and flashed before it lands) but punishes what it reads.
 * Breath techniques stop being a shield: they cost stamina, lose their invulnerability, and cannot be chained.
 * Parries and perfect dodges wear down his posture; a broken posture opens him to an execution. Being cut
 * leaves a part of the loss recoverable for a moment, won back by cutting him in return.
 */
export const DUEL = {
  // ---- the player
  stamina: { light: 9, heavy: 15, charged: 22, skill: 14, regen: 38, delay: 0.6, guard: 0.35 },
  breath: { regen: 1.0, onHit: 0.9, perfect: 18, parry: 22, parryGiyu: 30 },
  /** multiplier on the concentration (ultimate) gained from landing blows; parries and dodges give more */
  conc: { onHit: 0.5, perfect: 14, parry: 16 },
  /** block pressed within `gap` of letting go only parries for `spam` (no mashing the guard) */
  parry: { window: 0.18, spam: 0.06, gap: 0.45 },
  /** a dodge counts as perfect this close to the blow; the counter (a sure crit) lasts `counter` */
  perfect: { horizon: 0.22, grace: 0.2, counter: 1.1 },
  /** share of each wound that can be won back, how long it waits before fading, how fast it fades (hp/s),
   *  and how much of each blow landed comes back */
  rally: { share: 0.7, hold: 1.2, decay: 12, perHit: 0.55, flat: 2 },
  // ---- the boss
  /** posture (x`max` of his usual): a parry costs him base + the blow's own poise x mult, a perfect dodge
   *  `dodge`; a counter (a crit off either) bites `counter`x, any other blow only `hit`x, a flurry's tick
   *  `tick`x on top; it comes back quicker the healthier he is */
  posture: { max: 1.5, parry: 26, parryMult: 1.5, dodge: 12, counter: 1.8, hit: 0.5, tick: 0.4, regenLow: 0.45, regenHigh: 1.25 },
  /** a broken posture stands him still this long; an execution takes this share of his health */
  stagger: 3.0,
  exec: 0.08,
  /** he never flinches; after this many unanswered blows in a row he answers the next one */
  greed: { after: 3, chance: 0.55 },
  /** a breath technique started in front of him while he is free is read this often (more for a habit) */
  skillRead: { base: 0.35, habit: 0.45, range: 7.5 },
};

export const RULES = {
  easy: { tell: 0.8, delay: 0 },
  normal: { tell: 0.5, delay: 0.08 },
  hard: { tell: 0.35, delay: 0.16 },
  duel: { tell: 1, delay: 'read', duel: DUEL },
};

/** (a name from outside -- a URL, old saved settings -- is only a difficulty if it is one of these) */
export const isDifficulty = (d) => typeof d === 'string' && Object.hasOwn(RULES, d);

export function rulesFor(difficulty) {
  return isDifficulty(difficulty) ? RULES[difficulty] : RULES.normal;
}
