import * as THREE from 'three';
import { Actor } from './actor.js';
import { SwordTrail } from '../fx/effects.js';
import { playerMoves, SKILLS, ULTS } from '../game/moves.js';
import { clamp, dampT, angleDiff, DEG } from '../core/math.js';
import { LAYER_FX } from '../render/pipeline.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _mv = { x: 0, y: 0 };

const WALK = 5.2;
const SPRINT = 8.4;

export class Player extends Actor {
  constructor(game, charId, model) {
    super(game, model, { team: 'player', hp: charId === 'giyu' ? 125 : 115, radius: 0.42, height: 1.8, poise: 40 });
    this.charId = charId;
    this.moves = playerMoves(charId);
    this.skills = SKILLS[charId];
    this.ultInfo = ULTS[charId];
    this.maxStamina = this.stamina = 100;
    this.maxBreath = this.breath = 100;
    this.maxConc = 100;
    this.conc = 0;
    this.skillCd = [0, 0, 0];
    this.buffer = null;
    this.bufferT = 0;
    this.comboIdx = 0;
    this.comboTimer = 0;
    this.lockTarget = null;
    this.blocking = false;
    this.blockT = 0;
    this.chargeT = 0;
    this.speed = 0;
    this.moveDir = new THREE.Vector3();
    this.velXZ = new THREE.Vector3();
    this.staminaDelay = 0;
    this.critTarget = null;
    this.critT = 0;
    this.counterT = 0;
    this.dmgMul = charId === 'tanjiro' ? 1.08 : 1.0;
    this.control = true;
    this.state = 'move';
    this.trail = new SwordTrail(game.scene, { style: 'steel' });
    this.trail.setStyle('steel');
    this.trailOn = false;
    this.swordVel = new THREE.Vector3();
    this._prevTip = new THREE.Vector3();
    this._tip = new THREE.Vector3();
    this._base = new THREE.Vector3();
    this.footPhase = 0;
    this.perfectCooldown = 0;
    this.threadMesh = this._makeThread();
    this.ult = null;
    this.stats = { damageTaken: 0 };
  }

  _makeThread() {
    const g = new THREE.CylinderGeometry(0.012, 0.012, 1, 6, 1, true);
    g.translate(0, 0.5, 0);
    g.rotateX(Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(g, m);
    mesh.layers.set(LAYER_FX);
    mesh.visible = false;
    mesh.frustumCulled = false;
    this.game.scene.add(mesh);
    return mesh;
  }

  // ---------------------------------------------------------------- helpers
  aimTarget() {
    if (this.lockTarget && this.lockTarget.alive) return this.lockTarget;
    return this.bestTarget(6.5, 80);
  }

  bestTarget(maxDist = 8, maxAngleDeg = 90) {
    let best = null, bestScore = Infinity;
    for (const e of this.game.enemies) {
      if (!e.alive || e.targetable === false) continue;
      const d = this.distTo(e);
      if (d > maxDist) continue;
      // prefer targets in the input direction (or facing)
      const dirYaw = this.moveDir.lengthSq() > 0.01 ? Math.atan2(this.moveDir.x, this.moveDir.z) : this.yaw;
      const ang = Math.abs(angleDiff(dirYaw, Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z)));
      if (ang > maxAngleDeg * DEG) continue;
      const score = d + ang * 3;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  callout(school, form, name, style) {
    this.game.hud?.callout({ school, form, name, style, side: 'right' });
  }

  setTrail(style) {
    if (!style) {
      this.trailOn = false;
      return;
    }
    this.trail.setStyle(style);
    this.trailOn = true;
  }

  spend(res, amt) {
    if (this[res] < amt) return false;
    this[res] -= amt;
    if (res === 'stamina') this.staminaDelay = 0.7;
    return true;
  }

  gain(conc = 0, breath = 0) {
    const before = this.conc;
    this.conc = Math.min(this.maxConc, this.conc + conc);
    this.breath = Math.min(this.maxBreath, this.breath + breath);
    if (before < this.maxConc && this.conc >= this.maxConc) {
      this.game.audio?.play('gaugeFull');
      this.game.hud?.toast('全集中・常中', 'info');
    }
  }

  consumeCrit(victim) {
    if (this.counterT > 0) {
      this.counterT = 0;
      return true;
    }
    if (this.critTarget && victim === this.critTarget && this.critT > 0) {
      this.critTarget = null;
      this.critT = 0;
      this.threadMesh.visible = false;
      this.game.fx.screen.impact(0.06, 0x120204, 0xffe0e0);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- update
  update(dt, realDt) {
    dt = this.tick(dt, realDt);
    const g = this.game;
    const input = g.input;
    // cooldowns & resources
    for (let i = 0; i < 3; i++) this.skillCd[i] = Math.max(0, this.skillCd[i] - dt);
    this.staminaDelay -= dt;
    if (this.staminaDelay <= 0 && this.state !== 'block') this.stamina = Math.min(this.maxStamina, this.stamina + 34 * dt);
    this.breath = Math.min(this.maxBreath, this.breath + 5 * dt);
    this.comboTimer -= dt;
    if (this.critT > 0) {
      this.critT -= dt;
      if (this.critT <= 0 || !this.critTarget?.alive) {
        this.critTarget = null;
        this.threadMesh.visible = false;
      }
    }
    if (this.counterT > 0) this.counterT -= dt;
    if (this.perfectCooldown > 0) this.perfectCooldown -= realDt;
    if (this.lockTarget && (!this.lockTarget.alive || this.lockTarget.targetable === false)) {
      // hand the lock to the next closest demon so the flow is not broken
      const next = this.game.enemies.filter((e) => e.alive && e.targetable !== false && this.distTo(e) < 12).sort((a, b) => this.distTo(a) - this.distTo(b))[0];
      this.lockTarget = next || null;
      this.game.cameraRig.lock = this.lockTarget;
    }

    // input buffer
    if (this.control && this.alive) this._readInput(input);
    if (this.bufferT > 0) this.bufferT -= realDt;
    else this.buffer = null;

    switch (this.state) {
      case 'move': this._move(dt, input); break;
      case 'charge': this._charge(dt, input); break;
      case 'action': this._action(dt, input); break;
      case 'block': this._block(dt, input); break;
      case 'hit': this._hitStun(dt); break;
      case 'down': this._down(dt); break;
      case 'ult': this._ultUpdate(dt, realDt); break;
      case 'dead': break;
      case 'cine': this._idle(dt); break;
      default: this.setState('move');
    }
    this.blocking = this.state === 'block';
    this.anim.guardTarget = this.blocking ? 1 : 0;
    this.game.world?.constrain(this.pos, this.radius);
    this._updateThread();
    // present with sword sampling for the trail
    this.present(dt, () => this._sampleSword(dt));
    this.trail.update(this.game.time, this.trailOn);
  }

  _readInput(input) {
    const pressed = (a) => input.pressed(a);
    let b = null;
    if (pressed('light')) b = 'light';
    else if (pressed('heavy')) b = 'heavy';
    else if (pressed('dodge')) b = 'dodge';
    else if (pressed('skill1')) b = 'skill1';
    else if (pressed('skill2')) b = 'skill2';
    else if (pressed('skill3')) b = 'skill3';
    else if (pressed('ult')) b = 'ult';
    if (b) {
      this.buffer = b;
      this.bufferT = 0.28;
    }
    if (pressed('lock')) this.toggleLock();
    if (pressed('stance')) this.toggleAttackMode();
  }

  toggleAttackMode() {
    const heavy = this.game.input.toggleAttackMode() === 'heavy';
    this.game.audio?.play(heavy ? 'uiConfirm' : 'uiSelect', { volume: 0.5, pitch: heavy ? 0.8 : 1.15 });
  }

  toggleLock() {
    if (this.lockTarget) {
      this.lockTarget = null;
    } else {
      // choose the enemy closest to the camera's view direction
      const cam = this.game.cameraRig;
      const f = cam.basis(_f, _r);
      let best = null, bestS = Infinity;
      for (const e of this.game.enemies) {
        if (!e.alive || e.targetable === false) continue;
        const d = this.distTo(e);
        if (d > 22) continue;
        _v.set(e.pos.x - this.pos.x, 0, e.pos.z - this.pos.z).normalize();
        const s = (1 - _v.dot(f)) * 10 + d * 0.3 + (e.isBoss ? -3 : 0);
        if (s < bestS) { bestS = s; best = e; }
      }
      this.lockTarget = best;
    }
    this.game.cameraRig.lock = this.lockTarget;
    this.game.audio?.play('uiSelect', { volume: 0.4 });
  }

  _desiredMove(input) {
    input.move(_mv);
    const cam = this.game.cameraRig;
    cam.basis(_f, _r);
    this.moveDir.set(0, 0, 0).addScaledVector(_f, _mv.y).addScaledVector(_r, _mv.x);
    return Math.min(1, Math.hypot(_mv.x, _mv.y));
  }

  _locomote(dt, input, maxSpeed, allowSprint = true) {
    const mag = this.control ? this._desiredMove(input) : 0;
    let sprint = allowSprint && mag > 0.1 && input.down('sprint') && this.stamina > 1;
    if (sprint) {
      this.stamina -= 16 * dt;
      this.staminaDelay = 0.5;
    }
    const target = mag * (sprint ? SPRINT : maxSpeed);
    const wantVel = _v.copy(this.moveDir).normalize().multiplyScalar(target);
    if (mag < 0.01) wantVel.set(0, 0, 0);
    const k = dampT(target > this.velXZ.length() ? 12 : 16, dt);
    const prevSpeed = this.velXZ.length();
    this.velXZ.lerp(wantVel, k);
    this.pos.addScaledVector(this.velXZ, dt);
    const sp = this.velXZ.length();
    this.speed = sp;
    // facing
    const lock = this.lockTarget && this.lockTarget.alive && !sprint ? this.lockTarget : null;
    if (lock) this.turnTowards(lock.pos, 12, dt);
    else if (sp > 0.3) this.turnTowards(_v2.copy(this.pos).add(this.velXZ), 13, dt);
    const moveAngle = sp > 0.1 ? angleDiff(this.yaw, Math.atan2(this.velXZ.x, this.velXZ.z)) : 0;
    this.anim.setLoco(sp, lock ? moveAngle : 0, sprint ? 1 : 0);
    this.anim.leanTarget = clamp((sp - prevSpeed) / Math.max(dt, 1e-3) * 0.02, -0.6, 0.6) + (sprint ? 0.25 : 0);
    // footsteps
    const ph = Math.floor(this.anim.phase / Math.PI);
    if (ph !== this.footPhase) {
      this.footPhase = ph;
      if (sp > 1.5) this.game.audio?.play('step', { volume: sprint ? 0.55 : 0.4, pos: this.pos });
    }
    if (sprint && Math.random() < dt * 20) this.game.fx.particles.smoke(_v3.set(this.pos.x, 0.1, this.pos.z), 1, 0x3a2e2a, 0.25, 0.6, 0.5);
  }

  _idle(dt) {
    this.velXZ.multiplyScalar(Math.exp(-dt * 10));
    this.anim.setLoco(0, 0, 0);
  }

  _move(dt, input) {
    this._locomote(dt, input, WALK);
    if (!this.control) return;
    if (input.down('block')) {
      this.setState('block');
      this.blockT = 0;
      return;
    }
    this._consumeBuffer(input);
  }

  _consumeBuffer(input) {
    const b = this.buffer;
    if (!b) return false;
    const sprinting = this.anim.sprint > 0.5 && this.speed > 6;
    switch (b) {
      case 'light': {
        if (this.comboTimer <= 0) this.comboIdx = 0;
        const name = sprinting ? 'light3' : ['light1', 'light2', 'light3', 'light4'][this.comboIdx % 4];
        this.comboIdx = (this.comboIdx + 1) % 4;
        this.startMove(name);
        break;
      }
      case 'heavy':
        this.setState('charge');
        this.chargeT = 0;
        this.velXZ.multiplyScalar(0.3);
        break;
      case 'dodge':
        this.startDodge(input);
        break;
      case 'skill1': case 'skill2': case 'skill3':
        this.startSkill(+b.slice(-1) - 1);
        break;
      case 'ult':
        this.startUlt();
        break;
    }
    this.buffer = null;
    return true;
  }

  startMove(name, opts = {}) {
    const def = this.moves[name];
    if (!def) return;
    const tgt = this.aimTarget();
    // snap part of the way toward the target for responsiveness
    if (tgt) {
      const want = Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z);
      const d = angleDiff(this.yaw, want);
      this.yaw += clamp(d, -1.2, 1.2);
    } else if (this.moveDir.lengthSq() > 0.01) {
      this.yaw = Math.atan2(this.moveDir.x, this.moveDir.z);
    }
    // adaptive lunge: close the gap to targets slightly out of range
    let motionScale = 1;
    if (tgt && def.motion && !opts.noLunge) {
      const dist = this.distTo(tgt) - tgt.radius - 1.3;
      const base = def.motion.reduce((s, m) => s + m[2], 0);
      if (base > 0) motionScale = clamp(dist / base, 0.25, 1.8);
    }
    this.setState('action');
    this.run(def, { target: tgt, motionScale });
    this.curMove = name;
    this.velXZ.multiplyScalar(0.2);
    this.model.setFace('fierce');
    this.anim.setLoco(0, 0, 0);
    this.comboTimer = def.dur + 0.3;
  }

  startDodge(input) {
    if (!this.spend('stamina', 20)) {
      this.game.hud?.toast('耐力不足', 'info');
      return;
    }
    const mag = this._desiredMove(input);
    let dir;
    if (this.lockTarget && mag > 0.1) {
      const a = angleDiff(this.yaw, Math.atan2(this.moveDir.x, this.moveDir.z));
      dir = Math.abs(a) < Math.PI / 4 ? 'F' : Math.abs(a) > (3 * Math.PI) / 4 ? 'B' : a > 0 ? 'L' : 'R';
    } else if (mag > 0.1) {
      this.yaw = Math.atan2(this.moveDir.x, this.moveDir.z);
      dir = 'F';
    } else dir = 'B';
    this.setState('action');
    this.run(this.moves['dodge' + dir]);
    this.curMove = 'dodge';
    this.dodgeStart = this.game.time;
    this.invuln = 0.3;
    this.velXZ.set(0, 0, 0);
    this.setTrail(null);
    // a dodge started just before an incoming hit counts as perfect even if it carries us out of range
    const threat = this._imminentThreat();
    if (threat && this.perfectCooldown <= 0) this.perfectDodge(threat);
  }

  /** Returns the attacker whose hit would land on us within the next instant, if any. */
  _imminentThreat() {
    const g = this.game;
    const combat = g.combat;
    for (const e of g.enemies) {
      if (!e.alive || !e.action) continue;
      const r = e.action;
      const d = r.def;
      for (const h of d.hits || []) {
        const dt = h.t - r.t;
        if (dt < -0.02 || dt > 0.3) continue;
        if (combat.inShape(e, this, { ...h, range: (h.range ?? 2.2) + 0.9, arc: (h.arc ?? 120) + 30 })) return e;
      }
      for (const h of d.multi || []) {
        if (r.t < h.t0 - 0.3 || r.t > h.t1) continue;
        if (combat.inShape(e, this, { ...h, range: (h.range ?? 2.2) + 0.9 })) return e;
      }
      // hazards (shock rings) about to sweep over us
      for (const hz of e.hazards || []) {
        const dd = Math.hypot(this.pos.x - hz.c.x, this.pos.z - hz.c.z);
        if (!hz.hit && dd - hz.r > -0.5 && dd - hz.r < hz.speed * 0.3) return e;
      }
    }
    for (const pr of combat.projectiles) {
      if (pr.owner === this) continue;
      const dx = this.pos.x - pr.pos.x, dz = this.pos.z - pr.pos.z;
      const dist = Math.hypot(dx, dz);
      const closing = (dx * pr.vel.x + dz * pr.vel.z) / Math.max(dist, 1e-3);
      if (dist < 4.5 && closing > 0 && dist / Math.max(closing, 1) < 0.3) return pr.owner;
    }
    return null;
  }

  startSkill(i) {
    const sk = this.skills[i];
    if (!sk) return;
    if (this.skillCd[i] > 0) return;
    if (this.breath < sk.cost) {
      this.game.hud?.toast('呼吸不足', 'info');
      this.game.audio?.play('uiBack', { volume: 0.5 });
      return;
    }
    this.breath -= sk.cost;
    this.skillCd[i] = sk.cd;
    this.startMove(sk.move, { noLunge: false });
  }

  _charge(dt, input) {
    this.chargeT += dt;
    this.velXZ.multiplyScalar(Math.exp(-dt * 12));
    const tgt = this.aimTarget();
    if (tgt) this.turnTowards(tgt.pos, 8, dt);
    if (this.chargeT > 0.22 && !this._charging) {
      this._charging = true;
      this.anim.play(this.clips.thrustCharge, { fade: 0.1, hold: true });
      this.game.audio?.play('waterWave', { volume: 0.35, pitch: 1.3 });
    }
    if (this._charging && Math.random() < dt * 30) {
      this.model.sword.tip.getWorldPosition(_v);
      this.game.fx.particles.droplets(_v, _v2.set(0, 1, 0), 1, 0x7ad0ff, 1.5, 0.05);
    }
    if (this.chargeT > 0.6 && !this._chargedFx) {
      this._chargedFx = true;
      this.model.sword.tip.getWorldPosition(_v);
      this.game.fx.particles.flash(_v, 0xbfe8ff, 1.0, 0.18);
      this.game.audio?.play('gaugeFull', { volume: 0.4, pitch: 1.5 });
    }
    const released = !input.down('heavy') || !this.control;
    if (released || this.chargeT > 1.6) {
      const charged = this.chargeT >= 0.6;
      this._charging = false;
      this._chargedFx = false;
      if (charged) this.startMove('thrust');
      else this.startMove('heavy');
    }
  }

  _action(dt, input) {
    const r = this.action;
    if (!r) {
      this.setState('move');
      return;
    }
    const d = r.def;
    this.invuln = r.inWindow(d.iframes) ? Math.max(this.invuln, 0.02) : this.invuln;
    this.armor = r.inWindow(d.armor);
    r.update(dt);
    // cancels
    const b = this.buffer;
    if (b) {
      const isDodge = this.curMove === 'dodge';
      if (b === 'dodge' && !isDodge && (r.t > 0.12 || r.canCancel) && !d.cost) {
        this.startDodge(input);
        this.buffer = null;
        return;
      }
      if (r.canCancel) {
        if (isDodge && b === 'light') {
          this.buffer = null;
          this.comboIdx = 2;
          this.startMove('light3');
          return;
        }
        this.setState('move');
        this._consumeBuffer(input);
        if (this.state === 'action' || this.state === 'charge') return;
      }
    }
    if (r.done) {
      this.action = null;
      this.armor = false;
      this.setTrail(null);
      this.model.setFace('neutral');
      this.setState('move');
    }
  }

  _block(dt, input) {
    this.blockT += dt;
    this._locomote(dt, input, 2.0, false);
    const tgt = this.aimTarget();
    if (tgt) this.turnTowards(tgt.pos, 14, dt);
    if (!input.down('block') || !this.control) {
      this.setState('move');
      return;
    }
    if (this.buffer === 'dodge') {
      this.buffer = null;
      this.startDodge(input);
    } else if (this.buffer === 'light' || this.buffer === 'heavy') {
      this.setState('move');
      this._consumeBuffer(input);
    }
  }

  _hitStun(dt) {
    this.velXZ.multiplyScalar(Math.exp(-dt * 10));
    if (this.stateT > 0.16 && this.buffer === 'dodge' && this.control) {
      this.buffer = null;
      this.startDodge(this.game.input);
      return;
    }
    if (this.stateT > this.stunLen) {
      this.model.setFace('neutral');
      this.setState('move');
    }
  }

  _down(dt) {
    if (this.stateT > 1.05 && !this._gettingUp) {
      this._gettingUp = true;
      this.anim.play(this.clips.getup, { fade: 0.05 });
      this.invuln = 0.8;
    }
    if (this.stateT > 1.6) {
      this._gettingUp = false;
      this.model.setFace('neutral');
      this.setState('move');
    }
  }

  // ---------------------------------------------------------------- defence
  defend(att, h) {
    const g = this.game;
    if (!this.alive) return 'miss';
    if (this.state === 'ult' || this.god) return 'miss';
    if (this.invuln > 0) {
      const inDodge = this.curMove === 'dodge' && this.state === 'action' && g.time - this.dodgeStart < 0.24;
      if (inDodge && this.perfectCooldown <= 0) this.perfectDodge(att);
      return 'dodge';
    }
    if (this.blocking && !h.unblockable) {
      const front = Math.abs(this.angleTo(att)) < 1.7;
      if (!front) return null;
      if (this.blockT < 0.2 && !h.unparryable) {
        this.parry(att, h);
        return 'parry';
      }
      // regular block: chip damage + stamina
      const dmg = Math.round((h.dmg ?? 10) * g.combat.diff.toPlayer * 0.2);
      this.hp -= dmg;
      this.stats.damageTaken += dmg;
      g.stats.damageTaken += dmg;
      this.stamina -= (h.dmg ?? 10) * 1.6;
      this.staminaDelay = 0.8;
      const d = _v.set(this.pos.x - att.pos.x, 0, this.pos.z - att.pos.z).normalize();
      this.knock.copy(d).multiplyScalar(2 + (h.knock ?? 1) * 0.5);
      this.model.sword.mid.getWorldPosition(_v2);
      g.fx.particles.sparks(_v2, _v3.copy(d).negate(), 16, 0xfff0c0, 9, 1);
      g.fx.particles.flash(_v2, 0xfff4d0, 0.7, 0.08);
      g.audio?.play('block', { pos: _v2 });
      g.cameraRig.shake(0.18);
      this.hitstop = 0.06;
      att.hitstop = Math.max(att.hitstop, 0.05);
      if (this.stamina <= 0) {
        this.stamina = 0;
        g.audio?.play('guardBreak');
        g.hud?.toast('破防', 'break');
        this.stunLen = 1.0;
        this.setState('hit');
        this.anim.play(this.clips.hitLight, { fade: 0.03 });
      } else {
        this.anim.play(this.clips.blockHit, { fade: 0.02, mask: 'upper' });
      }
      if (this.hp <= 0) this.die(att, h, {});
      return 'block';
    }
    return null;
  }

  perfectDodge(att) {
    const g = this.game;
    this.perfectCooldown = 1.2;
    g.slowmo(0.22, 0.85);
    g.hud?.toast('完美閃避', 'perfect');
    g.audio?.play('perfectDodge');
    g.fx.screen.flash(0xcfe8ff, 0.3, 6);
    g.fx.screen.chroma(0.8);
    this.gain(10, 12);
    g.fx.effects.afterimage(this.model, { color: 0x6ec8ff, life: 0.45, alpha: 0.45 });
    if (this.charId === 'tanjiro' && att && att.alive) {
      this.critTarget = att;
      this.critT = 3.5;
      this.threadMesh.visible = true;
      g.hud?.toast('隙之線', 'counter');
    } else {
      this.counterT = 1.5;
    }
  }

  parry(att, h) {
    const g = this.game;
    this.model.sword.mid.getWorldPosition(_v2);
    g.fx.particles.sparks(_v2, _v3.set(att.pos.x - this.pos.x, 0.4, att.pos.z - this.pos.z).normalize(), 30, 0xfff6d0, 14, 1.2);
    g.fx.particles.flash(_v2, 0xffffff, 1.8, 0.14);
    g.fx.effects.ring(_v2.clone(), { color: 0xdff4ff, from: 0.1, to: 2.2, life: 0.3, normal: _v3.set(att.pos.x - this.pos.x, 0, att.pos.z - this.pos.z) });
    g.fx.light(_v2, 0xffffff, 5, 8, 0.2);
    g.audio?.play('clang', { pos: _v2 });
    g.cameraRig.shake(0.35);
    g.slowmo(0.3, 0.45);
    g.fx.screen.flash(0xffffff, 0.35, 12);
    this.hitstop = 0.12;
    att.hitstop = Math.max(att.hitstop, 0.14);
    this.anim.play(this.clips.parry, { fade: 0.02 });
    this.setState('action');
    this.run(this.moves.parry);
    this.curMove = 'parry';
    this.counterT = 1.6;
    this.gain(12, this.charId === 'giyu' ? 40 : 15);
    g.hud?.toast('完美格擋', 'counter');
    att.onParried?.(this, h);
    if (this.charId === 'giyu' && att.alive) {
      // Giyu counters instantly
      g.fx.effects.timer(0.12, null, () => {
        if (!att.alive || this.state === 'dead') return;
        this.faceInstant(att.pos);
        this.startMove('light3', { noLunge: true });
        this.callout('水之呼吸', '拾壹之型', '凪', 'calm');
      });
    }
  }

  onHit(att, h, info) {
    const g = this.game;
    this.stats.damageTaken += info.dmg;
    this.gain(4, 0);
    g.audio?.play('playerHurt', { pos: this.pos });
    if (this.state === 'ult') return;
    if (this.armor && h.stun !== 'down') {
      this.anim.hitJolt = 0.6;
      return;
    }
    this.action = null;
    this.setTrail(null);
    this._charging = false;
    this.model.setFace('hurt');
    const stun = h.stun || 'light';
    this.anim.hitDir = Math.sign(this.angleTo(att) || 1);
    if (stun === 'down') {
      this.setState('down');
      this._gettingUp = false;
      this.anim.play(this.clips.knockdown, { fade: 0.03, hold: true });
      this.knock.set(this.pos.x - att.pos.x, 0, this.pos.z - att.pos.z).normalize().multiplyScalar((h.knock ?? 5) + 2);
    } else {
      this.setState('hit');
      this.stunLen = stun === 'heavy' ? 0.55 : 0.34;
      this.anim.play(this.clips.hitLight, { fade: 0.02 });
    }
    g.fx.screen.flash(0x800010, 0.25, 6);
  }

  die(att) {
    if (!this.alive) return;
    this.alive = false;
    this.setState('dead');
    this.action = null;
    this.setTrail(null);
    this.model.setFace('hurt');
    this.anim.play(this.clips.death, { fade: 0.05, hold: true });
    this.game.audio?.play('playerDeath');
    this.game.slowmo(0.25, 1.2);
    this.game.onPlayerDeath?.();
    void att;
  }

  // ---------------------------------------------------------------- fx helpers used by moves
  _bodyDir(tilt, yaw, a, out) {
    // same maths as Animator._swordIK, rotated by the actor's yaw
    const ty = tilt * DEG, yy = yaw * DEG, aa = a * DEG;
    const fx = Math.sin(yy), fz = Math.cos(yy);
    const sx = -Math.cos(yy) * Math.sin(ty), sy = Math.cos(ty), sz = Math.sin(yy) * Math.sin(ty);
    out.set(fx * Math.cos(aa) + sx * Math.sin(aa), sy * Math.sin(aa), fz * Math.cos(aa) + sz * Math.sin(aa));
    // rotate by actor yaw (and body pitch for flips is ignored)
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const x = out.x * c + out.z * s;
    const z = -out.x * s + out.z * c;
    return out.set(x, out.y, z);
  }

  spawnArc({ tilt = 0, yaw = 0, a0, a1, r = 1.5, width = 0.5, style = 'steel', life = 0.3, wipe = 0.07 }) {
    const center = this.chest(_v).clone();
    center.y += 0.05;
    const f = this._bodyDir(tilt, yaw, a0, new THREE.Vector3());
    const sgn = a1 > a0 ? 1 : -1;
    const s = this._bodyDir(tilt, yaw, a0 + 90 * sgn, new THREE.Vector3());
    this.game.fx.effects.arc({ center, f, s, radius: r, width, arc: Math.abs(a1 - a0) * DEG, style, life, wipe });
  }

  glint() {
    this.model.sword.tip.getWorldPosition(_v);
    this.game.fx.particles.flash(_v, 0xffffff, 0.9, 0.16);
  }

  speedBurst(amount = 0.8) {
    this.game.fx.screen.speed(amount, 0.18);
    this.game.cameraRig.kick(6);
    this.game.fx.effects.afterimage(this.model, { color: 0x4fb3e8, life: 0.3, alpha: 0.35 });
  }

  splashGround(size = 1.5, power = 1) {
    const f = this.forward(_v2);
    const p = _v.copy(this.pos).addScaledVector(f, 1.3);
    p.y = 0.1;
    this.game.fx.effects.ring(p.clone(), { color: 0x7ad0ff, from: 0.3, to: size * 1.6, life: 0.45, thick: 0.3 });
    this.game.fx.particles.droplets(p.clone().setY(0.3), _v3.set(0, 1, 0), Math.round(20 * power), 0x4fb3e8, 5 * power, 0.09);
    this.game.fx.effects.sprite(p.clone().setY(0.6), { tex: 'splash', size: size * 1.2, life: 0.4, grow: 0.5 });
    this.game.fx.light(p.clone().setY(1), 0x6ec8ff, 3, 6, 0.3);
  }

  waveCurls(n = 3) {
    const f = this.forward(_v2).clone();
    const r = this.right(_v3).clone();
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const p = this.pos.clone().addScaledVector(f, 2.2 + i * 0.5).addScaledVector(r, side * (1.8 + Math.random() * 0.8));
      p.y = 0.5 + Math.random() * 0.5;
      this.game.fx.effects.sprite(p, { tex: 'waveCurl', size: 0.9 + Math.random() * 0.5, life: 0.5, rot: side * 0.25, grow: 0.35, alpha: 0.9 });
    }
    this.game.fx.particles.droplets(this.chest(_v).clone(), f, 30, 0x4fb3e8, 7, 0.08);
    this.game.fx.light(this.chest(_v).clone(), 0x6ec8ff, 2, 6, 0.3);
  }

  thrustFx() {
    const f = this.forward(_v2);
    const p = this.chest(_v).clone();
    this.game.fx.effects.ring(p.clone().addScaledVector(f, 1.2), { color: 0xbfe8ff, from: 0.2, to: 1.8, life: 0.35, normal: f.clone(), thick: 0.25 });
    this.game.fx.effects.ring(p.clone().addScaledVector(f, 2.4), { color: 0x6ec8ff, from: 0.1, to: 1.3, life: 0.4, normal: f.clone(), thick: 0.2 });
    this.game.fx.screen.speed(1, 0.12);
    this.game.fx.particles.droplets(p, f, 24, 0x4fb3e8, 9, 0.08);
    this.game.fx.effects.afterimage(this.model, { color: 0x4fb3e8, life: 0.3, alpha: 0.4 });
  }

  wheelFx() {
    const p = this.chest(_v).clone();
    const f = this.forward(_v2).clone();
    p.addScaledVector(f, 1.6);
    p.y += 0.4;
    // vertical full-circle water wheel in the forward plane
    this.game.fx.effects.arc({ center: p, f: new THREE.Vector3(0, 1, 0), s: f, radius: 1.5, width: 0.9, arc: Math.PI * 1.95, style: 'water', life: 0.6, wipe: 0.4 });
  }

  fireCharge() {
    this.model.sword.tip.getWorldPosition(_v);
    this.game.fx.particles.embers(_v, 20, 0xff8a2a, 2, 0.6);
    this.game.fx.light(_v, 0xff7a2a, 3, 5, 0.5);
    this.model.sword.bladeMat.uniforms.uEmissive.value.setRGB(0.9, 0.25, 0.05);
    this.game.fx.effects.timer(1.2, null, () => this.model.sword.bladeMat.uniforms.uEmissive.value.setRGB(0, 0, 0));
  }

  fireBurst() {
    const f = this.forward(_v2);
    const p = _v.copy(this.pos).addScaledVector(f, 1.8);
    p.y = 0.2;
    this.game.fx.ground(p, { size: 2.6, color: 0xff8a2a, crack: true });
    for (let i = 0; i < 4; i++) {
      this.game.fx.effects.sprite(p.clone().add(_v3.set((Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 1.6)), { tex: 'flame', size: 1.2 + Math.random(), life: 0.6, grow: 0.5, rise: 2, additive: true, add: 0.6 });
    }
    this.game.fx.particles.embers(p.clone().setY(0.8), 50, 0xff8a2a, 5, 1.2);
    this.game.fx.light(p.clone().setY(1.2), 0xff6a1a, 8, 12, 0.6);
  }

  whirlFx() {
    const c = this.pos.clone();
    c.y = 1.0;
    for (let i = 0; i < 3; i++) {
      const y = 0.5 + i * 0.35;
      const a0 = Math.random() * Math.PI * 2;
      this.game.fx.effects.timer(0.1 + i * 0.12, null, () => {
        this.game.fx.effects.arc({
          center: new THREE.Vector3(this.pos.x, y, this.pos.z),
          f: new THREE.Vector3(Math.cos(a0), 0, Math.sin(a0)),
          s: new THREE.Vector3(-Math.sin(a0), 0, Math.cos(a0)),
          radius: 2.0 + i * 0.5, width: 0.8, arc: Math.PI * 1.9, style: 'water', life: 0.6, wipe: 0.35,
        });
      });
    }
    this.game.fx.effects.ring(c.clone().setY(0.08), { color: 0x6ec8ff, from: 0.5, to: 4, life: 0.8, thick: 0.35 });
    this.game.fx.particles.droplets(c, _v2.set(0, 1, 0), 40, 0x4fb3e8, 6, 0.09);
  }

  fluxDragon() {
    const f = this.forward(new THREE.Vector3());
    const r = this.right(new THREE.Vector3());
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const p = this.pos.clone().addScaledVector(f, -0.5 + t * 7.2);
      p.addScaledVector(r, Math.sin(t * Math.PI * 3) * 1.2);
      p.y = 0.9 + Math.sin(t * Math.PI * 2) * 0.5 + t * 0.6;
      pts.push(p);
    }
    this.game.fx.effects.dragon(pts, { style: 'water', radius: 0.75, life: 2.2, grow: 0.72 });
  }

  dodgeFx(ang) {
    this.game.fx.effects.afterimage(this.model, { color: this.charId === 'giyu' ? 0x4fb3e8 : 0x7fd4a8, life: 0.25, alpha: 0.3 });
    this.game.fx.particles.smoke(_v.set(this.pos.x, 0.1, this.pos.z), 3, 0x3a2e2a, 0.35, 1.0, 0.5);
    void ang;
  }

  _sampleSword(dt) {
    const sw = this.model.sword;
    sw.tip.getWorldPosition(this._tip);
    sw.base.getWorldPosition(this._base);
    if (dt > 0) this.swordVel.subVectors(this._tip, this._prevTip).divideScalar(dt);
    this._prevTip.copy(this._tip);
    if (this.trailOn) this.trail.push(this._base, this._tip, this.game.time);
  }

  _updateThread() {
    if (!this.threadMesh.visible || !this.critTarget) return;
    const a = this.model.sword.tip.getWorldPosition(_v);
    const b = this.critTarget.chest(_v2);
    const m = this.threadMesh;
    m.position.copy(a);
    m.lookAt(b);
    m.scale.set(1 + Math.sin(this.game.time * 20) * 0.4, 1, a.distanceTo(b));
    m.material.opacity = 0.6 + Math.sin(this.game.time * 14) * 0.3;
  }

  // ---------------------------------------------------------------- ultimates
  startUlt() {
    if (this.conc < this.maxConc) {
      this.game.hud?.toast('全集中未滿', 'info');
      return;
    }
    this.conc = 0;
    this.setState('ult');
    this.action = null;
    this.invuln = 99;
    this.velXZ.set(0, 0, 0);
    this.model.setFace('fierce');
    const g = this.game;
    g.audio?.play('ultimate');
    g.fx.screen.flash(this.charId === 'giyu' ? 0xdff4ff : 0xffd0a0, 0.5, 5);
    g.fx.screen.speed(1, 0.6);
    g.cameraRig.kick(10);
    this.callout(this.ultInfo.school, this.ultInfo.form, this.ultInfo.name, this.ultInfo.style);
    this.ult = { phase: 'ready', t: 0, i: 0, targets: [], path: [this.pos.clone()], next: 0, hits: 0 };
    if (this.charId === 'giyu') {
      this.anim.play(this.clips.calmStance, { fade: 0.1, hold: true });
      g.fx.screen.desatTarget = 0.75;
      g.fx.screen.tintTarget.setRGB(0.85, 0.95, 1.08);
      g.fx.screen.ripple(4.2, g.worldToScreen(this.pos));
      g.audio?.play('calm');
      g.audio?.duck(0.7, 3.5);
      this.calmDecal = g.fx.effects.decal(this.pos, { kind: 'ripple', size: 15, life: 4.4, color: 0x9fdcff, alpha: 0.9, fadeIn: 0.4, y: 0.03 });
      g.enemyTimeScale = 0.3;
    } else {
      this.anim.play(this.clips.ultReady, { fade: 0.08, hold: true });
      g.enemyTimeScale = 0.15;
      this.model.sword.bladeMat.uniforms.uEmissive.value.setRGB(1.2, 0.35, 0.05);
      // close-up camera on the ready pose
      const yaw = this.yaw;
      g.cameraRig.play(
        [
          { t: 0, pos: [1.4, 1.2, 2.2], look: [0, 1.2, 0], fov: 40 },
          { t: 0.8, pos: [0.9, 1.35, 2.6], look: [0, 1.3, 0], fov: 36, e: 'inOut' },
        ],
        { anchor: this.pos.clone(), relYaw: yaw },
      );
    }
  }

  _ultUpdate(dt, realDt) {
    const u = this.ult;
    const g = this.game;
    u.t += dt;
    this._idle(dt);
    if (this.charId === 'giyu') return this._calmUpdate(dt, realDt);
    if (u.phase === 'ready') {
      if (Math.random() < dt * 40) {
        this.model.sword.tip.getWorldPosition(_v);
        g.fx.particles.embers(_v, 2, 0xff9a3a, 1.5, 0.5);
      }
      if (u.t > 0.9) {
        g.cameraRig.stopCine();
        g.cameraRig._syncFromCamera();
        u.phase = 'dance';
        u.t = 0;
        const list = g.enemies.filter((e) => e.alive && e.targetable !== false).sort((a, b) => this.distTo(a) - this.distTo(b));
        u.targets = list.slice(0, 8);
        if (u.targets.length === 0) u.targets = [null, null, null];
        while (u.targets.length < 4 && list.length) u.targets.push(list[u.targets.length % list.length]);
        u.next = 0;
      }
      return;
    }
    if (u.phase === 'dance') {
      if (u.t >= u.next) {
        if (u.i >= u.targets.length) {
          u.phase = 'finish';
          u.t = 0;
          this._ultFinish();
          return;
        }
        const tgt = u.targets[u.i];
        const from = this.pos.clone();
        let to;
        if (tgt && tgt.alive) {
          const d = _v.set(tgt.pos.x - from.x, 0, tgt.pos.z - from.z);
          const len = Math.max(0.01, d.length());
          d.multiplyScalar(1 / len);
          to = tgt.pos.clone().addScaledVector(d, 1.6);
          to.x += (Math.random() - 0.5) * 1.2;
          to.z += (Math.random() - 0.5) * 1.2;
        } else {
          const a = this.yaw + (u.i % 2 ? 0.9 : -0.9);
          to = from.clone().add(_v.set(Math.sin(a) * 4, 0, Math.cos(a) * 4));
        }
        g.world?.constrain(to, this.radius);
        this.faceInstant(to);
        u.dash = { from, to, t: 0 };
        u.path.push(to.clone());
        this.anim.play(u.i % 2 ? this.clips.dragonDanceB : this.clips.dragonDanceA, { fade: 0.02 });
        g.audio?.play('swingFire', { pitch: 1 + u.i * 0.03 });
        g.fx.screen.speed(0.8, 0.1);
        // fire dragon segment
        const mid = from.clone().lerp(to, 0.5).add(_v2.set(0, 1.2, 0));
        const side = _v3.set(-(to.z - from.z), 0, to.x - from.x).normalize().multiplyScalar(u.i % 2 ? 1 : -1);
        const pts = [from.clone().setY(0.9), mid.clone().addScaledVector(side, 1.2), to.clone().setY(1.1)];
        g.fx.effects.dragon(pts, { style: 'fire', radius: 0.55, life: 0.9, grow: 0.25, seg: 40 });
        u.i++;
        u.next = u.t + 0.2;
        u.hitDone = false;
      }
      if (u.dash) {
        u.dash.t += dt / 0.12;
        const k = Math.min(1, u.dash.t);
        this.pos.lerpVectors(u.dash.from, u.dash.to, 1 - Math.pow(1 - k, 3));
        if (k > 0.5 && !u.hitDone) {
          u.hitDone = true;
          // hit everything near the dash segment
          for (const e of g.enemies) {
            if (!e.alive) continue;
            const d = distToSegment(e.pos, u.dash.from, u.dash.to);
            if (d < 1.8 + e.radius) {
              g.combat.applyHit(this, e, { dmg: 48, poise: 60, knock: 3, hitstop: 0.04, shake: 0.25, power: 0.9, style: 'fire', stun: 'heavy' });
            }
          }
          g.fx.particles.embers(this.chest(_v), 20, 0xff8a2a, 4, 1);
        }
      }
      return;
    }
    if (u.phase === 'finish' && u.t > 1.1) this._endUlt();
  }

  _ultFinish() {
    const g = this.game;
    const u = this.ult;
    this.anim.play(this.clips.enbu, { fade: 0.02, time: 0.34 });
    // grand dragon along the whole path
    const pts = u.path.map((p, i) => p.clone().setY(1 + Math.sin(i) * 0.6));
    if (pts.length >= 2) {
      if (pts.length === 2) pts.splice(1, 0, pts[0].clone().lerp(pts[1], 0.5).setY(2.2));
      g.fx.effects.dragon(pts, { style: 'fire', radius: 1.0, life: 1.6, grow: 0.35, seg: 160 });
    }
    g.fx.effects.timer(0.28, null, () => {
      g.fx.screen.impact(0.14, 0x140404, 0xffd9a0);
      g.fx.screen.radial(0.8);
      g.audio?.play('fireDragon');
      g.audio?.play('impactFrame');
      g.cameraRig.shake(0.8);
      for (const e of g.enemies) {
        if (!e.alive) continue;
        if (this.distTo(e) < 9) g.combat.applyHit(this, e, { dmg: 90, poise: 200, knock: 7, hitstop: 0.12, shake: 0.6, power: 1, style: 'fire', stun: 'down', crit: true });
      }
      this.fireBurst();
    });
  }

  _calmUpdate(dt, realDt) {
    const u = this.ult;
    const g = this.game;
    const R = 7.5;
    if (u.phase === 'ready') {
      if (u.t > 0.5) {
        u.phase = 'calm';
        u.t = 0;
        u.next = 0;
      }
      return;
    }
    if (u.phase === 'calm') {
      // destroy projectiles that enter the calm
      for (const p of g.combat.projectiles) {
        if (p.owner !== this && Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < R) {
          p.life = 0;
          g.fx.particles.flash(p.pos, 0xdff4ff, 1, 0.12);
        }
      }
      if (u.t >= u.next) {
        u.next = u.t + 0.13;
        const inRange = g.enemies.filter((e) => e.alive && this.distTo(e) < R);
        if (inRange.length) {
          const e = inRange[u.i++ % inRange.length];
          this.faceInstant(e.pos);
          this.anim.play(u.i % 2 ? this.clips.calmSlashA : this.clips.calmSlashB, { fade: 0 });
          const c = e.chest(_v).clone();
          const a0 = Math.random() * Math.PI * 2;
          g.fx.effects.arc({ center: c, f: new THREE.Vector3(Math.cos(a0), Math.sin(a0) * 0.6, Math.sin(a0)), s: new THREE.Vector3(-Math.sin(a0), 0.3, Math.cos(a0)), radius: 1.0, width: 0.3, arc: Math.PI * 0.9, style: 'calm', life: 0.25, wipe: 0.03 });
          g.combat.applyHit(this, e, { dmg: e.isBoss ? 15 : 26, poise: 30, knock: 0.5, hitstop: 0.03, shake: 0.12, power: 0.6, style: 'water', stun: 'light' });
          g.audio?.play('swingLight', { pitch: 1.3, volume: 0.6 });
        }
      }
      if (u.t > 3.2) {
        u.phase = 'release';
        u.t = 0;
        this.anim.play(this.clips.whirlpool, { fade: 0.02, time: 0.7 });
        g.fx.screen.impact(0.12, 0x04081a, 0xe8f6ff);
        g.audio?.play('impactFrame');
        g.audio?.play('waterSplash');
        g.fx.effects.ring(this.pos.clone().setY(0.1), { color: 0xdff4ff, from: 0.5, to: R * 1.3, life: 0.6, thick: 0.2 });
        g.fx.effects.arc({ center: this.pos.clone().setY(1.0), f: new THREE.Vector3(1, 0, 0), s: new THREE.Vector3(0, 0, 1), radius: 3.5, width: 1.2, arc: Math.PI * 1.98, style: 'water', life: 0.6, wipe: 0.12 });
        for (const e of g.enemies) {
          if (e.alive && this.distTo(e) < R + 1) g.combat.applyHit(this, e, { dmg: 70, poise: 200, knock: 6, hitstop: 0.12, shake: 0.6, power: 1, style: 'water', stun: 'down', crit: true });
        }
      }
      return;
    }
    if (u.phase === 'release' && u.t > 0.8) this._endUlt();
    void realDt;
  }

  _endUlt() {
    const g = this.game;
    this.ult = null;
    this.invuln = 0.4;
    g.enemyTimeScale = 1;
    g.fx.screen.desatTarget = 0;
    g.fx.screen.tintTarget.setRGB(1, 1, 1);
    this.model.sword.bladeMat.uniforms.uEmissive.value.setRGB(this.charId === 'giyu' ? 0.02 : 0, this.charId === 'giyu' ? 0.08 : 0, this.charId === 'giyu' ? 0.19 : 0);
    this.model.setFace('neutral');
    this.setState('move');
    this.anim.stop(0.15);
  }
}

function distToSegment(p, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z;
  const apx = p.x - a.x, apz = p.z - a.z;
  const t = clamp((apx * abx + apz * abz) / Math.max(1e-6, abx * abx + abz * abz));
  const x = a.x + abx * t - p.x, z = a.z + abz * t - p.z;
  return Math.hypot(x, z);
}
