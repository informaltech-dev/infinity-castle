import * as THREE from 'three';
import { Actor } from './actor.js';
import { J } from './rig.js';
import { clamp, lerp, angleDiff } from '../core/math.js';
import { SHAPE } from '../fx/particles.js';
import { LAYER_MAIN_ONLY } from '../render/pipeline.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _c = new THREE.Color();

const P = (o) => ({ blunt: true, style: 'akaza', sfx: 'punchHit', power: 0.55, hitstop: 0.07, shake: 0.28, stun: 'light', ...o });

// Wind-up holds (seconds; see ActionRunner): 'open' when a blow starts a string, 'fast' as a follow-up,
// 'delay' when he holds it back on purpose. `tells` are the moments of full wind-up in each clip.
const HOLD = (open, fast, delay) => ({ open, fast: fast ?? open * 0.4, delay });

function akazaMoves(boss) {
  void boss;
  return {
    jab: {
      clip: 'jab', turn: [0, 0.06, 14], motion: [[0, 0.09, 0.7]], cancel: 0.2,
      hits: [P({ t: 0.08, range: 2.5, arc: 80, dmg: 8, poise: 8, knock: 1.6 })],
      sfx: [{ t: 0.04, name: 'punchWhoosh' }], windup: 0.05,
      tells: [0], holds: HOLD(0.3, 0.2, 0.55), fade: 0.1, limb: 'handL', recover: 0.6,
    },
    cross: {
      clip: 'cross', turn: [0, 0.07, 14], motion: [[0, 0.1, 1.0]],
      hits: [P({ t: 0.09, range: 2.7, arc: 80, dmg: 11, poise: 12, knock: 2.6 })],
      sfx: [{ t: 0.05, name: 'punchWhoosh' }],
      tells: [0], holds: HOLD(0.32, 0.2, 0.6), fade: 0.1, limb: 'handR', recover: 0.7,
    },
    hook: {
      clip: 'hook', turn: [0, 0.08, 12], motion: [[0, 0.12, 0.8]],
      hits: [P({ t: 0.11, range: 2.5, arc: 140, dmg: 14, poise: 18, knock: 4.5, stun: 'heavy', power: 0.7, shake: 0.35 })],
      sfx: [{ t: 0.06, name: 'punchWhoosh', opts: { pitch: 0.85 } }],
      tells: [0], holds: HOLD(0.34, 0.2, 0.6), fade: 0.1, limb: 'handL', recover: 0.85,
    },
    uppercut: {
      clip: 'uppercut', turn: [0, 0.08, 14], motion: [[0, 0.12, 1.0]],
      hits: [P({ t: 0.11, range: 2.4, arc: 90, dmg: 18, poise: 30, knock: 3, stun: 'down', power: 0.85, shake: 0.45, hitstop: 0.1 })],
      sfx: [{ t: 0.07, name: 'punchWhoosh', opts: { pitch: 0.75 } }],
      tells: [0], holds: HOLD(0.38, 0.2, 0.7), fade: 0.1, limb: 'handR', recover: 1.0,
    },
    spinKick: {
      clip: 'spinKick', turn: [0, 0.1, 8], windup: 0.12,
      hits: [P({ t: 0.3, shape: 'circle', range: 3.0, dmg: 16, poise: 25, knock: 5.5, stun: 'heavy', power: 0.75, shake: 0.4 })],
      sfx: [{ t: 0.18, name: 'punchWhoosh', opts: { pitch: 0.7 } }],
      events: [{ t: 0.28, fn: (a) => a.sweepFx() }],
      tells: [0.1], holds: HOLD(0.26, 0.1, 0.5), limb: 'footR', recover: 1.0,
    },
    axeKick: {
      // (he stops turning once the landing is marked: he comes down on the mark, however long he hangs)
      clip: 'axeKick', turn: [0, 0.1, 5], motion: [[0.16, 0.58, 1.0, 'inOut']], windup: 0.18, armor: [0.1, 0.7],
      hits: [P({ t: 0.58, shape: 'circle', offset: 1.0, range: 2.5, dmg: 18, poise: 40, knock: 6, stun: 'down', power: 1, shake: 0.6, hitstop: 0.12, sfx: 'hitBlunt' })],
      events: [
        { t: 0.1, fn: (a, r) => a.markLanding(r, 1.0, r.timeTo(0.58) - 0.1) },
        { t: 0.58, fn: (a) => a.slamFx(1.0, 2.4) },
      ],
      sfx: [{ t: 0.14, name: 'dodge', opts: { pitch: 0.6 } }, { t: 0.58, name: 'groundSlam' }],
      name: ['破壞殺', '腳式', '冠先割'],
      // (held at the top of the leap: he hangs in the air)
      tells: [0.46], holds: HOLD(0.1, 0.06, 0.45), limb: 'footR', recover: 1.2,
    },
    airType: {
      clip: 'airType', turn: [0, 0.7, 10], windup: 0.3,
      events: [{ t: 0, fn: (a) => a.airWindup() }, ...[0.37, 0.51, 0.65].map((t) => ({ t, fn: (a) => a.airPunch() }))],
      name: ['破壞殺', '', '空式'],
      strikes: [0.37], tells: [0.25], holds: HOLD(0.16, 0.1), limb: 'handR', recover: 0.8,
    },
    dash: {
      clip: 'dash', turn: [0, 0.2, 14], motion: [[0, 0.24, 1, 'out']],
      events: [{ t: 0.02, fn: (a) => a.afterimage() }],
      sfx: [{ t: 0, name: 'dodge', opts: { pitch: 0.7 } }],
    },
    backstep: {
      clip: 'backstep', motion: [[0, 0.3, 3.2, 'out', Math.PI]],
      sfx: [{ t: 0, name: 'dodge', opts: { pitch: 0.8 } }],
      events: [{ t: 0.02, fn: (a) => a.afterimage() }],
    },
    barrage: {
      clip: 'barrageA', dur: 1.35, turn: [0, 1.3, 5], motion: [[0.25, 1.3, 1.6]], armor: [0, 1.35], windup: 0.25,
      multi: [P({ t0: 0.28, t1: 1.3, every: 0.075, range: 2.5, arc: 110, dmg: 2.2, poise: 4, knock: 0.6, hitstop: 0.02, shake: 0.08, power: 0.3, sfx: 'barrage' })],
      events: [{ t: 0, fn: (a) => a._telegraph() }, { t: 0.25, fn: (a) => a.barrageFx(1.05) }],
      next: 'barrageEnd',
      name: ['破壞殺', '', '亂式'],
      tells: [0.2], holds: HOLD(0.3, 0.2), limb: 'handR',
    },
    barrageEnd: {
      clip: 'barrageEnd', turn: [0, 0.1, 10], motion: [[0.05, 0.14, 1.2]],
      hits: [P({ t: 0.12, range: 2.8, arc: 100, dmg: 16, poise: 40, knock: 7, stun: 'down', power: 1, shake: 0.55, hitstop: 0.13, radial: 0.35 })],
      sfx: [{ t: 0.08, name: 'punchWhoosh', opts: { pitch: 0.7 } }],
      events: [{ t: 0.12, fn: (a) => a.punchBurst(2.2) }],
      tells: [0], holds: HOLD(0.14, 0.14, 0.45), limb: 'handR', recover: 1.1,
    },
    groundSlam: {
      clip: 'groundSlam', turn: [0, 0.1, 6], motion: [[0.16, 0.56, 1.0, 'inOut']], windup: 0.2, armor: [0, 0.9],
      hits: [P({ t: 0.56, shape: 'circle', offset: 0.9, range: 2.2, dmg: 20, poise: 40, knock: 7, stun: 'down', power: 1, shake: 0.7, hitstop: 0.12, sfx: 'hitBlunt' })],
      events: [
        { t: 0.1, fn: (a, r) => a.markLanding(r, 0.9, r.timeTo(0.56) - 0.1) },
        { t: 0.56, fn: (a) => a.slamFx(0.9, 3.4) },
        // (after the blow has been resolved, a frame or more later: a fist turned aside by a parry sends out no ring)
        { t: 0.62, fn: (a, r) => r.data.parried || a.shockRing(0.9, 11, 12, 0.9, 16, 0.06) },
      ],
      sfx: [{ t: 0.2, name: 'bossRoar', opts: { volume: 0.5 } }, { t: 0.56, name: 'groundSlam' }],
      name: ['破壞殺', '碎式', '萬葉閃柳'],
      tells: [0.45], holds: HOLD(0.1, 0.06, 0.4), limb: 'handR', recover: 1.3,
    },
    annihilationCharge: {
      clip: 'annihilationCharge', dur: 1.05, turn: [0, 0.7, 7], hold: true, armor: [0, 1.05],
      events: [{ t: 0, fn: (a) => a.chargeFx() }],
      next: 'annihilation',
      name: ['破壞殺', '', '滅式'],
      // (the blow itself is the next move's, just after this one ends)
      strikes: [1.14], perilous: true, limb: 'handR',
    },
    annihilation: {
      clip: 'annihilation', motion: [[0, 0.16, 13, 'out3']], armor: [0, 0.3],
      hits: [P({ t: 0.09, shape: 'line', range: 13, offset: -12, width: 1.0, dmg: 34, poise: 60, knock: 9, stun: 'down', power: 1, shake: 0.8, hitstop: 0.16, unblockable: true, impact: 0.1, impactA: 0x06121a, impactB: 0xe0f8ff, radial: 0.5, sfx: 'punchHit' })],
      events: [{ t: 0, fn: (a) => a.annihilationFx() }],
      sfx: [{ t: 0, name: 'shockwave' }],
      noTell: true, recover: 1.4,
    },
    // 腳式・流閃群光: three kicks, right, left and a high one, each chambered where you can see it
    kickFlurry: {
      clip: 'kickFlurry', turn: [0, 0.6, 9], motion: [[0, 0.1, 0.6], [0.28, 0.38, 0.6], [0.56, 0.68, 0.8]],
      hits: [
        P({ t: 0.1, range: 2.8, arc: 130, dmg: 11, poise: 12, knock: 2.6 }),
        P({ t: 0.38, range: 2.8, arc: 130, dmg: 11, poise: 12, knock: 2.6 }),
        P({ t: 0.68, range: 2.9, arc: 90, dmg: 16, poise: 26, knock: 5.5, stun: 'heavy', power: 0.8, shake: 0.4 }),
      ],
      events: [{ t: 0.08, fn: (a) => a.kickFx(-1) }, { t: 0.36, fn: (a) => a.kickFx(1) }, { t: 0.66, fn: (a) => a.kickFx(0) }],
      sfx: [0.05, 0.33, 0.62].map((t, i) => ({ t, name: 'punchWhoosh', opts: { pitch: 0.7 - i * 0.05 } })),
      name: ['破壞殺', '腳式', '流閃群光'],
      tells: [0, 0.28, 0.56], limb: ['footR', 'footL', 'footR'], recover: 1.0,
      holds: { open: [0.3, 0.12, 0.12], fast: [0.2, 0.12, 0.12], delay: [0.3, 0.12, 0.5] },
    },
    // 腳式・飛遊星千輪: a leaping forward flip brought down heel-first -- no guard stops it
    flipKick: {
      clip: 'flipKick', turn: [0, 0.1, 12], motion: [[0.08, 0.52, 3.4, 'inOut']], armor: [0.08, 0.6],
      hits: [P({ t: 0.52, shape: 'circle', offset: 1.1, range: 2.3, dmg: 22, poise: 45, knock: 6.5, stun: 'down', power: 1, shake: 0.65, hitstop: 0.12, unblockable: true, sfx: 'hitBlunt' })],
      events: [{ t: 0.1, fn: (a, r) => a.markLanding(r, 1.1, r.timeTo(0.52) - 0.1, 3.4) }, { t: 0.52, fn: (a) => a.slamFx(1.1, 2.2) }],
      sfx: [{ t: 0.08, name: 'dodge', opts: { pitch: 0.55 } }, { t: 0.3, name: 'punchWhoosh', opts: { pitch: 0.6 } }, { t: 0.52, name: 'groundSlam', opts: { volume: 0.8 } }],
      name: ['破壞殺', '腳式', '飛遊星千輪'],
      tells: [0], holds: HOLD(0.42, 0.3, 0.75), perilous: true, limb: 'footL', recover: 1.3,
    },
    // 破壞殺・鬼芯八重芯: eight blows in the time of one, from every side -- a guard does not last them
    eightCore: {
      clip: 'eightCore', turn: [0, 0.5, 8], motion: [[0.04, 0.7, 1.6]], armor: [0.04, 0.72],
      hits: [
        ...[0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56].map((t) => P({ t, range: 2.6, arc: 120, dmg: 4, poise: 5, knock: 0.8, hitstop: 0.03, shake: 0.12, power: 0.4 })),
        P({ t: 0.66, range: 2.8, arc: 100, dmg: 15, poise: 34, knock: 7, stun: 'down', power: 1, shake: 0.55, hitstop: 0.12, radial: 0.3 }),
      ],
      events: [{ t: 0.66, fn: (a) => a.punchBurst(2.0) }],
      sfx: [0.05, 0.13, 0.21, 0.29, 0.37, 0.45, 0.53].map((t, i) => ({ t, name: 'punchWhoosh', opts: { pitch: 1.1 + (i % 2) * 0.1, volume: 0.6 } })).concat([{ t: 0.62, name: 'punchWhoosh', opts: { pitch: 0.7 } }]),
      name: ['破壞殺', '', '鬼芯八重芯'],
      tells: [0], holds: HOLD(0.42, 0.3, 0.7), limb: 'both', recover: 1.2,
    },
    counter: {
      clip: 'counterGuard', dur: 0.28,
      next: 'uppercut',
    },
    techniqueDev: {
      clip: 'techniqueDev', dur: 2.0,
      events: [{ t: 0.3, fn: (a) => a.techniqueFx() }],
    },
    finalType: {
      clip: 'finalType', dur: 3.4, armor: [0, 3.4],
      events: [0.3, 0.95, 1.6, 2.25, 2.9].map((t, i) => ({ t, fn: (a) => a.finalWave(i) })),
      name: ['終式', '', '青銀亂殘光'],
      noTell: true, recover: 1.5,
    },
  };
}

/**
 * What every Upper Moon shares: the fight loop (think, approach, act, recover), who he is fighting (with more
 * than one foe, the one who has drawn the most threat), poise breaking into a stagger, kneeling at zero for the
 * finisher and the head coming off. Subclasses bring the moves, how they are chosen, phases and effects.
 */
export class BossBase extends Actor {
  constructor(game, model, opts) {
    super(game, model, { team: 'demon', ...opts });
    this.isBoss = true;
    this.state = 'intro';
    this.velXZ = new THREE.Vector3();
    this.phase = 1;
    this.cooldown = 1.0;
    this.plan = null;
    this.planT = 0;
    this.lastMove = '';
    this.hazards = [];
    this.guardT = 0;
    this.recentHits = 0;
    this.recentT = 0;
    this.staggered = false;
    this.anim.stepHz = 15;
    this.targetable = true;
    this.regenT = 0;
    this.regenRate = 0.005;
    this.deathT = 0;
    this.queue = [];
    this.chainOpts = {};
    /** Tier speed: his whole clock runs this much faster (moves, steps, blades). */
    this.speedMul = 1;
    /** Move choices draw from this; a seeded boss swaps it so every machine in a party picks the same. */
    this.rng = () => Math.random();
    /** Threat each foe has drawn (damage dealt, fading): with several foes he turns on the greatest. */
    this.aggro = new Map();
    this._target = null;
    this.calloutStyle = 'demon';
    this.telegraphColor = 0x7fe6ff;
    this.basePoiseRegen = this.poiseRegen;
    this.basePoise = this.maxPoise;
    /** What he has learned of each foe: how early they dodge, how much they guard, how greedy they are... */
    this.habits = new Map();
    this._seen = new Map();
    /** unanswered blows in a row from each foe (a duel's greed read) */
    this.press = new Map();
    this._executed = false;
    this.lastTellT = -99;
    this.recoverLen = 0.6;
    /** His clock against the game's (his hitstop, a slowed foe's ultimate, a tier's speed): see own(). */
    this.clock = { rate: 1 };
  }

  /**
   * An effect (a ground mark, a timer) that keeps his time rather than the game's: a mark that fills toward his
   * blow still fills toward it when he is held in a hitstop or slowed by an ultimate.
   */
  own(e) {
    if (e) e.clock = this.clock;
    return e;
  }

  get rules() {
    return this.game.rules;
  }

  setState(s) {
    // however a broken posture ends (timed out, a phase, a finisher), it ends whole
    if (this.state === 'stagger' && s !== 'stagger') {
      this.staggered = false;
      this._executed = false;
      this._execPending = false;
    }
    // (an escape waits on the flinch it was earned in)
    if (this.state === 'hit' && s !== 'hit') this._escapeNext = false;
    super.setState(s);
  }

  /** The 真劍 ruleset (rules.js DUEL) when that is the difficulty, else undefined. */
  get duel() {
    return this.game.rules.duel;
  }

  /** How long a broken posture stands him still. */
  get staggerLen() {
    return this.duel ? this.duel.stagger : 2.2;
  }

  /** A duel's broken posture: close enough, a foe can execute him (one execution a break). */
  get execReady() {
    return !!this.duel && this.state === 'stagger' && !this._executed && !this._execUnderway() && this.alive;
  }

  /** Is an execution under way, its cut still to come? (One whose executor was pulled out of it is not.) */
  _execUnderway() {
    const x = this._executor;
    if (this._execPending && (!x || !x.alive || x.state !== 'action' || x.curMove !== 'execute')) this._execPending = false;
    return !!this._execPending;
  }

  habitsOf(f) {
    let h = this.habits.get(f);
    if (!h) this.habits.set(f, (h = { early: 0.25, turtle: 0, greed: 0, skill: 0, away: 0 }));
    return h;
  }

  /** How often a blow is held back on purpose; in a duel, more the earlier this foe has been dodging. */
  get delayChance() {
    const d = this.rules.delay;
    if (d === 'read') {
      const t = this.target;
      return clamp(0.1 + 0.62 * (t ? this.habitsOf(t).early : 0.25), 0.1, 0.66);
    }
    return d || 0;
  }

  /** Everyone his blows can reach (the living players): worked out once a frame, however often it is asked. */
  get foes() {
    const g = this.game;
    if (this._foesAt !== g.time || !this._foes) {
      this._foesAt = g.time;
      this._foes = g.combat.targetsFor(this);
    }
    return this._foes;
  }

  /** The foe he is fighting: he keeps to one unless another has drawn clearly more threat. */
  get target() {
    const foes = this.foes;
    if (foes.length <= 1) return (this._target = foes[0] || null);
    const cur = foes.includes(this._target) ? this._target : null;
    let best = cur, bestS = cur ? this.threat(cur) * 1.35 : -Infinity;
    for (const f of foes) {
      const s = this.threat(f);
      if (s > bestS) {
        best = f;
        bestS = s;
      }
    }
    return (this._target = best);
  }

  /** (the fight's one opponent, when there is only one) */
  get player() {
    return this.target;
  }

  threat(f) {
    return (this.aggro.get(f) || 0) + 30 / (1 + this.distTo(f));
  }

  update(dt, realDt) {
    const gdt = dt;
    dt = this.tick(dt * this.game.enemyTimeScale * this.speedMul, realDt);
    if (gdt > 0) this.clock.rate = dt / gdt;
    this._hazards(dt);
    this.tickExtra?.(dt);
    if (!this.alive) {
      this._deadUpdate(dt);
      this.present(dt, this.sampleCb);
      return;
    }
    for (const [f, v] of this.aggro) this.aggro.set(f, v * Math.exp(-dt * 0.25));
    const p = this.target;
    this.recentT -= dt;
    if (this.recentT <= 0) this.recentHits = 0;
    if (this.press.size && this.game.time - this.lastHitT > 1.6) this._endPress();
    if (this.state !== 'intro') this._watchFoes(dt);
    // a duel: more posture, and it comes back quicker the healthier he is
    const P = this.duel?.posture;
    const maxP = this.basePoise * (P ? P.max : 1);
    if (maxP !== this.maxPoise) {
      this.poise *= maxP / this.maxPoise;
      this.maxPoise = maxP;
    }
    this.poiseRegen = P ? this.basePoiseRegen * lerp(P.regenLow, P.regenHigh, this.hp / this.maxHp) : this.basePoiseRegen;
    this.tickTimers?.(dt);
    // regeneration when left alone
    if (this.game.time - this.lastHitT > 5 && this.hp < this.maxHp && this.state !== 'intro') {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.regenRate * dt);
      this.regenT -= dt;
      if (this.regenT <= 0) {
        this.regenT = 0.08;
        this.game.fx.particles.smoke(this.chest(_v).clone(), 1, 0x7a2030, 0.3, 0.6, 0.8);
      }
    }
    // (a boss kneeling for the finisher is beaten: no phase is left to enter, whatever his health said on the way down)
    if (this.state !== 'finisher') this._checkPhase();

    switch (this.state) {
      case 'intro':
        this.anim.setLoco(0, 0, 0);
        break;
      case 'idle':
        this._think(dt, p);
        break;
      case 'approach':
        this._approach(dt, p);
        break;
      case 'action':
        this._action(dt);
        break;
      case 'recover':
        this.velXZ.multiplyScalar(Math.exp(-dt * 8));
        // (in a duel the opening is real: he hardly turns to follow)
        if (p) this.turnTowards(p.pos, this.duel ? 2 : 5, dt);
        this.anim.setLoco(0, 0, 0);
        if (this.stateT > this.recoverLen) this.setState('idle');
        break;
      case 'guard':
        this.guardT -= dt;
        if (p) this.turnTowards(p.pos, 10, dt);
        if (this.guardT <= 0) this.setState('idle');
        break;
      case 'hit':
        if (this.stateT > this.stunLen) {
          const esc = this._escapeNext;
          this.setState('idle');
          if (esc) this._escape();
        }
        break;
      case 'stagger':
        // (an execution begun at the last moment is let finish: its cut falls on a broken posture, never a recovered one)
        if (this.stateT > this.staggerLen && !(this.stateT < this.staggerLen + 1 && this._execUnderway())) {
          this.staggered = false;
          this._executed = false;
          this.setState('idle');
          this.cooldown = 0.1;
          this.anim.stop(0.2);
        }
        break;
      case 'finisher':
        break;
    }
    this.afterUpdate?.(dt);
    this.game.world?.constrain(this.pos, this.radius);
    this.present(dt, this.sampleCb);
  }

  _checkPhase() {}

  _stepToward(dt, p, speed) {
    _v.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
    this.velXZ.lerp(_v.multiplyScalar(speed), Math.min(1, dt * 5));
    this.pos.addScaledVector(this.velXZ, dt);
    this.anim.setLoco(this.velXZ.length(), 0, 0);
  }

  /** Weighted draw over [{ name, w, range }] with the boss's own rng. */
  _pick(opts) {
    const total = opts.reduce((s, o) => s + o.w, 0);
    let r = this.rng() * total;
    let choice = opts[0];
    for (const o of opts) {
      r -= o.w;
      if (r <= 0) {
        choice = o;
        break;
      }
    }
    return choice;
  }

  /**
   * Run a string of moves. Each step is 'move' or 'move:kind', kind being how its wind-up is held:
   * 'open' (the first blow, fully shown), 'fast' (a follow-up), 'delay' (held back on purpose) or a number
   * of seconds. Unmarked steps are 'open' first and 'fast' after.
   */
  _chain(list, opts = {}) {
    this.queue = list.slice(1);
    this.chainOpts = opts;
    // (a counter comes straight back: none of its blows is held back at random; nor is any string that already
    // holds one back by design -- one delay a string)
    this._delayed = !!opts.noDelay || list.some((st) => String(st).endsWith(':delay'));
    this._step(list[0], true);
  }

  _step(step, first) {
    const [name, kind] = String(step).split(':');
    this._run(name, kind || (first ? 'open' : 'fast'));
  }

  /** The holds of a move's wind-ups for a kind of step (one per tell), scaled by the difficulty. */
  _holdsFor(def, kind) {
    const H = def.holds;
    if (!H) return null;
    const n = Number(kind);
    if (Number.isFinite(n)) return [n * this.rules.tell];
    const v = H[kind] ?? H.open;
    // a deliberate delay is the same length on every difficulty; the rest follow how readable it is
    const k = kind === 'delay' ? 1 : this.rules.tell;
    return (Array.isArray(v) ? v : [v]).map((x) => (x ?? 0) * k);
  }

  _run(name, kind = 'open') {
    const def = this.moves[name];
    if (!def) return this.setState('idle');
    this.setState('action');
    this.curMove = name;
    this._endPress();
    this.velXZ.set(0, 0, 0);
    this.anim.setLoco(0, 0, 0);
    // now and then one blow of a string is held back, to catch a dodge made too early (once a string)
    let k = kind;
    if (k !== 'delay' && def.holds?.delay != null && !this._delayed && this.rng() < this.delayChance) k = 'delay';
    if (k === 'delay') this._delayed = true;
    this.curKind = k;
    this.run(def, { target: this.target, motionScale: this._motionScale(name, def), holds: this._holdsFor(def, k) });
    if (def.name) this.game.hud?.callout({ school: def.name[0], form: def.name[1], name: def.name[2], style: this.calloutStyle, side: 'left' });
    if (def.windup && def.windup > 0.1 && !def.holds) this._telegraph();
  }

  /** A held blow is about to land: the flash that says so (and for a blow that cannot be blocked, 危). */
  onTell(r, s, i) {
    const d = r.def;
    this.lastTellT = this.game.time;
    // (the flash is bigger for a blow that was held back)
    this.glint(d, r.heldBefore(s) || !!d.perilous, i > 0, i);
    if (d.perilous && !i) this.peril();
  }

  /** (subclasses: a flash on the blade or the fist) */
  glint() {}

  peril() {
    const g = this.game;
    g.hud?.peril?.(this);
    g.audio?.play('peril', { pos: this.pos });
    this.flash(0xff2030, 0.16);
  }

  /** Between blows in a duel he circles at `range`, rather than standing and waiting. */
  _footwork(dt, p, range, speed) {
    const d = this.distTo(p);
    this._fwT = (this._fwT ?? 0) - dt;
    if (this._fwT <= 0) {
      this._fwT = 0.9 + this.rng() * 1.3;
      this._fwDir = this.rng() < 0.5 ? -1 : 1;
    }
    _v.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
    const radial = clamp((d - range) * 0.9, -1, 1);
    _v3.set(-_v.z, 0, _v.x).multiplyScalar(this._fwDir * 0.75).addScaledVector(_v, radial);
    if (_v3.lengthSq() > 1) _v3.normalize();
    this.velXZ.lerp(_v3.multiplyScalar(speed), Math.min(1, dt * 5));
    this.pos.addScaledVector(this.velXZ, dt);
    const sp = this.velXZ.length();
    this.anim.setLoco(sp, sp > 0.1 ? angleDiff(this.yaw, Math.atan2(this.velXZ.x, this.velXZ.z)) : 0, 0);
  }

  // ---------------------------------------------------------------- reading his foes
  /** Watches each foe: what they start (a dodge, a breath technique), how they guard, how far they stand. */
  _watchFoes(dt) {
    for (const f of this.foes) {
      const h = this.habitsOf(f);
      const d = this.distTo(f);
      if (d < 5) h.turtle += ((f.blocking ? 1 : 0) - h.turtle) * Math.min(1, dt * 0.45);
      else h.turtle *= Math.exp(-dt * 0.2);
      h.away += ((d > 7.5 ? 1 : 0) - h.away) * Math.min(1, dt * 0.15);
      h.skill = Math.max(0, h.skill - dt * 0.015);
      const r = f.action;
      if (!r || this._seen.get(f) === r) continue;
      this._seen.set(f, r);
      if (f.curMove === 'dodge') {
        this._sawDodge(h);
        this.onFoeDodge?.(f);
      }
      else if (r.def.cost && f.state === 'action') this._sawTechnique(f, r, h, d);
    }
  }

  /** A dodge: was it made well before his blow (the habit a held-back blow catches)? */
  _sawDodge(h) {
    const r = this.action;
    const s = r && this.state === 'action' ? r.nextStrike() : null;
    if (s == null) return;
    const tts = r.timeTo(s);
    if (tts > 1.2) return;
    h.early += ((tts > 0.42 ? 1 : 0) - h.early) * 0.22;
  }

  /** Is he between blows, watching (not committed to a move, nor still recovering from one)? */
  get watching() {
    return this.state === 'idle' || this.state === 'approach' || (this.state === 'recover' && this.stateT > this.recoverLen - 0.2);
  }

  /** A breath technique thrown at him: in a duel, if he is free to, he reads it, slips it and answers. */
  _sawTechnique(f, r, h, d) {
    const D = this.duel;
    const neutral = this.watching;
    if (neutral && d < 7.5) h.skill = Math.min(1, h.skill + 0.25);
    if (!D || !neutral || d > D.skillRead.range || f.state === 'ult') return;
    if (this.rng() >= D.skillRead.base + D.skillRead.habit * h.skill) return;
    // untouchable until its last blow has passed
    let last = 0;
    for (const x of r.def.hits || []) last = Math.max(last, x.t);
    for (const x of r.def.multi || []) last = Math.max(last, x.t1);
    this.invuln = clamp(r.timeTo(last || r.dur * 0.6) + 0.12, 0.35, 1.8);
    this._answerTechnique(f, r);
  }

  /** (subclasses: the evasion and the answer) */
  _answerTechnique() {}

  /** Blows landed in a row with no answer: counted toward a duel's greed read, and toward the habit. */
  _endPress() {
    if (!this.press.size) return;
    for (const [f, n] of this.press) {
      const h = this.habitsOf(f);
      h.greed += (Math.min(1, n / 4) - h.greed) * 0.3;
    }
    this.press.clear();
  }

  /** A duel: past a few unanswered blows he sees the next one coming and answers it instead. */
  _greedRead(att, h) {
    const D = this.duel;
    if (!D || !att || att.team !== 'player' || att.state === 'ult' || h?.unparryable) return false;
    if (this.state !== 'idle' && this.state !== 'recover' && this.state !== 'approach') return false;
    const n = this.press.get(att) || 0;
    const hb = this.habitsOf(att);
    if (n < D.greed.after - (hb.greed > 0.6 ? 1 : 0)) return false;
    if (this.rng() >= D.greed.chance + 0.3 * hb.greed) return false;
    this._endPress();
    this._answerGreed(att, h);
    return true;
  }

  /** (subclasses: how he answers a greedy flurry) */
  _answerGreed() {
    return false;
  }

  tryCounter(att, h) {
    if (this._greedRead(att, h)) return true;
    return this._guardCounter(att, h);
  }

  /** (subclasses: a stance that turns blows aside) */
  _guardCounter() {
    return false;
  }

  _motionScale() {
    return 1;
  }

  _telegraph() {
    const h = this.head(_v).clone();
    this.game.fx.particles.flash(h, this.telegraphColor, 1.1, 0.18);
  }

  _action(dt) {
    const r = this.action;
    if (!r) return this.setState('idle');
    this.armor = r.inWindow(r.def.armor);
    r.update(dt);
    if (r.done) {
      this.action = null;
      this.armor = false;
      if (r.def.next) {
        this._run(r.def.next, 'fast');
        // (the move goes on in its continuation: the draw is its stance's, and so are its moons)
        if (this.action && r.data.moonGroup) this.action.data.moonGroup ??= r.data.moonGroup;
        return;
      }
      const next = this.queue && this.queue.shift();
      if (next) {
        this._step(next, false);
        return;
      }
      this.setState('recover');
      this.recoverLen = this._recoverLen(r);
      this.cooldown = this._nextCooldown();
      this.onRecover?.(r);
    }
  }

  _nextCooldown() {
    return this.duel ? lerp(0.35, 1.1, this.rng()) : lerp(0.1, 0.5, this.rng());
  }

  /** The opening after a string: in a duel each move says how long it leaves him open. */
  _recoverLen(r) {
    if (this.duel) return (r?.def.recover ?? 0.85) * (this.phase >= 3 ? 0.85 : 1) * (0.9 + this.rng() * 0.2);
    // (his leaps come down on their marks now instead of homing in: he presses a little harder between them)
    const diff = this.game.settings?.difficulty || 'normal';
    const base = diff === 'hard' ? 0.3 : diff === 'easy' ? 0.85 : 0.5;
    return base * (this.phase === 1 ? 1.2 : this.phase === 2 ? 0.9 : 0.7);
  }

  /** Expanding ground shock rings (shockRing pushes them): each foe it sweeps over is hit once. */
  _hazards(dt) {
    const foes = this.hazards.length ? this.foes : null;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.r += h.speed * dt;
      for (const p of foes) {
        if (h.hitSet?.has(p)) continue;
        const d = Math.hypot(p.pos.x - h.c.x, p.pos.z - h.c.z);
        if (Math.abs(d - h.r) < h.width + p.radius * 0.5 && (p.posY || 0) < 0.8) {
          (h.hitSet ??= new Set()).add(p);
          h.hit = true;
          this.game.combat.applyHit(this, p, this._hazardHit(h));
        }
      }
      if (h.r > h.maxR) this.hazards.splice(i, 1);
    }
  }

  _hazardHit(h) {
    return { dmg: h.dmg, poise: 20, knock: 5, stun: 'heavy', power: 0.8, shake: 0.4, sfx: 'shockwave', unparryable: true };
  }

  // ---------------------------------------------------------------- reactions
  onHit(att, h, info) {
    this.recentHits++;
    this.recentT = 1.2;
    if (att && info?.dmg) this.aggro.set(att, (this.aggro.get(att) || 0) + info.dmg);
    if (this.state === 'intro') return;
    // (blows landed in an opening he gave are earned; blows into his guard between moves are counted)
    if (att && att.team === 'player' && (this.state === 'idle' || this.state === 'recover' || this.state === 'approach')) this.press.set(att, (this.press.get(att) || 0) + 1);
    // poise break -> stagger
    if (this.poise <= 0 && this.state !== 'stagger') {
      this._breakPosture();
      return;
    }
    // a duel's Upper Moon does not flinch: only a broken posture or a parried last blow stops him
    if (this.duel || this.armor || this.state === 'action' || this.state === 'stagger' || this.state === 'finisher') {
      this.anim.hitJolt = 0.7;
      return;
    }
    if (this._readsBlow(att, h)) return;
    // (his escape already coming: blows still land, but they no longer hold him)
    if (this._escapeNext && this.state === 'hit') {
      this.anim.hitJolt = 1;
      return;
    }
    this.setState('hit');
    this.stunLen = h.stun === 'down' || h.stun === 'heavy' ? 0.45 : 0.25;
    this.anim.play(this.clips.hit, { fade: 0.02 });
    this.anim.hitJolt = 1;
    // escape after being juggled too long: as soon as this flinch is over (on his own clock, and only if nothing --
    // a broken posture, a new phase, the finisher -- has taken him out of it first)
    if (this.recentHits >= 6) {
      this.recentHits = 0;
      this.stunLen = 0.1;
      this.cooldown = 0;
      this._escapeNext = true;
    }
  }

  _breakPosture() {
    const g = this.game;
    this.poise = this.maxPoise;
    this.action = null;
    this.queue = [];
    this.armor = false;
    this.staggered = true;
    this._executed = false;
    this.setState('stagger');
    // (a duel's stagger is longer: the clip is stretched to it, so he is not seen standing while still open)
    this.anim.play(this.clips.stagger, { fade: 0.03, speed: this.clips.stagger.dur / this.staggerLen });
    this.onStagger?.();
    g.hud?.toast('破勢', 'break');
    g.audio?.play('guardBreak');
    g.fx.screen.flash(0xffffff, 0.3, 8);
    if (this.duel) g.slowmo(0.35, 0.5);
  }

  /** The share of his health an execution takes. */
  execDamage() {
    return Math.round(this.maxHp * (this.duel?.exec ?? 0.1));
  }

  /** An execution has begun: no one else starts one. */
  onExecuteStart(by) {
    this._execPending = true;
    this._executor = by || null;
  }

  /** The execution's cut: landed, he is on his feet again soon after; missed, the chance is not lost. */
  onExecuted(landed = true) {
    this._execPending = false;
    if (!landed) return;
    this._executed = true;
    if (this.state === 'stagger') this.stateT = Math.max(this.stateT, this.staggerLen - 0.9);
  }

  /** A read of a blow that has just landed (true: he answered it instead of flinching). */
  _readsBlow() {
    return false;
  }

  _escape() {}

  onParried(player, h) {
    const D = this.duel;
    // (before anything ends his move: what the parried cut threw is turned aside with it)
    this.onParriedBy?.(player, h);
    if (!D) {
      // a parried Upper Moon is thrown off balance
      this.poise -= 45;
      this.action = null;
      this.queue = [];
      this.setState('hit');
      this.stunLen = 0.7;
      this.anim.play(this.clips.hit, { fade: 0.02 });
      return;
    }
    // a duel: every parry wears at his posture; only the last blow of a string, turned aside, opens him up
    this.poise -= D.posture.parry + (h?.poise ?? 10) * D.posture.parryMult;
    this.lastHitT = this.game.time;
    if (this.action) this.action.data.parried = true;
    if (this.poise <= 0) {
      this._breakPosture();
      return;
    }
    const r = this.action;
    const spent = !r || (!this.queue.length && !r.def.next && r.nextStrike() == null);
    if (spent) {
      this.action = null;
      this.queue = [];
      this.armor = false;
      this.setState('hit');
      this.stunLen = 0.9;
      this.anim.play(this.clips.hit, { fade: 0.02 });
    } else this.anim.hitJolt = 0.9;
  }

  die(att, h) {
    // an Upper Moon only dies to the finisher; at 0 hp he kneels and waits
    if (this.state === 'finisher') return;
    this.hp = 1;
    this.action = null;
    this.queue = [];
    this.hazards.length = 0;
    this.setState('finisher');
    this.targetable = false;
    this.onKneel?.();
    this.game.onBossDefeated?.(this, att, h);
  }

  /** Final blow from the finisher cinematic. */
  behead(dir) {
    const g = this.game;
    this.alive = false;
    this.hp = 0;
    const head = this.rig.j('head');
    g.scene.attach(head);
    this.rig.joints[J.head] = new THREE.Object3D();
    this.headPhys = { obj: head, vel: new THREE.Vector3(dir.x * 3, 6, dir.z * 3), spin: new THREE.Vector3(8, 5, 3), bounces: 0 };
    this.onBehead?.(dir);
  }

  _deadUpdate(dt) {
    this.deathT += dt;
    if (this.headPhys) {
      const hp = this.headPhys;
      hp.vel.y -= 14 * dt;
      hp.obj.position.addScaledVector(hp.vel, dt);
      hp.obj.rotation.x += hp.spin.x * dt;
      hp.obj.rotation.y += hp.spin.y * dt;
      if (hp.obj.position.y < 0.15) {
        hp.obj.position.y = 0.15;
        hp.vel.set(hp.vel.x * 0.5, Math.abs(hp.vel.y) > 2 ? -hp.vel.y * 0.3 : 0, hp.vel.z * 0.5);
        hp.spin.multiplyScalar(0.5);
      }
    }
    this._afterDeath(dt);
  }

  _afterDeath() {}

  /** Crumbling to ash: k 0..1 over the dissolve; removes him at the end. */
  _crumble(k) {
    const g = this.game;
    if (!this._layered && this.headPhys) {
      this._layered = true;
      this.headPhys.obj.traverse((o) => o.layers.set(LAYER_MAIN_ONLY));
    }
    this.setDissolve(k);
    if (Math.random() < 0.8) g.fx.ashFrom(this.model, 4);
    if (k >= 1 && !this.removed) {
      this.removed = true;
      if (this.headPhys) g.scene.remove(this.headPhys.obj);
      this.dispose();
    }
  }
}

export class Akaza extends BossBase {
  constructor(game, model) {
    super(game, model, { hp: 3200, poise: 170, radius: 0.5, height: 1.9, mass: 3, poiseRegen: 12 });
    this.moves = akazaMoves(this);
    this.compass = null;
    this.finalCd = 0;
    this.usedFinal = false;
  }

  tickTimers(dt) {
    this.finalCd -= dt;
  }

  _checkPhase() {
    const hp01 = this.hp / this.maxHp;
    // (not in the middle of a move, nor of a broken posture: the execution window is the player's)
    if (this.state === 'action' || this.state === 'stagger') return;
    if (this.phase === 1 && hp01 < 0.6) this._enterPhase(2);
    else if (this.phase === 2 && hp01 < 0.25) this._enterPhase(3);
  }

  afterUpdate() {
    if (this.compass) {
      this.compass.mesh.position.set(this.pos.x, 0.03, this.pos.z);
      this.compass.age = Math.min(this.compass.age, 1);
    }
  }

  get hudInfo() {
    return { title: '上弦之參', name: '猗窩座', phaseMarks: [0.6, 0.25] };
  }

  // ---------------------------------------------------------------- brain
  _think(dt, p) {
    this.cooldown -= dt;
    this.anim.setLoco(0, 0, 0);
    if (!p || !p.alive) return;
    this.turnTowards(p.pos, 8, dt);
    if (this.duel && this.cooldown > 0.12 && p.stamina < 18 && this.distTo(p) < 5) this.cooldown = 0.12; // out of breath: he presses
    if (this.cooldown > 0) {
      const d = this.distTo(p);
      // a duel: light on his feet, circling just outside reach; otherwise he walks in
      if (this.duel) this._footwork(dt, p, 3.4, 3.2);
      else if (d > 3.5) this._stepToward(dt, p, 2.2);
      return;
    }
    if (this.phase === 3 && this.finalCd <= 0) {
      this.finalCd = 26;
      this._startFinal();
      return;
    }
    const d = this.distTo(p);
    const opts = [];
    const add = (name, w, range) => {
      if (name === this.lastMove) w *= 0.3;
      opts.push({ name, w, range });
    };
    if (this.duel) this._duelOptions(add, d, p);
    else if (d > 9) {
      add('airType', 3, 30);
      add('dashIn', 3, 30);
      if (this.phase >= 2) add('annihilation', 2.5, 30);
    } else if (d > 4) {
      add('airType', 1.5, 30);
      add('dashIn', 2.5, 30);
      add('axeKick', 2, 9);
      if (this.phase >= 2) {
        add('annihilation', 1.8, 30);
        add('groundSlam', 1.6, 8);
      }
    } else {
      add('combo', 3, 2.8);
      add('spinKick', 1.6, 3.0);
      add('barrage', 1.6, 3.2);
      add('backAir', 1.0, 30);
      if (this.phase >= 2) {
        add('groundSlam', 1.2, 4);
        add('guard', 1.2, 30);
      }
    }
    const choice = this._pick(opts);
    this.plan = choice;
    this.planT = 0;
    this.lastMove = choice.name;
    if (d > choice.range) this.setState('approach');
    else this._execute(choice.name);
  }

  /** 真劍: what he picks from, weighted by what he has read of this foe. */
  _duelOptions(add, d, p) {
    const h = this.habitsOf(p);
    const turtle = h.turtle, away = h.away;
    if (d > 9) {
      add('airType', 2, 30);
      add('dashIn', 2.5 + away * 2, 30);
      if (this.phase >= 2) add('annihilation', 1.6 + away * 2, 30);
    } else if (d > 3.6) {
      add('dashIn', 2.4 + away, 30);
      add('axeKick', 1.6, 9);
      add('airType', 1.0 + away, 30);
      add('flipKick', 0.5 + turtle * 3, 6);
      if (this.phase >= 2) {
        add('annihilation', 1.2, 30);
        add('groundSlam', 1.2, 7);
      }
    } else {
      add('combo2', 2, 2.8);
      add('combo3', 2, 2.8);
      add('combo4', 1.4, 2.8);
      add('hookKick', 1.2, 3.0);
      add('kickFlurry', 1.5, 3.0);
      add('barrage', 0.9, 3.2);
      add('eightCore', 0.6 + turtle * 4, 3.0);
      add('flipKick', 0.4 + turtle * 3, 4.5);
      add('backAir', 0.6 + away, 30);
      if (this.phase >= 2) {
        add('groundSlam', 0.9, 4);
        add('guard', 0.8, 30);
      }
    }
  }

  _approach(dt, p) {
    if (!p || !p.alive) return this.setState('idle');
    this.planT += dt;
    const d = this.distTo(p);
    this.turnTowards(p.pos, 10, dt);
    this._stepToward(dt, p, this.phase >= 2 ? 7.5 : 6.5);
    if (d <= this.plan.range) this._execute(this.plan.name);
    else if (this.planT > 2.2) this._execute(d > 6 ? 'airType' : 'dashIn');
  }

  _execute(name) {
    const p = this.player;
    const d = p ? this.distTo(p) : 0;
    switch (name) {
      case 'combo':
        this._chain(this.rng() < 0.5 ? ['jab', 'cross', 'hook'] : ['jab', 'jab', 'cross', 'uppercut']);
        return;
      // 真劍 strings: two, three or four blows; the last of a long one may be held back
      case 'combo2':
        this._chain(['jab', 'cross']);
        return;
      case 'combo3':
        this._chain(this.rng() < 0.5 ? ['jab', 'cross', 'hook'] : ['cross', 'hook', 'uppercut']);
        return;
      case 'combo4':
        this._chain(['jab', 'jab', 'cross', this.rng() < 0.6 ? 'uppercut:delay' : 'uppercut']);
        return;
      case 'hookKick':
        this._chain(['hook', 'spinKick']);
        return;
      case 'dashIn': {
        const after = this.duel
          ? this.rng() < 0.5 ? ['jab:fast', 'cross', 'hook'] : ['jab:fast', 'cross', 'uppercut:delay']
          : this.rng() < 0.5 ? ['jab', 'cross', 'hook'] : ['barrage'];
        this._chain(['dash', ...after], { dashDist: Math.max(0.5, d - 1.8) });
        return;
      }
      case 'backAir':
        this._chain(['backstep', 'airType']);
        return;
      case 'guard':
        this._guard(1.4);
        return;
      case 'annihilation':
        this._chain(['annihilationCharge']);
        return;
      case 'axeKick':
      case 'groundSlam':
        this._chain([name], { leap: Math.max(0.2, d - 1.0) });
        return;
      default:
        this._chain([name]);
    }
  }

  _motionScale(name) {
    // (a dash that follows a step back measures the gap when it starts)
    if (name === 'dash') return this.chainOpts?.dashAuto && this.player ? Math.max(0.5, this.distTo(this.player) - 1.8) : this.chainOpts?.dashDist ?? 3;
    if (name === 'axeKick' || name === 'groundSlam') return this.chainOpts?.leap ?? 1;
    return 1;
  }

  _guard(len) {
    this.setState('guard');
    this.guardT = len;
    this.anim.play(this.clips.counterGuard, { fade: 0.05, hold: true });
    this.flash(0x7fe6ff, 0.12);
    this.game.fx.particles.flash(this.chest(_v).clone(), 0x7fe6ff, 1.2, 0.2);
  }

  /** Akaza reads fighting spirit: parries melee hits while guarding (not projectiles, not an ultimate). */
  _guardCounter(att, h) {
    if (this.state !== 'guard' || h.shape === 'circle' && (h.range ?? 0) > 3.2) return false;
    if (att.team !== 'player' || h.unparryable || att.state === 'ult') return false;
    this._turnAside(att);
    return true;
  }

  /** The blow meets his forearm; the uppercut comes straight back. */
  _turnAside(att) {
    const g = this.game;
    this.anim.play(this.clips.counterGuard, { fade: 0.01 });
    g.audio?.play('clang');
    g.fx.particles.sparks(this.chest(_v).clone(), _v2.set(att.pos.x - this.pos.x, 0.3, att.pos.z - this.pos.z).normalize(), 20, 0x7fe6ff, 10, 1);
    g.fx.particles.flash(this.chest(_v).clone(), 0x7fe6ff, 1.6, 0.15);
    g.cameraRig.shake(0.3);
    att.hitstop = 0.18;
    this.hitstop = 0.1;
    g.hud?.toast('被看穿了', 'break');
    this.faceInstant(att.pos);
    this._chain([this.duel ? 'uppercut:fast' : 'uppercut'], { noDelay: true });
  }

  /** 真劍: a flurry that goes on too long is read -- the next blow is turned aside and answered. */
  _answerGreed(att) {
    this.compassBurst(3);
    this._turnAside(att);
    // (read, the rest of that flurry finds nothing: he is already coming back through it)
    this.invuln = Math.max(this.invuln, 0.45);
    return true;
  }

  /** 真劍: a breath technique thrown while he watches: he steps out of it, then comes back in. */
  _answerTechnique(f) {
    const g = this.game;
    g.hud?.toast('被看穿了', 'break');
    g.audio?.play('compass', { volume: 0.6 });
    this.compassBurst(4);
    this.faceInstant(f.pos);
    this._chain(['backstep', 'dash', this.rng() < 0.5 ? 'uppercut:fast' : 'hook:fast'], { dashAuto: true, noDelay: true });
  }

  // in phase 2+ he reads spammed attacks
  _readsBlow() {
    if (this.phase >= 2 && this.recentHits >= 4 && this.rng() < 0.45) {
      this._guard(1.0);
      return true;
    }
    return false;
  }

  _escape() {
    this._chain(this.rng() < 0.5 ? ['backstep', 'airType'] : ['spinKick']);
  }

  /** The tell: his fist (or foot) flares ice-blue a moment before it lands. */
  glint(def, big, follow, i = 0) {
    const g = this.game;
    // (a string of kicks says which leg each time)
    const limb = Array.isArray(def.limb) ? def.limb[Math.min(i, def.limb.length - 1)] : def.limb;
    const limbs = limb === 'both' ? ['handL', 'handR'] : [limb || 'handR'];
    for (const l of limbs) {
      this.rig.j(l).getWorldPosition(_v);
      g.fx.particles.add.emit({ pos: _v, color: _c.set(0xdff8ff), size: big ? 0.62 : 0.42, shape: SHAPE.STAR, life: 0.24, drag: 0, rot: Math.random() * 3 });
      g.fx.particles.flash(_v.clone(), 0x7fe6ff, big ? 1.3 : 0.8, 0.16);
    }
    g.fx.light(_v.clone(), 0x7fe6ff, big ? 3 : 1.8, 4, 0.2);
    g.audio?.play('tellFist', { pos: this.pos, volume: big ? 0.9 : 0.6 });
  }

  onKneel() {
    this.anim.play(this.clips.stagger, { fade: 0.05, hold: true, time: 0.5 });
  }

  onBehead() {
    if (this.compass) {
      this.compass.life = this.compass.age + 1.5;
      this.compass = null;
    }
    this.anim.play(this.clips.death, { fade: 0.1, hold: true });
  }

  _afterDeath() {
    const g = this.game;
    if (this.deathT > 2.2) {
      this._crumble(clamp((this.deathT - 2.2) / 3.5));
      // snowflake motes drifting up (Koyuki's hairpin)
      if (Math.random() < 0.4) {
        const c = this.chest(_v).clone().add(_v2.set((Math.random() - 0.5) * 1.5, Math.random() * 1.2, (Math.random() - 0.5) * 1.5));
        g.fx.particles.emit({ additive: true, pos: c, vel: _v3.set(0, 0.6 + Math.random() * 0.6, 0), color: _c.set(0xbff4ff), size: 0.08 + Math.random() * 0.08, shape: SHAPE.STAR, life: 2.5, drag: 0.3, spin: 1 });
      }
    }
  }

  // ---------------------------------------------------------------- phases
  _enterPhase(n) {
    this.phase = n;
    const g = this.game;
    this.action = null;
    this.queue = [];
    if (n === 2) {
      this.setState('action');
      this.run(this.moves.techniqueDev);
      this.curMove = 'techniqueDev';
      this.invuln = 2.0;
      g.audio?.playMusic('boss2', 1.0);
      g.hud?.callout({ school: '術式展開', form: '', name: '破壞殺・羅針', style: 'demon', side: 'left' });
      g.hud?.subtitle('猗窩座', '好鬥氣……真是至高的鬥氣！再讓我看看吧！', 3.2);
      g.slowmo(0.4, 1.0);
      g.onBossPhase?.(2);
    } else if (n === 3) {
      g.hud?.subtitle('猗窩座', '還不夠——！拿出你的全部！', 2.6);
      g.onBossPhase?.(3);
      this.finalCd = 0;
      this.setState('idle');
      this.cooldown = 0.3;
    }
  }

  _startFinal() {
    const g = this.game;
    this._chain(['finalType']);
    this.invuln = 0.6;
    g.fx.screen.flash(0x7fe6ff, 0.4, 4);
    g.audio?.play('compass');
    g.audio?.play('bossRoar');
    this.compassBurst(9);
  }

  // ---------------------------------------------------------------- fx
  afterimage() {
    this.game.fx.effects.afterimage(this.model, { color: 0xff6aa0, life: 0.3, alpha: 0.4 });
  }

  /** Aims a leap at the player (its motion covers `base` at scale 1) and marks where it will land. */
  markLanding(r, offset, time, base = 1) {
    const p = this.player;
    if (!p) return;
    const d = Math.max(0.2, this.distTo(p) - offset);
    r.motionScale = clamp(d, 0.2, 11) / base;
    this.faceInstant(p.pos);
    const f = this.forward(_v);
    const land = this.pos.clone().addScaledVector(f, r.motionScale * base + offset);
    this.game.fx.effects.decal(land, { kind: 'circle', size: 5, life: time + 0.15, color: 0x7fe6ff, alpha: 0.95, fillTime: time });
  }

  /** A kick's arc of air: -1 from his right, 1 from his left, 0 the high one. */
  kickFx(side) {
    const c = this.pos.clone();
    c.y = side ? 0.95 : 1.5;
    const f = this.forward(_v);
    const r = this.right(_v2);
    this.game.fx.effects.arc({
      center: c,
      f: side ? r.clone().multiplyScalar(side) : new THREE.Vector3(0, -1, 0),
      s: side ? f.clone() : f.clone(),
      radius: 2.1, width: 0.45, arc: Math.PI * 0.8, style: 'demon', life: 0.28, wipe: 0.06,
    });
  }

  slamFx(offset, size) {
    const f = this.forward(_v);
    const p = this.pos.clone().addScaledVector(f, offset);
    this.game.fx.ground(p, { size, color: 0x9fefff });
    this.game.fx.effects.decal(p, { kind: 'compass', size: size * 2.2, life: 1.2, color: 0x7fe6ff, alpha: 0.9, spin: 1.5, fadeIn: 0.02 });
    this.game.fx.screen.radial(0.35);
    this.game.cameraRig.shake(0.55);
    this.game.audio?.play('crack', { pos: p });
  }

  sweepFx() {
    const c = this.pos.clone();
    c.y = 0.5;
    this.game.fx.effects.arc({ center: c, f: new THREE.Vector3(1, 0, 0), s: new THREE.Vector3(0, 0, 1), radius: 2.6, width: 0.5, arc: Math.PI * 1.9, style: 'demon', life: 0.35, wipe: 0.12 });
    this.game.fx.effects.ring(c.setY(0.08), { color: 0xff8ab0, from: 0.4, to: 3.4, life: 0.35 });
  }

  punchBurst(dist) {
    const f = this.forward(_v);
    const p = this.chest(_v2).clone().addScaledVector(f, dist);
    this.game.fx.effects.ring(p.clone(), { color: 0xffffff, from: 0.2, to: 1.8, life: 0.25, normal: f.clone(), thick: 0.3 });
    this.game.fx.effects.decal(p.clone().setY(0), { kind: 'compass', size: 2.6, life: 0.6, color: 0x7fe6ff, alpha: 0.7 });
    this.game.fx.particles.flash(p, 0x7fe6ff, 1.4, 0.12);
  }

  barrageFx(len) {
    const g = this.game;
    g.fx.effects.timer(len, (t, dt) => {
      if (!this.alive || this.curMove !== 'barrage') return;
      if (Math.random() < dt * 40) {
        const f = this.forward(_v);
        const r = this.right(_v2);
        const p = this.chest(_v3).clone().addScaledVector(f, 1.1 + Math.random() * 0.9).addScaledVector(r, (Math.random() - 0.5) * 1.2);
        p.y += (Math.random() - 0.5) * 0.7;
        g.fx.particles.emit({ additive: true, pos: p, vel: f.clone().multiplyScalar(18), color: _c.set(0xffc0d8), w: 0.12, h: 0.25, shape: SHAPE.STREAK, stretch: 0.03, life: 0.1, drag: 0 });
        g.fx.particles.ring(p, 0xffffff, 0.35, 2.5, 0.12);
      }
    });
  }

  airWindup() {
    // fist drawn back, ice-blue glow: the tell for incoming air shockwaves
    const g = this.game;
    this.rig.j('handR').getWorldPosition(_v);
    g.fx.particles.flash(_v.clone(), 0x7fe6ff, 1.2, 0.3);
    g.fx.light(_v.clone(), 0x7fe6ff, 3, 5, 0.35);
    g.audio?.play('punchWhoosh', { pos: this.pos, pitch: 0.6, volume: 0.6 });
  }

  airPunch() {
    const g = this.game;
    const p = this.player;
    const from = this.chest(_v).clone().addScaledVector(this.forward(_v2), 0.8);
    const tgt = p ? p.chest(_v3).clone() : from.clone().addScaledVector(this.forward(_v2), 10);
    const dir = tgt.sub(from).normalize();
    dir.y = clamp(dir.y, -0.15, 0.1);
    dir.normalize();
    g.audio?.play('shockwave', { pos: from, volume: 0.8 });
    g.fx.effects.ring(from.clone(), { color: 0xffffff, from: 0.2, to: 1.4, life: 0.2, normal: dir.clone(), thick: 0.3 });
    const owner = this;
    g.combat.spawn({
      pos: from.clone(),
      vel: dir.clone().multiplyScalar(15),
      radius: 0.85,
      life: 1.4,
      owner,
      hit: P({ dmg: 8, poise: 12, knock: 3.5, stun: 'light', power: 0.6, shake: 0.3, sfx: 'shockwave', unparryable: true }),
      fx: (proj, dt) => {
        if (Math.random() < dt * 60) g.fx.particles.ring(proj.pos, 0xcff6ff, 1.1, 0.6, 0.12);
        g.fx.particles.emit({ additive: true, pos: proj.pos, vel: proj.vel, color: _c.set(0xffffff), w: 0.3, h: 0.2, shape: SHAPE.STREAK, stretch: 0.04, life: 0.08, drag: 0 });
      },
      onHit: (proj) => g.fx.particles.flash(proj.pos, 0x7fe6ff, 1.4, 0.12),
    });
  }

  chargeFx() {
    const g = this.game;
    g.audio?.play('bossCharge');
    this.compassBurst(4);
    const p = this.player;
    // unblockable telegraph: red line that tracks the player for 0.7s then locks
    let line = null;
    g.fx.effects.timer(1.0, (t) => {
      if (!this.alive || this.curMove !== 'annihilationCharge') return;
      if (t < 0.7 && p) this.faceInstant(p.pos);
      if (!line) line = g.fx.effects.decal(this.pos, { kind: 'line', size: 2.0, length: 13, rot: this.yaw + Math.PI, life: 1.1, color: 0xff2a3a, alpha: 0.9, fillTime: 1.0 });
      if (line && t < 0.7) {
        line.mesh.rotation.z = this.yaw + Math.PI;
        line.mesh.position.set(this.pos.x + Math.sin(this.yaw) * 6.5, 0.03, this.pos.z + Math.cos(this.yaw) * 6.5);
      }
      if (Math.random() < 0.5) g.fx.particles.embers(this.chest(_v).clone(), 1, 0x7fe6ff, 1.5, 0.6);
    });
    this.flash(0xff3040, 0.2);
    g.hud?.toast('無法格擋', 'break');
  }

  annihilationFx() {
    const g = this.game;
    for (let i = 0; i < 4; i++) g.fx.effects.timer(i * 0.035, null, () => this.afterimage());
    g.fx.screen.speed(1, 0.2);
    g.cameraRig.shake(0.5);
    const f = this.forward(_v);
    g.fx.effects.ring(this.chest(_v2).clone().addScaledVector(f, 2), { color: 0xffffff, from: 0.3, to: 2.5, life: 0.3, normal: f.clone(), thick: 0.35 });
  }

  compassBurst(size) {
    const g = this.game;
    g.fx.effects.decal(this.pos, { kind: 'compass', size, life: 1.4, color: 0x7fe6ff, alpha: 1, spin: 0.8, fadeIn: 0.05 });
    g.fx.light(this.chest(_v).clone(), 0x7fe6ff, 5, 10, 0.6);
  }

  techniqueFx() {
    const g = this.game;
    g.audio?.play('compass');
    g.audio?.play('bossRoar', { volume: 0.8 });
    g.fx.screen.flash(0x9fefff, 0.5, 3);
    g.fx.screen.radial(0.6);
    g.cameraRig.shake(0.6);
    this.compassBurst(12);
    if (!this.compass) this.compass = g.fx.effects.decal(this.pos, { kind: 'compass', size: 5.5, life: 1e6, color: 0x7fe6ff, alpha: 0.55, spin: 0.15, fadeIn: 1.2 });
    g.fx.effects.ring(this.pos.clone().setY(0.1), { color: 0x7fe6ff, from: 0.5, to: 14, life: 1.0, thick: 0.15 });
  }

  /** Expanding ground shock ring that must be dodged through (`late`: seconds after it should have started). */
  shockRing(offset, maxR, speed, width, dmg, late = 0) {
    const f = this.forward(_v);
    const c = this.pos.clone().addScaledVector(f, offset);
    this.hazards.push({ c, r: 0.5 + speed * late, maxR, speed, width, dmg, hit: false });
    this.game.fx.effects.ring(c.clone().setY(0.1), { color: 0x9fefff, from: 0.5 + speed * late, to: maxR, life: (maxR - speed * late) / speed, thick: 0.12 });
  }

  finalWave(i) {
    const g = this.game;
    this.shockRing(0, 14, 13, 0.9, 13);
    g.audio?.play('shockwave', { volume: 0.9 });
    g.audio?.play('barrage');
    g.cameraRig.shake(0.3);
    g.fx.screen.flash(0x7fe6ff, 0.18, 8);
    const c = this.chest(_v).clone();
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2 + i;
      const d = _v2.set(Math.sin(a), (Math.random() - 0.5) * 0.3, Math.cos(a));
      g.fx.particles.emit({ additive: true, pos: c.clone().addScaledVector(d, 0.8), vel: d.clone().multiplyScalar(26), color: _c.set(k % 2 ? 0xffc0d8 : 0x9fefff), w: 0.16, h: 0.3, shape: SHAPE.STREAK, stretch: 0.03, life: 0.35, drag: 0.5 });
    }
    this.compassBurst(8);
  }

  _hazardHit(h) {
    return P({ dmg: h.dmg, poise: 20, knock: 5, stun: 'heavy', power: 0.8, shake: 0.4, sfx: 'shockwave', unparryable: true });
  }
}
