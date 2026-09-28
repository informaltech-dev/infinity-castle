import * as THREE from 'three';
import { BossBase } from './boss.js';
import { compilePose } from './anim.js';
import { KOKUSHIBO_STANCE, KOKUSHIBO_RUN, KOKUSHIBO_STANCE2, KOKUSHIBO_RUN2 } from './poses.js';
import { Crescents } from '../fx/crescents.js';
import { SwordTrail } from '../fx/effects.js';
import { SHAPE } from '../fx/particles.js';
import { clamp, lerp, mulberry32, DEG } from '../core/math.js';
import { toonMaterial } from '../render/materials.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * How strong he is. Alone he is already past Akaza: more health, harder cuts, crescents that hang in the air,
 * and he reads a careless flurry. Against a party (a later stage) he is far worse: health per head on top of a
 * higher base, a faster clock, denser moons, shorter pauses between forms, and forms that fall on everyone.
 * `party` is the number of players; `force` picks a tier by name (?tier=coop tries the party tier alone).
 */
export const KOKUSHIBO_TIERS = {
  solo: { hp: 5000, dmg: 1.1, speed: 1, density: 1, recover: 0.95, cd: [0.12, 0.42], read: { after: 5, chance: 0.4 }, phase2: 0.5, regen: 0.004, chain: 0.22, everyone: false },
  coop: { hp: 6800, hpPer: 5400, dmg: 1.4, speed: 1.12, density: 1.6, recover: 0.6, cd: [0.04, 0.26], read: { after: 3, chance: 0.55 }, phase2: 0.55, regen: 0.006, chain: 0.45, everyone: true },
};

export function kokushiboTier(party = 1, force = null) {
  const key = force && Object.hasOwn(KOKUSHIBO_TIERS, force) ? force : party > 1 ? 'coop' : 'solo';
  const t = KOKUSHIBO_TIERS[key];
  const hp = key === 'coop' ? t.hp + t.hpPer * Math.max(0, party - 1) : t.hp;
  return { ...t, key, party, hp };
}

const S = (o) => ({ style: 'moon', sfx: 'hitSlash', power: 0.6, hitstop: 0.07, shake: 0.3, stun: 'light', ...o });
/** One crescent's cut: light (there are many), blocked like any blow but never parried back into him. */
const CUT = (o) => ({ style: 'moon', sfx: 'moonCut', power: 0.4, hitstop: 0.035, shake: 0.14, stun: 'light', knock: 1.4, poise: 5, unparryable: true, ...o });
const ev = (t, fn) => ({ t, fn });
const MB = (form, name) => ['月之呼吸', form, name];

// Swing planes of the cuts, as the clips draw them (tilt / yaw / hand angle from a0 to a1, degrees).
const SWINGS = {
  A: { tilt: 40, yaw: 0, a0: 136, a1: -40 },
  B: { tilt: 45, yaw: 0, a0: -124, a1: 90 },
  C: { tilt: 86, yaw: 0, a0: 114, a1: -106 },
  iai: { tilt: 88, yaw: 0, a0: -132, a1: 112 },
  pearl1: { tilt: 45, yaw: 0, a0: -118, a1: 92 },
  pearl2: { tilt: -45, yaw: 0, a0: -116, a1: 92 },
  pearl3: { tilt: 0, yaw: 0, a0: -128, a1: 104 },
  loathe1: { tilt: 86, yaw: 0, a0: 106, a1: -112 },
  loathe2: { tilt: 86, yaw: 0, a0: -122, a1: 114 },
  eternal: { tilt: 22, yaw: 0, a0: 162, a1: -70 },
  mirror: { tilt: -24, yaw: -10, a0: -138, a1: 112 },
  dragon: { tilt: 88, yaw: 0, a0: 142, a1: -150 },
  descend1: { tilt: 0, yaw: -4, a0: 176, a1: -44 },
  descend2: { tilt: 0, yaw: -4, a0: -58, a1: 128 },
  sky: { tilt: 0, yaw: -4, a0: 100, a1: -50 },
};

// Wind-up holds (seconds; see ActionRunner): 'open' when a cut starts a string, 'fast' as a follow-up,
// 'delay' when he holds it back on purpose. `tells` are the moments of full wind-up in each clip.
const HOLD = (open, fast, delay) => ({ open, fast: fast ?? open * 0.4, delay });

function kokushiboMoves(b) {
  const d = (x) => Math.round(x * b.tier.dmg);
  const slash = (clip, t, kind, long, at, hold) => ({
    clip, turn: [0, at + 0.04, 12], motion: [[0.06, t + 0.02, long ? 1.4 : 1.1]], trail: true,
    hits: [S({ t, range: long ? 4.9 : 2.9, arc: kind === 'C' ? 170 : 130, dmg: d(long ? 13 : 10), poise: 14, knock: long ? 3 : 2 })],
    events: [ev(t - 0.01, (a) => a.swing(kind))],
    sfx: [{ t: t - 0.06, name: 'moonSlash', opts: long ? { pitch: 0.8 } : undefined }],
    tells: [at], holds: hold, recover: 0.8,
  });
  // (the draw's tell is its stance's; a counter-draw straight out of a read carries its own)
  const iai = (long, dmg, tell = false) => ({
    clip: 'iai', turn: [0, 0.03, 20], motion: [[0, 0.07, 1, 'out']], trail: true,
    hits: [S({ t: 0.07, range: long ? 5.8 : 3.6, arc: 180, dmg: d(dmg), poise: 30, knock: 4, stun: 'heavy', power: 0.85, shake: 0.45 })],
    events: [ev(0.01, (a) => a.afterimage()), ev(0.06, (a) => a.swing('iai', { n: long ? 18 : 12, spill: long ? 3.8 : 2.4 }))],
    sfx: [{ t: 0.0, name: 'moonDraw' }],
    noTell: !tell, recover: 0.95,
  });
  const iaiReady = (next) => ({
    clip: 'iaiReady', dur: 0.5, turn: [0, 0.5, 9], hold: true, windup: 0.5, next,
    events: [ev(0, (a) => a.drawTell())],
    name: MB('壹之型', '闇月・宵之宮'),
    // the stance is held a varying while; the draw is in the next move, 0.07 in
    tells: [0.45], holds: { open: 0.3 }, strikes: [0.57],
    onUpdate: (a, r) => a._iaiWatch(r, next === 'iai2'),
  });
  const thrust = (long) => ({
    // (it stops tracking as the wind-up is held: when the 危 shows, stepping off the line works)
    clip: 'thrust', turn: [0, 0.28, 10], motion: [[0.3, 0.42, long ? 3.2 : 2.2, 'out']], trail: true, armor: [0.3, 0.5],
    hits: [S({ t: 0.4, shape: 'line', range: long ? 7.4 : 4.8, width: 0.75, dmg: d(long ? 24 : 20), poise: 34, knock: 5, stun: 'heavy', power: 0.9, shake: 0.5, unblockable: true })],
    events: [ev(0.39, (a) => a.thrustFx(long ? 7.4 : 4.8))],
    sfx: [{ t: 0.34, name: 'moonSlash', opts: { pitch: 1.25 } }],
    tells: [0.3], holds: HOLD(0.28, 0.2, 0.62), perilous: true, recover: 1.2,
  });
  const step = (side) => ({
    clip: side > 0 ? 'stepL' : 'stepR', motion: [[0, 0.26, 3.0, 'out', (side * Math.PI) / 2]],
    events: [ev(0.01, (a) => a.afterimage())],
    sfx: [{ t: 0, name: 'dodge', opts: { pitch: 0.75 } }],
  });
  return {
    // ------------------------------------------------ plain cuts
    slashA: slash('slashA', 0.16, 'A', false, 0.08, HOLD(0.36, 0.14, 0.7)),
    slashB: slash('slashB', 0.16, 'B', false, 0.07, HOLD(0.32, 0.12, 0.65)),
    slashC: slash('slashC', 0.18, 'C', false, 0.08, HOLD(0.36, 0.16, 0.7)),
    longA: slash('slashA', 0.16, 'A', true, 0.08, HOLD(0.38, 0.16, 0.7)),
    longB: slash('slashB', 0.16, 'B', true, 0.07, HOLD(0.34, 0.14, 0.65)),
    longC: slash('slashC', 0.18, 'C', true, 0.08, HOLD(0.38, 0.18, 0.7)),
    dash: {
      clip: 'dash', turn: [0, 0.2, 14], motion: [[0, 0.26, 1, 'out']],
      events: [ev(0.01, (a) => a.afterimage())],
      sfx: [{ t: 0, name: 'dodge', opts: { pitch: 0.7 } }],
    },
    hop: {
      clip: 'hop', motion: [[0, 0.3, 3.4, 'out', Math.PI]],
      events: [ev(0.01, (a) => a.afterimage())],
      sfx: [{ t: 0, name: 'dodge', opts: { pitch: 0.8 } }],
    },
    stepL: step(1),
    stepR: step(-1),
    // ------------------------------------------------ 壹之型・闇月・宵之宮: the draw
    iaiReady: iaiReady('iai'),
    iaiReady2: iaiReady('iai2'),
    iai: iai(false, 18),
    iai2: iai(true, 22),
    // 通透世界's answer: the same draw, straight out of the read
    counter: iai(false, 14, true),
    counter2: iai(true, 17, true),
    // a straight thrust along a line: no guard turns it, only stepping off the line
    thrust: thrust(false),
    thrust2: thrust(true),
    // ------------------------------------------------ 貳之型・珠華之弄月: three rising cuts, each throwing a wave
    pearl: {
      clip: 'pearl', turn: [0, 0.8, 8], motion: [[0.2, 0.78, 1.4]], trail: true, windup: 0.24,
      hits: [0.26, 0.5, 0.76].map((t) => S({ t, range: 3.0, arc: 110, dmg: d(7), poise: 12 })),
      events: [
        ev(0, (a) => a.drawTell()),
        ev(0.25, (a) => a.swing('pearl1', { n: 5, max: 2, waves: [2, 11, 0.9, 0.25] })),
        ev(0.49, (a) => a.swing('pearl2', { n: 5, waves: [2, 11, 0.9, -0.25] })),
        ev(0.75, (a) => a.swing('pearl3', { n: 6, waves: [3, 12, 1.0, 0] })),
      ],
      sfx: [0.2, 0.44, 0.7].map((t) => ({ t, name: 'moonSlash', opts: { pitch: 1.1 } })),
      name: MB('貳之型', '珠華之弄月'),
      tells: [0.16, 0.36, 0.62], recover: 1.0,
      holds: { open: [0.24, 0.06, 0.06], fast: [0.12, 0.06, 0.06], delay: [0.24, 0.5, 0.06] },
    },
    // ------------------------------------------------ 參之型・厭忌月・銷蝕: two flat sweeps, a fan of crescents each
    loathe: {
      clip: 'loathe', turn: [0, 0.4, 7], motion: [[0.1, 0.5, 1.4]], trail: true, windup: 0.18,
      hits: [S({ t: 0.18, range: 3.7, arc: 200, dmg: d(11) }), S({ t: 0.48, range: 3.7, arc: 200, dmg: d(11) })],
      events: [ev(0.17, (a) => a.swing('loathe1', { n: 10, spill: 2.6 })), ev(0.47, (a) => a.swing('loathe2', { n: 10, spill: 2.6 }))],
      sfx: [{ t: 0.12, name: 'moonSlash' }, { t: 0.42, name: 'moonSlash', opts: { pitch: 0.9 } }],
      name: MB('參之型', '厭忌月・銷蝕'),
      tells: [0, 0.3], fade: 0.1, recover: 1.0,
      holds: { open: [0.34, 0.06], fast: [0.16, 0.06], delay: [0.34, 0.45] },
    },
    // ------------------------------------------------ 伍之型・月魄災渦: no swing -- the moons simply come
    cast: {
      clip: 'cast', dur: 1.0, turn: [0, 0.2, 6], armor: [0, 0.9], windup: 0.25,
      events: [ev(0, (a, r) => a.vortexTell(r.timeTo(0.25))), ev(0.25, (a) => a.vortex())],
      name: MB('伍之型', '月魄災渦'),
      tells: [0.2], holds: HOLD(0.2, 0.12), strikes: [0.25], recover: 1.1,
    },
    // ------------------------------------------------ 陸之型・常夜孤月・無間: one cut, countless moons ahead of it
    eternal: {
      clip: 'eternal', dur: 1.1, turn: [0, 0.38, 8], armor: [0.2, 0.6], windup: 0.38, trail: true,
      hits: [S({ t: 0.44, range: 3.3, arc: 110, dmg: d(18), power: 0.9, stun: 'heavy', poise: 30 })],
      events: [ev(0, (a, r) => a.fieldTell(10.5, 7, r.timeTo(0.43))), ev(0.43, (a) => a.swing('eternal', { n: 8, then: () => a.field(10.5, 7, 26) }))],
      sfx: [{ t: 0.38, name: 'moonSlash', opts: { pitch: 0.75 } }],
      name: MB('陸之型', '常夜孤月・無間'),
      tells: [0.34], holds: HOLD(0.12, 0.08, 0.5), recover: 1.2,
    },
    // ------------------------------------------------ the second state
    transform: {
      clip: 'transform', dur: 2.4, armor: [0, 2.4], hold: true,
      onUpdate: (a, r) => r.t >= 0.35 && r.t < 2.0 && (a.game.fx.screen.desatTarget = 0.4),
      events: [ev(0.35, (a) => a.transformStart()), ev(0.6, (a) => a.growBlade(1.3)), ev(1.5, (a) => a.bladeEyesOpen()), ev(2.0, (a) => a.transformBurst())],
    },
    // 漆之型・厄鏡・月映: a rising diagonal cut; crescents run out along the floor in a fan
    mirror: {
      clip: 'mirror', turn: [0, 0.3, 8], windup: 0.3, trail: true,
      hits: [S({ t: 0.36, shape: 'line', range: 5.6, width: 1.0, dmg: d(20), power: 0.85, stun: 'heavy', poise: 30 })],
      events: [ev(0.35, (a) => a.swing('mirror', { n: 10, then: () => a.groundWaves(5, 0.72) }))],
      sfx: [{ t: 0.28, name: 'moonSlash', opts: { pitch: 0.7 } }],
      name: MB('漆之型', '厄鏡・月映'),
      tells: [0.24], holds: HOLD(0.14, 0.08, 0.5), recover: 1.1,
    },
    // 捌之型・月龍輪尾: the whole length swept flat round more than half a circle
    dragon: {
      clip: 'dragon', turn: [0, 0.26, 7], windup: 0.26, armor: [0.2, 0.6], trail: true,
      hits: [S({ t: 0.42, range: 6.6, arc: 250, dmg: d(24), power: 0.95, stun: 'down', knock: 6, poise: 40, shake: 0.55 })],
      events: [ev(0, (a, r) => a.arcTell(7, 250, r.timeTo(0.42))), ev(0.38, (a) => a.swing('dragon', { n: 22, spill: 3.6, r: 3.3 }))],
      sfx: [{ t: 0.32, name: 'moonSlash', opts: { pitch: 0.6 } }],
      name: MB('捌之型', '月龍輪尾'),
      tells: [0.24], holds: HOLD(0.16, 0.1, 0.55), recover: 1.2,
    },
    // 玖之型・墮月・連面: down from overhead along a line, then back up, crescents curling every which way
    descend: {
      clip: 'descend', turn: [0, 0.26, 8], windup: 0.2, trail: true,
      hits: [S({ t: 0.3, shape: 'line', range: 7.2, width: 1.1, dmg: d(20), stun: 'down', power: 0.9, poise: 30 }), S({ t: 0.6, range: 4.6, arc: 100, dmg: d(14) })],
      events: [
        ev(0, (a, r) => a.lineTell(8.5, 2.4, r.timeTo(0.3))),
        ev(0.29, (a) => a.swing('descend1', { n: 8, then: () => a.lineFall(8.5) })),
        ev(0.59, (a) => a.swing('descend2', { n: 8, then: () => a.curls(10) })),
      ],
      sfx: [{ t: 0.24, name: 'moonSlash', opts: { pitch: 0.7 } }, { t: 0.54, name: 'moonSlash', opts: { pitch: 0.9 } }],
      name: MB('玖之型', '墮月・連面'),
      tells: [0.18, 0.46], recover: 1.2,
      holds: { open: [0.14, 0], fast: [0.1, 0], delay: [0.14, 0.42] },
    },
    // 拾之型・穿面斬・籮月: the blade wheeled round twice, each turn sending a great saw of moons down the floor
    saw: {
      clip: 'saw', turn: [0, 0.5, 7], windup: 0.14, trail: true,
      events: [ev(0.46, (a) => a.sawWheel(1)), ev(0.84, (a) => a.sawWheel(-1))],
      sfx: [{ t: 0.4, name: 'moonVortex' }, { t: 0.78, name: 'moonVortex', opts: { pitch: 0.9 } }],
      name: MB('拾之型', '穿面斬・籮月'),
      tells: [0.14], holds: HOLD(0.1, 0.06), strikes: [0.46, 0.84], recover: 1.3,
    },
    // 拾肆之型・兇變・天滿纖月: two whole turns, the crescents spiralling out in layers
    spiral: {
      clip: 'spiral', armor: [0, 1.1], windup: 0.18, trail: true,
      multi: [S({ t0: 0.3, t1: 0.95, every: 0.16, shape: 'circle', range: 4.6, dmg: d(5), poise: 6, knock: 2.5, hitstop: 0.03, power: 0.5 })],
      events: [ev(0, (a, r) => a.ringTell(9, r.timeTo(0.3))), ev(0.2, (a) => a.spiral(0.85))],
      sfx: [{ t: 0.2, name: 'moonVortex', opts: { pitch: 0.8 } }],
      name: MB('拾肆之型', '兇變・天滿纖月'),
      tells: [0.18], holds: HOLD(0.14, 0.08), recover: 1.3,
    },
    // 拾陸之型・月虹・孤留月: raised to the sky; moons fall on the marked ground
    sky: {
      clip: 'sky', turn: [0, 0.3, 6], armor: [0.3, 1.1], windup: 0.36, trail: true,
      events: [ev(0.36, (a) => a.skyMarks(0.62)), ev(0.98, (a) => a.swing('sky', { n: 6 }))],
      sfx: [{ t: 0.9, name: 'moonSlash', opts: { pitch: 0.7 } }],
      name: MB('拾陸之型', '月虹・孤留月'),
      strikes: [0.98], recover: 1.4,
    },
  };
}

export class Kokushibo extends BossBase {
  /**
   * @param {object} tier  kokushiboTier(): hp, damage, speed, crescent density, pauses, reads
   * @param {number} seed  his move choices and every crescent pattern come from this
   */
  constructor(game, model, tier = kokushiboTier(1), seed = 1) {
    super(game, model, { hp: tier.hp, poise: 230, radius: 0.5, height: 1.98, mass: 3.2, poiseRegen: 14 });
    this.tier = tier;
    this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed);
    this.speedMul = tier.speed;
    this.regenRate = tier.regen;
    this.calloutStyle = 'moon';
    this.telegraphColor = 0xffd27a;
    this.moves = kokushiboMoves(this);
    this.moons = new Crescents(game.scene, game.fx);
    this.trail = new SwordTrail(game.scene, { style: 'moon' });
    this.trail.setStyle('moon', { life: 0.22, extend: 0.25, inner: 0.1 });
    this.trailOn = false;
    this._base = new THREE.Vector3();
    this._tip = new THREE.Vector3();
    this.sampleCb = () => this._sampleSword();
    this.flute = null;
    this.crumbleT = -1;
    this.iaiT = -99;
    /** Bumped when a new phase begins and when he kneels: whatever he set going before throws nothing more. */
    this._era = 0;
    /** (for tests and tuning) */
    this.log = { reads: 0, forms: {} };
  }

  /** How thick the moons come: the tier's, and in a duel sparser (it is fought blade to blade). */
  get density() {
    return this.tier.density * (this.duel ? 0.85 : 1);
  }

  get hudInfo() {
    return { title: '上弦之壹', name: '黑死牟', phaseMarks: [this.tier.phase2], theme: 'moon' };
  }

  get blade() {
    const s = this.model.sword;
    return this.phase >= 2 && s.long.group.visible ? s.long : s;
  }

  // ---------------------------------------------------------------- per frame
  tickExtra(dt) {
    this.moons.update(dt);
    this._moonHits();
    this.trail.update(this.game.time, this.trailOn);
  }

  tickTimers() {
    // the trail follows the cut being made, nothing else
    const r = this.action;
    this.trailOn = !!(r && r.def.trail && this.state === 'action');
  }

  _sampleSword() {
    const b = this.blade;
    b.base.getWorldPosition(this._base);
    b.tip.getWorldPosition(this._tip);
    if (this.trailOn) this.trail.push(this._base, this._tip, this.game.time);
  }

  _checkPhase() {
    // (not in the middle of a form, nor of a broken posture: the execution window is the player's)
    if (this.phase === 1 && this.hp / this.maxHp < this.tier.phase2 && this.state !== 'action' && this.state !== 'intro' && this.state !== 'stagger') this._enterPhase(2);
  }

  // ---------------------------------------------------------------- brain
  _think(dt, p) {
    this.cooldown -= dt;
    this.anim.setLoco(0, 0, 0);
    if (!p) return;
    this.turnTowards(p.pos, 7, dt);
    const d = this.distTo(p);
    if (this.duel && this.cooldown > 0.15 && p.stamina < 18 && d < 6) this.cooldown = 0.15; // out of breath: he comes
    if (this.cooldown > 0) {
      // a duel: he circles, measuring; otherwise, unhurried, he walks in while he waits
      if (this.duel) this._footwork(dt, p, this.phase >= 2 ? 5.2 : 4.2, 1.7);
      else if (d > 4.5) this._stepToward(dt, p, 1.7);
      return;
    }
    const opts = [];
    const add = (name, w, range) => {
      if (name === this.lastMove) w *= 0.25;
      if ((name === 'iai' || name === 'hopIai') && this.game.time - this.iaiT < 5) w *= 0.3;
      opts.push({ name, w, range });
    };
    if (this.duel) this._duelOptions(add, d, p);
    else if (this.phase < 2) {
      if (d > 8) {
        add('iai', 2.4, 30);
        add('eternal', 1.3, 9);
        add('dashCombo', 2, 30);
      } else if (d > 3.4) {
        add('iai', 2.4, 30);
        add('pearl', 1.6, 6);
        add('eternal', 1.8, 9);
        add('dashCombo', 1.4, 30);
        add('loathe', 1.0, 4.6);
      } else {
        add('combo', 3, 3.2);
        add('loathe', 1.8, 4.2);
        add('cast', 1.6, 4.4);
        add('pearl', 1.2, 4);
        add('hopIai', 1.0, 30);
      }
    } else if (d > 9) {
      add('mirror', 2, 30);
      add('saw', 2, 30);
      add('sky', 1.8, 30);
      add('iai', 1.2, 30);
    } else if (d > 4.6) {
      add('dragon', 2, 6.8);
      add('mirror', 1.8, 12);
      add('descend', 1.6, 8.5);
      add('saw', 1.5, 14);
      add('iai', 1.4, 30);
      add('sky', 1.2, 30);
    } else {
      add('combo', 2, 5);
      add('spiral', 1.8, 30);
      add('cast', 1.2, 5.2);
      add('dragon', 1.6, 6.8);
      add('descend', 1.4, 8.5);
    }
    const choice = this._pick(opts);
    this.plan = choice;
    this.planT = 0;
    this.lastMove = choice.name;
    if (d > choice.range) this.setState('approach');
    else this._execute(choice.name);
  }

  /** 真劍: his choices, weighted by what he has read of this foe (guarding, keeping away). */
  _duelOptions(add, d, p) {
    const h = this.habitsOf(p);
    const turtle = h.turtle, away = h.away;
    if (this.phase < 2) {
      if (d > 8) {
        add('iai', 2.4, 30);
        add('eternal', 1.3 + away, 9);
        add('dashCombo', 2 + away, 30);
      } else if (d > 3.3) {
        add('iai', 2.2, 30);
        add('pearl', 1.4, 6);
        add('eternal', 1.4, 9);
        add('dashCombo', 1.4, 30);
        add('thrust', 0.7 + turtle * 3, 6);
        add('loathe', 0.8, 4.6);
      } else {
        add('c2', 1.8, 3.2);
        add('c3', 1.8, 3.2);
        add('c3d', 1.1, 3.2);
        add('cDraw', 1.1, 3.2);
        add('cC', 1.0, 3.2);
        add('loathe', 1.2, 4.2);
        add('cast', 1.0 + (d < 2 ? 1 : 0), 4.4);
        add('pearl', 1.0, 4);
        add('hopIai', 0.8, 30);
        add('thrust', 0.5 + turtle * 3, 4.6);
      }
    } else if (d > 9) {
      add('mirror', 2, 30);
      add('saw', 2, 30);
      add('sky', 1.8, 30);
      add('iai', 1.2, 30);
      add('thrust', 0.6 + away, 7);
    } else if (d > 5.2) {
      add('dragon', 1.8, 6.8);
      add('mirror', 1.8, 12);
      add('descend', 1.5, 8.5);
      add('saw', 1.2, 14);
      add('iai', 1.4, 30);
      add('sky', 1.0, 30);
      add('thrust', 0.7 + turtle * 2, 7);
    } else {
      add('L2', 1.6, 5);
      add('L3', 1.6, 5);
      add('dragon', 1.5, 6.8);
      add('dragonFall', 0.8, 6.8);
      add('descend', 1.2, 8.5);
      add('spiral', 1.3, 30);
      add('cast', 0.9 + (d < 2.5 ? 1 : 0), 5.2);
      add('mirrorDraw', 0.8, 12);
      add('thrust', 0.5 + turtle * 3, 7);
    }
  }

  _approach(dt, p) {
    if (!p) return this.setState('idle');
    this.planT += dt;
    const d = this.distTo(p);
    this.turnTowards(p.pos, 9, dt);
    this._stepToward(dt, p, this.phase >= 2 ? 7.2 : 6.2);
    if (d <= this.plan.range) this._execute(this.plan.name);
    else if (this.planT > 1.8) this._execute(d > 7 ? 'iai' : 'dashCombo');
  }

  /** A draw's stance is held a varying while (a duel: long enough to be a feint of its own). */
  _drawHold() {
    return this.duel ? 0.3 + this.rng() * 0.75 : 0.22 + this.rng() * 0.28;
  }

  _execute(name) {
    const long = this.phase >= 2;
    const p = this.target;
    const d = p ? this.distTo(p) : 0;
    const A = long ? 'longA' : 'slashA', B = long ? 'longB' : 'slashB', C = long ? 'longC' : 'slashC';
    const ready = (long ? 'iaiReady2' : 'iaiReady') + ':' + this._drawHold().toFixed(2);
    switch (name) {
      case 'combo':
        this._chain([A, B, C]);
        return;
      // 真劍 strings: two or three cuts, the last one held back now and then, or a draw to finish
      case 'c2':
      case 'L2':
        this._chain([A, B]);
        return;
      case 'c3':
      case 'L3':
        this._chain([A, B, C]);
        return;
      case 'c3d':
        this._chain([A, B, C + ':delay']);
        return;
      case 'cDraw':
        this.iaiT = this.game.time;
        this._chain([A, B, (long ? 'iaiReady2' : 'iaiReady') + ':0.2']);
        return;
      case 'cC':
        this._chain([C, A + ':delay', B]);
        return;
      case 'dragonFall':
        this._chain(['dragon', 'descend:delay']);
        return;
      case 'mirrorDraw':
        this.iaiT = this.game.time;
        this._chain(['mirror', 'iaiReady2:0.2']);
        return;
      case 'thrust':
        this._chain([long ? 'thrust2' : 'thrust']);
        return;
      case 'dashCombo':
        this._chain(this.duel ? ['dash', C + ':fast', A + ':delay'] : long ? ['dash', 'longC', 'longA'] : ['dash', 'slashC', 'slashA'], { dash: Math.max(0.4, d - (long ? 3.8 : 2.2)) });
        return;
      case 'iai':
        this.iaiT = this.game.time;
        this._chain([ready]);
        return;
      case 'hopIai':
        this._chain(['hop', 'iaiReady:' + this._drawHold().toFixed(2)]);
        return;
      default:
        this._chain([name]);
    }
  }

  _run(name, kind) {
    this.log.forms[name] = (this.log.forms[name] || 0) + 1;
    super._run(name, kind);
  }

  _motionScale(name) {
    const p = this.target;
    if (name === 'dash') return clamp(this.chainOpts?.dash ?? 3, 0.3, 8);
    if (name === 'iai' || name === 'iai2' || name === 'counter' || name === 'counter2') {
      // the draw carries him in to where the blade reaches
      const d = p ? this.distTo(p) : 3;
      return clamp(d - (name.endsWith('2') ? 4.4 : 2.6), 0.2, 6);
    }
    if (name === 'thrust' || name === 'thrust2') {
      const d = p ? this.distTo(p) : 3;
      return clamp((d - (name === 'thrust2' ? 4.6 : 2.8)) / (name === 'thrust2' ? 3.2 : 2.2), 0.2, 1.6);
    }
    return 1;
  }

  /** A duel: someone walking into the reach of a held draw brings it out at once (but still flashed). */
  _iaiWatch(r, long) {
    if (!this.duel || !r.holding) return;
    const reach = long ? 5.4 : 3.4;
    for (const f of this.foes) {
      if (this.distTo(f) < reach) {
        r.cutHold(0.2);
        return;
      }
    }
  }

  _recoverLen(r) {
    if (this.duel) return super._recoverLen(r) * (this.tier.key === 'coop' ? 0.75 : 1);
    const diff = this.game.settings?.difficulty || 'normal';
    const k = diff === 'hard' ? 0.7 : diff === 'easy' ? 1.45 : 1;
    const hp01 = this.hp / this.maxHp;
    let len = 0.62 * this.tier.recover * k * (this.phase >= 2 ? 0.85 : 1) * (0.7 + 0.3 * hp01);
    // now and then one form flows straight into the next
    if (this.rng() < this.tier.chain * (this.phase >= 2 ? 1.4 : 1) * (1.4 - hp01 * 0.4)) len *= 0.2;
    return len;
  }

  _nextCooldown() {
    if (this.duel) return super._nextCooldown();
    const [a, b] = this.tier.cd;
    return lerp(a, b, this.rng());
  }

  /** A duel's opening: a string of plain cuts ends with the blade flicked clean, then lowered. */
  onRecover(r) {
    if (!this.duel || !r.def.hits || !/^(slash|long)/.test(this.curMove)) return;
    this.anim.play(this.clips.chiburi, { fade: 0.08 });
  }

  // ---------------------------------------------------------------- 通透世界: he sees the flurry coming
  _readsBlow(att, h) {
    // blades close at hand only: not an ultimate, not a thrown technique, not from across the floor
    // (a duel reads differently: see _answerGreed and _answerTechnique)
    if (this.duel || !att || att.team !== 'player' || this.state === 'guard' || att.state === 'ult' || h?.unparryable || this.distTo(att) > 4.5) return false;
    const R = this.tier.read;
    if (this.recentHits < R.after || this.rng() >= R.chance) return false;
    this._read(att);
    return true;
  }

  _read(att) {
    const g = this.game;
    this.recentHits = 0;
    this.invuln = 0.5;
    this.action = null;
    this.queue = [];
    this.faceInstant(att.pos);
    this.setState('guard');
    this.guardT = 0.6;
    this.anim.play(this.clips.counterGuard, { fade: 0.02 });
    // half a step aside
    this.knock.copy(this.right(_v)).multiplyScalar(this.rng() < 0.5 ? 5 : -5);
    this.eyeFlash();
    g.hud?.toast('通透世界', 'break');
    g.audio?.play('moonRead');
    this.own(g.fx.effects.timer(0.22, null, () => {
      if (this.alive && this.state === 'guard') this._chain([this.phase >= 2 ? 'counter2' : 'counter']);
    }));
    this.log.reads++;
  }

  /** 真劍: a flurry that goes on too long -- the next blow finds nothing, and the draw answers. */
  _answerGreed(att) {
    this._read(att);
    return true;
  }

  /** 真劍: a breath technique thrown while he watches: he steps out of its path and draws as it ends. */
  _answerTechnique(f) {
    const g = this.game;
    this.faceInstant(f.pos);
    this.eyeFlash();
    g.hud?.toast('通透世界', 'break');
    g.audio?.play('moonRead');
    this.log.reads++;
    this.iaiT = g.time;
    this._chain([this.rng() < 0.5 ? 'stepL' : 'stepR', (this.phase >= 2 ? 'iaiReady2' : 'iaiReady') + ':0.15'], { noDelay: true });
  }

  /**
   * A cut read cleanly (parried, or dodged at the last instant): its crescents are part of it. In a duel
   * none of that form's moons cut the one who read it, those still to come included; otherwise only those
   * about them now are turned aside.
   */
  onParriedBy(f) {
    const grp = this.action?.data.moonGroup;
    if (this.duel) {
      if (grp) grp.immune.add(f);
      return;
    }
    if (!grp) return;
    for (const c of this.moons.list) {
      if (c.group !== grp) continue;
      if (Math.hypot(c.pos.x - f.pos.x, c.pos.z - f.pos.z) < 3.2) (c.hitSet ??= new Set()).add(f);
    }
  }

  /** A duel: a dodge made as a form's cut is about to fall reads the form -- its moons pass them by. */
  onFoeDodge(f) {
    if (!this.duel || this.state !== 'action' || !this.action) return;
    const r = this.action;
    const d = r.def;
    // the cut coming: this move's own, or (a draw's stance) the one it runs into
    let h = null, tc = null;
    (d.hits || []).forEach((x, i) => {
      if (!r.fired.has('h' + i) && (tc == null || x.t < tc)) (h = x), (tc = x.t);
    });
    let lunge = 0;
    if (!h && d.next && d.strikes) {
      const nd = this.moves[d.next];
      h = nd?.hits?.[0] || null;
      tc = d.strikes[0];
      if (nd?.motion) lunge = nd.motion.reduce((sum, m) => sum + m[2], 0) * this._motionScale(d.next, nd);
    }
    if (!h || r.timeTo(tc) >= 0.4) return;
    // only from within its reach (and a margin): a dodge made across the floor reads nothing
    const reach = { ...h, range: (h.range ?? 2.2) + lunge + 1.5, width: (h.width ?? 0.8) + 1.2, arc: Math.min(360, (h.arc ?? 120) + 40) };
    if (this.game.combat.inShape(this, f, reach)) this._group().immune.add(f);
  }

  onPerfectDodgedBy(f) {
    const D = this.duel;
    if (!D) return;
    // the moons that set off the dodge -- whichever form threw them -- and whatever hangs about the dodger pass
    // them by (the cut of the form in hand is read by onFoeDodge, when the dodge was made against that cut)
    const horizon = D.perfect.horizon + 0.1;
    for (const c of this.moons.list) {
      const grp = c.group;
      if (!grp || grp.immune.has(f)) continue;
      if (Math.hypot(c.pos.x - f.pos.x, c.pos.z - f.pos.z) < 4 || this._moonReaches(c, f, horizon)) grp.immune.add(f);
    }
  }

  _escape() {
    this._chain(['hop', this.phase >= 2 ? 'iaiReady2' : 'iaiReady']);
  }

  onStagger() {
    this.trailOn = false;
  }

  // ---------------------------------------------------------------- the second state
  _enterPhase(n) {
    if (n !== 2) return;
    const g = this.game;
    this.phase = 2;
    this.action = null;
    this.queue = [];
    this.moons.cancel();
    this._era++;
    this.setState('action');
    this.run(this.moves.transform);
    this.curMove = 'transform';
    this.invuln = 3.0;
    this.recentHits = 0;
    g.hud?.subtitle('黑死牟', '……不錯。那就讓你見識，月之呼吸真正的樣子。', 3.4);
    g.slowmo(0.5, 0.8);
    g.onBossPhase?.(2);
  }

  transformStart() {
    const g = this.game;
    g.audio?.playMusic(null, 1.0);
    g.audio?.play('moonTransform');
    g.fx.screen.desatTarget = 0.4;
    this.eyeFlash();
  }

  /** Kyokotsu Kamusari grows: the katana goes, the long branched blade pushes out of the grip. */
  growBlade(len) {
    const g = this.game;
    const s = this.model.sword;
    for (const o of s.shortParts) o.visible = false;
    const L = s.long.group;
    L.visible = true;
    L.scale.set(1, 0.2, 1);
    this.own(g.fx.effects.timer(len, (t) => {
      const e = 1 - Math.pow(1 - t, 3);
      L.scale.set(1, 0.2 + 0.8 * e, 1);
      if (Math.random() < 0.6) {
        s.long.tip.getWorldPosition(_v);
        g.fx.particles.sparks(_v, _v2.set(0, 1, 0), 2, 0xd8b8ff, 3, 1.2);
      }
    }, () => L.scale.set(1, 1, 1)));
    g.cameraRig.shake(0.3);
  }

  bladeEyesOpen() {
    const g = this.game;
    const s = this.model.sword.long;
    for (let i = 0; i < 9; i++) {
      _v.set(0, 0.3 + i * 0.26, 0.02);
      s.group.localToWorld(_v);
      g.fx.particles.flash(_v.clone(), 0xffc040, 0.5, 0.25);
    }
    g.audio?.play('moonRead', { pitch: 0.7 });
  }

  transformBurst() {
    const g = this.game;
    g.fx.screen.flash(0xd8b8ff, 0.5, 3);
    g.fx.screen.radial(0.7);
    g.fx.screen.desatTarget = 0;
    g.cameraRig.shake(0.7);
    g.audio?.play('bossRoar', { pitch: 0.7 });
    g.audio?.play('moonVortex', { pitch: 0.6 });
    g.audio?.playMusic('moon2', 0.4);
    const c = this.pos.clone().setY(0.1);
    g.fx.effects.ring(c, { color: 0xc8a0ff, from: 0.5, to: 16, life: 1.1, thick: 0.12 });
    g.fx.effects.ring(c.clone().setY(1.2), { color: 0xffe6a8, from: 0.4, to: 9, life: 0.7, thick: 0.2 });
    g.fx.light(this.chest(_v).clone(), 0xc8a0ff, 6, 14, 0.8);
    // a ring of crescents bursts outward, pushing them back (no cut)
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const dir = _v.set(Math.sin(a), 0, Math.cos(a));
      this.moons.spawn({ pos: c.clone().setY(1.1).addScaledVector(dir, 1.2), vel: dir.clone().multiplyScalar(14), quat: this._faceQuat(dir, UP), size: 0.9 + this.rng() * 0.5, life: 0.7, fade: 0.3 });
    }
    for (const f of this.foes) {
      const dir = _v.set(f.pos.x - this.pos.x, 0, f.pos.z - this.pos.z);
      if (dir.lengthSq() < 49) f.knock.copy(dir.normalize().multiplyScalar(9));
    }
    this._setStance(true);
    g.hud?.callout({ school: '血鬼術', form: '', name: '虛哭神去', style: 'moon', side: 'left' });
  }

  _setStance(long) {
    const a = this.anim;
    a.stance = compilePose(long ? KOKUSHIBO_STANCE2 : KOKUSHIBO_STANCE);
    a.runPose = compilePose(long ? KOKUSHIBO_RUN2 : KOKUSHIBO_RUN, a.stance);
    a.sprintPose = a.runPose;
  }

  // ---------------------------------------------------------------- crescents
  /** Swing-plane direction (degrees, as the clips use them) in the world, from his yaw. */
  _bodyDir(tilt, yaw, a, out) {
    const ty = tilt * DEG, yy = yaw * DEG, aa = a * DEG;
    const fx = Math.sin(yy), fz = Math.cos(yy);
    const sx = -Math.cos(yy) * Math.sin(ty), sy = Math.cos(ty), sz = Math.sin(yy) * Math.sin(ty);
    out.set(fx * Math.cos(aa) + sx * Math.sin(aa), sy * Math.sin(aa), fz * Math.cos(aa) + sz * Math.sin(aa));
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return out.set(out.x * c + out.z * s, out.y, -out.x * s + out.z * c);
  }

  /** Orientation for a crescent whose thick back leads along `lead`, lying in the plane with normal `normal`. */
  _quat(lead, normal, out = new THREE.Quaternion()) {
    _x.copy(lead).normalize().negate();
    _z.copy(normal).addScaledVector(_x, -normal.dot(_x));
    if (_z.lengthSq() < 1e-6) _z.set(0, 1, 0).addScaledVector(_x, -_x.y);
    _z.normalize();
    _y.crossVectors(_z, _x);
    _m.makeBasis(_x, _y, _z);
    return out.setFromRotationMatrix(_m);
  }

  /** Upright crescent facing along `dir` (a wave standing on its horns, leading edge forward). */
  _faceQuat(dir, up) {
    return this._quat(dir, _v3.crossVectors(dir, up).normalize());
  }

  /** Irregular sizes: mostly small, now and then a big one. */
  _moonSize(scale = 1) {
    const r = this.rng();
    return (r < 0.14 ? 0.85 + this.rng() * 0.55 : 0.2 + this.rng() * 0.4) * scale;
  }

  /**
   * A tally for crescents: however many there are, those of one group cut a foe at most `max` times, `cd` apart.
   * Everything one move throws shares the move's tally (the first call sets it).
   */
  _group(cd = 0.22, max = 3) {
    const a = this.state === 'action' ? this.action : null;
    if (a) return (a.data.moonGroup ??= { cd, max, last: new Map(), count: new Map(), immune: new Set() });
    return { cd, max, last: new Map(), count: new Map(), immune: new Set() };
  }

  _crescentHit(dmg, o = {}) {
    // (a duel is fought blade to blade: the moons about the blade cut a little lighter)
    return CUT({ dmg: Math.round(dmg * this.tier.dmg * (this.duel ? 0.85 : 1)), ...o });
  }

  /**
   * One of his cuts drawn in the air, with crescents strewn along its path and spilling past it; they hang
   * there a moment and cut whoever is inside. The second state's blade reaches twice as far.
   */
  swing(kind, o = {}) {
    const g = this.game;
    const sw = SWINGS[kind];
    const long = this.phase >= 2;
    const R = o.r ?? (long ? 2.9 : 1.35);
    const center = this.chest(_v).clone();
    center.y += 0.05;
    const sgn = sw.a1 > sw.a0 ? 1 : -1;
    const f = this._bodyDir(sw.tilt, sw.yaw, sw.a0, new THREE.Vector3());
    const s = this._bodyDir(sw.tilt, sw.yaw, sw.a0 + 90 * sgn, new THREE.Vector3());
    g.fx.effects.arc({ center, f, s, radius: R, width: long ? 1.35 : 0.72, arc: Math.abs(sw.a1 - sw.a0) * DEG, style: 'moon', life: long ? 0.42 : 0.32, wipe: 0.06 });
    const normal = new THREE.Vector3().crossVectors(f, s).normalize();
    const n = Math.round((o.n ?? (long ? 11 : 6)) * this.density);
    const spill = o.spill ?? (long ? 3.2 : 1.6);
    const group = this._group(0.22, o.max ?? 3);
    const hit = this._crescentHit(long ? 6 : 5);
    const dir = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = lerp(sw.a0, sw.a1, (i + this.rng()) / n);
      this._bodyDir(sw.tilt, sw.yaw, a, dir);
      const pos = center.clone().addScaledVector(dir, R * (0.8 + this.rng() * 0.3) + this.rng() * spill);
      pos.y = Math.max(0.2, pos.y);
      const nrm = _v2.copy(normal).add(_v3.set(this.rng() - 0.5, this.rng() - 0.5, this.rng() - 0.5).multiplyScalar(0.8)).normalize();
      const size = this._moonSize(long ? 1.5 : 1);
      this.moons.spawn({
        pos, vel: dir.clone().multiplyScalar(0.6 + this.rng() * 1.8), quat: this._quat(dir, nrm),
        size, life: 0.38 + this.rng() * 0.4, delay: this.rng() * 0.05, spin: (this.rng() - 0.5) * 3,
        hit, r: size * 0.75, group,
      });
    }
    g.audio?.play('moonCrescent', { pos: this.pos });
    g.fx.light(center, 0xc8a0ff, 2.2, 6, 0.2);
    if (o.waves) this.waves(...o.waves);
    o.then?.();
  }

  /** Crescent waves thrown forward, spread across `spread` radians. */
  waves(n, speed, size, bias = 0) {
    const p = this.target;
    const from = this.chest(_v).clone().addScaledVector(this.forward(_v2), 0.8);
    const k = Math.max(1, Math.round(n * this.density));
    const group = this._group(0.2, 2);
    const hit = this._crescentHit(7, { power: 0.55 });
    for (let i = 0; i < k; i++) {
      const yaw = this.yaw + bias + (k > 1 ? (i / (k - 1) - 0.5) * 0.5 : 0) + (this.rng() - 0.5) * 0.12;
      const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      if (p) dir.y = clamp((p.pos.y + 1 - from.y) / 8, -0.1, 0.1);
      dir.normalize();
      const sz = size * (0.8 + this.rng() * 0.5);
      this.moons.spawn({ pos: from, vel: dir.clone().multiplyScalar(speed), quat: this._quat(dir, _v3.set(-dir.z, 0.3, dir.x)), size: sz, life: 0.75, fade: 0.2, hit, r: sz * 0.8, group, spin: (this.rng() - 0.5) * 2 });
    }
  }

  /** The tell: a star of light runs to the blade's point (the six eyes flare with it for a held blow). */
  glint(def, big) {
    const g = this.game;
    const b = this.blade;
    b.tip.getWorldPosition(_v);
    g.fx.particles.add.emit({ pos: _v, color: _c.set(0xfff0c0), size: big ? 0.7 : 0.48, shape: SHAPE.STAR, life: 0.26, drag: 0, rot: Math.random() * 3 });
    g.fx.particles.flash(_v.clone(), 0xffd27a, big ? 1.4 : 0.9, 0.16);
    g.fx.light(_v.clone(), 0xffd27a, big ? 3 : 1.8, 4, 0.2);
    if (big) this.eyeFlash();
    g.audio?.play('tellBlade', { pos: this.pos, volume: big ? 0.9 : 0.6 });
  }

  /** The thrust's line: a streak of light straight down it. */
  thrustFx(len) {
    const g = this.game;
    const f = this.forward(new THREE.Vector3());
    const from = this.chest(_v).clone();
    for (let i = 0; i < 5; i++) {
      const sz = 0.5 + i * 0.12;
      this.moons.spawn({ pos: from.clone().addScaledVector(f, 1 + i * (len / 5)), vel: f.clone().multiplyScalar(4), quat: this._faceQuat(f, UP), size: sz, life: 0.3, delay: i * 0.02, fade: 0.2 });
    }
    g.fx.screen.speed(0.7, 0.12);
    g.cameraRig.shake(0.3);
  }

  drawTell() {
    const g = this.game;
    this.eyeFlash();
    this.flash(0xffd27a, 0.1);
    g.audio?.play('moonRead', { pitch: 1.2, volume: 0.6 });
    const b = this.blade;
    b.mid.getWorldPosition(_v);
    g.fx.particles.flash(_v.clone(), 0xffd27a, 1.0, 0.3);
  }

  eyeFlash() {
    const g = this.game;
    this.head(_v);
    const f = this.forward(_v2);
    const r = this.right(_v3);
    for (const [dx, dy] of [[-0.05, 0.1], [0.05, 0.1], [-0.055, 0.06], [0.055, 0.06], [-0.06, 0.02], [0.06, 0.02]]) {
      const p = _v.clone().addScaledVector(f, 0.13).addScaledVector(r, dx);
      p.y += dy;
      g.fx.particles.add.emit({ pos: p, color: _c.set(0xffc830), size: 0.12, shape: SHAPE.STAR, life: 0.3, drag: 0, rot: Math.random() * 3 });
    }
    g.fx.light(_v.clone().addScaledVector(f, 0.3), 0xffb040, 2, 3, 0.25);
  }

  afterimage() {
    this.game.fx.effects.afterimage(this.model, { color: 0x9a6ad8, life: 0.3, alpha: 0.4 });
  }

  // 伍之型: three rings of crescents whirl out of nowhere around him
  vortexTell(fill = 0.25) {
    this.own(this.game.fx.effects.decal(this.pos, { kind: 'circle', size: 9.6, life: fill + 0.15, color: 0xc8a0ff, alpha: 0.9, fillTime: fill }));
    this.game.audio?.play('moonRead', { pitch: 0.9, volume: 0.7 });
  }

  vortex() {
    const g = this.game;
    const c = this.pos.clone();
    const group = this._group(0.25, 3);
    const hit = this._crescentHit(7);
    const rings = [[0.45, 6, 3.6], [1.15, 8, -3.2], [1.85, 10, 2.8]];
    for (const [y, n0, w] of rings) {
      const n = Math.round(n0 * this.density);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + this.rng() * 0.3;
        const size = this._moonSize(1.1);
        const cr = this.moons.spawn({
          pos: c, quat: new THREE.Quaternion(), size, life: 0.62 + this.rng() * 0.12, fade: 0.2,
          orbit: { c, a, w, r: 1.0, dr: 4.6, y }, hit, r: size * 0.8, group,
        });
        cr.faceOrbit = true;
      }
    }
    g.audio?.play('moonVortex');
    g.fx.effects.ring(c.clone().setY(0.1), { color: 0xc8a0ff, from: 0.6, to: 4.8, life: 0.6, thick: 0.15 });
    g.cameraRig.shake(0.25);
  }

  // 陸之型
  fieldTell(len, width, fill = 0.42) {
    this.own(this.game.fx.effects.decal(this.pos, { kind: 'line', size: width, length: len, rot: this.yaw + Math.PI, life: fill + 0.18, color: 0xc8a0ff, alpha: 0.85, fillTime: fill }));
    this.eyeFlash();
  }

  field(len, width, n0) {
    const g = this.game;
    const f = this.forward(new THREE.Vector3());
    const r = this.right(new THREE.Vector3());
    const n = Math.round(n0 * this.density);
    const group = this._group(0.2, 4);
    const hit = this._crescentHit(7);
    for (let i = 0; i < n; i++) {
      const along = 1.2 + this.rng() * (len - 1.2);
      const pos = this.pos.clone().addScaledVector(f, along).addScaledVector(r, (this.rng() - 0.5) * width);
      pos.y = 0.3 + this.rng() * 1.9;
      const dir = _v.set(this.rng() - 0.5, (this.rng() - 0.5) * 0.6, this.rng() - 0.5).normalize();
      const size = this._moonSize(1.1);
      this.moons.spawn({
        pos, vel: f.clone().multiplyScalar(1.5 + this.rng() * 2), quat: this._quat(dir, _v2.set(this.rng() - 0.5, this.rng() - 0.5, this.rng() - 0.5)),
        size, life: 0.36 + this.rng() * 0.26, delay: (along / len) * 0.28 + this.rng() * 0.06, spin: (this.rng() - 0.5) * 6, hit, r: size * 0.75, group,
      });
    }
    g.audio?.play('moonVortex', { pitch: 1.2 });
    g.cameraRig.shake(0.35);
    g.fx.screen.radial(0.35);
  }

  // 漆之型
  groundWaves(n0, spread) {
    const g = this.game;
    const n = Math.round(n0 * this.density);
    const group = this._group(0.3, 2);
    const hit = this._crescentHit(10, { power: 0.7, stun: 'heavy', poise: 12 });
    const from = this.pos.clone().addScaledVector(this.forward(_v), 1.0);
    for (let i = 0; i < n; i++) {
      const yaw = this.yaw + (n > 1 ? (i / (n - 1) - 0.5) * spread * 2 : 0);
      const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const size = 1.2 + this.rng() * 0.5;
      const pos = from.clone();
      pos.y = size * 0.55;
      this.moons.spawn({ pos, vel: dir.clone().multiplyScalar(13), quat: this._faceQuat(dir, UP), size, life: 0.95, fade: 0.25, hit, r: size * 0.7, group });
      // a wake of small ones behind each
      for (let k = 1; k <= 3; k++) {
        const sz = this._moonSize(0.8);
        this.moons.spawn({ pos: pos.clone().setY(0.35 + this.rng() * 0.6), vel: dir.clone().multiplyScalar(13 - k * 1.5), quat: this._faceQuat(dir, UP), size: sz, life: 0.9, delay: k * 0.05, fade: 0.25, hit, r: sz * 0.7, group });
      }
    }
    g.fx.ground(from, { size: 2.2, color: 0xd8c0ff, crack: true, dust: true });
    g.audio?.play('moonVortex', { pitch: 0.8 });
  }

  // 捌之型 / 拾肆之型 / 玖之型 telegraphs
  arcTell(radius, deg, fill = 0.36) {
    void deg;
    this.own(this.game.fx.effects.decal(this.pos, { kind: 'circle', size: radius * 2, life: fill + 0.14, color: 0xc8a0ff, alpha: 0.75, fillTime: fill }));
    this.eyeFlash();
  }

  ringTell(radius, fill = 0.3) {
    this.own(this.game.fx.effects.decal(this.pos, { kind: 'circle', size: radius * 2, life: fill + 0.25, color: 0xc8a0ff, alpha: 0.7, fillTime: Math.max(0.2, fill - 0.1) }));
    this.game.fx.effects.ring(this.pos.clone().setY(0.1), { color: 0xc8a0ff, from: radius, to: radius * 0.4, life: 0.25, thick: 0.1 });
  }

  lineTell(len, width, fill = 0.3) {
    this.own(this.game.fx.effects.decal(this.pos, { kind: 'line', size: width, length: len, rot: this.yaw + Math.PI, life: fill + 0.15, color: 0xc8a0ff, alpha: 0.85, fillTime: fill }));
  }

  // 玖之型: crescents fall one after another all along the line of the downward cut
  lineFall(len) {
    const f = this.forward(new THREE.Vector3());
    const r = this.right(new THREE.Vector3());
    const n = Math.round(9 * this.density);
    const group = this._group(0.25, 2);
    const hit = this._crescentHit(10, { stun: 'heavy', power: 0.6 });
    for (let i = 0; i < n; i++) {
      const along = 1.5 + (i / n) * (len - 1.5);
      const pos = this.pos.clone().addScaledVector(f, along).addScaledVector(r, (this.rng() - 0.5) * 1.2);
      pos.y = 0.6 + this.rng() * 0.8;
      const size = 0.9 + this.rng() * 0.6;
      // standing across the line of the cut, facing back along it
      this.moons.spawn({ pos, vel: _v.set(0, -2, 0).clone(), quat: this._quat(_v2.set(0, -1, 0), f), size, life: 0.5, delay: (i / n) * 0.2, fade: 0.2, hit, r: size * 0.6, group });
    }
    this.game.cameraRig.shake(0.45);
  }

  // 玖之型, the rising half: crescents curling out on arcs every which way
  curls(n0) {
    const n = Math.round(n0 * this.density);
    const group = this._group(0.22, 3);
    const hit = this._crescentHit(8);
    const f = this.forward(new THREE.Vector3());
    const r = this.right(new THREE.Vector3());
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const rad = 3 + this.rng() * 4;
      const c = this.pos.clone().addScaledVector(r, side * rad).addScaledVector(f, 1 + this.rng() * 2);
      const a0 = Math.atan2(this.pos.z - c.z, this.pos.x - c.x);
      // round the circle the way that heads forward first
      const fwd = Math.sign(-Math.sin(a0) * f.x + Math.cos(a0) * f.z) || 1;
      const size = this._moonSize(1.2);
      const cr = this.moons.spawn({
        pos: this.pos, quat: new THREE.Quaternion(), size, life: 0.8 + this.rng() * 0.3, delay: this.rng() * 0.1, fade: 0.25,
        orbit: { c, a: a0, w: fwd * (2.2 + this.rng() * 1.2), r: rad, dr: 0, y: 0.5 + this.rng() * 1.8 },
        hit, r: size * 0.8, group,
      });
      cr.faceOrbit = true;
    }
  }

  // 拾之型: a great wheel of two crescents, spinning, runs down the floor
  sawWheel(side) {
    const g = this.game;
    const f = this.forward(new THREE.Vector3());
    const r = this.right(new THREE.Vector3());
    const from = this.pos.clone().addScaledVector(f, 1.6).addScaledVector(r, side * 0.8);
    from.y = 1.5;
    const vel = f.clone().multiplyScalar(10.5);
    const group = this._group(0.2, 3);
    const hit = this._crescentHit(9, { stun: 'heavy', power: 0.65, knock: 3 });
    const q = this._faceQuat(f, UP);
    const q2 = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(_z.set(0, 0, 1), Math.PI));
    for (const qq of [q, q2]) this.moons.spawn({ pos: from, vel, quat: qq, size: 2.3, cut: 0.3, life: 1.25, fade: 0.25, spin: -side * 14, hit, r: 1.7, group });
    // a spray of small ones thrown off as it goes
    const shed = this._group(0.25, 2);
    const small = this._crescentHit(5);
    const era = this._era;
    let acc = 0;
    this.own(g.fx.effects.timer(1.1, (t, dt) => {
      if (this._era !== era) return;
      acc += dt * 18;
      while (acc >= 1) {
        acc -= 1;
        const p = from.clone().addScaledVector(vel, t * 1.1);
        const d = _v.set(this.rng() - 0.5, this.rng() * 0.6, this.rng() - 0.5).normalize();
        const size = this._moonSize(0.8);
        this.moons.spawn({ pos: p, vel: d.clone().multiplyScalar(3), quat: this._quat(d, _v2.set(0, 1, 0)), size, life: 0.4, hit: small, r: size * 0.7, group: shed });
      }
    }));
    g.fx.ground(from.clone().setY(0), { size: 1.6, color: 0xd8c0ff, crack: true, dust: false });
    g.cameraRig.shake(0.3);
  }

  // 拾肆之型: crescents spiral out from him in layered arms
  spiral(len) {
    const g = this.game;
    const c = this.pos.clone();
    const group = this._group(0.3, 3);
    const hit = this._crescentHit(7, { stun: 'heavy', power: 0.6 });
    const arms = 3;
    const rate = 26 * this.density;
    let acc = 0;
    let k = 0;
    const run = this.action;
    this.own(g.fx.effects.timer(len, (t, dt) => {
      if (!this.alive || this.action !== run) return;
      acc += dt * rate;
      while (acc >= 1) {
        acc -= 1;
        const arm = k % arms;
        const layer = Math.floor(k / arms) % 3;
        k++;
        const a = (arm / arms) * Math.PI * 2 - t * 7.5;
        const size = this._moonSize(1.2);
        const cr = this.moons.spawn({
          pos: c, quat: new THREE.Quaternion(), size, life: 1.0 + this.rng() * 0.2, fade: 0.25,
          orbit: { c, a, w: -2.4, r: 1.2, dr: 7.6, y: [0.45, 1.2, 1.95][layer] },
          hit, r: size * 0.8, group,
        });
        cr.faceOrbit = true;
      }
    }));
    g.fx.effects.ring(c.clone().setY(0.1), { color: 0xc8a0ff, from: 1, to: 9.5, life: 1.1, thick: 0.12 });
    g.cameraRig.shake(0.4);
  }

  // 拾陸之型: marks on the ground round each foe he means to hit, then moons fall on every mark
  skyMarks(wait) {
    const g = this.game;
    const foes = this.tier.everyone ? this.foes : [this.target].filter(Boolean);
    const per = Math.round(6 * this.density);
    const group = this._group(0.3, 2);
    const hit = this._crescentHit(12, { stun: 'heavy', power: 0.75, poise: 14, sfx: 'moonCut' });
    const era = this._era;
    for (const f of foes) {
      for (let i = 0; i < per; i++) {
        // one mark right where they stand, the rest round it
        const a = this.rng() * Math.PI * 2;
        const rr = i === 0 ? 0 : 1.3 + this.rng() * 2.4;
        const spot = new THREE.Vector3(f.pos.x + Math.cos(a) * rr, 0, f.pos.z + Math.sin(a) * rr);
        g.world?.constrain(spot, 0.5);
        const t = wait + i * 0.07;
        this.own(g.fx.effects.decal(spot, { kind: 'circle', size: 2.6, life: t + 0.15, color: 0xffd27a, alpha: 0.9, fillTime: t }));
        const size = 1.35;
        const top = spot.clone().setY(8.5);
        const fall = 26;
        this.moons.spawn({
          pos: top, vel: new THREE.Vector3(0, -fall, 0), quat: this._quat(_v.set(0, -1, 0), _v2.set(Math.cos(a), 0, Math.sin(a))),
          size, life: (8.5 - 0.3) / fall, delay: t - 0.3, fade: 0.05, hit, r: 1.0, group,
        });
        this.own(g.fx.effects.timer(t + 0.02, null, () => this._era === era && this._moonImpact(spot)));
      }
    }
    this.eyeFlash();
    g.audio?.play('moonRead', { pitch: 0.8 });
  }

  _moonImpact(spot) {
    const g = this.game;
    if (!this.alive && this.crumbleT >= 0) return;
    g.fx.ground(spot, { size: 1.4, color: 0xffe6a8, crack: true, dust: true, life: 4 });
    g.audio?.play('moonFall', { pos: spot });
    g.cameraRig.shake(0.18);
    const group = this._group(0.3, 1);
    const hit = this._crescentHit(5);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + this.rng();
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const size = this._moonSize(0.8);
      this.moons.spawn({ pos: spot.clone().setY(0.4), vel: dir.clone().multiplyScalar(6), quat: this._faceQuat(dir, UP), size, life: 0.35, hit, r: size * 0.7, group });
    }
  }

  /** Crescent blades against his foes: each cuts a foe once; a group (one form) cuts a foe at most so often. */
  _moonHits() {
    const list = this.moons.list;
    if (!list.length) return;
    // orbiting crescents turn to run along their circle
    for (const c of list) {
      if (!c.faceOrbit || !c.orbit) continue;
      const a = c.orbit.a;
      _v.set(-Math.sin(a) * Math.sign(c.orbit.w), 0, Math.cos(a) * Math.sign(c.orbit.w));
      this._quat(_v, _v2.set(Math.cos(a), 0.25, Math.sin(a)), c.quat);
    }
    const foes = this.alive ? this.foes : [];
    if (!foes.length) return;
    const now = this.game.time;
    for (const c of list) {
      if (!c.hit || !Crescents.cutting(c)) continue;
      for (const f of foes) {
        if (c.hitSet?.has(f)) continue;
        const dx = f.pos.x - c.pos.x, dz = f.pos.z - c.pos.z;
        const reach = c.r + f.radius;
        if (dx * dx + dz * dz > reach * reach) continue;
        const fy = f.posY || 0;
        if (c.pos.y < fy - c.r * 0.6 || c.pos.y > fy + f.height + c.r * 0.6) continue;
        (c.hitSet ??= new Set()).add(f);
        const g = c.group;
        if (g && (g.immune.has(f) || now - (g.last.get(f) ?? -99) < g.cd || (g.count.get(f) ?? 0) >= g.max)) continue;
        const res = this.game.combat.applyHit(this, f, { ...c.hit, from: c.pos });
        if (g && res !== 'dodge' && res !== 'miss') {
          g.last.set(f, now);
          g.count.set(f, (g.count.get(f) ?? 0) + 1);
        }
      }
    }
  }

  /** For a perfect dodge: is a crescent about to reach this foe? */
  threatens(p, horizon) {
    for (const c of this.moons.list) {
      const grp = c.group;
      if (grp && (grp.immune.has(p) || (grp.count.get(p) ?? 0) >= grp.max)) continue;
      if (this._moonReaches(c, p, horizon)) return true;
    }
    return false;
  }

  /** Will this crescent, still able to cut, reach `p` within `horizon` seconds (flying, falling, or wheeling round)? */
  _moonReaches(c, p, horizon) {
    if (!c.hit || c.hitSet?.has(p)) return false;
    const t = c.age - c.delay;
    if (t > c.life - c.fade) return false;
    const dx = p.pos.x - c.pos.x, dz = p.pos.z - c.pos.z;
    const dist = Math.hypot(dx, dz);
    const reach = c.r + p.radius + 0.3;
    if (t < 0) return -t < horizon && dist < reach;
    if (c.orbit) {
      // (a wheeling moon: where its circle carries it over the next moments)
      const o = c.orbit;
      for (let i = 1; i <= 6; i++) {
        const s = (horizon * i) / 6;
        if (t + s > c.life - c.fade) break;
        const a = (o.a ?? 0) + o.w * s, r = o.r + (o.dr ?? 0) * s;
        if (Math.hypot(p.pos.x - o.c.x - Math.cos(a) * r, p.pos.z - o.c.z - Math.sin(a) * r) < reach) return true;
      }
      return false;
    }
    if (!c.vel) return false;
    const closing = (dx * c.vel.x + dz * c.vel.z) / Math.max(dist, 1e-3);
    return closing > 4 && (dist - reach) / closing < horizon;
  }

  // ---------------------------------------------------------------- defeat
  die(att, h) {
    // he does not fall before the moon has shown its true form: a blow that would end him turns him instead
    if (this.phase < 2) {
      this.hp = Math.round(this.maxHp * this.tier.phase2 * 0.5);
      this._enterPhase(2);
      return;
    }
    super.die(att, h);
  }

  onKneel() {
    this.moons.cancel();
    this._era++;
    this.trailOn = false;
    this.anim.play(this.clips.kneel, { fade: 0.1, hold: true });
  }

  onBehead() {
    this.moons.cancel();
    this.anim.play(this.clips.deathStand, { fade: 0.15, hold: true });
  }

  /** The finisher's aftermath: blades split out of the headless body and a horned head grows back. */
  regrow() {
    const g = this.game;
    const M = this.model.monster;
    M.head.visible = true;
    M.head.scale.setScalar(0.05);
    for (const b of M.blades) {
      b.visible = true;
      b.scale.setScalar(0.001);
    }
    g.audio?.play('moonTransform', { pitch: 0.8 });
    g.fx.screen.flash(0x3a0a2a, 0.4, 3);
    g.cameraRig.shake(0.5);
    g.fx.effects.timer(1.4, (t) => {
      const e = 1 - Math.pow(1 - clamp(t / 0.6), 3);
      M.head.scale.setScalar(0.05 + 0.95 * e);
      M.blades.forEach((b, i) => {
        const k = clamp((t - 0.1 - i * 0.05) / 0.35);
        b.scale.setScalar(Math.max(0.001, 1 - Math.pow(1 - k, 3)));
      });
      if (Math.random() < 0.5) g.fx.particles.smoke(this.chest(_v).clone(), 1, 0x2a0a1a, 0.4, 1, 0.8);
    });
    this.anim.play(this.clips.transform, { fade: 0.4, hold: true, time: 0.6 });
  }

  /** He sees what he has become and falls apart; what is left on the boards is a flute. */
  crumble() {
    this.crumbleT = 0;
  }

  _afterDeath(dt) {
    if (this.crumbleT < 0) return;
    const g = this.game;
    this.crumbleT += dt;
    const k = clamp(this.crumbleT / 4.2);
    if (Math.random() < 0.5) {
      const c = this.chest(_v).clone().add(_v2.set((Math.random() - 0.5) * 1.4, (Math.random() - 0.3) * 1.6, (Math.random() - 0.5) * 1.4));
      g.fx.particles.emit({ additive: true, pos: c, vel: _v3.set((Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3), color: _c.set(0xd8b8ff), size: 0.06 + Math.random() * 0.07, shape: SHAPE.STAR, life: 2.2, drag: 0.3, spin: 1 });
    }
    if (!this.flute && this.crumbleT > 1.2) this._dropFlute();
    this._crumble(k);
  }

  _dropFlute() {
    const g = this.game;
    const bamboo = toonMaterial({ color: 0xc9b27c, shade: 0x8a7a6a, rim: 0.4, spec: 0.3 });
    const dark = toonMaterial({ color: 0x5a3a24, shade: 0x4a3a3a });
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.34, 10), bamboo);
    grp.add(body);
    for (const y of [-0.12, 0.03, 0.15]) {
      const node = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.008, 10), dark);
      node.position.y = y;
      grp.add(node);
    }
    for (let i = 0; i < 5; i++) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.004, 8), dark);
      hole.position.set(0, -0.08 + i * 0.045, 0.0132);
      grp.add(hole);
    }
    grp.rotation.set(Math.PI / 2, 0, this.yaw + 0.4);
    const at = this.pos.clone().addScaledVector(this.forward(_v), 0.35);
    grp.position.set(at.x, 0.2, at.z);
    (g.world?.group || g.scene).add(grp);
    this.flute = grp;
    // it drops the last bit to the boards
    g.fx.effects.timer(0.35, (t) => (grp.position.y = 0.2 - 0.187 * t * t), () => (grp.position.y = 0.013));
    g.audio?.play('biwa', { note: 7, volume: 0.35 });
  }

  dispose() {
    super.dispose();
    if (this._disposed) return;
    this._disposed = true;
    this.moons.dispose();
    this.game.scene.remove(this.trail.mesh);
  }
}
