import * as THREE from 'three';
import { clamp, dampT, angleDiff, noise1, lerp, ease } from '../core/math.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _t = new THREE.Vector3();

/**
 * Third-person orbit camera with lock-on framing, trauma shake, FOV kicks and scripted cinematics.
 */
export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = Math.PI; // camera sits behind the player (player faces +Z at yaw 0)
    this.pitch = 0.18;
    this.dist = 5.4;
    this.distTarget = 5.4;
    this.height = 1.45;
    this.focus = new THREE.Vector3(0, 1.4, 0);
    this.baseFov = 52;
    this.fovKick = 0;
    this.trauma = 0;
    this.shakeT = 0;
    this.shakeScale = 1;
    this.lock = null; // target actor
    this.sens = 1;
    this.invertY = false;
    this.cine = null;
    this.bounds = null;
    this.side = 0.35; // over-the-shoulder offset
    this.lookAheadYaw = 0;
    // touch screens: swing round behind sideways movement when the right thumb is busy elsewhere
    this.autoFollow = false;
    this.lookIdle = 0;
    /** A camera-drag finger rests on the screen (touch): no auto-follow under it. */
    this.lookHeld = false;
  }

  shake(amount) {
    this.trauma = Math.min(1.2, this.trauma + amount * this.shakeScale);
  }
  kick(fov) {
    this.fovKick = Math.max(this.fovKick, fov);
  }

  snapBehind(yawFacing) {
    this.yaw = yawFacing + Math.PI;
  }

  /** Scripted shot: keys = [{ t, pos:[x,y,z], look:[x,y,z], fov, e }] in world space (or relative to `anchor`). */
  play(keys, { anchor = null, relYaw = 0, onEnd = null, hold = false } = {}) {
    this.cine = { keys, time: 0, anchor, relYaw, onEnd, hold, done: false };
  }
  stopCine() {
    this.cine = null;
  }

  update(dt, realDt, player, look) {
    const cam = this.cam;
    if (this.cine) {
      this._cinematic(realDt);
      this._applyShake(realDt);
      return;
    }
    // input look
    if (look && (look.x || look.y)) {
      this.yaw -= look.x * 0.0026 * this.sens;
      this.pitch += look.y * 0.0022 * this.sens * (this.invertY ? -1 : 1);
      this.lookIdle = 0;
    } else if (this.lookHeld) this.lookIdle = 0;
    else this.lookIdle += realDt;
    if (this.autoFollow && look && !this.lock && player.velXZ && this.lookIdle > 0.5) {
      // sideways speed along the camera's right vector turns the view towards it
      const side = player.velXZ.x * Math.cos(this.yaw) - player.velXZ.z * Math.sin(this.yaw);
      this.yaw -= side * 0.09 * clamp((this.lookIdle - 0.5) * 2, 0, 1) * realDt;
    }
    this.pitch = clamp(this.pitch, -0.35, 1.05);
    // follow
    const p = player.pos;
    // (camLift: a player fighting high in the air -- Sanemi's typhoon -- takes the view up with him)
    _t.set(p.x, p.y + this.height + (player.camLift || 0), p.z);
    this.focus.lerp(_t, dampT(14, realDt));
    // (distAdd: a bigger player -- Gyomei -- is framed from further back)
    let dist = this.distTarget + (this.distAdd || 0);
    if (this.lock && this.lock.alive !== false) {
      const tp = this.lock.pos;
      const dx = tp.x - p.x, dz = tp.z - p.z;
      const d = Math.hypot(dx, dz);
      // camera behind the player, facing the target
      const want = Math.atan2(-dx, -dz);
      this.yaw += angleDiff(this.yaw, want) * dampT(5, realDt);
      const wantPitch = clamp(0.2 + (d < 3 ? 0.1 : 0) - (this.lock.height > 2.5 ? 0.05 : 0), 0.05, 0.5);
      this.pitch += (wantPitch - this.pitch) * dampT(3, realDt);
      dist = clamp(4.8 + d * 0.18, 4.8, 7.5) + (this.distAdd || 0);
      // focus slightly toward target
      _v.set(tp.x, tp.y + 1.2, tp.z);
      this.focus.lerp(_v, 0.18 * dampT(14, realDt) * 3);
    }
    this.dist += (dist - this.dist) * dampT(4, realDt);
    const cy = Math.cos(this.pitch);
    _v.set(Math.sin(this.yaw) * cy, Math.sin(this.pitch), Math.cos(this.yaw) * cy).multiplyScalar(this.dist);
    // over-the-shoulder
    _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(this.side);
    cam.position.copy(this.focus).add(_v).add(_v2);
    if (cam.position.y < 0.35) cam.position.y = 0.35;
    cam.lookAt(_t.copy(this.focus).add(_v2));
    this.fovKick = Math.max(0, this.fovKick - realDt * 40);
    const fov = this.baseFov + this.fovKick;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    this._applyShake(realDt);
  }

  _applyShake(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    if (this.trauma <= 0) return;
    this.shakeT += dt * 38;
    const s = this.trauma * this.trauma;
    const cam = this.cam;
    cam.rotateX(noise1(this.shakeT) * 0.05 * s);
    cam.rotateY(noise1(this.shakeT + 31.7) * 0.05 * s);
    cam.rotateZ(noise1(this.shakeT + 77.1) * 0.06 * s);
    cam.position.x += noise1(this.shakeT + 11.3) * 0.12 * s;
    cam.position.y += noise1(this.shakeT + 51.9) * 0.12 * s;
  }

  _cinematic(dt) {
    const c = this.cine;
    c.time += dt;
    const keys = c.keys;
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1].t <= c.time) i++;
    const k0 = keys[i];
    const k1 = keys[Math.min(i + 1, keys.length - 1)];
    const span = Math.max(1e-4, k1.t - k0.t);
    const a = k1 === k0 ? 1 : (ease[k1.e || 'inOut'] || ease.inOut)(clamp((c.time - k0.t) / span));
    const tr = (arr, out) => {
      out.set(arr[0], arr[1], arr[2]);
      if (c.anchor) {
        const cs = Math.cos(c.relYaw), sn = Math.sin(c.relYaw);
        const x = out.x * cs + out.z * sn;
        const z = -out.x * sn + out.z * cs;
        out.set(x + c.anchor.x, out.y + c.anchor.y, z + c.anchor.z);
      }
      return out;
    };
    const p0 = tr(k0.pos, new THREE.Vector3()), p1 = tr(k1.pos, new THREE.Vector3());
    const l0 = tr(k0.look, new THREE.Vector3()), l1 = tr(k1.look, new THREE.Vector3());
    this.cam.position.lerpVectors(p0, p1, a);
    _t.lerpVectors(l0, l1, a);
    this.cam.lookAt(_t);
    const fov = lerp(k0.fov ?? this.baseFov, k1.fov ?? this.baseFov, a);
    if (Math.abs(this.cam.fov - fov) > 0.01) {
      this.cam.fov = fov;
      this.cam.updateProjectionMatrix();
    }
    if (c.time >= keys[keys.length - 1].t && !c.done) {
      c.done = true;
      const cb = c.onEnd;
      if (!c.hold) {
        // hand control back: derive orbit angles from the current view so there is no jump
        this.cine = null;
        this._syncFromCamera();
      }
      cb?.();
    }
  }

  _syncFromCamera() {
    const d = _v.copy(this.cam.position).sub(this.focus);
    const len = d.length() || 1;
    this.yaw = Math.atan2(d.x, d.z);
    this.pitch = clamp(Math.asin(clamp(d.y / len, -1, 1)), -0.35, 1.0);
    this.dist = clamp(len, 3, 9);
  }

  /** Forward/right vectors on the ground plane for camera-relative movement. */
  basis(outF, outR) {
    outF.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    outR.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).negate();
    // right = forward x up (y) → (-f.z, 0, f.x)... keep consistent with screen right
    outR.set(-outF.z, 0, outF.x);
    return outF;
  }
}
