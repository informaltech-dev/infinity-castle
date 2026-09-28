import * as THREE from 'three';
import { createAnimator } from './animsets.js';
import { setFlash, setDissolve } from '../render/materials.js';
import { LAYER_MAIN_ONLY } from '../render/pipeline.js';
import { angleDiff, clamp, ease as EASE, DEG } from '../core/math.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _flashCol = new THREE.Color();

/** How long before a held blow lands its tell (the glint) shows: about one human reaction and a little over. */
export const TELL_LEAD = 0.32;

/**
 * Runs a move definition on an actor: plays the clip, fires timed hits/fx/sfx, applies root motion.
 * def: { clip, speed, dur, cancel, motion: [[t0,t1,dist,(ease)]], turn: [t0,t1,rate], hits: [...], multi: [...],
 *        iframes: [t0,t1], armor: [t0,t1], events: [{t, fn}], sfx: [{t,name,opts}], mask, fade,
 *        tells: [t, ...], strikes: [t, ...] }
 * `t` is the move's own clock (every timing in the def is on it). A wind-up can be held: at each of def.tells
 * (a moment of full anticipation in the clip) the move waits opts.holds[i] seconds, pose held, before it goes
 * on into the blow. The actor's onTell(runner) is called TELL_LEAD before each blow that follows a hold, and
 * before the first. `strikes` names the blows of a move whose damage comes from its events, not its hits.
 */
export class ActionRunner {
  constructor(actor, def, opts = {}) {
    this.actor = actor;
    this.def = def;
    this.t = 0;
    this.speed = def.speed ?? 1;
    const clip = def.clip ? actor.clips[def.clip] : null;
    this.clip = clip;
    this.dur = def.dur ?? (clip ? clip.dur / this.speed : 0.5);
    this.fired = new Set();
    this.hitSets = new Map(); // hit index -> Set(targets)
    this.multiNext = new Map();
    this.done = false;
    this.motionScale = opts.motionScale ?? 1;
    this.target = opts.target ?? null;
    this.data = {};
    this.holds = null;
    this.tellAt = null;
    if (def.tells && opts.holds) {
      const holds = def.tells.map((at, i) => ({ at, len: Math.max(0, opts.holds[i] ?? 0), used: 0 }));
      if (holds.some((h) => h.len > 0)) this.holds = holds;
    }
    if (actor.onTell && !def.noTell) {
      // a tell before every blow (a flurry of ticks: only before its first)
      const strikes = def.strikes || [...(def.hits || []).map((h) => h.t), ...(def.multi || []).map((h) => h.t0)];
      this.tellAt = [...new Set(strikes)].sort((x, y) => x - y);
    }
    // (a held move's clip waits for the move's first update to set its pace: were it to run on its own the frame it
    // starts, it would stand one frame ahead of the move's clock -- a held wind-up frozen partway into the blow)
    if (clip) actor.anim.play(clip, { fade: def.fade ?? 0.04, speed: this.holds ? 0 : this.speed, mask: def.mask, fadeOut: def.fadeOut ?? 0.14, hold: def.hold });
    def.onStart?.(actor, this);
  }

  inWindow(w) {
    return w && this.t >= w[0] && this.t <= w[1];
  }

  /** Seconds (real, this actor's clock) until the move's clock reaches `tc`, counting the holds still ahead. */
  timeTo(tc) {
    let s = tc - this.t;
    if (s > 0 && this.holds) for (const h of this.holds) if (h.used < h.len && h.at <= tc) s += h.len - h.used;
    return s;
  }

  /** The next blow of this move still to come (its clock time), or null. (A blow already dealt is not "next".) */
  nextStrike() {
    const d = this.def;
    let best = null;
    const consider = (t) => {
      if (best == null || t < best) best = t;
    };
    if (d.strikes) {
      for (const t of d.strikes) if (t > this.t + 1e-6) consider(t);
    } else {
      (d.hits || []).forEach((h, i) => {
        if (!this.fired.has('h' + i)) consider(h.t);
      });
      for (const h of d.multi || []) if (this.t <= h.t1) consider(Math.max(h.t0, this.t));
    }
    return best;
  }

  /** Was the blow at clock time `s` held back (the last wind-up before it held at least `min`)? */
  heldBefore(s, min = 0.3) {
    let last = null;
    for (const h of this.holds || []) if (h.at <= s && (!last || h.at > last.at)) last = h;
    return !!last && last.len >= min;
  }

  /** Is a hold running right now? */
  get holding() {
    return !!this.holds?.some((h) => h.used > 0 && h.used < h.len);
  }

  /** Shorten the hold in progress (or the next one) so the blow comes within `left` seconds of its wind-up. */
  cutHold(left) {
    for (const h of this.holds || []) {
      if (h.used >= h.len) continue;
      h.len = Math.min(h.len, h.used + Math.max(0, left));
      return;
    }
  }

  /** The move clock's advance for `dt` of real time: it stands still through a hold. */
  _advance(dt) {
    let t = this.t;
    let left = dt;
    for (const h of this.holds || []) {
      if (left <= 0) break;
      if (h.used >= h.len) continue;
      if (t < h.at) {
        const n = Math.min(left, h.at - t);
        t += n;
        left -= n;
        if (left <= 0) break;
      }
      const n = Math.min(left, h.len - h.used);
      h.used += n;
      left -= n;
    }
    return t + left - this.t;
  }

  update(dt) {
    if (this.done) return;
    const a = this.actor;
    const prev = this.t;
    const adv = this.holds ? this._advance(dt) : dt;
    this.t += adv;
    // the clip keeps to the move's clock (it stands in the held pose)
    if (this.holds && dt > 0 && this.clip && a.anim.clip === this.clip) a.anim.clipSpeed = this.speed * (adv / dt);
    const d = this.def;
    if (this.tellAt) {
      for (let i = 0; i < this.tellAt.length; i++) {
        const s = this.tellAt[i];
        if (s == null || this.timeTo(s) > (d.tellLead ?? TELL_LEAD)) continue;
        this.tellAt[i] = null;
        a.onTell(this, s, i);
      }
    }
    // turning / auto-aim
    if (d.turn && this.t >= d.turn[0] && this.t <= d.turn[1]) {
      const tgt = this.target || a.aimTarget?.();
      if (tgt) a.turnTowards(tgt.pos, d.turn[2] ?? 10, dt);
    }
    // root motion
    if (d.motion) {
      for (const m of d.motion) {
        const [t0, t1, dist] = m;
        if (this.t <= t0 || prev >= t1) continue;
        const e = EASE[m[3] || 'out'] || EASE.out;
        const f0 = e(clamp((prev - t0) / (t1 - t0)));
        const f1 = e(clamp((this.t - t0) / (t1 - t0)));
        let step = (f1 - f0) * dist * this.motionScale;
        const dir = m[4] ?? 0; // local direction angle
        a.moveLocal(step, dir);
      }
    }
    // timed events
    if (d.events) {
      for (let i = 0; i < d.events.length; i++) {
        const ev = d.events[i];
        if (ev.t <= this.t && !this.fired.has('e' + i)) {
          this.fired.add('e' + i);
          ev.fn(a, this);
        }
      }
    }
    if (d.sfx) {
      for (let i = 0; i < d.sfx.length; i++) {
        const s = d.sfx[i];
        if (s.t <= this.t && !this.fired.has('s' + i)) {
          this.fired.add('s' + i);
          a.game.audio?.play(s.name, { ...(s.opts || {}), pos: a.pos });
        }
      }
    }
    if (d.hits) {
      for (let i = 0; i < d.hits.length; i++) {
        const h = d.hits[i];
        if (h.t <= this.t && !this.fired.has('h' + i)) {
          this.fired.add('h' + i);
          a.game.combat.sweep(a, h, this, 'h' + i);
        }
      }
    }
    if (d.multi) {
      for (let i = 0; i < d.multi.length; i++) {
        const h = d.multi[i];
        if (this.t < h.t0 || prev > h.t1) continue;
        let next = this.multiNext.get(i) ?? h.t0;
        while (next <= this.t && next <= h.t1) {
          const tick = Math.round((next - h.t0) / h.every);
          const hh = h.grow ? { ...h, dmg: h.dmg * (1 + tick * 0.22), power: Math.min(1, (h.power ?? 0.5) + tick * 0.05) } : h;
          a.game.combat.sweep(a, hh, this, 'm' + i + ':' + tick);
          next += h.every;
        }
        this.multiNext.set(i, next);
      }
    }
    d.onUpdate?.(a, this, dt);
    if (this.t >= this.dur) {
      this.done = true;
      d.onEnd?.(a, this);
    }
  }

  get canCancel() {
    return this.t >= (this.def.cancel ?? this.dur);
  }
}

/**
 * Base class for everything that fights: player, demons, Akaza.
 */
export class Actor {
  constructor(game, model, opts = {}) {
    this.game = game;
    this.model = model;
    this.rig = model.rig;
    this.root = model.root;
    const { anim, clips } = createAnimator(model);
    this.anim = anim;
    this.clips = clips;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.knock = new THREE.Vector3();
    this.yaw = 0;
    this.radius = opts.radius ?? 0.45;
    this.height = opts.height ?? 1.8;
    this.mass = opts.mass ?? 1;
    this.team = opts.team ?? 'demon';
    this.maxHp = this.hp = opts.hp ?? 100;
    this.maxPoise = this.poise = opts.poise ?? 30;
    this.poiseRegen = opts.poiseRegen ?? 10;
    this.alive = true;
    this.hitstop = 0;
    this.flashT = 0;
    this.flashColor = new THREE.Color(1, 1, 1);
    this.state = 'idle';
    this.stateT = 0;
    this.action = null;
    this.invuln = 0;
    this.armor = false;
    this.lastHitT = -99;
    this.timeScale = 1;
    this.visible = true;
    this.dissolve = 0;
    this.materials = model.materials;
    this.id = Actor.nextId++;
    this.chestObj = this.rig.j('chest');
    this.headObj = this.rig.j('head');
    this.shadow = null;
    this.onGround = true;
    this.yVel = 0;
    this.posY = 0;
  }

  get chestPos() {
    return this.chestObj.getWorldPosition(new THREE.Vector3());
  }
  chest(out) {
    return this.chestObj.getWorldPosition(out);
  }
  head(out) {
    return this.headObj.getWorldPosition(out);
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  run(def, opts) {
    this.action = new ActionRunner(this, def, opts);
    return this.action;
  }

  forward(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }
  right(out = new THREE.Vector3()) {
    return out.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
  }

  moveLocal(dist, angle = 0) {
    const y = this.yaw + angle;
    this.pos.x += Math.sin(y) * dist;
    this.pos.z += Math.cos(y) * dist;
  }

  turnTowards(p, rate, dt) {
    const want = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    const d = angleDiff(this.yaw, want);
    const step = rate * dt;
    this.yaw += Math.abs(d) < step ? d : Math.sign(d) * step;
  }

  faceInstant(p) {
    this.yaw = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
  }

  distTo(o) {
    return Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z);
  }

  angleTo(o) {
    const want = Math.atan2(o.pos.x - this.pos.x, o.pos.z - this.pos.z);
    return angleDiff(this.yaw, want);
  }

  flash(color = 0xffffff, t = 0.08) {
    this.flashColor.set(color);
    this.flashT = t;
  }

  /** Common per-frame bookkeeping: hitstop, knockback, flashes, model sync, animation. */
  tick(dt, realDt) {
    this.timeScale = 1;
    if (this.hitstop > 0) {
      this.hitstop -= realDt;
      dt = 0;
    }
    this.localDt = dt;
    this.stateT += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.flashT > 0) this.flashT -= realDt;
    // knockback slide
    if (this.knock.lengthSq() > 1e-4) {
      this.pos.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.exp(-dt * 6));
    }
    // vertical (launch/jumps)
    if (!this.onGround) {
      this.yVel -= 22 * dt;
      this.posY += this.yVel * dt;
      if (this.posY <= 0) {
        this.posY = 0;
        this.yVel = 0;
        this.onGround = true;
        this.onLand?.();
      }
    }
    if (this.poise < this.maxPoise && this.game.time - this.lastHitT > 1.5) this.poise = Math.min(this.maxPoise, this.poise + this.poiseRegen * dt);
    return dt;
  }

  /**
   * Sanemi's 稀血: a demon that has smelled his blood reels as if drunk for a while (drunkT seconds of real
   * time, its clock at drunkK). Returns the factor for this frame's clock.
   */
  drunkScale(realDt) {
    if (!(this.drunkT > 0)) return 1;
    this.drunkT -= realDt;
    if (this.alive && Math.random() < realDt * 5) {
      this.head(_v);
      _v.x += (Math.random() - 0.5) * 0.4;
      _v.z += (Math.random() - 0.5) * 0.4;
      this.game.fx.particles.smoke(_v, 1, 0xb83a52, 0.28, 0.5, 0.9);
    }
    return this.drunkK ?? 0.6;
  }

  /** Called after behaviour: writes transform, animates the rig, updates effects. */
  present(dt, sampleCb) {
    this.root.position.set(this.pos.x, this.pos.y + this.posY, this.pos.z);
    this.root.rotation.y = this.yaw;
    this.anim.update(dt);
    this.anim.apply(sampleCb);
    this.rig.updateSprings(dt);
    const fl = this.flashT > 0 ? Math.min(1, this.flashT / 0.06) * 0.85 : 0;
    if (fl !== this._lastFlash) {
      setFlash(this.materials, fl, this.flashColor);
      this._lastFlash = fl;
    }
    if (this.shadow) {
      this.shadow.position.set(this.pos.x, 0.025, this.pos.z);
      const s = this.radius * 2.6 * (1 - Math.min(0.5, this.posY * 0.15));
      this.shadow.scale.set(s, s, 1);
    }
  }

  setDissolve(v) {
    if (v > 0 && !this._dissolving) {
      this._dissolving = true;
      // excluded from outline prepass while crumbling
      this.root.traverse((o) => o.layers.set(LAYER_MAIN_ONLY));
    }
    this.dissolve = v;
    setDissolve(this.materials, v, _v.set(this.pos.x, 0, this.pos.z));
  }

  launch(v) {
    this.onGround = false;
    this.yVel = v;
  }

  dispose() {
    this.game.scene.remove(this.root);
    if (this.shadow) this.game.scene.remove(this.shadow);
    if (this.headPhys) this.game.scene.remove(this.headPhys.obj);
    if (this.compass) {
      this.compass.life = 0;
      this.compass = null;
    }
  }
}
Actor.nextId = 1;
void DEG;
void _v2;
void _flashCol;
