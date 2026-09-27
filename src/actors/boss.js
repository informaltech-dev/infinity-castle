import * as THREE from 'three';
import { Actor } from './actor.js';
import { J } from './rig.js';
import { clamp, rand, angleDiff } from '../core/math.js';
import { SHAPE } from '../fx/particles.js';
import { LAYER_MAIN_ONLY } from '../render/pipeline.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _c = new THREE.Color();

const P = (o) => ({ blunt: true, style: 'akaza', sfx: 'punchHit', power: 0.55, hitstop: 0.07, shake: 0.28, stun: 'light', ...o });

function akazaMoves(boss) {
  return {
    jab: {
      clip: 'jab', turn: [0, 0.06, 14], motion: [[0, 0.09, 0.7]], cancel: 0.2,
      hits: [P({ t: 0.08, range: 2.5, arc: 80, dmg: 8, poise: 8, knock: 1.6 })],
      sfx: [{ t: 0.04, name: 'punchWhoosh' }], windup: 0.05,
    },
    cross: {
      clip: 'cross', turn: [0, 0.07, 14], motion: [[0, 0.1, 1.0]],
      hits: [P({ t: 0.09, range: 2.7, arc: 80, dmg: 11, poise: 12, knock: 2.6 })],
      sfx: [{ t: 0.05, name: 'punchWhoosh' }],
    },
    hook: {
      clip: 'hook', turn: [0, 0.08, 12], motion: [[0, 0.12, 0.8]],
      hits: [P({ t: 0.11, range: 2.5, arc: 140, dmg: 14, poise: 18, knock: 4.5, stun: 'heavy', power: 0.7, shake: 0.35 })],
      sfx: [{ t: 0.06, name: 'punchWhoosh', opts: { pitch: 0.85 } }],
    },
    uppercut: {
      clip: 'uppercut', turn: [0, 0.08, 14], motion: [[0, 0.12, 1.0]],
      hits: [P({ t: 0.11, range: 2.4, arc: 90, dmg: 18, poise: 30, knock: 3, stun: 'down', power: 0.85, shake: 0.45, hitstop: 0.1 })],
      sfx: [{ t: 0.07, name: 'punchWhoosh', opts: { pitch: 0.75 } }],
    },
    spinKick: {
      clip: 'spinKick', turn: [0, 0.1, 8], windup: 0.12,
      hits: [P({ t: 0.3, shape: 'circle', range: 3.0, dmg: 16, poise: 25, knock: 5.5, stun: 'heavy', power: 0.75, shake: 0.4 })],
      sfx: [{ t: 0.18, name: 'punchWhoosh', opts: { pitch: 0.7 } }],
      events: [{ t: 0.28, fn: (a) => a.sweepFx() }],
    },
    axeKick: {
      clip: 'axeKick', turn: [0, 0.45, 5], motion: [[0.16, 0.58, 1.0, 'inOut']], windup: 0.18, armor: [0.1, 0.7],
      hits: [P({ t: 0.58, shape: 'circle', offset: 1.0, range: 2.5, dmg: 18, poise: 40, knock: 6, stun: 'down', power: 1, shake: 0.6, hitstop: 0.12, sfx: 'hitBlunt' })],
      events: [
        { t: 0.1, fn: (a, r) => a.markLanding(r, 1.0, 0.48) },
        { t: 0.58, fn: (a) => a.slamFx(1.0, 2.4) },
      ],
      sfx: [{ t: 0.14, name: 'dodge', opts: { pitch: 0.6 } }, { t: 0.58, name: 'groundSlam' }],
      name: ['破壞殺', '腳式', '冠先割'],
    },
    airType: {
      clip: 'airType', turn: [0, 0.7, 10], windup: 0.3,
      events: [{ t: 0, fn: (a) => a.airWindup() }, ...[0.37, 0.51, 0.65].map((t) => ({ t, fn: (a) => a.airPunch() }))],
      name: ['破壞殺', '', '空式'],
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
    },
    barrageEnd: {
      clip: 'barrageEnd', turn: [0, 0.1, 10], motion: [[0.05, 0.14, 1.2]],
      hits: [P({ t: 0.12, range: 2.8, arc: 100, dmg: 16, poise: 40, knock: 7, stun: 'down', power: 1, shake: 0.55, hitstop: 0.13, radial: 0.35 })],
      sfx: [{ t: 0.08, name: 'punchWhoosh', opts: { pitch: 0.7 } }],
      events: [{ t: 0.12, fn: (a) => a.punchBurst(2.2) }],
    },
    groundSlam: {
      clip: 'groundSlam', turn: [0, 0.4, 6], motion: [[0.16, 0.56, 1.0, 'inOut']], windup: 0.2, armor: [0, 0.9],
      hits: [P({ t: 0.56, shape: 'circle', offset: 0.9, range: 2.2, dmg: 20, poise: 40, knock: 7, stun: 'down', power: 1, shake: 0.7, hitstop: 0.12, sfx: 'hitBlunt' })],
      events: [
        { t: 0.1, fn: (a, r) => a.markLanding(r, 0.9, 0.46) },
        { t: 0.56, fn: (a) => { a.slamFx(0.9, 3.4); a.shockRing(0.9, 11, 12, 0.9, 16); } },
      ],
      sfx: [{ t: 0.2, name: 'bossRoar', opts: { volume: 0.5 } }, { t: 0.56, name: 'groundSlam' }],
      name: ['破壞殺', '碎式', '萬葉閃柳'],
    },
    annihilationCharge: {
      clip: 'annihilationCharge', dur: 1.05, turn: [0, 0.7, 7], hold: true, armor: [0, 1.05],
      events: [{ t: 0, fn: (a) => a.chargeFx() }],
      next: 'annihilation',
      name: ['破壞殺', '', '滅式'],
    },
    annihilation: {
      clip: 'annihilation', motion: [[0, 0.16, 13, 'out3']], armor: [0, 0.3],
      hits: [P({ t: 0.09, shape: 'line', range: 13, offset: -12, width: 1.0, dmg: 34, poise: 60, knock: 9, stun: 'down', power: 1, shake: 0.8, hitstop: 0.16, unblockable: true, impact: 0.1, impactA: 0x06121a, impactB: 0xe0f8ff, radial: 0.5, sfx: 'punchHit' })],
      events: [{ t: 0, fn: (a) => a.annihilationFx() }],
      sfx: [{ t: 0, name: 'shockwave' }],
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
    },
  };
}

export class Boss extends Actor {
  constructor(game, model) {
    super(game, model, { team: 'demon', hp: 3200, poise: 170, radius: 0.5, height: 1.9, mass: 3, poiseRegen: 12 });
    this.isBoss = true;
    this.moves = akazaMoves(this);
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
    this.compass = null;
    this.finalCd = 0;
    this.anim.stepHz = 15;
    this.targetable = true;
    this.regenT = 0;
    this.deathT = 0;
    this.usedFinal = false;
  }

  get player() {
    return this.game.player;
  }

  update(dt, realDt) {
    dt = this.tick(dt * this.game.enemyTimeScale, realDt);
    this._hazards(dt);
    if (!this.alive) {
      this._deadUpdate(dt);
      this.present(dt);
      return;
    }
    const p = this.player;
    this.recentT -= dt;
    if (this.recentT <= 0) this.recentHits = 0;
    this.finalCd -= dt;
    // regeneration when left alone
    if (this.game.time - this.lastHitT > 5 && this.hp < this.maxHp && this.state !== 'intro') {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.005 * dt);
      this.regenT -= dt;
      if (this.regenT <= 0) {
        this.regenT = 0.08;
        this.game.fx.particles.smoke(this.chest(_v).clone(), 1, 0x7a2030, 0.3, 0.6, 0.8);
      }
    }
    // phase transitions
    const hp01 = this.hp / this.maxHp;
    if (this.phase === 1 && hp01 < 0.6 && this.state !== 'action') this._enterPhase(2);
    else if (this.phase === 2 && hp01 < 0.25 && this.state !== 'action') this._enterPhase(3);

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
        if (p) this.turnTowards(p.pos, 5, dt);
        this.anim.setLoco(0, 0, 0);
        if (this.stateT > this.recoverLen) this.setState('idle');
        break;
      case 'guard':
        this.guardT -= dt;
        if (p) this.turnTowards(p.pos, 10, dt);
        if (this.guardT <= 0) this.setState('idle');
        break;
      case 'hit':
        if (this.stateT > this.stunLen) this.setState('idle');
        break;
      case 'stagger':
        if (this.stateT > 2.2) {
          this.staggered = false;
          this.setState('idle');
          this.cooldown = 0.1;
        }
        break;
      case 'finisher':
        break;
    }
    if (this.compass) {
      this.compass.mesh.position.set(this.pos.x, 0.03, this.pos.z);
      this.compass.age = Math.min(this.compass.age, 1);
    }
    this.game.world?.constrain(this.pos, this.radius);
    this.present(dt);
  }

  // ---------------------------------------------------------------- brain
  _think(dt, p) {
    this.cooldown -= dt;
    this.anim.setLoco(0, 0, 0);
    if (!p || !p.alive) return;
    this.turnTowards(p.pos, 8, dt);
    if (this.cooldown > 0) {
      // circle a little while waiting
      const d = this.distTo(p);
      if (d > 3.5) this._stepToward(dt, p, 2.2);
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
    if (d > 9) {
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
    const total = opts.reduce((s, o) => s + o.w, 0);
    let r = Math.random() * total;
    let choice = opts[0];
    for (const o of opts) {
      r -= o.w;
      if (r <= 0) { choice = o; break; }
    }
    this.plan = choice;
    this.planT = 0;
    this.lastMove = choice.name;
    if (d > choice.range) this.setState('approach');
    else this._execute(choice.name);
  }

  _stepToward(dt, p, speed) {
    _v.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
    this.velXZ.lerp(_v.multiplyScalar(speed), Math.min(1, dt * 5));
    this.pos.addScaledVector(this.velXZ, dt);
    this.anim.setLoco(this.velXZ.length(), 0, 0);
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
        this._chain(Math.random() < 0.5 ? ['jab', 'cross', 'hook'] : ['jab', 'jab', 'cross', 'uppercut']);
        return;
      case 'dashIn': {
        const after = Math.random() < 0.5 ? ['jab', 'cross', 'hook'] : ['barrage'];
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

  _chain(list, opts = {}) {
    this.queue = list.slice(1);
    this.chainOpts = opts;
    this._run(list[0]);
  }

  _run(name) {
    const def = this.moves[name];
    if (!def) return this.setState('idle');
    this.setState('action');
    this.curMove = name;
    this.velXZ.set(0, 0, 0);
    this.anim.setLoco(0, 0, 0);
    let motionScale = 1;
    if (name === 'dash') motionScale = this.chainOpts?.dashDist ?? 3;
    if (name === 'axeKick' || name === 'groundSlam') motionScale = this.chainOpts?.leap ?? 1;
    this.run(def, { target: this.player, motionScale });
    if (def.name) this.game.hud?.callout({ school: def.name[0], form: def.name[1], name: def.name[2], style: 'demon', side: 'left' });
    if (def.windup && def.windup > 0.1) this._telegraph();
  }

  _telegraph() {
    const h = this.head(_v).clone();
    this.game.fx.particles.flash(h, 0x7fe6ff, 1.1, 0.18);
  }

  _action(dt) {
    const r = this.action;
    if (!r) return this.setState('idle');
    this.armor = r.inWindow(r.def.armor);
    r.update(dt);
    if (r.done) {
      this.action = null;
      this.armor = false;
      const next = r.def.next || (this.queue && this.queue.shift());
      if (next) {
        this._run(next);
        return;
      }
      this.setState('recover');
      const diff = this.game.settings?.difficulty || 'normal';
      const base = diff === 'hard' ? 0.35 : diff === 'easy' ? 0.95 : 0.6;
      this.recoverLen = base * (this.phase === 1 ? 1.2 : this.phase === 2 ? 0.9 : 0.7);
      this.cooldown = rand(0.1, 0.5);
    }
  }

  _guard(len) {
    this.setState('guard');
    this.guardT = len;
    this.anim.play(this.clips.counterGuard, { fade: 0.05, hold: true });
    this.flash(0x7fe6ff, 0.12);
    this.game.fx.particles.flash(this.chest(_v).clone(), 0x7fe6ff, 1.2, 0.2);
  }

  /** Akaza reads fighting spirit: parries melee hits while guarding (not projectiles, not an ultimate). */
  tryCounter(att, h) {
    if (this.state !== 'guard' || h.shape === 'circle' && (h.range ?? 0) > 3.2) return false;
    if (att !== this.player || h.unparryable || att.state === 'ult') return false;
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
    this._chain(['uppercut']);
    return true;
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

  markLanding(r, offset, time) {
    const p = this.player;
    if (!p) return;
    // aim the leap at the player
    const d = Math.max(0.2, this.distTo(p) - offset);
    r.motionScale = clamp(d, 0.2, 11);
    this.faceInstant(p.pos);
    const f = this.forward(_v);
    const land = this.pos.clone().addScaledVector(f, r.motionScale + offset);
    this.game.fx.effects.decal(land, { kind: 'circle', size: 5, life: time + 0.15, color: 0x7fe6ff, alpha: 0.95, fillTime: time });
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
      hit: P({ dmg: 8, poise: 12, knock: 3.5, stun: 'light', power: 0.6, shake: 0.3, sfx: 'shockwave' }),
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

  /** Expanding ground shock ring that must be dodged through. */
  shockRing(offset, maxR, speed, width, dmg) {
    const f = this.forward(_v);
    const c = this.pos.clone().addScaledVector(f, offset);
    this.hazards.push({ c, r: 0.5, maxR, speed, width, dmg, hit: false });
    this.game.fx.effects.ring(c.clone().setY(0.1), { color: 0x9fefff, from: 0.5, to: maxR, life: maxR / speed, thick: 0.12 });
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

  _hazards(dt) {
    const p = this.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.r += h.speed * dt;
      if (!h.hit && p && p.alive) {
        const d = Math.hypot(p.pos.x - h.c.x, p.pos.z - h.c.z);
        if (Math.abs(d - h.r) < h.width + p.radius * 0.5 && (p.posY || 0) < 0.8) {
          h.hit = true;
          this.game.combat.applyHit(this, p, P({ dmg: h.dmg, poise: 20, knock: 5, stun: 'heavy', power: 0.8, shake: 0.4, sfx: 'shockwave' }));
        }
      }
      if (h.r > h.maxR) this.hazards.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- reactions
  onHit(att, h, info) {
    const g = this.game;
    this.recentHits++;
    this.recentT = 1.2;
    if (this.state === 'intro') return;
    // poise break -> stagger
    if (this.poise <= 0) {
      this.poise = this.maxPoise;
      this.action = null;
      this.queue = [];
      this.armor = false;
      this.staggered = true;
      this.setState('stagger');
      this.anim.play(this.clips.stagger, { fade: 0.03 });
      g.hud?.toast('破勢', 'break');
      g.audio?.play('guardBreak');
      g.fx.screen.flash(0xffffff, 0.3, 8);
      return;
    }
    if (this.armor || this.state === 'action' || this.state === 'stagger' || this.state === 'finisher') {
      this.anim.hitJolt = 0.7;
      return;
    }
    // in phase 2+ he reads spammed attacks
    if (this.phase >= 2 && this.recentHits >= 4 && Math.random() < 0.45) {
      this._guard(1.0);
      return;
    }
    this.setState('hit');
    this.stunLen = h.stun === 'down' || h.stun === 'heavy' ? 0.45 : 0.25;
    this.anim.play(this.clips.hit, { fade: 0.02 });
    this.anim.hitJolt = 1;
    // escape after being juggled too long
    if (this.recentHits >= 6) {
      this.recentHits = 0;
      this.stunLen = 0.1;
      this.cooldown = 0;
      this.game.fx.effects.timer(0.12, null, () => {
        if (this.alive && this.state !== 'finisher') this._chain(Math.random() < 0.5 ? ['backstep', 'airType'] : ['spinKick']);
      });
    }
    void info;
  }

  onParried(player) {
    // a parried Akaza is thrown off balance
    this.poise -= 45;
    this.action = null;
    this.queue = [];
    this.setState('hit');
    this.stunLen = 0.7;
    this.anim.play(this.clips.hit, { fade: 0.02 });
    void player;
  }

  die(att, h) {
    // Akaza only dies to the finisher; at 0 hp he kneels and waits
    if (this.state === 'finisher') return;
    this.hp = 1;
    this.action = null;
    this.queue = [];
    this.hazards.length = 0;
    this.setState('finisher');
    this.targetable = false;
    this.anim.play(this.clips.stagger, { fade: 0.05, hold: true, time: 0.5 });
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
    if (this.compass) {
      this.compass.life = this.compass.age + 1.5;
      this.compass = null;
    }
    this.anim.play(this.clips.death, { fade: 0.1, hold: true });
  }

  _deadUpdate(dt) {
    this.deathT += dt;
    const g = this.game;
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
    if (this.deathT > 2.2) {
      const k = clamp((this.deathT - 2.2) / 3.5);
      if (!this._layered && this.headPhys) {
        this._layered = true;
        this.headPhys.obj.traverse((o) => o.layers.set(LAYER_MAIN_ONLY));
      }
      this.setDissolve(k);
      if (Math.random() < 0.8) g.fx.ashFrom(this.model, 4);
      // snowflake motes drifting up (Koyuki's hairpin)
      if (Math.random() < 0.4) {
        const c = this.chest(_v).clone().add(_v2.set((Math.random() - 0.5) * 1.5, Math.random() * 1.2, (Math.random() - 0.5) * 1.5));
        g.fx.particles.emit({ additive: true, pos: c, vel: _v3.set(0, 0.6 + Math.random() * 0.6, 0), color: _c.set(0xbff4ff), size: 0.08 + Math.random() * 0.08, shape: SHAPE.STAR, life: 2.5, drag: 0.3, spin: 1 });
      }
      if (k >= 1 && !this.removed) {
        this.removed = true;
        if (this.headPhys) g.scene.remove(this.headPhys.obj);
        this.dispose();
      }
    }
    void angleDiff;
  }
}
