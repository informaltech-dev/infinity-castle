import * as THREE from 'three';
import { Actor } from './actor.js';
import { J } from './rig.js';
import { LAYER_MAIN_ONLY } from '../render/pipeline.js';
import { clamp, angleDiff, rand, pick } from '../core/math.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

const VARIANTS = {
  grunt: { hp: 95, poise: 24, speed: 3.6, radius: 0.45, mass: 1, height: 1.8, attacks: ['swipe', 'swipe2', 'lunge'], aggression: 1 },
  fast: { hp: 62, poise: 14, speed: 5.6, radius: 0.4, mass: 0.8, height: 1.7, attacks: ['swipe2', 'lunge', 'lunge'], aggression: 1.4 },
  brute: { hp: 360, poise: 95, speed: 2.5, radius: 0.8, mass: 2.6, height: 2.6, attacks: ['smash', 'swipe'], aggression: 0.8, armored: true },
};

function enemyMoves(variant) {
  const big = variant === 'brute';
  const fast = variant === 'fast';
  const s = fast ? 1.25 : big ? 0.85 : 1;
  return {
    swipe: {
      clip: 'swipe', speed: s, turn: [0, 0.4 / s, 6], motion: [[0.45 / s, 0.6 / s, big ? 1.4 : 1.2]],
      windup: 0.45 / s,
      hits: [{ t: 0.53 / s, range: big ? 3.0 : 2.1, arc: 130, dmg: big ? 18 : 10, poise: 10, knock: big ? 5 : 2.6, hitstop: 0.07, shake: 0.25, power: 0.5, stun: big ? 'heavy' : 'light', style: 'demon' }],
      sfx: [{ t: 0.47 / s, name: 'swingLight', opts: { pitch: 0.8 } }],
    },
    swipe2: {
      clip: 'swipe2', speed: s, turn: [0, 0.3 / s, 6], motion: [[0.33 / s, 0.46 / s, 1.1]],
      windup: 0.33 / s,
      hits: [{ t: 0.41 / s, range: 2.0, arc: 130, dmg: 9, poise: 8, knock: 2.2, hitstop: 0.06, shake: 0.2, power: 0.45, stun: 'light', style: 'demon' }],
      sfx: [{ t: 0.36 / s, name: 'swingLight', opts: { pitch: 0.85 } }],
    },
    lunge: {
      clip: 'lungeWind', speed: s, dur: 0.7 / s, turn: [0, 0.6 / s, 8], windup: 0.6 / s,
      sfx: [{ t: 0, name: 'demonGrowl', opts: { volume: 0.8 } }],
      next: 'lungeJump',
    },
    lungeJump: {
      clip: 'lunge', speed: 1, turn: [0, 0.05, 4], motion: [[0, 0.3, 5.2, 'out']],
      hits: [{ t: 0.16, range: 1.9, arc: 150, dmg: 10, poise: 14, knock: 4, hitstop: 0.07, shake: 0.28, power: 0.55, stun: 'heavy', style: 'demon' }],
      sfx: [{ t: 0.1, name: 'swingHeavy', opts: { pitch: 0.8 } }],
      events: [{ t: 0.02, fn: (a) => a.launch(4.5) }],
    },
    smash: {
      clip: 'smash', turn: [0, 0.8, 3], windup: 0.85, armor: [0, 1.0],
      hits: [{ t: 0.93, shape: 'circle', range: 3.3, offset: 1.4, dmg: 24, poise: 30, knock: 7, hitstop: 0.11, shake: 0.6, power: 0.9, stun: 'down', style: 'demon', unparryable: true, blunt: true, sfx: 'hitBlunt' }],
      events: [{ t: 0.93, fn: (a) => a.smashFx() }, { t: 0.1, fn: (a) => a.telegraphCircle(3.3, 1.4, 0.8) }],
      sfx: [{ t: 0.2, name: 'demonGrowl' }, { t: 0.93, name: 'groundSlam' }],
    },
  };
}

export class Enemy extends Actor {
  constructor(game, model, variant = 'grunt') {
    const V = VARIANTS[variant];
    super(game, model, { team: 'demon', hp: V.hp, poise: V.poise, radius: V.radius, height: V.height, mass: V.mass });
    this.variant = variant;
    this.V = V;
    this.moves = enemyMoves(variant);
    this.hasToken = false;
    this.cooldown = rand(0.6, 1.6);
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = rand(1, 3);
    this.slotAngle = Math.random() * Math.PI * 2;
    this.velXZ = new THREE.Vector3();
    this.state = 'spawn';
    this.targetable = true;
    this.anim.stepHz = 12;
    this.deathT = 0;
    this.headPhys = null;
    this.growlT = rand(2, 6);
  }

  spawnAt(pos, yaw) {
    this.pos.copy(pos);
    this.yaw = yaw;
    this.setState('spawn');
    this.invuln = 0.6;
    this.anim.play(this.clips.spawn, { fade: 0 });
    this.game.fx.spawnSmoke(pos);
    this.game.audio?.play('spawn', { pos });
  }

  get player() {
    return this.game.player;
  }

  update(dt, realDt) {
    dt = this.tick(dt * this.game.enemyTimeScale * this.drunkScale(realDt), realDt);
    if (!this.alive) {
      this._deadUpdate(dt);
      this.present(dt);
      return;
    }
    const p = this.player;
    switch (this.state) {
      case 'spawn':
        if (this.stateT > 0.8) this.setState('chase');
        break;
      case 'chase':
        this._chase(dt, p);
        break;
      case 'attack':
        this._attack(dt);
        break;
      case 'hit':
        this.velXZ.multiplyScalar(Math.exp(-dt * 8));
        if (this.stateT > this.stunLen) this.setState('chase');
        break;
      case 'down':
        if (this.stateT > 1.4) this.setState('chase');
        break;
    }
    if (this.state !== 'attack' && this.hasToken) this.releaseToken();
    this.cooldown -= dt;
    this.growlT -= dt;
    if (this.growlT < 0) {
      this.growlT = rand(4, 9);
      if (Math.random() < 0.5) this.game.audio?.play('demonGrowl', { pos: this.pos, volume: 0.35 });
    }
    this.game.world?.constrain(this.pos, this.radius);
    this.present(dt);
  }

  _chase(dt, p) {
    if (!p || !p.alive) {
      this.anim.setLoco(0, 0, 0);
      return;
    }
    const d = this.distTo(p);
    const g = this.game;
    // choose behaviour
    let want = _v.set(0, 0, 0);
    let speed = this.V.speed;
    const engage = this.variant === 'brute' ? 2.6 : 2.0;
    if (this.cooldown <= 0 && g.director.requestToken(this)) {
      this.hasToken = true;
      // pick attack by distance
      let atk;
      if (d > 3.8 && d < 8 && this.V.attacks.includes('lunge') && Math.random() < (this.variant === 'fast' ? 0.55 : 0.35)) atk = 'lunge';
      else if (d <= engage + 0.4) atk = pick(this.V.attacks.filter((a) => a !== 'lunge')) || 'swipe';
      if (atk) {
        this.startAttack(atk);
        return;
      }
      // approach to engage
      want.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
      speed *= 1.25;
    } else {
      // hover around the player on an assigned slot
      this.strafeT -= dt;
      if (this.strafeT < 0) {
        this.strafeT = rand(1.2, 3);
        this.strafeDir *= -1;
      }
      this.slotAngle += this.strafeDir * dt * 0.35;
      const ring = this.variant === 'brute' ? 4.2 : 3.6 + (this.id % 3) * 0.6;
      const tx = p.pos.x + Math.sin(this.slotAngle) * ring;
      const tz = p.pos.z + Math.cos(this.slotAngle) * ring;
      want.set(tx - this.pos.x, 0, tz - this.pos.z);
      const wl = want.length();
      if (wl > 0.3) want.multiplyScalar(1 / wl);
      else want.set(0, 0, 0);
      speed *= wl > 4 ? 1.0 : 0.55;
    }
    // separation
    for (const o of g.enemies) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const dd = Math.hypot(dx, dz);
      const min = this.radius + o.radius + 0.5;
      if (dd < min && dd > 1e-3) want.addScaledVector(_v2.set(dx / dd, 0, dz / dd), (min - dd) * 1.5);
    }
    const len = want.length();
    if (len > 1) want.multiplyScalar(1 / len);
    this.velXZ.lerp(_v2.copy(want).multiplyScalar(speed), Math.min(1, dt * 6));
    this.pos.addScaledVector(this.velXZ, dt);
    this.turnTowards(p.pos, 6, dt);
    const sp = this.velXZ.length();
    const ma = sp > 0.1 ? angleDiff(this.yaw, Math.atan2(this.velXZ.x, this.velXZ.z)) : 0;
    this.anim.setLoco(sp, ma, 0);
  }

  startAttack(name) {
    const def = this.moves[name];
    this.setState('attack');
    this.curAttack = name;
    this.velXZ.set(0, 0, 0);
    this.anim.setLoco(0, 0, 0);
    this.run(def, { target: this.player });
    // telegraph: eye glint
    this.telegraph(def.windup ?? 0.4, name === 'smash');
  }

  telegraph(windup, heavy) {
    const g = this.game;
    g.fx.effects.timer(Math.max(0.05, windup - 0.18), null, () => {
      if (!this.alive || this.state !== 'attack') return;
      const h = this.head(_v).clone();
      h.y += 0.02;
      g.fx.particles.flash(h, heavy ? 0xff2020 : 0xffd040, heavy ? 1.3 : 0.9, 0.2);
      this.flash(heavy ? 0xff3030 : 0xffe080, 0.1);
    });
  }

  telegraphCircle(r, offset, time) {
    const f = this.forward(_v);
    const p = this.pos.clone().addScaledVector(f, offset);
    this.game.fx.effects.decal(p, { kind: 'circle', size: r * 2, life: time + 0.2, color: 0xff2a3a, alpha: 0.9, fillTime: time });
  }

  smashFx() {
    const f = this.forward(_v);
    const p = this.pos.clone().addScaledVector(f, 1.4);
    this.game.fx.ground(p, { size: 3, color: 0xff6a4a });
    this.game.cameraRig.shake(0.5);
    this.game.audio?.play('crack', { pos: p });
  }

  _attack(dt) {
    const r = this.action;
    if (!r) {
      this.setState('chase');
      return;
    }
    this.armor = this.V.armored ? r.inWindow(r.def.armor || [0, 99]) : false;
    r.update(dt);
    if (r.done) {
      this.action = null;
      this.armor = false;
      if (r.def.next) {
        this.run(this.moves[r.def.next], { target: this.player });
        return;
      }
      this.releaseToken();
      this.cooldown = rand(1.0, 2.2) / this.V.aggression / (this.game.combat.diff.tokens > 2 ? 1.3 : 1);
      this.setState('chase');
    }
  }

  releaseToken() {
    if (this.hasToken) this.game.director.releaseToken(this);
    this.hasToken = false;
  }

  onHit(att, h, info) {
    this.game.audio?.play('demonHurt', { pos: this.pos, volume: 0.5 });
    const heavyHit = h.stun === 'heavy' || h.stun === 'down';
    if (this.armor && this.poise > 0 && !heavyHit) {
      this.anim.hitJolt = 0.5;
      return;
    }
    const broke = this.poise <= 0;
    if (broke) this.poise = this.maxPoise;
    if (this.armor && !broke && this.variant === 'brute') {
      this.anim.hitJolt = 0.8;
      return;
    }
    this.releaseToken();
    this.action = null;
    this.armor = false;
    this.anim.hitDir = Math.sign(this.angleTo(att) || 1);
    if (h.stun === 'down' || (broke && this.variant !== 'brute' && heavyHit)) {
      this.setState('down');
      this.anim.play(this.clips.knockdown, { fade: 0.02 });
      this.knock.copy(info.dir).multiplyScalar((h.knock ?? 4) + 2);
      if (h.launch || h.stun === 'down') this.launch(h.launch ?? 3.5);
    } else {
      this.setState('hit');
      this.stunLen = heavyHit || broke ? 0.6 : 0.38;
      this.anim.play(this.clips.hit, { fade: 0.02 });
      this.anim.hitJolt = 1;
    }
    this.cooldown = Math.max(this.cooldown, 0.5);
    void clamp;
  }

  die(att, h, info) {
    if (!this.alive) return;
    this.alive = false;
    this.targetable = false;
    this.releaseToken();
    this.action = null;
    this.setState('dead');
    const g = this.game;
    g.onEnemyKilled?.(this, att, h);
    this.anim.play(this.clips.death, { fade: 0.02, hold: true });
    this.knock.copy(info.dir || _v.set(0, 0, 1)).multiplyScalar(3);
    // decapitation for bladed kills
    if (!h.blunt) this._decapitate(info.dir || _v.set(0, 0, 1));
    g.audio?.play('decap', { pos: this.pos });
    g.slowmoSoft?.(0.35, 0.18);
  }

  _decapitate(dir) {
    const g = this.game;
    const head = this.rig.j('head');
    g.scene.attach(head);
    // decouple from the animator
    this.rig.joints[J.head] = new THREE.Object3D();
    const vel = new THREE.Vector3(dir.x * 2.5 + (Math.random() - 0.5), 4.5 + Math.random() * 2, dir.z * 2.5 + (Math.random() - 0.5));
    this.headPhys = { obj: head, vel, spin: new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 16), bounces: 0 };
    const neck = this.rig.j('neck').getWorldPosition(_v).clone();
    g.fx.particles.ash(neck, 14, 0x3a0810, 0.15);
    g.fx.particles.sparks(neck, _v2.set(0, 1, 0), 12, 0x8a1020, 5, 0.5);
  }

  _deadUpdate(dt) {
    this.deathT += dt;
    const g = this.game;
    if (this.headPhys) {
      const hp = this.headPhys;
      hp.vel.y -= 16 * dt;
      hp.obj.position.addScaledVector(hp.vel, dt);
      hp.obj.rotation.x += hp.spin.x * dt;
      hp.obj.rotation.y += hp.spin.y * dt;
      hp.obj.rotation.z += hp.spin.z * dt;
      if (hp.obj.position.y < 0.15) {
        hp.obj.position.y = 0.15;
        if (hp.vel.y < -1.5 && hp.bounces < 3) {
          hp.vel.y *= -0.35;
          hp.vel.x *= 0.6;
          hp.vel.z *= 0.6;
          hp.spin.multiplyScalar(0.5);
          hp.bounces++;
          if (hp.bounces === 1) g.audio?.play('land', { pos: hp.obj.position, volume: 0.35 });
        } else {
          hp.vel.set(0, 0, 0);
          hp.spin.multiplyScalar(0.8);
        }
      }
    }
    if (this.deathT > 0.45) {
      const k = clamp((this.deathT - 0.45) / 1.7);
      if (!this._ashSfx) {
        this._ashSfx = true;
        g.audio?.play('demonDeath', { pos: this.pos, volume: 0.7 });
      }
      if (!this._layered && this.headPhys) {
        this._layered = true;
        this.headPhys.obj.traverse((o) => o.layers.set(LAYER_MAIN_ONLY));
      }
      this.setDissolve(k);
      if (Math.random() < 0.7) g.fx.ashFrom(this.model, 3);
      if (k >= 1 && !this.removed) {
        this.removed = true;
        if (this.headPhys) g.scene.remove(this.headPhys.obj);
        this.dispose();
      }
    }
  }
}
