import * as THREE from 'three';
import { Actor } from './actor.js';
import { SwordTrail } from '../fx/effects.js';
import { playerMoves, SKILLS, ULTS, CHAR_FX } from '../game/moves.js';
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
const HP = { tanjiro: 115, giyu: 125, rengoku: 130, obanai: 105 };
const DMG = { tanjiro: 1.08, rengoku: 1.1 };

export class Player extends Actor {
  constructor(game, charId, model) {
    super(game, model, { team: 'player', hp: HP[charId] ?? 115, radius: 0.42, height: 1.8, poise: 40 });
    this.charId = charId;
    this.palette = CHAR_FX[charId] || CHAR_FX.tanjiro;
    this.heart = false; // Rengoku's 燃燒心靈
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
    this.baseDmg = this.dmgMul = DMG[charId] ?? 1.0;
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
    this.stats = { damageTaken: 0, parries: 0, perfects: 0, executions: 0 };
    /** 真劍: health a wound leaves recoverable for a moment, won back by cutting back (rally) */
    this.rally = 0;
    this.rallyT = 0;
    this.parryWin = 0.2;
    this.blockEndT = -99;
    this.blockPressT = -99;
    // the blade's resting glow as built; techniques light it up, _restGlow puts it back
    this._glow0 = model.sword.bladeMat.uniforms.uEmissive.value.clone();
  }

  setState(s) {
    // super armor belongs to the action that granted it (_action re-reads it from the running move each frame)
    this.armor = false;
    super.setState(s);
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

  /** The 真劍 ruleset (rules.js DUEL) when that is the difficulty, else undefined. */
  get duel() {
    return this.game.rules.duel;
  }

  spend(res, amt) {
    if (this[res] < amt) return false;
    this[res] -= amt;
    if (res === 'stamina') this.staminaDelay = this.duel?.stamina.delay ?? 0.7;
    return true;
  }

  /** 真劍: every swing costs stamina (any left will do; running dry holds the recovery back). */
  _pay(kind) {
    const D = this.duel;
    if (!D) return true;
    if (this.stamina <= 0.5) {
      this.game.hud?.toast('耐力不足', 'info');
      return false;
    }
    const cost = D.stamina[kind] ?? 0;
    this.staminaDelay = this.stamina < cost ? D.stamina.delay + 0.5 : D.stamina.delay;
    this.stamina = Math.max(0, this.stamina - cost);
    return true;
  }

  /** 真劍: a boss with a broken posture within reach, open to an execution. */
  execTarget() {
    if (!this.duel || !this.alive) return null;
    for (const e of this.game.enemies) if (e.execReady && this.distTo(e) < 4.4) return e;
    return null;
  }

  /** 真劍: a cut landed wins back part of the recoverable health. */
  regain(dmg) {
    const R = this.duel?.rally;
    if (!R || this.rally <= 0 || !this.alive) return;
    const heal = Math.min(this.rally, R.flat + dmg * R.perHit);
    this.hp = Math.min(this.maxHp, this.hp + heal);
    this.rally -= heal;
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

  /** A critical blow owed: 'counter' (off a parry or a perfect dodge, Tanjiro's thread too), 'back', or false. */
  consumeCrit(victim, h) {
    // Obanai's winding blade: a real blow (heavy, combo finisher, technique) landed from behind is always critical.
    // Not the chip ticks or the ultimate's slither: each crit flashes the screen, and those land several times a second.
    // (Outside a duel it comes first, and a counter owed is kept for the next blow; in a duel the counter, which
    // bites deeper into his posture, is spent on it.)
    const back = this.charId === 'obanai' && victim && this.state !== 'ult' && (h?.power ?? 0.5) >= 0.6 && this._behind(victim);
    if (back && !this.duel) return 'back';
    if (this.counterT > 0) {
      this.counterT = 0;
      return 'counter';
    }
    if (this.critTarget && victim === this.critTarget && this.critT > 0) {
      this.critTarget = null;
      this.critT = 0;
      this.threadMesh.visible = false;
      this.game.fx.screen.impact(0.06, 0x120204, 0xffe0e0);
      return 'counter';
    }
    return back ? 'back' : false;
  }

  /** Are we behind `v` (outside the front ~220° of its facing)? */
  _behind(v) {
    const toMe = Math.atan2(this.pos.x - v.pos.x, this.pos.z - v.pos.z);
    return Math.abs(angleDiff(v.yaw, toMe)) > 1.92;
  }

  /** Back to the resting blade glow (the heart's fire outlasts every technique while it burns). */
  _restGlow() {
    const glow = this.model.sword.bladeMat.uniforms.uEmissive.value;
    if (this.heart) glow.setRGB(0.55, 0.13, 0.02);
    else glow.copy(this._glow0);
  }

  /** Rengoku: below 40% health his heart burns — harder blows, double breath, no flinching from light hits. */
  _heartUpdate(dt) {
    const on = this.alive && this.hp < this.maxHp * 0.4;
    const g = this.game;
    if (on !== this.heart) {
      this.heart = on;
      this.dmgMul = this.baseDmg * (on ? 1.3 : 1);
      if (this.state !== 'ult') this._restGlow();
      if (on) {
        g.hud?.toast('燃燒心靈', 'counter');
        g.audio?.play('fireBurst', { volume: 0.55 });
        g.fx.screen.flash(0xff8a3a, 0.3, 6);
        g.fx.particles.embers(this.chest(_v).clone(), 40, 0xff8a2a, 4, 1.2);
      }
    }
    if (on && Math.random() < dt * 16) {
      _v.set(this.pos.x + (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 1.4, this.pos.z + (Math.random() - 0.5) * 0.6);
      g.fx.particles.embers(_v, 1, 0xff8a2a, 1.2, 0.4);
    }
  }

  // ---------------------------------------------------------------- update
  update(dt, realDt) {
    dt = this.tick(dt, realDt);
    const g = this.game;
    const input = g.input;
    // cooldowns & resources
    for (let i = 0; i < 3; i++) this.skillCd[i] = Math.max(0, this.skillCd[i] - dt);
    this.staminaDelay -= dt;
    const D = this.duel;
    if (D) {
      // 真劍: slower breath (won back by parrying and dodging well), some stamina back even behind a guard
      if (this.staminaDelay <= 0) this.stamina = Math.min(this.maxStamina, this.stamina + D.stamina.regen * (this.state === 'block' ? D.stamina.guard : 1) * dt);
      this.breath = Math.min(this.maxBreath, this.breath + D.breath.regen * (this.heart ? 2 : 1) * dt);
      if (this.rally > 0) {
        if (this.rallyT > 0) this.rallyT -= dt;
        else this.rally = Math.max(0, this.rally - D.rally.decay * dt);
        this.rally = Math.min(this.rally, this.maxHp - Math.max(0, this.hp));
      }
    } else {
      if (this.staminaDelay <= 0 && this.state !== 'block') this.stamina = Math.min(this.maxStamina, this.stamina + 34 * dt);
      this.breath = Math.min(this.maxBreath, this.breath + (this.heart ? 10 : 5) * dt);
      this.rally = 0;
    }
    this.comboTimer -= dt;
    if (this.charId === 'rengoku') this._heartUpdate(dt);
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
    if (pressed('block')) this.blockPressT = this.game.time;
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
      this._enterBlock();
      return;
    }
    this._consumeBuffer(input);
  }

  /**
   * Raise the guard. Its first moments parry. 真劍: only a fresh press parries (not a guard held through
   * the end of an attack), and a press right after letting go parries for less (no mashing it).
   */
  _enterBlock() {
    const D = this.duel;
    this.setState('block');
    this.blockT = 0;
    this._parryKept = false;
    if (!D) {
      this.parryWin = 0.2;
      return;
    }
    const g = this.game;
    const fresh = g.time - this.blockPressT < 0.15;
    this.parryWin = !fresh ? 0 : g.time - this.blockEndT < D.parry.gap ? D.parry.spam : D.parry.window;
  }

  _consumeBuffer(input) {
    const b = this.buffer;
    if (!b) return false;
    const sprinting = this.anim.sprint > 0.5 && this.speed > 6;
    const ex = (b === 'light' || b === 'heavy') && this.execTarget();
    if (ex) {
      this.buffer = null;
      this.startExecution(ex);
      return true;
    }
    switch (b) {
      case 'light': {
        if (!this._pay('light')) break;
        if (this.comboTimer <= 0) this.comboIdx = 0;
        const name = sprinting ? 'light3' : ['light1', 'light2', 'light3', 'light4'][this.comboIdx % 4];
        this.comboIdx = (this.comboIdx + 1) % 4;
        this.startMove(name);
        break;
      }
      case 'heavy':
        if (this.duel && this.stamina <= 0.5) {
          this.game.hud?.toast('耐力不足', 'info');
          break;
        }
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
      if (base > 0) motionScale = clamp(dist / base, def.lunge?.[0] ?? 0.25, def.lunge?.[1] ?? 1.8);
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
    if (!this.spend('stamina', this.charId === 'obanai' ? 10 : 20)) {
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
    const threat = this._imminentThreat(this.duel?.perfect.horizon ?? 0.3);
    if (threat && this.perfectCooldown <= 0) this.perfectDodge(threat);
  }

  /** Returns the attacker whose hit would land on us within `horizon` seconds, if any. */
  _imminentThreat(horizon = 0.3) {
    const g = this.game;
    const combat = g.combat;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const r = e.action;
      const d = r?.def;
      for (const h of (r && d.hits) || []) {
        // (a held wind-up counts: the blow is that much further off)
        const dt = r.timeTo ? r.timeTo(h.t) : h.t - r.t;
        if (dt < -0.02 || dt > horizon) continue;
        if (combat.inShape(e, this, { ...h, range: (h.range ?? 2.2) + 0.9, arc: (h.arc ?? 120) + 30 })) return e;
      }
      for (const h of (r && d.multi) || []) {
        if ((r.timeTo ? r.timeTo(h.t0) : h.t0 - r.t) > horizon || r.t > h.t1) continue;
        if (combat.inShape(e, this, { ...h, range: (h.range ?? 2.2) + 0.9 })) return e;
      }
      // (what he has thrown -- moons still in flight, rings still spreading -- outlives the move that threw it)
      if (e.threatens?.(this, horizon)) return e;
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
    if (!this._pay('skill')) return;
    this.breath -= sk.cost;
    this.skillCd[i] = sk.cd;
    this.startMove(sk.move, { noLunge: false });
  }

  _charge(dt, input) {
    this.chargeT += dt;
    this.velXZ.multiplyScalar(Math.exp(-dt * 12));
    const tgt = this.aimTarget();
    if (tgt) this.turnTowards(tgt.pos, 8, dt);
    const kind = this.palette.charge;
    if (this.chargeT > 0.22 && !this._charging) {
      this._charging = true;
      this.anim.play(this.clips.thrustCharge, { fade: 0.1, hold: true });
      if (kind === 'fire') this.game.audio?.play('fireWhoosh', { volume: 0.4, pitch: 1.2 });
      else if (kind === 'serpent') this.game.audio?.play('serpentHiss', { volume: 0.45 });
      else this.game.audio?.play('waterWave', { volume: 0.35, pitch: 1.3 });
    }
    if (this._charging && Math.random() < dt * 30) {
      this.model.sword.tip.getWorldPosition(_v);
      const P = this.game.fx.particles;
      if (kind === 'fire') P.embers(_v, 2, 0xff8a2a, 1.4, 0.4);
      else if (kind === 'serpent') P.sparks(_v, _v2.set(0, 1, 0), 1, 0xd9c6ff, 1.6, 1.2);
      else P.droplets(_v, _v2.set(0, 1, 0), 1, 0x7ad0ff, 1.5, 0.05);
    }
    if (this.chargeT > 0.6 && !this._chargedFx) {
      this._chargedFx = true;
      this.model.sword.tip.getWorldPosition(_v);
      this.game.fx.particles.flash(_v, kind === 'fire' ? 0xffc080 : kind === 'serpent' ? 0xe6d8ff : 0xbfe8ff, 1.0, 0.18);
      this.game.audio?.play('gaugeFull', { volume: 0.4, pitch: 1.5 });
    }
    const released = !input.down('heavy') || !this.control;
    if (released || this.chargeT > 1.6) {
      const charged = this.chargeT >= 0.6;
      this._charging = false;
      this._chargedFx = false;
      if (!this._pay(charged ? 'charged' : 'heavy')) {
        this.anim.stop(0.1);
        this.setState('move');
        return;
      }
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
    // 真劍: a breath technique is no shield (only one that is itself a slip keeps a sliver of invulnerability)
    const iw = this.duel && d.cost ? d.duelIframes : d.iframes;
    this.invuln = r.inWindow(iw) ? Math.max(this.invuln, 0.02) : this.invuln;
    this.armor = r.inWindow(d.armor);
    r.update(dt);
    // 真劍: parry after parry -- a fresh press turns the next blow of the string aside too; a guard simply held on
    // through the parry blocks the next blow if it comes before the parry is over (only a fresh press parries it)
    if (this.duel && this.curMove === 'parry' && r.t > 0.1 && this.control && (input.pressed('block') || (input.down('block') && this._imminentThreat(Math.max(0.1, r.dur - r.t) + 0.1)))) {
      this.action = null;
      this._enterBlock();
      return;
    }
    // cancels
    const b = this.buffer;
    if (b) {
      const isDodge = this.curMove === 'dodge';
      if (b === 'dodge' && !isDodge && (r.t > 0.12 || r.canCancel) && !d.cost && !d.commit) {
        this.startDodge(input);
        this.buffer = null;
        return;
      }
      // 真劍: one breath technique cannot run straight into the next; it plays out first
      if (this.duel && d.cost && b.startsWith('skill') && !r.done) {
        // (keep it buffered)
      } else if (r.canCancel) {
        if (isDodge && b === 'light' && !this.execTarget()) {
          this.buffer = null;
          if (!this._pay('light')) return;
          this.comboIdx = 2;
          this.startMove('light3');
          return;
        }
        const st = this.stateT, arm = this.armor;
        this.setState('move');
        this._consumeBuffer(input);
        if (this.state !== 'move') return;
        // (nothing came of it -- short of stamina, a technique not ready: the move plays on)
        this.state = 'action';
        this.stateT = st;
        this.armor = arm;
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
      // (letting go of a guard that a parry kept up is no mashing: the next press gets the full window)
      this.blockEndT = this._parryKept ? -99 : this.game.time;
      this._parryKept = false;
      this.setState('move');
      return;
    }
    if (this.buffer === 'dodge') {
      this.buffer = null;
      this.startDodge(input);
    } else if (this.buffer === 'light' || this.buffer === 'heavy') {
      const st = this.stateT;
      this.setState('move');
      this._consumeBuffer(input);
      // (nothing came of it -- short of stamina: the guard stays up, and its parry window with it)
      if (this.state === 'move') {
        this.state = 'block';
        this.stateT = st;
      }
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
      const inDodge = this.curMove === 'dodge' && this.state === 'action' && g.time - this.dodgeStart < (this.duel?.perfect.grace ?? 0.24);
      if (inDodge && this.perfectCooldown <= 0) this.perfectDodge(att);
      return 'dodge';
    }
    const src = h.from || att.pos;
    if (this.blocking && !h.unblockable) {
      const front = Math.abs(angleDiff(this.yaw, Math.atan2(src.x - this.pos.x, src.z - this.pos.z))) < 1.7;
      if (!front) return null;
      // (真劍: a flurry's ticks come too fast to turn aside one by one: they are blocked)
      if (this.blockT < this.parryWin && !h.unparryable && !(this.duel && h.every)) {
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
      const d = _v.set(this.pos.x - src.x, 0, this.pos.z - src.z).normalize();
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
    const D = this.duel;
    this.perfectCooldown = 1.2;
    this.stats.perfects++;
    // (a duel's rhythm is not stopped for long: a short slow, a sure counter)
    if (D) g.slowmo(0.3, 0.45);
    else g.slowmo(0.22, 0.85);
    g.hud?.toast('完美閃避', 'perfect');
    g.audio?.play('perfectDodge');
    g.fx.screen.flash(0xcfe8ff, 0.3, 6);
    g.fx.screen.chroma(0.8);
    if (D) {
      this.gain(D.conc.perfect, D.breath.perfect);
      att?.onPerfectDodgedBy?.(this);
      // (his blow cut only air: it costs him balance)
      if (att?.isBoss && att.state !== 'stagger') {
        att.poise -= D.posture.dodge;
        att.lastHitT = g.time;
        if (att.poise <= 0) att._breakPosture?.();
      }
    } else this.gain(10, 12);
    g.fx.effects.afterimage(this.model, { color: 0x6ec8ff, life: 0.45, alpha: 0.45 });
    if (this.charId === 'tanjiro' && att && att.alive) {
      this.critTarget = att;
      this.critT = 3.5;
      this.threadMesh.visible = true;
      g.hud?.toast('隙之線', 'counter');
    } else {
      this.counterT = D ? D.perfect.counter : 1.5;
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
    const D = this.duel;
    // 真劍: with his next blow right behind this one the guard stays up (to block it, or parry it on a fresh press)
    const r = D ? att.action : null;
    const next = r ? r.nextStrike() : null;
    const soon = next != null && r.timeTo(next) < 0.25;
    // (a parry that landed is no mashing: the next press gets the full window)
    this.blockEndT = -99;
    if (soon) {
      this.anim.play(this.clips.blockHit, { fade: 0.02, mask: 'upper' });
      this.blockT = this.parryWin;
      this._parryKept = true;
    } else {
      this.anim.play(this.clips.parry, { fade: 0.02 });
      this.setState('action');
      this.run(this.moves.parry);
      this.curMove = 'parry';
    }
    this.counterT = D ? 1.0 : 1.6;
    this.stats.parries++;
    if (D) this.gain(D.conc.parry, this.charId === 'giyu' ? D.breath.parryGiyu : D.breath.parry);
    else this.gain(12, this.charId === 'giyu' ? 40 : 15);
    g.hud?.toast('完美格擋', 'counter');
    att.onParried?.(this, h);
    // Giyu counters instantly (in a duel, only once the parry has ended the string: mid-string the next blow is
    // already coming; and a broken posture is left to an execution)
    if (this.charId === 'giyu' && att.alive && (!D || att.state === 'hit')) {
      g.fx.effects.timer(0.12, null, () => {
        // (not if he has since done anything else: dodged, guarded, begun an execution)
        if (!att.alive || this.state !== 'action' || this.curMove !== 'parry') return;
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
    const R = this.duel?.rally;
    if (R) {
      this.rally = Math.min(this.maxHp - Math.max(0, this.hp), this.rally + info.dmg * R.share);
      this.rallyT = R.hold;
    }
    g.audio?.play('playerHurt', { pos: this.pos });
    if (this.state === 'ult') return;
    if ((this.armor && h.stun !== 'down') || (this.heart && (h.stun || 'light') === 'light')) {
      this.anim.hitJolt = 0.6;
      return;
    }
    this.action = null;
    this.setTrail(null);
    this._charging = false;
    this.model.setFace('hurt');
    const stun = h.stun || 'light';
    const src = h.from || att.pos;
    this.anim.hitDir = Math.sign(angleDiff(this.yaw, Math.atan2(src.x - this.pos.x, src.z - this.pos.z)) || 1);
    if (stun === 'down') {
      this.setState('down');
      this._gettingUp = false;
      this.anim.play(this.clips.knockdown, { fade: 0.03, hold: true });
      this.knock.set(this.pos.x - src.x, 0, this.pos.z - src.z).normalize().multiplyScalar((h.knock ?? 5) + 2);
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
    this.rally = 0;
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

  /** 真劍: a broken posture, and the killing blow it opens: in close, one cut through him. */
  startExecution(e) {
    const g = this.game;
    this.faceInstant(e.pos);
    const d = this.distTo(e);
    this.setState('action');
    this.run(this.moves.execute, { target: e, motionScale: clamp((d - e.radius - 1.1) / 1.6, 0.05, 2.4) });
    this.curMove = 'execute';
    this.invuln = 1.0;
    this.velXZ.set(0, 0, 0);
    this.model.setFace('fierce');
    e.onExecuteStart(this);
    g.slowmo(0.3, 0.55);
    g.cameraRig.kick(8);
    g.fx.screen.speed(1, 0.3);
    g.audio?.play('execute', { pos: this.pos });
    this.afterimage(0.5, 0.4);
  }

  /** The execution's cut: a fixed share of his health, and the full weight of the moment. */
  _executeHit(e) {
    const g = this.game;
    if (!e || !e.alive) return;
    // (his posture already back: the chance is gone, the cut is no execution)
    if (e.state !== 'stagger') return e.onExecuted?.(false);
    const dmg = e.execDamage();
    const res = g.combat.applyHit(this, e, {
      dmg, fixed: true, poise: 0, knock: 2, hitstop: 0.22, shake: 0.85, power: 1, stun: 'heavy', crit: true,
      style: this.palette.style, impact: 0.16, impactA: 0x050305, impactB: 0xfff4e8, radial: 0.9, fov: 10,
    });
    const landed = res === 'hit';
    e.onExecuted?.(landed);
    if (!landed) return;
    this.stats.executions++;
    g.hud?.toast('處決', 'counter');
    g.fx.effects.arc({
      center: e.chest(new THREE.Vector3()),
      f: this.right(new THREE.Vector3()).negate().setY(0.4).normalize(),
      s: this.forward(new THREE.Vector3()),
      radius: 1.6, width: 0.9, arc: Math.PI * 1.1, style: this.palette.style, life: 0.6, wipe: 0.06,
    });
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

  fireCharge(hold = 1.2) {
    this.model.sword.tip.getWorldPosition(_v);
    this.game.fx.particles.embers(_v, 20, 0xff8a2a, 2, 0.6);
    this.game.fx.light(_v, 0xff7a2a, 3, 5, 0.5);
    const glow = this.model.sword.bladeMat.uniforms.uEmissive.value;
    glow.setRGB(0.9, 0.25, 0.05);
    const token = (this._glowToken = (this._glowToken || 0) + 1);
    this.game.fx.effects.timer(hold, null, () => {
      if (token === this._glowToken && this.state !== 'ult') this._restGlow();
    });
  }

  afterimage(alpha = 0.45, life = 0.35) {
    this.game.fx.effects.afterimage(this.model, { color: this.palette.after, life, alpha });
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

  // ---------------------------------------------------------------- 炎之呼吸 fx
  /** Small eruption of fire where the blade lands. */
  flameGround(size = 1.3) {
    const g = this.game;
    const p = _v.copy(this.pos).addScaledVector(this.forward(_v2), 1.4);
    p.y = 0.1;
    g.fx.effects.ring(p.clone(), { color: 0xff8a2a, from: 0.3, to: size * 1.8, life: 0.4, thick: 0.3 });
    for (let i = 0; i < 3; i++) {
      _v3.set(p.x + (Math.random() - 0.5) * size, 0.5 + Math.random() * 0.5, p.z + (Math.random() - 0.5) * size);
      g.fx.effects.sprite(_v3.clone(), { tex: 'flame', size: 0.8 + Math.random() * 0.6, life: 0.45, grow: 0.5, rise: 1.6, additive: true, add: 0.6 });
    }
    g.fx.particles.embers(p.clone().setY(0.5), 26, 0xff8a2a, 4, 1);
    g.fx.light(p.clone().setY(0.9), 0xff6a1a, 4, 7, 0.35);
  }

  /** 不知火: the path of the dash goes up in flames behind him. */
  flameStreak(from) {
    if (!from) return;
    const g = this.game;
    const to = this.pos.clone();
    const len = Math.hypot(to.x - from.x, to.z - from.z);
    const n = Math.max(2, Math.round(len / 0.7));
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const p = new THREE.Vector3(from.x + (to.x - from.x) * k, 0.35 + Math.random() * 0.3, from.z + (to.z - from.z) * k);
      g.fx.effects.timer(k * 0.08, null, () => g.fx.effects.sprite(p, { tex: 'flame', size: 0.7 + Math.random() * 0.5, life: 0.5, grow: 0.6, rise: 1.8, additive: true, add: 0.6 }));
    }
    if (len > 1) {
      const mid = from.clone().lerp(to, 0.5).setY(1.0);
      g.fx.effects.dragon([from.clone().setY(0.7), mid, to.clone().setY(1.05)], { style: 'fire', radius: 0.55, life: 0.6, grow: 0.12, seg: 40 });
    }
    g.fx.particles.embers(this.chest(_v).clone(), 30, 0xff8a2a, 5, 1.1);
    g.fx.light(this.chest(_v).clone(), 0xff7a2a, 4, 8, 0.3);
    g.fx.screen.speed(0.9, 0.14);
  }

  /** 昇炎天: a column of fire climbs out of the rising cut. */
  risingFlameFx() {
    const g = this.game;
    const f = this.forward(new THREE.Vector3());
    const base = this.pos.clone().addScaledVector(f, 1.5);
    const pts = [];
    for (let i = 0; i <= 5; i++) {
      const k = i / 5;
      pts.push(base.clone().addScaledVector(f, Math.sin(k * Math.PI) * 0.5).setY(0.2 + k * 3.8));
    }
    g.fx.effects.dragon(pts, { style: 'fire', radius: 0.75, life: 0.8, grow: 0.22, seg: 48 });
    for (let i = 0; i < 5; i++) {
      _v3.set(base.x + (Math.random() - 0.5) * 1.2, 0.4 + i * 0.55, base.z + (Math.random() - 0.5) * 1.2);
      g.fx.effects.sprite(_v3.clone(), { tex: 'flame', size: 1 + Math.random() * 0.6, life: 0.55, grow: 0.5, rise: 3, additive: true, add: 0.6 });
    }
    g.fx.particles.embers(base.clone().setY(0.8), 40, 0xff9a3a, 6, 1.4);
    g.fx.light(base.clone().setY(1.4), 0xff6a1a, 6, 10, 0.45);
  }

  /** 盛炎漩渦: wheels of fire spinning in front of him. */
  flameVortexFx() {
    const g = this.game;
    for (let i = 0; i < 4; i++) {
      g.fx.effects.timer(i * 0.14, null, () => {
        if (this.state !== 'action' || this.curMove !== 'flameVortex') return;
        const f = this.forward(new THREE.Vector3());
        const r = this.right(new THREE.Vector3());
        const c = this.chest(new THREE.Vector3()).addScaledVector(f, 1.0);
        const a0 = i * 1.3;
        const start = new THREE.Vector3(0, Math.cos(a0), 0).addScaledVector(r, Math.sin(a0));
        const sweep = new THREE.Vector3(0, -Math.sin(a0), 0).addScaledVector(r, Math.cos(a0));
        g.fx.effects.arc({ center: c, f: start, s: sweep, radius: 1.25 + i * 0.12, width: 0.85, arc: Math.PI * 1.9, style: 'fire', life: 0.42, wipe: 0.2 });
        g.fx.effects.sprite(c.clone().addScaledVector(r, (Math.random() - 0.5) * 1.6).setY(0.6 + Math.random() * 1.2), { tex: 'flame', size: 1.1, life: 0.45, grow: 0.5, rise: 1.4, additive: true, add: 0.6 });
        g.fx.particles.embers(c, 14, 0xff8a2a, 4, 0.9);
      });
    }
    g.fx.light(this.chest(_v).clone(), 0xff7a2a, 5, 9, 0.9);
  }

  /** Burns up anything thrown at him from the front half (projectiles only). */
  burnProjectiles(R) {
    const g = this.game;
    const f = this.forward(_v2);
    for (const p of g.combat.projectiles) {
      if (p.owner === this || p.age >= p.life) continue;
      const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
      if (Math.hypot(dx, dz) < R && dx * f.x + dz * f.z > -0.5) {
        p.life = 0;
        g.fx.particles.embers(p.pos, 16, 0xff8a2a, 4, 0.8);
        g.fx.particles.flash(p.pos, 0xffc080, 1.2, 0.12);
      }
    }
  }

  /** 炎虎: the cut lands and a tiger of flame bounds away down the hall, mauling everything in its way. */
  flameTigerFx() {
    const g = this.game;
    const f = this.forward(new THREE.Vector3());
    const start = this.pos.clone().addScaledVector(f, 1.3);
    g.fx.ground(start.clone(), { size: 2.6, color: 0xff8a2a, crack: true });
    g.fx.screen.impact(0.1, 0x140404, 0xffd9a0);
    g.fx.screen.radial(0.6);
    g.fx.screen.flash(0xffb060, 0.3, 6);
    g.cameraRig.shake(0.65);
    g.cameraRig.kick(8);
    g.freeze?.(0.06);
    const speed = 17, life = 0.5;
    // its body: a thick blaze leaping along the path, plus the head
    const end = start.clone().addScaledVector(f, speed * life);
    g.world?.constrain(end, 0.5);
    // (kept slim and low: from the follow camera a thick blaze would bloom over the head and hide it)
    const body = start.clone().addScaledVector(f, 1.2);
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const k = i / 6;
      pts.push(body.clone().lerp(end, k).setY(0.7 + Math.sin(k * Math.PI) * 0.55));
    }
    g.fx.effects.dragon(pts, { style: 'fire', radius: 0.8, life: 0.9, grow: life, seg: 80 });
    const head = g.fx.effects.sprite(start.clone().setY(1.5), { tex: 'flameTiger', size: 3.4, life: life + 0.2, grow: 0.2, additive: true, add: 0.25 });
    g.combat.spawn({
      pos: start.clone().setY(1.1),
      vel: f.clone().multiplyScalar(speed),
      radius: 1.6,
      life,
      owner: this,
      pierce: true,
      hit: { dmg: 88, poise: 110, knock: 8, hitstop: 0.1, shake: 0.55, power: 1, stun: 'down', style: 'fire', radial: 0.35, fov: 6, unparryable: true },
      // emission is rated per second (none while frozen), and one light is re-lit rather than stacking one per frame
      fx: (pr, dt) => {
        const k = Math.min(1, pr.age / life);
        if (head) head.obj.position.set(pr.pos.x, 1.5 + Math.sin(k * Math.PI) * 0.7, pr.pos.z);
        if (Math.random() < dt * 21) g.fx.effects.sprite(pr.pos.clone().add(_v3.set((Math.random() - 0.5) * 1.6, Math.random() * 0.6 - 0.4, (Math.random() - 0.5) * 1.6)), { tex: 'flame', size: 0.9 + Math.random() * 0.6, life: 0.45, grow: 0.5, rise: 2, additive: true, add: 0.5 });
        const n = Math.floor(dt * 180 + Math.random());
        if (n) g.fx.particles.embers(pr.pos, n, 0xff8a2a, 4, 1.2);
        pr.lightT = (pr.lightT ?? 0) - dt;
        if (pr.lightT <= 0) {
          pr.lightT = 0.07;
          g.fx.light(pr.pos, 0xff6a1a, 3, 8, 0.14);
        }
      },
    });
  }

  // ---------------------------------------------------------------- 蛇之呼吸 fx
  /** Two fangs of light where the blade bites. */
  fangMark(size = 1.2) {
    const g = this.game;
    const f = this.forward(new THREE.Vector3());
    const r = this.right(new THREE.Vector3());
    const c = this.chest(new THREE.Vector3()).addScaledVector(f, 1.1);
    for (const s of [-1, 1]) {
      g.fx.effects.arc({
        center: c.clone().addScaledVector(r, s * 0.22 * size),
        f: new THREE.Vector3(0, 1, 0),
        s: r.clone().multiplyScalar(s),
        radius: 0.55 * size, width: 0.3, arc: Math.PI * 0.95, style: 'serpent', life: 0.36, wipe: 0.06,
      });
    }
    g.fx.particles.sparks(c, f, 14, 0xf0e6ff, 8, 0.9);
    g.fx.light(c, 0xc6a4ff, 2.5, 6, 0.25);
  }

  /** 頸蛇雙生: two serpents twisting round each other along the lunge. */
  twinFangFx() {
    const g = this.game;
    const f = this.forward(new THREE.Vector3());
    const r = this.right(new THREE.Vector3());
    const base = this.chest(new THREE.Vector3());
    for (const s of [0, Math.PI]) {
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        const a = t * Math.PI * 2.2 + s;
        const rr = 0.45 * Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5);
        pts.push(base.clone().addScaledVector(f, -0.6 + t * 5.4).addScaledVector(r, Math.cos(a) * rr).add(_v3.set(0, Math.sin(a) * rr, 0)));
      }
      g.fx.effects.dragon(pts, { style: 'serpent', radius: 0.3, life: 0.6, grow: 0.12, seg: 60 });
    }
    this.afterimage(0.4, 0.3);
    g.fx.screen.speed(0.9, 0.12);
  }

  /** 委蛇斬: a serpent traces the weaving path the dash is about to take. */
  windingFx(runner) {
    const g = this.game;
    const k = runner?.motionScale ?? 1;
    const p = this.pos.clone();
    const pts = [p.clone().setY(0.8)];
    for (const m of this.moves.windingSlash.motion) {
      const y = this.yaw + (m[4] ?? 0);
      p.x += Math.sin(y) * m[2] * k;
      p.z += Math.cos(y) * m[2] * k;
      pts.push(p.clone().setY(0.8 + pts.length * 0.08));
    }
    g.fx.effects.dragon(pts, { style: 'serpent', radius: 0.42, life: 0.9, grow: 0.42, seg: 70 });
    this.afterimage(0.35, 0.3);
  }

  /** 狹頭之毒牙: slip round to the target's back (or dart forward when there is none). */
  venomBlink() {
    const g = this.game;
    const tgt = this.aimTarget() || this.bestTarget(9, 120);
    const from = this.pos.clone();
    this.afterimage(0.5, 0.4);
    let to;
    if (tgt && this.distTo(tgt) < 9) {
      to = tgt.pos.clone().add(_v2.set(-Math.sin(tgt.yaw), 0, -Math.cos(tgt.yaw)).multiplyScalar(tgt.radius + 1.05));
      if (this.action) this.action.target = tgt;
    } else {
      to = from.clone().addScaledVector(this.forward(_v2), 3.2);
    }
    g.world?.constrain(to, this.radius);
    // the path curls round the target's flank like a snake
    const side = this.right(_v3).clone().multiplyScalar(Math.random() < 0.5 ? 1 : -1);
    const mid = from.clone().lerp(to, 0.5).addScaledVector(side, 1.4).setY(0.9);
    g.fx.effects.dragon([from.clone().setY(0.7), mid, to.clone().setY(0.8)], { style: 'serpent', radius: 0.36, life: 0.5, grow: 0.1, seg: 40 });
    g.fx.particles.smoke(from.clone().setY(0.1), 4, 0x2a2233, 0.4, 1, 0.5);
    this.pos.copy(to);
    if (tgt) this.faceInstant(tgt.pos);
    g.fx.screen.speed(0.6, 0.12);
  }

  /** 塒締: two coils wind inward and upward round him. */
  coilFx() {
    const g = this.game;
    const c = this.pos.clone();
    for (let j = 0; j < 2; j++) {
      const pts = [];
      const a0 = this.yaw + j * Math.PI;
      for (let k = 0; k <= 20; k++) {
        const t = k / 20;
        const a = a0 + t * Math.PI * 3.2;
        const rr = 3.0 - t * 1.7;
        pts.push(new THREE.Vector3(c.x + Math.cos(a) * rr, 0.3 + t * 1.5, c.z + Math.sin(a) * rr));
      }
      g.fx.effects.timer(j * 0.12, null, () => g.fx.effects.dragon(pts, { style: 'serpent', radius: 0.5, life: 0.95, grow: 0.62, seg: 90 }));
    }
    g.fx.effects.ring(c.clone().setY(0.08), { color: 0xc6a4ff, from: 3.8, to: 0.9, life: 0.75, thick: 0.3 });
  }

  /** 塒締's closing squeeze bursts outward (a move event, so it keeps time with the final hit). */
  coilBurst() {
    const g = this.game;
    const p = this.pos.clone();
    g.fx.effects.ring(p.clone().setY(0.1), { color: 0xe6d8ff, from: 0.4, to: 4.2, life: 0.45, thick: 0.25 });
    g.fx.particles.sparks(p.clone().setY(1), _v2.set(0, 1, 0), 30, 0xf0e6ff, 9, 1.4);
    g.fx.light(p.clone().setY(1.2), 0xc6a4ff, 4, 8, 0.3);
  }

  dodgeFx(ang) {
    this.game.fx.effects.afterimage(this.model, { color: this.palette.dodge, life: 0.25, alpha: 0.3 });
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
    g.fx.screen.flash(this.palette.flash, 0.5, 5);
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
    } else if (this.charId === 'rengoku') {
      this._purgatoryStart();
    } else if (this.charId === 'obanai') {
      this._serpentStart();
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
    if (this.charId === 'rengoku') return this._purgatoryUpdate(dt);
    if (this.charId === 'obanai') return this._serpentUpdate(dt);
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
    if (u.phase === 'finish') {
      // on the ultimate's own clock: effect timers keep ticking under the pause menu
      if (!u.blasted && u.t >= 0.28) {
        u.blasted = true;
        this._ultBlast();
      }
      if (u.t > 1.1) this._endUlt();
    }
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
  }

  _ultBlast() {
    const g = this.game;
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

  // 玖之型・煉獄: a low stance while the fire gathers, then one charge that burns a tunnel through the hall.
  _purgatoryStart() {
    const g = this.game;
    this.anim.play(this.clips.rengokuReady, { fade: 0.08, hold: true });
    g.enemyTimeScale = 0.12;
    this.model.sword.bladeMat.uniforms.uEmissive.value.setRGB(1.3, 0.4, 0.06);
    g.fx.screen.tintTarget.setRGB(1.08, 0.96, 0.88);
    g.audio?.play('fireWhoosh', { volume: 0.7, pitch: 0.8 });
    g.cameraRig.play(
      [
        { t: 0, pos: [-1.5, 0.7, 1.9], look: [0, 0.9, 0], fov: 42 },
        { t: 1.0, pos: [-1.0, 0.8, 2.4], look: [0, 1.0, 0], fov: 36, e: 'inOut' },
      ],
      { anchor: this.pos.clone(), relYaw: this.yaw },
    );
  }

  _purgatoryUpdate(dt) {
    const u = this.ult;
    const g = this.game;
    if (u.phase === 'ready') {
      if (Math.random() < dt * 60) {
        // embers drawn in toward the body
        const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 1.2;
        _v.set(this.pos.x + Math.cos(a) * r, 0.2 + Math.random() * 1.6, this.pos.z + Math.sin(a) * r);
        g.fx.particles.embers(_v, 1, 0xff9a3a, 1.5, 0.5);
      }
      if (!u.ring && u.t > 0.35) {
        u.ring = true;
        g.fx.effects.ring(this.pos.clone().setY(0.06), { color: 0xff7a2a, from: 2.6, to: 0.6, life: 0.6, thick: 0.35 });
        g.fx.effects.sprite(this.chest(_v).clone(), { tex: 'flame', size: 2.4, life: 0.7, grow: 0.3, rise: 0.6, additive: true, add: 0.6 });
        g.fx.light(this.chest(_v).clone(), 0xff6a1a, 6, 8, 0.7);
      }
      if (u.t > 1.0) {
        g.cameraRig.stopCine();
        g.cameraRig._syncFromCamera();
        const tgt = this.lockTarget && this.lockTarget.alive ? this.lockTarget : this.bestTarget(20, 75);
        if (tgt) this.faceInstant(tgt.pos);
        const from = this.pos.clone();
        const to = from.clone().addScaledVector(this.forward(_v), 14);
        g.world?.constrain(to, this.radius);
        u.dash = { from, to, t: 0 };
        u.phase = 'dash';
        u.t = 0;
        this.anim.play(this.clips.rengokuDash, { fade: 0.02, hold: true });
        this.setTrail('fire');
        g.audio?.play('fireDragon');
        g.audio?.play('swingFire', { pitch: 0.8 });
        g.audio?.play('impactFrame');
        g.fx.screen.flash(0xffd0a0, 0.45, 8);
        g.fx.screen.speed(1, 0.4);
        g.fx.screen.radial(0.8);
        g.cameraRig.shake(0.7);
        g.cameraRig.kick(10);
        const mid = from.clone().lerp(to, 0.5);
        g.fx.effects.dragon([from.clone().setY(0.9), from.clone().lerp(to, 0.25).setY(1.35), mid.setY(1.2), to.clone().setY(1.1)], { style: 'fire', radius: 1.55, life: 1.6, grow: 0.3, seg: 100 });
        this.afterimage(0.6, 0.5);
      }
      return;
    }
    if (u.phase === 'dash') {
      u.dash.t += dt / 0.3;
      const k = Math.min(1, u.dash.t);
      this.pos.lerpVectors(u.dash.from, u.dash.to, 1 - Math.pow(1 - k, 3));
      if (Math.random() < dt * 48) {
        _v.set(this.pos.x + (Math.random() - 0.5) * 1.4, 0.4 + Math.random() * 1.4, this.pos.z + (Math.random() - 0.5) * 1.4);
        g.fx.effects.sprite(_v.clone(), { tex: 'flame', size: 1.4 + Math.random(), life: 0.6, grow: 0.5, rise: 1.6, additive: true, add: 0.6 });
      }
      if (k > 0.35 && !u.hitDone) {
        u.hitDone = true;
        for (const e of g.enemies) {
          if (!e.alive) continue;
          if (distToSegment(e.pos, u.dash.from, u.dash.to) < 2.6 + e.radius) {
            g.combat.applyHit(this, e, { dmg: e.isBoss ? 200 : 240, poise: 300, knock: 9, hitstop: 0.12, shake: 0.8, power: 1, style: 'fire', stun: 'down', crit: true, impact: 0.14, impactA: 0x140404, impactB: 0xffd9a0, radial: 0.8 });
          }
        }
      }
      if (k >= 1) {
        u.phase = 'finish';
        u.t = 0;
        this.anim.play(this.clips.flameTiger, { fade: 0.04, time: 0.44 });
        g.fx.ground(this.pos.clone().addScaledVector(this.forward(_v), 1.2), { size: 3.4, color: 0xff8a2a, crack: true });
        g.audio?.play('fireBurst');
        g.fx.light(this.chest(_v).clone(), 0xff6a1a, 9, 14, 0.7);
        // the scorched path keeps burning a moment
        const { from, to } = u.dash;
        for (let i = 0; i <= 10; i++) {
          const p = from.clone().lerp(to, i / 10).setY(0.5);
          g.fx.effects.timer(i * 0.04, null, () => g.fx.effects.sprite(p, { tex: 'flame', size: 1.3 + Math.random() * 0.6, life: 0.8, grow: 0.5, rise: 1.4, additive: true, add: 0.6 }));
        }
      }
      return;
    }
    if (u.phase === 'finish' && u.t > 1.0) this._endUlt();
  }

  // 伍之型・蜿蜒長蛇: he slithers from foe to foe, then the whole path rears up as one great serpent and constricts.
  _serpentStart() {
    const g = this.game;
    this.anim.play(this.clips.serpentReady, { fade: 0.08, hold: true });
    g.enemyTimeScale = 0.2;
    g.fx.screen.desatTarget = 0.35;
    g.fx.screen.tintTarget.setRGB(0.98, 0.92, 1.08);
    g.audio?.play('serpentHiss', { volume: 0.9 });
    this.model.sword.bladeMat.uniforms.uEmissive.value.setRGB(0.4, 0.2, 0.7);
    g.cameraRig.play(
      [
        { t: 0, pos: [-1.6, 0.55, 1.9], look: [0, 0.8, 0.3], fov: 44 },
        { t: 0.75, pos: [-1.15, 0.65, 2.35], look: [0, 0.9, 0.3], fov: 38, e: 'inOut' },
      ],
      { anchor: this.pos.clone(), relYaw: this.yaw },
    );
  }

  _serpentUpdate(dt) {
    const u = this.ult;
    const g = this.game;
    if (u.phase === 'ready') {
      if (u.t > 0.75) {
        g.cameraRig.stopCine();
        g.cameraRig._syncFromCamera();
        u.phase = 'slither';
        u.t = 0;
        u.next = 0;
        const list = g.enemies.filter((e) => e.alive && e.targetable !== false).sort((a, b) => this.distTo(a) - this.distTo(b));
        u.targets = list.slice(0, 6);
        if (!u.targets.length) u.targets = [null, null, null, null];
        while (u.targets.length < 5 && list.length) u.targets.push(list[u.targets.length % list.length]);
        u.main = list[0] || null;
      }
      return;
    }
    if (u.phase === 'slither') {
      if (u.t >= u.next) {
        if (u.i >= u.targets.length) {
          u.phase = 'constrict';
          u.t = 0;
          this._serpentConstrict();
          return;
        }
        const tgt = u.targets[u.i];
        const side = u.i % 2 ? 1 : -1;
        const from = this.pos.clone();
        let to;
        if (tgt && tgt.alive) {
          const d = _v.set(tgt.pos.x - from.x, 0, tgt.pos.z - from.z);
          d.multiplyScalar(1 / Math.max(0.01, d.length()));
          to = tgt.pos.clone().addScaledVector(d, 1.8).add(_v2.set(-d.z, 0, d.x).multiplyScalar(side * 0.9));
        } else {
          const a = this.yaw + side * 0.9;
          to = from.clone().add(_v.set(Math.sin(a) * 3.5, 0, Math.cos(a) * 3.5));
        }
        g.world?.constrain(to, this.radius);
        const dir = _v.set(to.x - from.x, 0, to.z - from.z);
        const mid = from.clone().lerp(to, 0.5).add(_v2.set(-dir.z, 0, dir.x).normalize().multiplyScalar(side * 1.5));
        u.dash = { from, mid, to, t: 0 };
        u.path.push(mid.clone(), to.clone());
        this.faceInstant(to);
        this.anim.play(u.i % 2 ? this.clips.dragonDanceB : this.clips.dragonDanceA, { fade: 0.02 });
        g.audio?.play('swingSerpent', { pitch: 1 + u.i * 0.04 });
        g.fx.screen.speed(0.7, 0.1);
        g.fx.effects.dragon([from.clone().setY(0.8), mid.clone().setY(1.0), to.clone().setY(0.9)], { style: 'serpent', radius: 0.5, life: 0.8, grow: 0.16, seg: 40 });
        u.i++;
        u.next = u.t + 0.2;
        u.hitDone = false;
      }
      if (u.dash) {
        u.dash.t += dt / 0.13;
        const k = Math.min(1, u.dash.t);
        const e = 1 - Math.pow(1 - k, 3);
        const { from, mid, to } = u.dash;
        // quadratic curve from -> mid -> to
        const a = (1 - e) * (1 - e), b = 2 * e * (1 - e), c = e * e;
        this.pos.set(from.x * a + mid.x * b + to.x * c, 0, from.z * a + mid.z * b + to.z * c);
        if (k > 0.5 && !u.hitDone) {
          u.hitDone = true;
          for (const en of g.enemies) {
            if (!en.alive) continue;
            const d = Math.min(distToSegment(en.pos, from, mid), distToSegment(en.pos, mid, to));
            if (d < 1.7 + en.radius) g.combat.applyHit(this, en, { dmg: en.isBoss ? 30 : 38, poise: 50, knock: 2.5, hitstop: 0.04, shake: 0.25, power: 0.8, style: 'serpent', stun: 'heavy' });
          }
          g.fx.particles.sparks(this.chest(_v), _v2.set(0, 1, 0), 12, 0xf0e6ff, 7, 1.2);
        }
      }
      return;
    }
    if (u.phase === 'constrict') {
      if (!u.squeezed && u.t >= 0.62) {
        u.squeezed = true;
        this._serpentSqueeze();
      }
      if (u.t > 1.15) this._endUlt();
    }
  }

  _serpentConstrict() {
    const g = this.game;
    const u = this.ult;
    // the whole slither path rears up as one great serpent
    const pts = u.path.map((p, i) => p.clone().setY(0.9 + Math.sin(i * 1.3) * 0.4));
    if (pts.length === 2) pts.splice(1, 0, pts[0].clone().lerp(pts[1], 0.5).setY(1.8));
    if (pts.length >= 3) g.fx.effects.dragon(pts, { style: 'serpent', radius: 1.0, life: 1.4, grow: 0.35, seg: 140 });
    // and coils round the first foe (or round him) before it squeezes
    const main = u.main && u.main.alive ? u.main : null;
    const c = (u.coilAt = (main ? main.pos : this.pos).clone());
    const coil = [];
    for (let k = 0; k <= 26; k++) {
      const t = k / 26;
      const a = t * Math.PI * 5;
      const r = 2.4 - t * 1.2;
      coil.push(new THREE.Vector3(c.x + Math.cos(a) * r, 0.2 + t * 2.6, c.z + Math.sin(a) * r));
    }
    g.fx.effects.timer(0.2, null, () => g.fx.effects.dragon(coil, { style: 'serpent', radius: 0.6, life: 1.0, grow: 0.4, seg: 120 }));
    this.anim.play(this.clips.coilChoke, { fade: 0.05, time: 0.84 });
    g.audio?.play('serpentHiss');
  }

  /** ...and squeezes: everything along the path or inside the coil. */
  _serpentSqueeze() {
    const g = this.game;
    const u = this.ult;
    const c = u.coilAt;
    g.fx.screen.impact(0.12, 0x0c0418, 0xf0e6ff);
    g.fx.screen.radial(0.7);
    g.audio?.play('impactFrame');
    g.audio?.play('swingSerpent', { pitch: 0.7 });
    g.cameraRig.shake(0.7);
    g.fx.effects.ring(c.clone().setY(0.1), { color: 0xe6d8ff, from: 0.5, to: 6, life: 0.6, thick: 0.2 });
    g.fx.particles.sparks(c.clone().setY(1.2), _v2.set(0, 1, 0), 40, 0xf0e6ff, 10, 1.4);
    for (const e of g.enemies) {
      if (!e.alive) continue;
      let near = Math.hypot(e.pos.x - c.x, e.pos.z - c.z) < 3.4 + e.radius;
      for (let i = 1; i < u.path.length && !near; i++) near = distToSegment(e.pos, u.path[i - 1], u.path[i]) < 2 + e.radius;
      if (near) g.combat.applyHit(this, e, { dmg: e.isBoss ? 70 : 80, poise: 220, knock: 6, hitstop: 0.12, shake: 0.6, power: 1, style: 'serpent', stun: 'down', crit: true });
    }
  }

  /** A cutscene takes over mid-ultimate: put the world back the way the ultimate found it. */
  interruptUlt() {
    if (!this.ult) return;
    this.game.cameraRig.stopCine();
    // Giyu's calm spreads its ripple over the floor and the screen: let both die out now
    const d = this.calmDecal;
    if (d && d.life - d.age > 1.2) d.life = d.age + 1.2;
    this.game.fx.screen.endRipple();
    this._endUlt();
  }

  _endUlt() {
    const g = this.game;
    this.ult = null;
    this.invuln = 0.4;
    g.enemyTimeScale = 1;
    g.fx.screen.desatTarget = 0;
    g.fx.screen.tintTarget.setRGB(1, 1, 1);
    this._restGlow();
    this.setTrail(null);
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
