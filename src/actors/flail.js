// Gyomei's weapon: a hand axe chained to a spiked iron ball.
import * as THREE from 'three';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();
const _one = new THREE.Vector3(1, 1, 1);
const _s = new THREE.Vector3();
// the chain's stretches, laid out afresh every frame: ball -> left hand, left hand -> right hand, right hand -> axe
const SEG_A = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const SEG_B = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const SEG_SAG = [0, 0, 0];
const SEG_L = [0, 0, 0];
const UP = new THREE.Vector3(0, 1, 0);
const TWIST = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2);

const HANG = 0.56; // chain from the left hand down to the ball at rest
const LINK = 0.052; // spacing of the chain's links
const SLACK = 1.0; // chain between his hands
const GRAV = 16;
const HAUL_V = 12; // the most speed a ball hauled back in carries on with

function catmull(a, b, c, d, u, u2, u3) {
  return 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
}

/** A point on a key list (world positions, one per key) at time t: Catmull-Rom through them. */
function sampleKeys(ts, ps, t, out) {
  const n = ts.length;
  if (t <= ts[0]) return out.copy(ps[0]);
  if (t >= ts[n - 1]) return out.copy(ps[n - 1]);
  let i = 0;
  while (i < n - 2 && ts[i + 1] <= t) i++;
  const u = (t - ts[i]) / Math.max(1e-6, ts[i + 1] - ts[i]);
  const p0 = ps[Math.max(0, i - 1)], p1 = ps[i], p2 = ps[i + 1], p3 = ps[Math.min(n - 1, i + 2)];
  const u2 = u * u, u3 = u2 * u;
  out.x = catmull(p0.x, p1.x, p2.x, p3.x, u, u2, u3);
  out.y = catmull(p0.y, p1.y, p2.y, p3.y, u, u2, u3);
  out.z = catmull(p0.z, p1.z, p2.z, p3.z, u, u2, u3);
  return out;
}

/**
 * The flail's state. The ball hangs from his left hand on the chain (a damped pendulum) until a move throws it:
 * the move's `flail` keys then carry it on the move's own clock --
 *   { ball: [[t, x, y, z] | [t, 'hang']], axe: [[t, x, y, z] | [t, 'hand']], spin }
 * in his body space (+X his left, +Y up, +Z ahead, following him as he moves) -- and when they end the chain takes
 * it back. The axe is the model's sword, in his right hand, until its own keys throw it too. The chain runs
 * ball -> left hand -> right hand -> axe, its links laid along it every frame.
 */
export class Flail {
  constructor(model, parts) {
    this.model = model;
    this.rig = model.rig;
    this.ballObj = parts.ball;
    this.axeObj = parts.axe;
    this.chain = parts.chain;
    this.ballR = parts.ballR;
    this.max = parts.links;
    this.p = new THREE.Vector3();
    this.pp = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.axeP = new THREE.Vector3();
    this.axeVel = new THREE.Vector3();
    this.axeSpin = 0;
    this.init = false;
    this.ball = null; // a keyed path the ball is on: { ts, pts, kind, runner, actor }
    this.axe = null; // likewise the axe
    this.throws = []; // arcs in world space (the ultimate, a recall): { which, from, to, t, dur, lift, back }
    this.whirlOn = false; // whirling overhead (a charged heavy winding up)
    this.whirlA = 0;
    this.wasDriven = false; // the ball carried last frame (a path, a throw, the whirl) rather than hanging
    this.spin = 16;
    this.hand = new THREE.Vector3();
    this.grip = new THREE.Vector3();
    this.pommel = new THREE.Vector3();
  }

  get axeFlying() {
    return !!this.axe || this._thrown('axe');
  }

  get ballFlying() {
    return !!this.ball || this._thrown('ball');
  }

  _thrown(which) {
    for (const t of this.throws) if (t.which === which) return true;
    return false;
  }

  /** The ball's resting place: HANG under the left hand. */
  rest(out) {
    return out.copy(this.hand).add(_v2.set(0, -HANG, 0));
  }

  /** Start a move's keyed paths (on the runner's clock). */
  play(spec, runner, actor) {
    if (!spec) return;
    const axeOut = this.axeFlying;
    // (the move takes the ball over; the axe too if it throws it, else an axe flying home carries on)
    this.throws = this.throws.filter((t) => t.which === 'axe' && t.back && !spec.axe);
    if (spec.ball) this.ball = this._path(spec.ball, runner, actor, this.p);
    if (spec.axe) {
      this.axe = this._path(spec.axe, runner, actor, axeOut ? this.axeP : this.grip);
      this._showAxe(true);
    }
    this.spin = spec.spin ?? 16;
  }

  _path(keys, runner, actor, from) {
    // (the path starts where the thing is now, so a throw never jumps)
    const ts = [runner.t], pts = [from.clone()];
    const kind = [];
    kind.push(null);
    for (const k of keys) {
      if (k[0] <= runner.t) continue;
      ts.push(k[0]);
      pts.push(new THREE.Vector3());
      kind.push(typeof k[1] === 'string' ? k[1] : k.slice(1));
    }
    return { ts, pts, kind, runner, actor };
  }

  /** Throw one of them along an arc to a point in the world (the ultimate): there it stays until recalled. */
  throwTo(which, to, dur, lift = 1.2) {
    const from = (which === 'ball' ? this.p : this.axeFlying ? this.axeP : this.grip).clone();
    this.throws = this.throws.filter((t) => t.which !== which);
    this.throws.push({ which, from, to: to.clone(), t: 0, dur, lift, back: false });
    if (which === 'ball') this.ball = null;
    else {
      this.axe = null;
      this._showAxe(true);
    }
  }

  /** ...and back: the ball to hang from his hand, the axe to his hand. */
  recall(which, dur = 0.16) {
    const t = this.throws.find((x) => x.which === which);
    if (!t) return;
    t.from = (which === 'ball' ? this.p : this.axeP).clone();
    t.t = 0;
    t.dur = dur;
    t.back = true;
    t.lift = 0.4;
    t.v0 = null;
  }

  /** Whirl the ball overhead (while a charged heavy winds up, and his ultimate gathers). */
  setWhirl(on) {
    this.whirlOn = !!on;
  }

  /** Drop every path: the ball swings free on the chain, the axe flies back to his hand. */
  release() {
    const axeOut = this.axeFlying;
    this.ball = null;
    this.axe = null;
    this.throws.length = 0;
    if (axeOut) this.throws.push({ which: 'axe', from: this.axeP.clone(), to: null, t: 0, dur: 0.14, lift: 0.3, back: true });
    this.whirlOn = false;
  }

  _showAxe(flying) {
    const sw = this.model.sword;
    if (sw) sw.group.visible = !flying;
    this.axeObj.visible = flying;
  }

  _keyPoint(path, i, out) {
    const k = path.kind[i];
    if (k === 'hang') return this.rest(out);
    if (k === 'hand') return out.copy(this.grip);
    const a = path.actor;
    const x = k[0], y = k[1], z = k[2];
    const c = Math.cos(a.yaw), s = Math.sin(a.yaw);
    return out.set(a.pos.x + x * c + z * s, (a.pos.y || 0) + (a.posY || 0) + y, a.pos.z - x * s + z * c);
  }

  /** Advance a keyed path: 'on' while it runs, 'end' once its last key is reached, 'cut' if its move was cut short. */
  _follow(path, out) {
    const r = path.runner;
    if (!r || path.actor.action !== r) return 'cut';
    for (let i = 1; i < path.ts.length; i++) this._keyPoint(path, i, path.pts[i]);
    sampleKeys(path.ts, path.pts, r.t, out);
    if (r.t < path.ts[path.ts.length - 1]) return r.done ? 'cut' : 'on';
    return 'end';
  }

  _anchors() {
    const rig = this.rig;
    rig.j('handL').localToWorld(this.hand.set(0, -0.07, 0.02));
    const sw = this.model.sword;
    sw.grip.getWorldPosition(this.grip);
    sw.pommel.getWorldPosition(this.pommel);
  }

  update(dt) {
    this._anchors();
    if (!this.init) {
      this.rest(this.p);
      this.pp.copy(this.p);
      this.axeP.copy(this.grip);
      this.init = true;
    }
    const prev = _c.copy(this.p);
    const prevAxe = _b.copy(this.axeP);
    // --- the ball
    let driven = false;
    if (this.ball) {
      if (this._follow(this.ball, this.p) === 'on') driven = true;
      else {
        // (off the path -- its end, or its move cut short: the ball swings on with the speed it had)
        this.pp.copy(this.p).addScaledVector(this.vel, -Math.max(dt, 1 / 60));
        this.ball = null;
      }
    }
    if (!driven && this.wasDriven && !this.whirlOn && !this._thrown('ball')) {
      // (...but let go far out -- a move cut short, the whirl or a throw dropped -- the chain would snatch it in to
      // hang at a stroke: it is hauled in instead, carrying on a little the way it was going)
      const far = _v.subVectors(this.p, this.hand).length();
      if (far > HANG + 0.1) {
        const v0 = this.vel.clone();
        if (v0.lengthSq() > HAUL_V * HAUL_V) v0.setLength(HAUL_V);
        this.throws.push({ which: 'ball', from: this.p.clone(), to: null, t: 0, dur: Math.min(0.42, 0.14 + far * 0.07), lift: 0.2, back: true, v0 });
      }
    }
    for (const th of this.throws) {
      if (th.which !== 'ball') continue;
      driven = true;
      this._throwStep(th, dt, this.p, this.rest(_a));
      if (th.v0 && this.p.y < this.ballR) this.p.y = this.ballR;
    }
    if (!driven && this.whirlOn) {
      // winding up overhead
      this.whirlA += dt * 13;
      rigHead(this.rig, _a);
      _a.y += 0.42;
      _v.set(Math.cos(this.whirlA) * 1.05, 0.12 * Math.sin(this.whirlA * 2), Math.sin(this.whirlA) * 1.05);
      this.p.lerp(_a.add(_v), Math.min(1, dt * 18));
      this.pp.copy(this.p);
      driven = true;
    }
    if (!driven && dt > 0) this._hang(dt);
    if (driven) this.pp.copy(prev);
    if (dt > 0) this.vel.subVectors(this.p, prev).divideScalar(dt);
    this.wasDriven = driven;
    // --- the axe
    let flying = false;
    if (this.axe) {
      const st = this._follow(this.axe, this.axeP);
      if (st === 'on') flying = true;
      else {
        // (back in his hand at the path's end; flung back to it if the move was cut short)
        if (st === 'cut') {
          this.throws.push({ which: 'axe', from: this.axeP.clone(), to: null, t: 0, dur: 0.14, lift: 0.3, back: true });
          flying = true;
        }
        this.axe = null;
      }
    }
    for (const th of this.throws) {
      if (th.which !== 'axe') continue;
      flying = true;
      this._throwStep(th, dt, this.axeP, this.grip);
    }
    // (those flown home are done)
    let w = 0;
    for (const th of this.throws) if (!(th.back && th.t >= th.dur)) this.throws[w++] = th;
    this.throws.length = w;
    if (!flying) this.axeP.copy(this.grip);
    if (dt > 0) this.axeVel.subVectors(this.axeP, prevAxe).divideScalar(dt);
    this.axeSpin += dt * (flying ? this.spin || 16 : 0);
    this._showAxe(flying);
    this._draw(flying);
  }

  _throwStep(th, dt, out, home) {
    th.t = Math.min(th.dur, th.t + dt);
    const k = th.t / th.dur;
    const to = th.back ? home : th.to;
    if (th.v0) {
      // (hauled in on the chain: leaving with the speed it had, settling to hang)
      const k2 = k * k, k3 = k2 * k;
      out.lerpVectors(th.from, to, 3 * k2 - 2 * k3).addScaledVector(th.v0, (k3 - 2 * k2 + k) * th.dur);
    } else {
      const e = th.back ? k * k : 1 - (1 - k) * (1 - k);
      out.lerpVectors(th.from, to, e);
    }
    out.y += Math.sin(k * Math.PI) * th.lift;
  }

  _hang(dt) {
    const p = this.p, pp = this.pp;
    const vx = (p.x - pp.x) * 0.985, vy = (p.y - pp.y) * 0.985, vz = (p.z - pp.z) * 0.985;
    pp.copy(p);
    p.x += vx;
    p.y += vy - GRAV * dt * dt;
    p.z += vz;
    // the chain holds it: never further from the hand than it is long
    _v.subVectors(p, this.hand);
    const len = _v.length();
    if (len > HANG) p.copy(this.hand).addScaledVector(_v, HANG / len);
    // the floor
    if (p.y < this.ballR) {
      p.y = this.ballR;
      pp.x = p.x - (p.x - pp.x) * 0.6;
      pp.z = p.z - (p.z - pp.z) * 0.6;
      pp.y = p.y;
    }
  }

  _draw(flying) {
    const root = this.model.root;
    _inv.copy(root.matrixWorld).invert();
    // the ball faces the chain
    const anchor = this.hand;
    _v.subVectors(anchor, this.p);
    const d = _v.length();
    if (d > 1e-4) _q.setFromUnitVectors(UP, _v.multiplyScalar(1 / d));
    _m.compose(this.p, _q, _one);
    this.ballObj.matrix.multiplyMatrices(_inv, _m);
    this.ballObj.matrixWorldNeedsUpdate = true;
    // the thrown axe tumbles end over end about his right-left axis
    if (flying) {
      _v2.set(1, 0, 0).applyQuaternion(root.quaternion);
      _q2.setFromAxisAngle(_v2, this.axeSpin);
      _q.copy(_q2).multiply(root.quaternion);
      _m.compose(this.axeP, _q, _one);
      this.axeObj.matrix.multiplyMatrices(_inv, _m);
      this.axeObj.matrixWorldNeedsUpdate = true;
    }
    // --- the chain: ball -> left hand -> right hand (-> the axe, when it flies)
    SEG_A[0].copy(this.p);
    if (d > 1e-4) SEG_A[0].addScaledVector(_v2.subVectors(anchor, this.p).normalize(), this.ballR);
    SEG_B[0].copy(this.hand);
    SEG_SAG[0] = 0.02 + Math.min(0.1, d * 0.02);
    const handEnd = flying ? this.grip : this.pommel;
    const span = this.hand.distanceTo(handEnd);
    SEG_A[1].copy(this.hand);
    SEG_B[1].copy(handEnd);
    SEG_SAG[1] = span < SLACK ? Math.sqrt(SLACK * SLACK - span * span) * 0.42 : 0;
    let segs = 2;
    if (flying) {
      this.axeObj.updateMatrixWorld(true);
      SEG_A[2].copy(this.grip);
      this.axeObj.userData.pommel.getWorldPosition(SEG_B[2]);
      SEG_SAG[2] = 0.06;
      segs = 3;
    }
    // (a very long throw spreads the links further apart, each drawn longer, rather than run out of them short of the axe)
    let need = 0;
    for (let s = 0; s < segs; s++) {
      SEG_L[s] = SEG_A[s].distanceTo(SEG_B[s]) + SEG_SAG[s] * 1.4;
      need += Math.max(2, Math.ceil(SEG_L[s] / LINK));
    }
    const stretch = need > this.max - segs ? need / (this.max - segs) : 1;
    _s.set(1, stretch, 1);
    let n = 0;
    const mesh = this.chain;
    for (let s = 0; s < segs; s++) {
      const A = SEG_A[s], B = SEG_B[s], sag = SEG_SAG[s];
      // a quadratic curve sagging `sag` below the straight line at its middle
      const ctrl = _c.addVectors(A, B).multiplyScalar(0.5);
      ctrl.y -= sag * 2;
      const steps = Math.max(2, Math.ceil(SEG_L[s] / (LINK * stretch)));
      for (let i = 0; i < steps && n < this.max; i++) {
        const t = (i + 0.5) / steps, it = 1 - t;
        const x = it * it * A.x + 2 * it * t * ctrl.x + t * t * B.x;
        const y = it * it * A.y + 2 * it * t * ctrl.y + t * t * B.y;
        const z = it * it * A.z + 2 * it * t * ctrl.z + t * t * B.z;
        // tangent
        _v.set(2 * it * (ctrl.x - A.x) + 2 * t * (B.x - ctrl.x), 2 * it * (ctrl.y - A.y) + 2 * t * (B.y - ctrl.y), 2 * it * (ctrl.z - A.z) + 2 * t * (B.z - ctrl.z));
        if (_v.lengthSq() < 1e-10) _v.set(0, 1, 0);
        _q.setFromUnitVectors(UP, _v.normalize());
        if (n % 2) _q.multiply(TWIST);
        _m.compose(_v2.set(x, y, z), _q, _s);
        mesh.setMatrixAt(n++, _m);
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.matrix.copy(_inv);
    mesh.matrixWorldNeedsUpdate = true;
  }
}

function rigHead(rig, out) {
  return rig.j('head').getWorldPosition(out);
}
