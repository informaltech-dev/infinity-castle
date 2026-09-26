import * as THREE from 'three';
import { merge } from '../render/geo.js';

export const JOINTS = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'upperArmL', 'foreArmL', 'handL',
  'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL',
  'thighR', 'shinR', 'footR',
];
export const J = Object.fromEntries(JOINTS.map((n, i) => [n, i]));
export const JCOUNT = JOINTS.length;
export const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15];

export const DEFAULT_DIMS = {
  hipY: 0.94,
  spine: 0.11,
  chest: 0.19,
  neck: 0.23,
  head: 0.07,
  headR: 0.118,
  shoulderX: 0.175,
  shoulderY: 0.2,
  upperArm: 0.28,
  foreArm: 0.25,
  hipX: 0.095,
  thigh: 0.43,
  shin: 0.42,
};

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

/**
 * Hierarchical humanoid built from Object3D joints. Mesh parts are registered per joint and
 * merged per (joint, material) at build() time to keep draw calls low.
 */
export class Rig {
  constructor(dims = {}) {
    this.d = { ...DEFAULT_DIMS, ...dims };
    const d = this.d;
    this.root = new THREE.Group(); // world placement (feet at origin), yaw here
    this.body = new THREE.Group(); // extra lean/tilt without touching root yaw
    this.root.add(this.body);
    this.joints = [];
    const off = [
      [0, d.hipY, 0],
      [0, d.spine, 0],
      [0, d.chest, 0],
      [0, d.neck, 0],
      [0, d.head, 0],
      [d.shoulderX, d.shoulderY, 0],
      [0, -d.upperArm, 0],
      [0, -d.foreArm, 0],
      [-d.shoulderX, d.shoulderY, 0],
      [0, -d.upperArm, 0],
      [0, -d.foreArm, 0],
      [d.hipX, -0.045, 0],
      [0, -d.thigh, 0],
      [0, -d.shin, 0],
      [-d.hipX, -0.045, 0],
      [0, -d.thigh, 0],
      [0, -d.shin, 0],
    ];
    this.restPos = off.map((o) => new THREE.Vector3(...o));
    for (let i = 0; i < JCOUNT; i++) {
      const o = new THREE.Object3D();
      o.name = JOINTS[i];
      o.position.copy(this.restPos[i]);
      this.joints.push(o);
      (PARENT[i] < 0 ? this.body : this.joints[PARENT[i]]).add(o);
    }
    this.parts = []; // {joint, geo, mat, matrix}
    this.meshes = [];
    this.materials = new Set();
    this.springs = [];
    this.sockets = {};
  }

  j(name) {
    return this.joints[J[name]];
  }

  /** Register a geometry on a joint (geometry expressed in joint-local space). */
  add(joint, geo, mat, opts = {}) {
    const jo = typeof joint === 'string' ? this.j(joint) : joint;
    this.materials.add(mat);
    if (opts.merge === false || opts.name) {
      const mesh = new THREE.Mesh(geo, mat);
      if (opts.name) mesh.name = opts.name;
      mesh.frustumCulled = false;
      jo.add(mesh);
      this.meshes.push(mesh);
      return mesh;
    }
    this.parts.push({ joint: jo, geo, mat });
    return null;
  }

  /** Create a socket Object3D under a joint (e.g. weapon grip, scabbard) */
  socket(name, joint, pos = [0, 0, 0], rot = [0, 0, 0]) {
    const s = new THREE.Object3D();
    s.name = name;
    s.position.set(...pos);
    s.rotation.set(...rot);
    (typeof joint === 'string' ? this.j(joint) : joint).add(s);
    this.sockets[name] = s;
    return s;
  }

  /** Spring (jiggle) bone: an Object3D under `parent` whose -Y axis follows inertia + gravity. */
  spring(name, parent, pos, length, opts = {}) {
    const bone = new THREE.Object3D();
    bone.name = name;
    bone.position.set(...pos);
    if (opts.rest) bone.rotation.set(...opts.rest);
    (typeof parent === 'string' ? this.j(parent) : parent).add(bone);
    const s = {
      bone,
      length,
      restQ: bone.quaternion.clone(),
      tip: new THREE.Vector3(),
      prev: new THREE.Vector3(),
      stiffness: opts.stiffness ?? 0.18,
      damping: opts.damping ?? 0.82,
      gravity: opts.gravity ?? 0.04, // metres of sag of the rest target
      maxAngle: opts.maxAngle ?? 1.2,
      init: false,
    };
    this.springs.push(s);
    return bone;
  }

  build() {
    const groups = new Map();
    for (const p of this.parts) {
      const key = p.joint.uuid + '|' + p.mat.uuid;
      if (!groups.has(key)) groups.set(key, { joint: p.joint, mat: p.mat, geos: [] });
      groups.get(key).geos.push(p.geo);
    }
    for (const g of groups.values()) {
      const geo = merge(g.geos);
      const mesh = new THREE.Mesh(geo, g.mat);
      mesh.frustumCulled = false;
      g.joint.add(mesh);
      this.meshes.push(mesh);
    }
    this.parts.length = 0;
    return this;
  }

  setLayer(layer) {
    this.root.traverse((o) => o.layers.set(layer));
  }

  resetSprings() {
    for (const s of this.springs) s.init = false;
  }

  /** Simulate spring bones. Call after the pose is applied and world matrices are updated. */
  updateSprings(dt) {
    if (dt <= 0) return;
    const k = Math.min(dt * 60, 2);
    for (const s of this.springs) {
      const bone = s.bone;
      const parent = bone.parent;
      parent.updateWorldMatrix(true, false);
      // rest tip in world
      bone.quaternion.copy(s.restQ);
      bone.updateMatrixWorld(true);
      const origin = _v.setFromMatrixPosition(bone.matrixWorld);
      const restTip = _v2.set(0, -s.length, 0).applyMatrix4(bone.matrixWorld);
      if (!s.init) {
        s.tip.copy(restTip);
        s.prev.copy(restTip);
        s.init = true;
      }
      const vx = (s.tip.x - s.prev.x) * s.damping;
      const vy = (s.tip.y - s.prev.y) * s.damping;
      const vz = (s.tip.z - s.prev.z) * s.damping;
      s.prev.copy(s.tip);
      s.tip.x += vx + (restTip.x - s.tip.x) * s.stiffness * k;
      s.tip.y += vy + (restTip.y - s.gravity - s.tip.y) * s.stiffness * k;
      s.tip.z += vz + (restTip.z - s.tip.z) * s.stiffness * k;
      // keep length
      const dir = _v2.subVectors(s.tip, origin);
      const len = dir.length() || 1;
      dir.multiplyScalar(1 / len);
      s.tip.copy(origin).addScaledVector(dir, s.length);
      // convert to bone-parent local
      _m.copy(parent.matrixWorld).invert();
      const localDir = dir.transformDirection(_m); // normalized
      // rest direction in parent space
      const restDir = _v.set(0, -1, 0).applyQuaternion(s.restQ);
      const ang = restDir.angleTo(localDir);
      if (ang > s.maxAngle) {
        // clamp
        const axis = restDir.clone().cross(localDir).normalize();
        localDir.copy(restDir).applyAxisAngle(axis, s.maxAngle);
      }
      _q.setFromUnitVectors(_v.set(0, -1, 0).applyQuaternion(s.restQ).normalize(), localDir);
      bone.quaternion.copy(_q).multiply(s.restQ);
      bone.updateMatrixWorld(true);
    }
  }
}
