import * as THREE from 'three';
import { Particles, SHAPE } from './particles.js';
import { Effects } from './effects.js';
import { Lighting } from '../render/materials.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _c = new THREE.Color();

class LightPool {
  constructor() {
    this.lights = [];
  }
  add(pos, color, intensity, range, life) {
    this.lights.push({ pos: pos.clone(), color: new THREE.Color(color), intensity, range, life, age: 0 });
    if (this.lights.length > 16) this.lights.shift();
  }
  update(dt, camPos) {
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      l.age += dt;
      if (l.age >= l.life) this.lights.splice(i, 1);
    }
    // choose the 4 strongest (by intensity and proximity to the camera)
    const sorted = this.lights
      .map((l) => ({ l, w: l.intensity * (1 - l.age / l.life) / (1 + (camPos ? l.pos.distanceTo(camPos) * 0.05 : 0)) }))
      .sort((a, b) => b.w - a.w);
    for (let i = 0; i < 4; i++) {
      const s = sorted[i];
      if (s) {
        const f = 1 - s.l.age / s.l.life;
        Lighting.uPointPos.value[i].copy(s.l.pos);
        Lighting.uPointColor.value[i].copy(s.l.color).multiplyScalar(s.l.intensity * f * f);
        Lighting.uPointRange.value[i] = s.l.range;
      } else {
        Lighting.uPointColor.value[i].setRGB(0, 0, 0);
      }
    }
  }
  clear() {
    this.lights.length = 0;
  }
}

/** Drives the full-screen post effects on the pipeline. Uses real (unscaled) time. */
export class ScreenFX {
  constructor(pipeline) {
    this.p = pipeline;
    this.impactT = 0;
    this.impactLen = 0;
    this.impactA = new THREE.Color(0x0a0608);
    this.impactB = new THREE.Color(0xf6efe2);
    this.flashV = 0;
    this.flashDecay = 8;
    this.speedV = 0;
    this.speedHold = 0;
    this.radialV = 0;
    this.chromaV = 0;
    this.desat = 0;
    this.desatTarget = 0;
    this.tint = new THREE.Color(1, 1, 1);
    this.tintTarget = new THREE.Color(1, 1, 1);
    this.rippleT = -1;
    this.rippleLen = 0;
    this.frame = 0;
    this.danger = 0;
    this.shakeScale = 1;
    this.exposure = 1;
  }
  impact(len = 0.12, a = 0x0a0608, b = 0xf6efe2) {
    this.impactT = len;
    this.impactLen = len;
    this.impactA.set(a);
    this.impactB.set(b);
  }
  flash(color = 0xffffff, amount = 0.6, decay = 8) {
    this.p.fx.uFlashColor.value.set(color);
    this.flashV = Math.max(this.flashV, amount);
    this.flashDecay = decay;
  }
  speed(amount = 1, hold = 0.2, center = null) {
    this.speedV = Math.max(this.speedV, amount);
    this.speedHold = Math.max(this.speedHold, hold);
    if (center) this.p.fx.uSpeedCenter.value.copy(center);
    else this.p.fx.uSpeedCenter.value.set(0.5, 0.5);
  }
  radial(amount = 0.5, center = null) {
    this.radialV = Math.max(this.radialV, amount);
    if (center) this.p.fx.uRadialCenter.value.copy(center);
    else this.p.fx.uRadialCenter.value.set(0.5, 0.5);
  }
  chroma(amount = 0.6) {
    this.chromaV = Math.max(this.chromaV, amount);
  }
  /** Let a running ripple die out quickly. */
  endRipple() {
    if (this.rippleT >= 0) this.rippleT = Math.max(this.rippleT, this.rippleLen * 0.9);
  }
  ripple(len = 2.5, center = null) {
    this.rippleT = 0;
    this.rippleLen = len;
    if (center) this.p.fx.uRippleCenter.value.copy(center);
  }
  update(dt) {
    const fx = this.p.fx;
    this.frame++;
    if (this.impactT > 0) {
      this.impactT -= dt;
      fx.uImpact.value = 1;
      fx.uImpactSeed.value = Math.floor(this.frame / 2);
      fx.uImpactA.value.copy(this.impactA);
      fx.uImpactB.value.copy(this.impactB);
    } else fx.uImpact.value = 0;
    this.flashV = Math.max(0, this.flashV - dt * this.flashDecay * Math.max(this.flashV, 0.2));
    fx.uFlash.value = this.flashV;
    if (this.speedHold > 0) this.speedHold -= dt;
    else this.speedV = Math.max(0, this.speedV - dt * 4);
    fx.uSpeed.value = this.speedV;
    this.radialV = Math.max(0, this.radialV - dt * 3.5);
    fx.uRadial.value = this.radialV;
    this.chromaV = Math.max(0, this.chromaV - dt * 3);
    fx.uChroma.value = this.chromaV;
    this.desat += (this.desatTarget - this.desat) * Math.min(1, dt * 6);
    fx.uDesat.value = this.desat;
    this.tint.lerp(this.tintTarget, Math.min(1, dt * 5));
    fx.uTint.value.copy(this.tint);
    if (this.rippleT >= 0) {
      this.rippleT += dt;
      const k = this.rippleT / this.rippleLen;
      fx.uRipple.value = k < 1 ? Math.sin(Math.min(1, k * 4) * Math.PI * 0.5) * (1 - k) : 0;
      fx.uRippleTime.value = this.rippleT;
      if (k >= 1) this.rippleT = -1;
    }
    fx.uDanger.value = this.danger;
    fx.uExposure.value += (this.exposure - fx.uExposure.value) * Math.min(1, dt * 6);
  }
  reset() {
    this.impactT = 0;
    this.flashV = 0;
    this.speedV = 0;
    this.speedHold = 0;
    this.radialV = 0;
    this.chromaV = 0;
    this.desat = this.desatTarget = 0;
    this.tintTarget.setRGB(1, 1, 1);
    this.rippleT = -1;
    this.p.fx.uRipple.value = 0;
    this.danger = 0;
    this.exposure = 1;
  }
}

const STYLE_COL = {
  steel: 0xfff4d6,
  water: 0x6ec8ff,
  fire: 0xff8a2a,
  calm: 0xd8f4ff,
  demon: 0xff4a6a,
  akaza: 0x7fe6ff,
  serpent: 0xc6a4ff,
};

export class FX {
  constructor(scene, textures, pipeline) {
    this.scene = scene;
    this.T = textures || {};
    this.particles = new Particles(scene);
    this.effects = new Effects(scene, this.T);
    this.lights = new LightPool();
    this.screen = new ScreenFX(pipeline);
    this.time = 0;
  }

  update(dt, realDt, camPos) {
    this.time += dt;
    this.particles.update(dt);
    this.effects.update(dt);
    this.lights.update(dt, camPos);
    this.screen.update(realDt);
  }

  clear() {
    this.particles.clear();
    this.effects.clear();
    this.lights.clear();
    this.screen.reset();
  }

  light(pos, color, intensity = 2, range = 6, life = 0.25) {
    this.lights.add(pos, color, intensity, range, life);
  }

  /** The anime "cut" line across a target + sparks + flash. dir: slash travel direction (world). */
  hit(pos, dir, { style = 'steel', power = 0.5, crit = false, blunt = false, cutDir = null } = {}) {
    const col = STYLE_COL[style] ?? STYLE_COL.steel;
    const P = this.particles;
    _v.copy(dir).normalize();
    if (!blunt) {
      // bright cut line
      const cd = cutDir ? _v2.copy(cutDir).normalize() : _v2.set(-_v.z, 0.35, _v.x).normalize();
      _c.set(0xffffff);
      P.add.emit({ pos, vel: cd.clone().multiplyScalar(0.001), color: _c, w: 0.05 + power * 0.05, h: 2.0 + power * 1.8, shape: SHAPE.STREAK, stretch: 1e-4, life: 0.1 + power * 0.06, drag: 0 });
      // cross line (rotated) for strong hits
      if (power > 0.6 || crit) {
        const cd2 = _v2.set(cd.x, -cd.y, cd.z).cross(_v).normalize();
        P.add.emit({ pos, vel: cd2.multiplyScalar(0.001), color: _c.set(col), w: 0.04, h: 1.6 + power, shape: SHAPE.STREAK, stretch: 1e-4, life: 0.1, drag: 0 });
      }
    }
    P.flash(pos, crit ? 0xffffff : col, 0.7 + power * 1.1, 0.1 + power * 0.05);
    P.sparks(pos, _v, Math.round(8 + power * 16), blunt ? 0xffffff : col, 8 + power * 8, 0.8);
    if (style === 'water') {
      P.droplets(pos, _v, Math.round(10 + power * 18), 0x4fb3e8, 4 + power * 4, 0.07 + power * 0.04);
      if (power > 0.35) this.effects.sprite(pos, { tex: 'splash', size: 0.5 + power * 0.9, life: 0.32, rot: Math.random() * 6.28, grow: 0.7, alpha: 0.9 });
    } else if (style === 'fire') {
      P.embers(pos, Math.round(12 + power * 20), 0xff8a2a, 3 + power * 3, 0.8);
      if (power > 0.35) this.effects.sprite(pos, { tex: 'flame', size: 0.5 + power * 0.9, life: 0.35, grow: 0.6, rise: 1.5, additive: true, add: 0.5 });
    } else if (style === 'serpent') {
      P.sparks(pos, _v, Math.round(6 + power * 10), 0xf2eaff, 10 + power * 6, 0.6);
      if (power > 0.35) this.effects.sprite(pos, { tex: 'splash', size: 0.4 + power * 0.7, life: 0.26, rot: Math.random() * 6.28, grow: 0.8, color: 0xc6a4ff, alpha: 0.75 });
    } else if (style === 'demon') {
      P.sparks(pos, _v, 8, 0xff3050, 7, 1.2);
    }
    if (blunt || power > 0.7) this.effects.ring(pos, { color: col, from: 0.2, to: 1.2 + power * 1.5, life: 0.25, normal: _v, thick: 0.2 });
    // dark demon blood-ash puff
    if (!blunt && style !== 'akaza') P.ash(pos, Math.round(3 + power * 6), 0x2a0e12, 0.2);
    this.light(pos, col, 0.9 + power * 1.4, 2.5 + power * 2.5, 0.14 + power * 0.08);
  }

  /** Big ground impact: ring, cracks, debris, dust. */
  ground(pos, { size = 3, color = 0xfff0d8, crack = true, dust = true, life = 8 } = {}) {
    const p = _v.set(pos.x, 0.05, pos.z);
    this.effects.ring(p.clone(), { color, from: 0.3, to: size * 1.4, life: 0.5, thick: 0.18 });
    this.effects.ring(p.clone(), { color: 0xffffff, from: 0.2, to: size * 0.8, life: 0.3, thick: 0.35 });
    if (crack) this.effects.decal(p, { kind: 'crack', size: size * 1.2, life, rot: Math.random() * 6.28, alpha: 0.95, fadeIn: 0.02 });
    this.particles.debris(p.clone().setY(0.2), Math.round(10 + size * 4), 0x5a3a24, 5 + size * 1.5);
    if (dust) this.particles.smoke(p.clone(), Math.round(6 + size * 2), 0x3a2e2a, 0.7 + size * 0.15, 2 + size * 0.4, 1.1);
    this.light(p.clone().setY(0.6), color, 3, size * 3, 0.25);
  }

  spawnSmoke(pos) {
    this.particles.smoke(pos, 14, 0x120c10, 0.9, 1.8, 1.3);
    this.particles.smoke(pos, 6, 0x3a0a18, 0.6, 1.2, 0.9);
    this.effects.ring(_v.set(pos.x, 0.05, pos.z), { color: 0x7a1030, from: 0.2, to: 2.5, life: 0.6, additive: false, alpha: 0.6 });
  }

  /** Emit ash from random points of a model (call repeatedly while it dissolves). */
  ashFrom(model, n = 4) {
    const meshes = model.rig.meshes;
    for (let i = 0; i < n; i++) {
      const m = meshes[(Math.random() * meshes.length) | 0];
      if (!m || !m.visible) continue;
      m.getWorldPosition(_v);
      _v.x += (Math.random() - 0.5) * 0.25;
      _v.y += (Math.random() - 0.5) * 0.25;
      _v.z += (Math.random() - 0.5) * 0.25;
      this.particles.ash(_v, 2, Math.random() < 0.3 ? 0x5a2a1a : 0x161212, 0.1);
      if (Math.random() < 0.3) this.particles.embers(_v, 1, 0xff5a20, 0.8, 0.4);
    }
  }
}
