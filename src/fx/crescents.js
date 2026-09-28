import * as THREE from 'three';
import { LAYER_FX } from '../render/pipeline.js';
import { SHAPE } from './particles.js';

// Moon Breathing's crescent blades: flat, lit from within, drawn in whatever plane they were cut in.
// Each crescent is a plain object the owner keeps (its hit data rides along); this pool moves them,
// draws every live one in one instanced mesh and retires them when their time is up.

const MAX = 640;

const vert = /* glsl */ `
attribute vec4 iCol;
attribute float iCut;
varying vec2 vUv;
varying vec4 vCol;
varying float vCut;
varying float vNear;
void main() {
  vUv = uv;
  vCol = iCol;
  vCut = iCut;
  // a blade passing right in front of the lens fades instead of whiting out the screen; the biggest are dimmer
  vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float size = length(instanceMatrix[0].xyz);
  vNear = smoothstep(0.6 + size * 0.5, 2.2 + size, -c.z) * (1.0 - 0.3 * smoothstep(1.0, 2.4, size));
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

// Local plane: the outer disc (radius 1) less an inner disc pushed toward +x. The thick back of the
// crescent is at -x (it leads when the blade flies), the horns reach round toward +x.
const frag = /* glsl */ `
varying vec2 vUv;
varying vec4 vCol;
varying float vCut;
varying float vNear;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float outer = 1.0 - smoothstep(0.9, 1.0, r);
  float ri = length(p - vec2(vCut, 0.0)) / (1.0 - vCut * 0.45);
  float body = outer * smoothstep(0.93, 1.0, ri);
  // gold-white cutting edge along the outer rim, deepening to violet at the hollow's edge
  float rim = smoothstep(0.78, 0.98, r) * body;
  float hollow = 1.0 - smoothstep(1.0, 1.3, ri);
  float halo = pow(max(0.0, 1.0 - abs(r - 0.96) * 5.0), 2.0) * smoothstep(0.9, 1.1, ri) * 0.3;
  vec3 violet = vec3(0.42, 0.16, 0.78);
  vec3 col = mix(vCol.rgb, violet, hollow * 0.85);
  col = mix(col, vec3(1.0, 0.96, 0.86), rim * 0.7);
  float a = (body * (0.75 + 0.25 * rim) + halo) * vCol.a * vNear;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col * (0.95 + rim * 0.75), a);
}
`;

const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const _col = new THREE.Color();

export class Crescents {
  /**
   * @param {THREE.Scene} scene
   * @param {object} [fx] the game's FX (sparkles along the blades)
   */
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.list = [];
    const geo = new THREE.PlaneGeometry(2, 2);
    this.cols = new Float32Array(MAX * 4);
    this.cuts = new Float32Array(MAX);
    this.aCol = new THREE.InstancedBufferAttribute(this.cols, 4).setUsage(THREE.DynamicDrawUsage);
    this.aCut = new THREE.InstancedBufferAttribute(this.cuts, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iCol', this.aCol);
    geo.setAttribute('iCut', this.aCut);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.mesh.layers.set(LAYER_FX);
    scene.add(this.mesh);
  }

  /**
   * o: { pos, quat, size, life, delay=0, vel, spin (rad/s about its own axis), grow (s to full size),
   *      fade (s), color (tint, hex), cut (0.25 thin .. 0.6 fat), orbit: { c, w, r, dr, y },
   *      hit, r (hit radius), group }  -- pos/vel/quat are copied.
   */
  spawn(o) {
    if (this.list.length >= MAX) this.list.shift();
    const c = {
      pos: o.pos.clone(),
      vel: o.vel ? o.vel.clone() : null,
      quat: o.quat ? o.quat.clone() : new THREE.Quaternion(),
      size: o.size ?? 0.6,
      life: o.life ?? 0.6,
      delay: o.delay ?? 0,
      age: 0,
      spin: o.spin ?? 0,
      grow: o.grow ?? 0.08,
      fade: o.fade ?? 0.2,
      color: _col.set(o.color ?? 0xffe6a8).toArray(),
      cut: o.cut ?? 0.42,
      orbit: o.orbit || null,
      hit: o.hit || null,
      r: o.r ?? (o.size ?? 0.6) * 0.7,
      group: o.group || null,
      hitSet: null,
      done: false,
      sparkT: Math.random() * 0.2,
    };
    this.list.push(c);
    return c;
  }

  /** Live and past its delay (drawn, and able to cut) and not yet fading out. */
  static cutting(c) {
    const t = c.age - c.delay;
    return t >= 0.02 && t <= c.life - c.fade * 0.5;
  }

  update(dt) {
    const L = this.list;
    let n = 0;
    for (let i = 0; i < L.length; i++) {
      const c = L[i];
      c.age += dt;
      const t = c.age - c.delay;
      if (t > c.life || c.done) continue;
      L[n++] = c;
      if (t < 0) continue;
      if (c.orbit) {
        const o = c.orbit;
        o.a = (o.a ?? 0) + o.w * dt;
        o.r += (o.dr ?? 0) * dt;
        c.pos.set(o.c.x + Math.cos(o.a) * o.r, o.y ?? c.pos.y, o.c.z + Math.sin(o.a) * o.r);
      } else if (c.vel) c.pos.addScaledVector(c.vel, dt);
      if (c.spin) c.quat.multiply(_q.setFromAxisAngle(_z, c.spin * dt));
      c.sparkT -= dt;
      if (c.sparkT <= 0 && this.fx && t < c.life - c.fade) {
        c.sparkT = 0.09 + Math.random() * 0.12;
        _col.setRGB(1, 0.92, 0.7);
        this.fx.particles.add.emit({ pos: c.pos, vel: _v.set((Math.random() - 0.5) * 1.2, Math.random() * 0.8, (Math.random() - 0.5) * 1.2), color: _col, size: 0.05 + c.size * 0.06, shape: SHAPE.STAR, life: 0.25, drag: 2, rot: Math.random() * 3 });
      }
    }
    L.length = n;
    // draw
    let k = 0;
    for (const c of L) {
      const t = c.age - c.delay;
      if (t < 0) continue;
      const g = c.grow > 0 ? Math.min(1, t / c.grow) : 1;
      const sc = c.size * (1 - (1 - g) * (1 - g));
      _s.setScalar(Math.max(0.001, sc));
      _m.compose(c.pos, c.quat, _s);
      this.mesh.setMatrixAt(k, _m);
      const fin = Math.min(1, t / 0.04);
      const fout = Math.min(1, (c.life - t) / Math.max(0.01, c.fade));
      this.cols[k * 4] = c.color[0];
      this.cols[k * 4 + 1] = c.color[1];
      this.cols[k * 4 + 2] = c.color[2];
      this.cols[k * 4 + 3] = Math.max(0, fin * fout);
      this.cuts[k] = c.cut;
      k++;
    }
    this.mesh.count = k;
    // (only the live instances go up to the card, and nothing at all while the air is clear)
    if (k) {
      for (const a of [this.mesh.instanceMatrix, this.aCol, this.aCut]) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, k * a.itemSize);
        a.needsUpdate = true;
      }
    }
  }

  /** Retire every crescent of a group (or all of them) at once, fading. */
  cancel(group = null) {
    for (const c of this.list) {
      if (group && c.group !== group) continue;
      const t = c.age - c.delay;
      if (t < 0) c.done = true;
      else c.life = Math.min(c.life, t + c.fade);
      c.hit = null;
    }
  }

  clear() {
    this.list.length = 0;
    this.mesh.count = 0;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
