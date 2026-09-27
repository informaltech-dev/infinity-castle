import * as THREE from 'three';
import { JOINTS, J, JCOUNT } from './rig.js';
import { DEG, ease as EASE, clamp, angleDiff } from '../core/math.js';

// Pose buffer layout: [q(jointCount*4)] [hipX hipY hipZ] [lh] [bodyPitch] [bodyRoll]
export const HP = JCOUNT * 4;
export const LH = HP + 3;
export const BP = LH + 1; // body (root) pitch in radians (flips, dives)
export const BR = BP + 1; // body roll
// Sword swing-plane parameters (IK-driven sword arm): weight, tilt, yaw, angle, radius, blade offset, roll, pole xyz
export const BY = BR + 1; // body yaw (spins)
export const SW = BY + 1;
export const ST = SW + 1;
export const SY = ST + 1;
export const SA = SY + 1;
export const SR = SA + 1;
export const SO = SR + 1;
export const SL = SO + 1;
export const PX = SL + 1;
export const POSE_SIZE = PX + 3;

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();

export function newPose() {
  const p = new Float32Array(POSE_SIZE);
  for (let i = 0; i < JCOUNT; i++) p[i * 4 + 3] = 1;
  p[SR] = 0.4;
  p[PX] = -0.8; p[PX + 1] = -0.6; p[PX + 2] = -0.2;
  return p;
}

/** Write a pose definition (degrees) on top of `base` (Float32Array) into `out`. */
export function compilePose(def, base, out = newPose()) {
  if (base) out.set(base);
  for (const name in def) {
    const v = def[name];
    if (name === 'hp') {
      out[HP] = v[0]; out[HP + 1] = v[1]; out[HP + 2] = v[2];
    } else if (name === 'lh') {
      out[LH] = v;
    } else if (name === 'bp') {
      out[BP] = v * DEG;
    } else if (name === 'br') {
      out[BR] = v * DEG;
    } else if (name === 'by') {
      out[BY] = v * DEG;
    } else if (name === 'sw') {
      out[SW] = v.w ?? 1;
      if (v.tilt !== undefined) out[ST] = v.tilt * DEG;
      if (v.yaw !== undefined) out[SY] = v.yaw * DEG;
      if (v.a !== undefined) out[SA] = v.a * DEG;
      if (v.r !== undefined) out[SR] = v.r;
      if (v.off !== undefined) out[SO] = v.off * DEG;
      if (v.roll !== undefined) out[SL] = v.roll * DEG;
    } else if (name === 'pole') {
      out[PX] = v[0]; out[PX + 1] = v[1]; out[PX + 2] = v[2];
    } else if (J[name] !== undefined) {
      _e.set(v[0] * DEG, v[1] * DEG, v[2] * DEG, 'YXZ');
      _q.setFromEuler(_e);
      const o = J[name] * 4;
      out[o] = _q.x; out[o + 1] = _q.y; out[o + 2] = _q.z; out[o + 3] = _q.w;
    }
  }
  return out;
}

const MIRROR_NAME = (n) => (n.endsWith('L') ? n.slice(0, -1) + 'R' : n.endsWith('R') ? n.slice(0, -1) + 'L' : n);
/** Mirror a pose definition across the character's sagittal plane. */
export function mirrorDef(def) {
  const out = {};
  for (const k in def) {
    const v = def[k];
    if (k === 'hp') out.hp = [-v[0], v[1], v[2]];
    else if (k === 'lh' || k === 'bp') out[k] = v;
    else if (k === 'sw') out.sw = { ...v, yaw: v.yaw !== undefined ? -v.yaw : undefined, tilt: v.tilt !== undefined ? -v.tilt : undefined };
    else if (k === 'pole') out.pole = [-v[0], v[1], v[2]];
    else if (k === 'br' || k === 'by') out[k] = -v;
    else out[MIRROR_NAME(k)] = [v[0], -v[1], -v[2]];
  }
  return out;
}

/**
 * Clip definition:
 * { name, dur, loop?, keys: [{ t, p: poseDef, e: easeName }], base?: poseDef, events?: [...] }
 * Each key's missing joints inherit from the previous key (first key inherits from base).
 */
export function compileClip(def, basePose) {
  const keys = [];
  let prev = basePose ? basePose.slice() : newPose();
  if (def.base) prev = compilePose(def.base, prev);
  for (const k of def.keys) {
    const pose = compilePose(k.p || {}, prev);
    keys.push({ t: k.t, pose, ease: EASE[k.e || 'inOut'] || EASE.inOut });
    prev = pose;
  }
  return {
    name: def.name,
    dur: def.dur ?? keys[keys.length - 1].t,
    loop: !!def.loop,
    keys,
    stepHz: def.stepHz,
    def,
  };
}

export function sampleClip(clip, t, out) {
  const keys = clip.keys;
  if (clip.loop) t = ((t % clip.dur) + clip.dur) % clip.dur;
  if (t <= keys[0].t) { out.set(keys[0].pose); return out; }
  const last = keys[keys.length - 1];
  if (t >= last.t) {
    if (clip.loop && keys.length > 1) {
      // wrap last -> first
      const span = clip.dur - last.t;
      const a = span > 0 ? last.ease((t - last.t) / span) : 1;
      return blendPose(out, last.pose, keys[0].pose, a);
    }
    out.set(last.pose);
    return out;
  }
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const k0 = keys[i], k1 = keys[i + 1];
  const a = k0.ease((t - k0.t) / (k1.t - k0.t));
  return blendPose(out, k0.pose, k1.pose, a);
}

export function blendPose(out, a, b, w) {
  if (w <= 0) { if (out !== a) out.set(a); return out; }
  if (w >= 1) { if (out !== b) out.set(b); return out; }
  for (let i = 0; i < JCOUNT; i++) {
    THREE.Quaternion.slerpFlat(out, i * 4, a, i * 4, b, i * 4, w);
  }
  for (let i = HP; i < POSE_SIZE; i++) out[i] = a[i] + (b[i] - a[i]) * w;
  return out;
}

/** Pre-multiply joint rotations of `add` (as local offsets) onto `out`, weighted. */
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
export function addOffset(out, jointIndex, qx, qy, qz, w = 1) {
  if (w === 0) return;
  _e.set(qx * w, qy * w, qz * w, 'YXZ');
  _qa.setFromEuler(_e);
  const o = jointIndex * 4;
  _qb.set(out[o], out[o + 1], out[o + 2], out[o + 3]).multiply(_qa);
  out[o] = _qb.x; out[o + 1] = _qb.y; out[o + 2] = _qb.z; out[o + 3] = _qb.w;
}

// ---------------------------------------------------------------------------
// Two-bone IK for the off hand
// ---------------------------------------------------------------------------
const _S = new THREE.Vector3();
const _T = new THREE.Vector3();
const _E = new THREE.Vector3();
const _D = new THREE.Vector3();
const _P = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _pq = new THREE.Quaternion();
const _m4 = new THREE.Matrix4();
const DOWN = new THREE.Vector3(0, -1, 0);

export function solveArmIK(upper, fore, hand, target, pole, lenA, lenB, weight, handWorldQ) {
  if (weight <= 0.001) return;
  const uq0 = upper.quaternion.clone();
  const fq0 = fore.quaternion.clone();
  const hq0 = hand.quaternion.clone();
  upper.parent.updateWorldMatrix(true, false);
  _S.setFromMatrixPosition(upper.matrixWorld);
  _D.subVectors(target, _S);
  let d = _D.length();
  d = clamp(d, 0.02, (lenA + lenB) * 0.999);
  _D.normalize();
  const cosA = clamp((lenA * lenA + d * d - lenB * lenB) / (2 * lenA * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  _P.copy(pole).addScaledVector(_D, -pole.dot(_D)).normalize();
  _E.copy(_S).addScaledVector(_D, lenA * cosA).addScaledVector(_P, lenA * sinA);
  // upper arm: rest dir (0,-1,0) in its parent space -> (E - S) expressed in parent space
  upper.parent.getWorldQuaternion(_pq);
  _tmp.subVectors(_E, _S).normalize().applyQuaternion(_pq.invert());
  upper.quaternion.setFromUnitVectors(DOWN, _tmp);
  upper.updateMatrixWorld(true);
  // forearm
  upper.getWorldQuaternion(_pq);
  _tmp.subVectors(_T.copy(_S).addScaledVector(_D, d), _E).normalize().applyQuaternion(_pq.invert());
  fore.quaternion.setFromUnitVectors(DOWN, _tmp);
  fore.updateMatrixWorld(true);
  if (handWorldQ) {
    fore.getWorldQuaternion(_pq);
    hand.quaternion.copy(_pq.invert().multiply(handWorldQ));
  }
  if (weight < 0.999) {
    upper.quaternion.slerpQuaternions(uq0, upper.quaternion, weight);
    fore.quaternion.slerpQuaternions(fq0, fore.quaternion, weight);
    hand.quaternion.slerpQuaternions(hq0, hand.quaternion, weight);
  }
  upper.updateMatrixWorld(true);
}

// ---------------------------------------------------------------------------
// Animator
// ---------------------------------------------------------------------------
const SNAP_FIELDS = ['time', 'phase', 'speed', 'moveAngle', 'sprint', 'guard', 'lean', 'hitJolt', 'hitDir',
  'clip', 'clipTime', 'prevClip', 'prevTime', 'weight', 'blendIn', 'fadeIn', 'mask', 'lookYaw', 'lookPitch'];

export class Animator {
  /**
   * @param {Rig} rig
   * @param {object} cfg { stance, run, sprint, guard }
   */
  constructor(rig, cfg) {
    this.rig = rig;
    this.cfg = cfg;
    this.stance = compilePose(cfg.stance);
    this.runPose = compilePose(cfg.run || {}, this.stance);
    this.sprintPose = compilePose(cfg.sprint || cfg.run || {}, this.stance);
    this.guardPose = cfg.guard ? compilePose(cfg.guard, this.stance) : null;
    this.loco = newPose();
    this.act = newPose();
    this.act2 = newPose();
    this.out = newPose();
    this.outStep = newPose();
    this.time = 0;
    this.phase = 0;
    this.speed = 0;
    this.moveAngle = 0;
    this.sprint = 0;
    this.guard = 0;
    this.guardTarget = 0;
    this.clip = null;
    this.clipTime = 0;
    this.clipSpeed = 1;
    this.weight = 0;
    this.blendIn = 0;
    this.fadeIn = 0.05;
    this.fadeOut = 0.12;
    this.fading = false;
    this.prevClip = null;
    this.prevTime = 0;
    this.mask = 'full';
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.hitJolt = 0;
    this.hitDir = 1;
    this.lean = 0;
    this.leanTarget = 0;
    this.breath = 1;
    this.poseOverride = null;
    this.ikTarget = null;
    this.ikPole = new THREE.Vector3(0.7, -1, 0.3);
    this.stepHz = 0;
    this._acc = 0;
    this.s = {};
    this._snap();
  }

  _snap() {
    const s = this.s;
    for (const f of SNAP_FIELDS) s[f] = this[f];
  }

  play(clip, opts = {}) {
    if (!clip) return;
    if (this.clip && this.weight > 0.01) {
      this.prevClip = this.clip;
      this.prevTime = this.clipTime;
    } else {
      this.prevClip = null;
    }
    this.clip = clip;
    this.clipTime = opts.time ?? 0;
    this.clipSpeed = opts.speed ?? 1;
    this.fadeIn = opts.fade ?? 0.05;
    this.fadeOut = opts.fadeOut ?? 0.12;
    this.mask = opts.mask ?? 'full';
    if (!this.prevClip) this.weight = this.fadeIn <= 0 ? 1 : this.weight;
    this.blendIn = 0;
    this.fading = false;
    this.hold = !!opts.hold;
    // new actions display immediately, even in stepped mode (responsiveness)
    this._acc = 0;
    this._snap();
  }

  stop(fade = 0.12) {
    if (!this.clip) return;
    this.fading = true;
    this.fadeOut = fade;
  }

  get playing() {
    return !!this.clip && !this.fading;
  }

  setLoco(speed, moveAngle, sprint) {
    this.speed = speed;
    this.moveAngle = moveAngle;
    this.sprint = sprint;
  }

  update(dt) {
    this.time += dt;
    const stride = 1.35 + this.sprint * 0.9;
    this.phase += (this.speed / stride) * Math.PI * dt;
    this.guard += (this.guardTarget - this.guard) * Math.min(1, dt * 18);
    this.lean += (this.leanTarget - this.lean) * Math.min(1, dt * 8);
    this.hitJolt = Math.max(0, this.hitJolt - dt * 4.5);
    if (this.clip) {
      this.clipTime += dt * this.clipSpeed;
      this.blendIn += dt;
      if (this.fading) {
        this.weight -= dt / Math.max(0.001, this.fadeOut);
        if (this.weight <= 0) {
          this.weight = 0;
          this.clip = null;
          this.prevClip = null;
        }
      } else {
        this.weight = this.fadeIn <= 0 ? 1 : Math.min(1, this.weight + dt / this.fadeIn);
        if (!this.clip.loop && this.clipTime >= this.clip.dur && !this.hold) this.fading = true;
      }
    }
    if (this.prevClip) {
      this.prevTime += dt * this.clipSpeed;
      if (this.blendIn >= this.fadeIn) this.prevClip = null;
    }
    if (this.stepHz > 0) {
      this._acc += dt;
      const step = 1 / this.stepHz;
      if (this._acc >= step) {
        this._acc %= step;
        this._snap();
      }
    } else {
      this._snap();
    }
  }

  _compute(out, src) {
    this._locomotion(this.loco, src);
    if (src.clip && src.weight > 0) {
      const ct = src.clip.loop ? src.clipTime : Math.min(src.clipTime, src.clip.dur);
      sampleClip(src.clip, ct, this.act);
      // body yaw blends the short way round: a spin clip can sit whole turns away from its neighbours
      // (coilChoke ends at -1080 deg), and a straight lerp would whirl the body through every one of them
      if (src.prevClip && src.fadeIn > 0) {
        sampleClip(src.prevClip, Math.min(src.prevTime, src.prevClip.dur), this.act2);
        this.act2[BY] = this.act[BY] + angleDiff(this.act[BY], this.act2[BY]);
        blendPose(this.act, this.act2, this.act, clamp(src.blendIn / src.fadeIn));
      }
      const w = src.weight;
      if (src.mask === 'upper') {
        for (let i = 0; i < JCOUNT; i++) {
          if (i === J.hips || i >= J.thighL) {
            for (let k = 0; k < 4; k++) out[i * 4 + k] = this.loco[i * 4 + k];
          } else {
            THREE.Quaternion.slerpFlat(out, i * 4, this.loco, i * 4, this.act, i * 4, w);
          }
        }
        for (let i = HP; i < POSE_SIZE; i++) out[i] = this.loco[i];
        out[LH] = this.loco[LH] + (this.act[LH] - this.loco[LH]) * w;
      } else {
        if (w < 1) this.act[BY] = this.loco[BY] + angleDiff(this.loco[BY], this.act[BY]);
        blendPose(out, this.loco, this.act, w);
      }
    } else {
      out.set(this.loco);
    }
    if (src.hitJolt > 0) {
      const j = Math.sin(src.hitJolt * Math.PI) * src.hitJolt;
      addOffset(out, J.chest, -0.4 * j, 0.3 * j * src.hitDir, 0);
      addOffset(out, J.head, -0.5 * j, 0, 0.25 * j * src.hitDir);
      addOffset(out, J.spine, -0.25 * j, 0, 0);
    }
    if (src.lookYaw || src.lookPitch) {
      addOffset(out, J.neck, src.lookPitch * 0.4, src.lookYaw * 0.4, 0);
      addOffset(out, J.head, src.lookPitch * 0.6, src.lookYaw * 0.6, 0);
    }
    return out;
  }

  _locomotion(out, src) {
    const sp = Math.min(src.speed / 5.0, 1.4);
    const run = clamp(sp);
    blendPose(out, this.stance, this.runPose, run);
    if (src.sprint > 0) blendPose(out, out, this.sprintPose, src.sprint);
    if (this.guardPose && src.guard > 0.01) blendPose(out, out, this.guardPose, src.guard);
    const s = Math.sin(src.phase);
    const c = Math.cos(src.phase);
    const amp = 0.5 * sp + 0.22 * src.sprint;
    const fwd = Math.cos(src.moveAngle), side = Math.sin(src.moveAngle);
    if (sp > 0.02) {
      const swing = s * amp;
      addOffset(out, J.thighL, -swing * fwd, 0, swing * side * 0.6);
      addOffset(out, J.thighR, swing * fwd, 0, swing * side * 0.6);
      const kL = Math.max(0, -c) * (0.9 * sp + 0.4 * src.sprint) + 0.1 * sp;
      const kR = Math.max(0, c) * (0.9 * sp + 0.4 * src.sprint) + 0.1 * sp;
      addOffset(out, J.shinL, kL * 1.2, 0, 0);
      addOffset(out, J.shinR, kR * 1.2, 0, 0);
      addOffset(out, J.footL, -kL * 0.3 + swing * fwd * 0.3, 0, 0);
      addOffset(out, J.footR, -kR * 0.3 - swing * fwd * 0.3, 0, 0);
      addOffset(out, J.hips, 0, swing * 0.25 * fwd, 0);
      addOffset(out, J.chest, 0, -swing * 0.35 * fwd, 0);
      out[HP + 1] += -Math.abs(c) * 0.045 * sp - 0.02 * sp;
      addOffset(out, J.upperArmL, swing * 0.9 * fwd, 0, 0);
      addOffset(out, J.upperArmR, -swing * 0.25 * fwd, 0, 0);
    }
    const b = Math.sin(src.time * 2.1) * this.breath;
    addOffset(out, J.chest, b * 0.02, 0, 0);
    addOffset(out, J.neck, -b * 0.015, 0, 0);
    addOffset(out, J.upperArmL, 0, 0, b * 0.02);
    addOffset(out, J.upperArmR, 0, 0, -b * 0.02);
    out[HP + 1] += b * 0.006 * (1 - run);
    addOffset(out, J.spine, src.lean * 0.25, 0, 0);
    return out;
  }

  /**
   * Write the pose to the rig. With stepping enabled the displayed pose is the snapshot taken on
   * the last step tick (anime "on twos"); `sampleCb` is invoked while the continuous pose is applied,
   * so weapon trails can still trace smooth arcs between drawn frames.
   */
  apply(sampleCb) {
    if (this.poseOverride) {
      this._write(this.poseOverride);
      this._swordIK(this.poseOverride);
      this._ik();
      sampleCb?.();
      return;
    }
    const stepped = this.stepHz > 0;
    if (stepped && sampleCb) {
      this._compute(this.out, this);
      this._write(this.out);
      this._swordIK(this.out);
      this._ik();
      sampleCb();
    }
    this._compute(this.outStep, stepped ? this.s : this);
    this._write(this.outStep);
    this._swordIK(this.outStep);
    this._ik();
    if (!stepped) sampleCb?.();
  }

  /** Swing-plane sword pose: places the sword grip on an arc around a chest pivot and solves the arm. */
  _swordIK(pose) {
    const sc = this.sword;
    const w = pose[SW];
    if (!sc || !(w > 0.01)) return;
    const rig = this.rig;
    const chest = rig.j('chest');
    chest.updateWorldMatrix(true, false);
    // swing plane is expressed in body space (follows flips/spins, not chest twist)
    rig.body.getWorldQuaternion(_cq);
    const yaw = pose[SY], tilt = pose[ST], a = pose[SA], r = pose[SR], off = pose[SO], roll = pose[SL];
    _f.set(Math.sin(yaw), 0, Math.cos(yaw));
    _s.set(0, Math.cos(tilt), 0).addScaledVector(_fx.set(-Math.cos(yaw), 0, Math.sin(yaw)), Math.sin(tilt));
    const dir = (ang, out) => out.copy(_f).multiplyScalar(Math.cos(ang)).addScaledVector(_s, Math.sin(ang));
    dir(a, _hd);
    dir(a + off, _bd);
    dir(a + off + Math.PI / 2, _tg);
    // edge faces the direction of decreasing angle by default, roll rotates about the blade
    _ed.copy(_tg).negate();
    if (roll) {
      _x.crossVectors(_bd, _ed);
      _ed.multiplyScalar(Math.cos(roll)).addScaledVector(_x, Math.sin(roll));
    }
    // to world
    _piv.setFromMatrixPosition(chest.matrixWorld).add(_x.copy(sc.pivot).applyQuaternion(_cq));
    _hd.applyQuaternion(_cq);
    _bd.applyQuaternion(_cq);
    _ed.applyQuaternion(_cq);
    const gripPos = _gp.copy(_piv).addScaledVector(_hd, r);
    // sword basis: Y = blade, Z = -edge
    _z.copy(_ed).negate();
    _z.addScaledVector(_bd, -_z.dot(_bd)).normalize();
    _x.crossVectors(_bd, _z).normalize();
    _mat.makeBasis(_x, _bd, _z);
    _swq.setFromRotationMatrix(_mat);
    // hand world rotation = swordQ * inverse(gripLocalQ)
    _hq2.copy(_swq).multiply(sc.gripInvQ);
    // hand joint position = grip target - handQ * gripOffset
    _off.copy(sc.gripOffset).applyQuaternion(_hq2);
    _hp.copy(gripPos).sub(_off);
    _pole.set(pose[PX], pose[PX + 1], pose[PX + 2]).applyQuaternion(_cq);
    solveArmIK(rig.j('upperArmR'), rig.j('foreArmR'), rig.j('handR'), _hp, _pole, rig.d.upperArm, rig.d.foreArm, w, _hq2);
    rig.j('upperArmR').updateMatrixWorld(true);
  }

  _write(pose) {
    const rig = this.rig;
    for (let i = 0; i < JCOUNT; i++) {
      const o = i * 4;
      rig.joints[i].quaternion.set(pose[o], pose[o + 1], pose[o + 2], pose[o + 3]);
    }
    const r0 = rig.restPos[0];
    rig.joints[J.hips].position.set(r0.x + pose[HP], r0.y + pose[HP + 1], r0.z + pose[HP + 2]);
    rig.body.rotation.set(pose[BP], pose[BY], pose[BR], 'YXZ');
    // pivot flips around the hips rather than the feet
    const hy = r0.y + pose[HP + 1];
    _piv.set(0, hy, 0).applyEuler(rig.body.rotation);
    rig.body.position.set(-_piv.x, hy - _piv.y, -_piv.z);
    this.lhWeight = pose[LH];
    rig.root.updateMatrixWorld(true);
  }

  _ik() {
    const w = this.lhWeight;
    if (!this.ikTarget || !(w > 0.01)) return;
    const rig = this.rig;
    this.ikTarget.updateWorldMatrix(true, false);
    const target = _T2.setFromMatrixPosition(this.ikTarget.matrixWorld);
    rig.body.getWorldQuaternion(_pq2);
    const pole = _pole.copy(this.ikPole).applyQuaternion(_pq2);
    this.ikTarget.getWorldQuaternion(_hq);
    solveArmIK(rig.j('upperArmL'), rig.j('foreArmL'), rig.j('handL'), target, pole, rig.d.upperArm, rig.d.foreArm, w, _hq);
    rig.j('upperArmL').updateMatrixWorld(true);
  }
}
const _piv = new THREE.Vector3();
const _cq = new THREE.Quaternion();
const _f = new THREE.Vector3();
const _s = new THREE.Vector3();
const _fx = new THREE.Vector3();
const _hd = new THREE.Vector3();
const _bd = new THREE.Vector3();
const _tg = new THREE.Vector3();
const _ed = new THREE.Vector3();
const _x = new THREE.Vector3();
const _z = new THREE.Vector3();
const _gp = new THREE.Vector3();
const _hp = new THREE.Vector3();
const _off = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _swq = new THREE.Quaternion();
const _hq2 = new THREE.Quaternion();
const _T2 = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _pq2 = new THREE.Quaternion();
const _hq = new THREE.Quaternion();

export { JOINTS };
