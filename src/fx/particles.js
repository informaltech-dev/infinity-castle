import * as THREE from 'three';
import { LAYER_FX } from '../render/pipeline.js';

// Shape ids used by the fragment shader
export const SHAPE = { GLOW: 0, DROP: 1, STREAK: 2, ASH: 3, SMOKE: 4, STAR: 5, RING: 6, EMBER: 7, PETAL: 8 };

const vert = /* glsl */ `
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec4 iCol;
attribute vec4 iMisc; // x: width, y: height, z: rotation, w: shape
attribute vec2 iLife; // x: age01, y: stretch
varying vec2 vUv;
varying vec4 vCol;
varying float vShape;
varying float vAge;
varying float vSeed;
void main() {
  vUv = uv;
  vCol = iCol;
  vShape = iMisc.w;
  vAge = iLife.x;
  vSeed = fract(iPos.x * 13.1 + iPos.z * 7.7);
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  vec2 q = position.xy;
  float w = iMisc.x, h = iMisc.y;
  if (iLife.y > 0.0) {
    // velocity-aligned streak in view space
    vec3 vv = (viewMatrix * vec4(iVel, 0.0)).xyz;
    vec2 d = vv.xy;
    float sp = length(d);
    vec2 dir = sp > 1e-4 ? d / sp : vec2(0.0, 1.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    float len = h + sp * iLife.y;
    vec2 off = dir * q.y * len + nrm * q.x * w;
    mv.xy += off;
  } else {
    float c = cos(iMisc.z), s = sin(iMisc.z);
    vec2 r = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
    mv.xy += r * vec2(w, h);
  }
  gl_Position = projectionMatrix * mv;
}
`;

const frag = /* glsl */ `
varying vec2 vUv;
varying vec4 vCol;
varying float vShape;
varying float vAge;
varying float vSeed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  int shape = int(vShape + 0.5);
  float a = 0.0;
  vec3 col = vCol.rgb;
  if (shape == 0) {
    a = pow(max(0.0, 1.0 - r), 2.0);
  } else if (shape == 1) {
    // anime droplet: white core, coloured body, dark ink rim
    float body = 1.0 - smoothstep(0.78, 0.86, r);
    float rim = smoothstep(0.62, 0.72, r) * body;
    float hl = 1.0 - smoothstep(0.0, 0.28, length(p - vec2(-0.28, 0.3)));
    col = mix(col, vec3(1.0), hl * 0.9);
    col = mix(col, col * 0.25, rim);
    a = body;
  } else if (shape == 2) {
    float core = 1.0 - smoothstep(0.0, 1.0, abs(p.x));
    float along = smoothstep(1.0, 0.2, abs(p.y));
    a = core * along;
    col = mix(col, vec3(1.0), core * core * 0.6);
  } else if (shape == 3) {
    float n = noise(vUv * 5.0 + vSeed * 17.0);
    float d = max(abs(p.x), abs(p.y)) + n * 0.5;
    a = 1.0 - smoothstep(0.75, 0.85, d);
  } else if (shape == 4) {
    float n = noise(vUv * 3.0 + vSeed * 9.0 + vAge * 1.5) * 0.45 + noise(vUv * 7.0 - vSeed * 3.0) * 0.2;
    a = smoothstep(1.0, 0.35, r + n * 0.6);
  } else if (shape == 5) {
    float s = max(0.0, 1.0 - abs(p.x) * 7.0 - abs(p.y) * 0.9) + max(0.0, 1.0 - abs(p.y) * 7.0 - abs(p.x) * 0.9);
    a = clamp(s, 0.0, 1.0) + pow(max(0.0, 1.0 - r), 6.0);
    col = mix(col, vec3(1.0), 0.5);
  } else if (shape == 6) {
    a = smoothstep(0.62, 0.8, r) * (1.0 - smoothstep(0.86, 1.0, r));
  } else if (shape == 7) {
    a = pow(max(0.0, 1.0 - r), 1.5);
    col = mix(col, vec3(1.0, 0.95, 0.7), pow(max(0.0, 1.0 - r * 2.0), 2.0));
  } else {
    // petal / flame lick: teardrop
    vec2 q = p;
    q.y += 0.3;
    float d = length(vec2(q.x * (1.4 + q.y), q.y * 0.8));
    a = 1.0 - smoothstep(0.7, 0.85, d);
  }
  a *= vCol.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}
`;

class Pool {
  constructor(max, blending, renderOrder) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.col0 = new Float32Array(max * 4);
    this.misc = new Float32Array(max * 4);
    this.size0 = new Float32Array(max * 2);
    this.life = new Float32Array(max * 2);
    this.age = new Float32Array(max);
    this.maxAge = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.fadeIn = new Float32Array(max);
    this.floor = new Float32Array(max);

    const g = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute('position', quad.attributes.position);
    g.setAttribute('uv', quad.attributes.uv);
    const mk = (arr, n) => {
      const a = new THREE.InstancedBufferAttribute(arr, n);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.aPos = mk(this.pos, 3);
    this.aVel = mk(this.vel, 3);
    this.aCol = mk(this.col, 4);
    this.aMisc = mk(this.misc, 4);
    this.aLife = mk(this.life, 2);
    g.setAttribute('iPos', this.aPos);
    g.setAttribute('iVel', this.aVel);
    g.setAttribute('iCol', this.aCol);
    g.setAttribute('iMisc', this.aMisc);
    g.setAttribute('iLife', this.aLife);
    g.instanceCount = 0;
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.layers.set(LAYER_FX);
  }

  emit(o) {
    if (this.count >= this.max) this._kill(0);
    const i = this.count++;
    const p = o.pos, v = o.vel;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v ? v.x : 0; this.vel[i * 3 + 1] = v ? v.y : 0; this.vel[i * 3 + 2] = v ? v.z : 0;
    const c = o.color;
    this.col0[i * 4] = c.r; this.col0[i * 4 + 1] = c.g; this.col0[i * 4 + 2] = c.b; this.col0[i * 4 + 3] = o.alpha ?? 1;
    this.size0[i * 2] = o.w ?? o.size ?? 0.1;
    this.size0[i * 2 + 1] = o.h ?? o.size ?? 0.1;
    this.misc[i * 4 + 2] = o.rot ?? Math.random() * 6.283;
    this.misc[i * 4 + 3] = o.shape ?? 0;
    this.life[i * 2 + 1] = o.stretch ?? 0;
    this.age[i] = 0;
    this.maxAge[i] = o.life ?? 0.6;
    this.drag[i] = o.drag ?? 1.5;
    this.grav[i] = o.gravity ?? 0;
    this.grow[i] = o.grow ?? 0;
    this.spin[i] = o.spin ?? 0;
    this.fadeIn[i] = o.fadeIn ?? 0;
    this.floor[i] = o.floor ?? -999;
  }

  _kill(i) {
    const j = --this.count;
    if (i === j) return;
    this.pos.copyWithin(i * 3, j * 3, j * 3 + 3);
    this.vel.copyWithin(i * 3, j * 3, j * 3 + 3);
    this.col0.copyWithin(i * 4, j * 4, j * 4 + 4);
    this.misc.copyWithin(i * 4, j * 4, j * 4 + 4);
    this.size0.copyWithin(i * 2, j * 2, j * 2 + 2);
    this.life.copyWithin(i * 2, j * 2, j * 2 + 2);
    this.age[i] = this.age[j];
    this.maxAge[i] = this.maxAge[j];
    this.drag[i] = this.drag[j];
    this.grav[i] = this.grav[j];
    this.grow[i] = this.grow[j];
    this.spin[i] = this.spin[j];
    this.fadeIn[i] = this.fadeIn[j];
    this.floor[i] = this.floor[j];
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.maxAge[i]) {
        this._kill(i);
        i--;
        continue;
      }
      const t = this.age[i] / this.maxAge[i];
      const d = Math.exp(-this.drag[i] * dt);
      const i3 = i * 3;
      this.vel[i3] *= d;
      this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.grav[i] * dt;
      this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < this.floor[i]) {
        this.pos[i3 + 1] = this.floor[i];
        this.vel[i3 + 1] *= -0.3;
        this.vel[i3] *= 0.6;
        this.vel[i3 + 2] *= 0.6;
      }
      const g = 1 + this.grow[i] * t;
      this.misc[i * 4] = this.size0[i * 2] * g;
      this.misc[i * 4 + 1] = this.size0[i * 2 + 1] * g;
      this.misc[i * 4 + 2] += this.spin[i] * dt;
      const fi = this.fadeIn[i] > 0 ? Math.min(1, t / this.fadeIn[i]) : 1;
      const fade = (1 - t) * (1 - t * 0.3) * fi;
      const i4 = i * 4;
      this.col[i4] = this.col0[i4];
      this.col[i4 + 1] = this.col0[i4 + 1];
      this.col[i4 + 2] = this.col0[i4 + 2];
      this.col[i4 + 3] = this.col0[i4 + 3] * fade;
      this.life[i * 2] = t;
    }
    this.geo.instanceCount = this.count;
    const n = this.count;
    for (const a of [this.aPos, this.aVel, this.aCol, this.aMisc, this.aLife]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
  }
}

const _v = new THREE.Vector3();
const _c = new THREE.Color();

export class Particles {
  constructor(scene) {
    this.add = new Pool(2500, THREE.AdditiveBlending, 12);
    this.alpha = new Pool(2500, THREE.NormalBlending, 11);
    scene.add(this.add.mesh, this.alpha.mesh);
  }

  update(dt) {
    this.add.update(dt);
    this.alpha.update(dt);
  }

  clear() {
    this.add.count = 0;
    this.alpha.count = 0;
  }

  /** Low level emit: o.additive chooses the pool. */
  emit(o) {
    (o.additive ? this.add : this.alpha).emit(o);
  }

  // ------------------------------------------------------------------ presets
  sparks(pos, dir, n = 14, color = 0xfff1c0, speed = 11, spread = 0.9) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      _v.set(dir.x + (Math.random() - 0.5) * spread * 2, dir.y + (Math.random() - 0.3) * spread * 1.6, dir.z + (Math.random() - 0.5) * spread * 2).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      this.add.emit({ pos, vel: _v, color: _c, w: 0.02 + Math.random() * 0.02, h: 0.05, shape: SHAPE.STREAK, stretch: 0.035, life: 0.18 + Math.random() * 0.22, drag: 4, gravity: 6 });
    }
  }

  droplets(pos, dir, n = 16, color = 0x5ab4ff, speed = 6, size = 0.08) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      _v.set(dir.x + (Math.random() - 0.5) * 1.6, dir.y + Math.random() * 1.2, dir.z + (Math.random() - 0.5) * 1.6).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.9));
      const s = size * (0.5 + Math.random());
      this.alpha.emit({ pos, vel: _v, color: _c, size: s, shape: SHAPE.DROP, life: 0.5 + Math.random() * 0.5, drag: 1.2, gravity: 11, floor: 0.02 });
    }
  }

  embers(pos, n = 16, color = 0xff8a2a, speed = 3, spread = 1) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      _v.set((Math.random() - 0.5) * spread * 2, Math.random() * 1.2 + 0.4, (Math.random() - 0.5) * spread * 2).multiplyScalar(speed * (0.4 + Math.random()));
      this.add.emit({ pos: _v2.copy(pos).add(_v3.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3)), vel: _v, color: _c, size: 0.03 + Math.random() * 0.05, shape: SHAPE.EMBER, life: 0.6 + Math.random() * 0.8, drag: 1.5, gravity: -1.5 });
    }
  }

  flash(pos, color = 0xffffff, size = 1.2, life = 0.12) {
    _c.set(color);
    this.add.emit({ pos, color: _c, size, shape: SHAPE.GLOW, life, drag: 0 });
    this.add.emit({ pos, color: _c, size: size * 1.4, shape: SHAPE.STAR, life: life * 0.9, drag: 0, rot: Math.random() * 3 });
  }

  ring(pos, color = 0xffffff, size = 0.6, grow = 3, life = 0.25) {
    _c.set(color);
    this.add.emit({ pos, color: _c, size, shape: SHAPE.RING, life, grow, drag: 0 });
  }

  smoke(pos, n = 8, color = 0x201818, size = 0.6, speed = 1.2, life = 1.0) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      _v.set((Math.random() - 0.5) * 2, Math.random() * 0.8, (Math.random() - 0.5) * 2).multiplyScalar(speed);
      this.alpha.emit({ pos: _v2.copy(pos).add(_v3.set((Math.random() - 0.5) * 0.6, Math.random() * 0.5, (Math.random() - 0.5) * 0.6)), vel: _v, color: _c, size: size * (0.6 + Math.random() * 0.8), alpha: 0.7, shape: SHAPE.SMOKE, life: life * (0.7 + Math.random() * 0.6), drag: 2, grow: 1.5, fadeIn: 0.15, spin: (Math.random() - 0.5) * 1.5 });
    }
  }

  ash(pos, n = 10, color = 0x1a1414, spread = 0.4) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      _v.set((Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 1.6, (Math.random() - 0.5) * 1.2);
      this.alpha.emit({ pos: _v2.copy(pos).add(_v3.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)), vel: _v, color: _c, size: 0.03 + Math.random() * 0.06, shape: SHAPE.ASH, life: 1.2 + Math.random() * 1.2, drag: 1.4, gravity: -0.4, spin: (Math.random() - 0.5) * 8 });
    }
  }

  debris(pos, n = 12, color = 0x5a3a24, speed = 7) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      _v.set((Math.random() - 0.5) * 1.4, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * 1.4).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      this.alpha.emit({ pos, vel: _v, color: _c, size: 0.06 + Math.random() * 0.1, shape: SHAPE.ASH, life: 0.9 + Math.random() * 0.6, drag: 0.6, gravity: 16, spin: (Math.random() - 0.5) * 14, floor: 0.03 });
    }
  }
}
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
