import * as THREE from 'three';
import { toonMaterial } from '../render/materials.js';
import { LAYER_MAIN_ONLY } from '../render/pipeline.js';
import { merge } from '../render/geo.js';
import { mulberry32, clamp, ease } from '../core/math.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Geometry bucket builder: collects transformed geometries per material key and merges them.
// ---------------------------------------------------------------------------
class Builder {
  constructor(mats) {
    this.mats = mats;
    this.buckets = new Map();
  }
  push(key, geo, pos, rot = [0, 0, 0], scale) {
    _e.set(rot[0], rot[1], rot[2], 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(pos[0], pos[1], pos[2]), _q, scale ? _s.set(scale[0], scale[1], scale[2]) : _s.set(1, 1, 1));
    const g = geo.clone();
    g.applyMatrix4(_m);
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    this.buckets.get(key).push(g);
  }
  box(key, w, h, d, pos, rot) {
    this.push(key, new THREE.BoxGeometry(w, h, d), pos, rot);
  }
  build(group, layer = 0) {
    for (const [key, geos] of this.buckets) {
      if (!geos.length) continue;
      // chunk huge buckets so merged meshes stay reasonable
      for (let i = 0; i < geos.length; i += 400) {
        const g = merge(geos.slice(i, i + 400));
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, this.mats[key]);
        mesh.layers.set(layer);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        group.add(mesh);
      }
    }
    this.buckets.clear();
    return group;
  }
}

function makeMaterials(T) {
  const t = (k) => (T && T[k]) || undefined;
  const M = {
    floor: toonMaterial({ color: t('woodFloor') ? 0xffffff : 0x7a5134, map: t('woodFloor'), worldUV: 1 / 3, shade: 0x8a6a7a, rim: 0.1, paint: 0.03 }),
    darkWood: toonMaterial({ color: t('woodDark') ? 0xffffff : 0x2e1d14, map: t('woodDark'), worldUV: 1 / 1.6, shade: 0x7a6a8a, rim: 0.15 }),
    pillar: toonMaterial({ color: t('pillarRed') ? 0xffffff : 0x9b2a1e, map: t('pillarRed'), worldUV: 1 / 2, shade: 0x8a4a6a, rim: 0.3 }),
    shoji: toonMaterial({ color: t('shoji') ? 0xffffff : 0xf0dcb0, map: t('shoji'), shade: 0xd8b8a0, glow: 0.9, rim: 0, fog: true }),
    shojiDim: toonMaterial({ color: t('shoji') ? 0xc0a890 : 0xa89070, map: t('shoji'), shade: 0xa08878, glow: 0.35, rim: 0 }),
    fusuma1: toonMaterial({ color: 0xffffff, map: t('fusuma1'), shade: 0xa89090, glow: 0.1 }),
    fusuma2: toonMaterial({ color: 0xffffff, map: t('fusuma2'), shade: 0xa89090, glow: 0.05 }),
    fusuma3: toonMaterial({ color: 0xffffff, map: t('fusuma3'), shade: 0xa89090, glow: 0.1 }),
    roof: toonMaterial({ color: t('roofTiles') ? 0xffffff : 0x3b4150, map: t('roofTiles'), worldUV: 1 / 2, shade: 0x7a7a9a, rim: 0.2 }),
    plaster: toonMaterial({ color: t('plaster') ? 0xffffff : 0xe8dcc4, map: t('plaster'), worldUV: 1 / 3, shade: 0x9a8a9a }),
    tatami: toonMaterial({ color: 0xffffff, map: t('tatami'), shade: 0x8a8a7a, rim: 0.05 }),
    lantern: toonMaterial({ color: t('lantern') ? 0xffffff : 0xd8452a, map: t('lantern'), glow: 1.6, shade: 0xffffff, rim: 0, unlit: false }),
    lanternCap: toonMaterial({ color: 0x1a1210, shade: 0x6a5a6a }),
    gold: toonMaterial({ color: 0xc9a45c, shade: 0x8a6a5a, spec: 0.5, rim: 0.3 }),
    glowWarm: toonMaterial({ color: 0xffc27a, unlit: true, emissive: 0x552200 }),
  };
  for (const k of ['fusuma1', 'fusuma2', 'fusuma3', 'tatami']) if (!t(k === 'tatami' ? 'tatami' : k)) M[k].uniforms.uColor.value.set(k === 'tatami' ? 0xb5b36a : 0xc9a45c);
  return M;
}

// Void sky: gradient dome with a faint warm glow band
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform float uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        float y = vDir.y;
        vec3 top = vec3(0.035, 0.02, 0.05);
        vec3 mid = vec3(0.12, 0.05, 0.06);
        vec3 bot = vec3(0.01, 0.005, 0.012);
        vec3 c = y > 0.0 ? mix(mid, top, smoothstep(0.0, 0.6, y)) : mix(mid, bot, smoothstep(0.0, 0.5, -y));
        // faint drifting haze
        float a = atan(vDir.z, vDir.x);
        float band = sin(a * 3.0 + uTime * 0.05) * 0.5 + 0.5;
        c += vec3(0.05, 0.02, 0.01) * band * exp(-abs(y) * 6.0);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  m.layers.set(LAYER_MAIN_ONLY);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

// Distant lit windows scattered on a far shell (instanced)
function makeFarWindows(rnd, count = 1400) {
  const geo = new THREE.PlaneGeometry(0.7, 1.1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffb870, transparent: true, opacity: 0.45, depthWrite: false, fog: false });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const d = new THREE.Object3D();
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = rnd() * Math.PI * 2;
    const v = (rnd() - 0.5) * 1.6;
    const r = 220 + rnd() * 150;
    d.position.set(Math.cos(u) * Math.cos(v) * r, Math.sin(v) * r * 0.8, Math.sin(u) * Math.cos(v) * r);
    d.lookAt(0, d.position.y * 0.5, 0);
    const s = 0.6 + rnd() * 1.2;
    d.scale.set(s, s * (0.8 + rnd() * 0.6), 1);
    d.updateMatrix();
    inst.setMatrixAt(i, d.matrix);
    col.setHSL(0.07 + rnd() * 0.04, 0.85, 0.2 + rnd() * 0.25);
    inst.setColorAt(i, col);
  }
  inst.layers.set(LAYER_MAIN_ONLY);
  inst.frustumCulled = false;
  return inst;
}

// ---------------------------------------------------------------------------
// Castle pieces
// ---------------------------------------------------------------------------
function shojiWall(B, x0, x1, z, y0, floors, facing, opts = {}) {
  // wall spanning x0..x1 along X at depth z, facing +1 (toward -z... we rotate per facing)
  const panelW = 1.6;
  const n = Math.max(1, Math.round((x1 - x0) / panelW));
  const w = (x1 - x0) / n;
  for (let f = 0; f < floors; f++) {
    const h = f === 0 ? opts.groundH ?? 2.8 : 2.4;
    const y = y0 + (f === 0 ? 0 : (opts.groundH ?? 2.8) + (f - 1) * 3.2 + 0.4);
    for (let i = 0; i < n; i++) {
      const cx = x0 + w * (i + 0.5);
      const key = f === 0 && opts.fusuma ? ['fusuma1', 'fusuma2', 'fusuma3'][(i + f) % 3] : (i + f) % 5 === 2 ? 'shojiDim' : 'shoji';
      B.box(key, w - 0.08, h - 0.1, 0.06, rot2(cx, y + h / 2, z, facing), [0, facing, 0]);
      // vertical posts
      B.box('darkWood', 0.12, h, 0.14, rot2(x0 + w * i, y + h / 2, z + 0.02 * 0, facing), [0, facing, 0]);
    }
    B.box('darkWood', 0.12, h, 0.14, rot2(x1, y + h / 2, z, facing), [0, facing, 0]);
    // lintel & sill
    B.box('darkWood', x1 - x0 + 0.2, 0.18, 0.2, rot2((x0 + x1) / 2, y + h + 0.05, z, facing), [0, facing, 0]);
    B.box('darkWood', x1 - x0 + 0.2, 0.12, 0.22, rot2((x0 + x1) / 2, y + 0.04, z, facing), [0, facing, 0]);
    // balcony + eave for upper floors
    if (f > 0 || opts.eaveGround) {
      const ey = y + h + 0.35;
      B.push('roof', eaveGeo(x1 - x0 + 1.2, 1.3), rot2((x0 + x1) / 2, ey, z + 0.0, facing), [0, facing, 0]);
    }
    if (f > 0) {
      // balcony floor + railing
      B.box('darkWood', x1 - x0, 0.14, 1.0, rot2((x0 + x1) / 2, y - 0.1, z - 0.5, facing), [0, facing, 0]);
      B.box('darkWood', x1 - x0, 0.08, 0.08, rot2((x0 + x1) / 2, y + 0.85, z - 0.95, facing), [0, facing, 0]);
      for (let i = 0; i <= n * 2; i++) {
        B.box('darkWood', 0.05, 0.85, 0.05, rot2(x0 + (i * w) / 2, y + 0.42, z - 0.95, facing), [0, facing, 0]);
      }
    }
  }
}

/** Rotate a point around the origin (Y axis) by `facing` (radians): walls are authored along X at depth z. */
function rot2(x, y, z, facing) {
  const c = Math.cos(facing), s = Math.sin(facing);
  return [x * c + z * s, y, -x * s + z * c];
}

function eaveGeo(w, d) {
  // sloped roof strip: slopes down away from the wall (toward -z)
  const g = new THREE.BoxGeometry(w, 0.12, d);
  g.translate(0, 0, -d / 2 + 0.2);
  g.rotateX(-0.42);
  return g;
}

/** A background building block: box body with lit facade grids and eaves on each floor. */
function building(B, rnd, pos, rot, w, h, d) {
  const floors = Math.max(1, Math.floor(h / 3.2));
  const add = (key, geo) => B.push(key, geo, pos, rot);
  const body = new THREE.BoxGeometry(w, h, d);
  body.translate(0, h / 2, 0);
  add(rnd() < 0.2 ? 'plaster' : 'darkWood', body);
  // facade panels on the +z and -z faces, and sometimes x faces
  const faces = [
    { n: [0, 0, 1], len: w, depth: d / 2 },
    { n: [0, 0, -1], len: w, depth: d / 2 },
    { n: [1, 0, 0], len: d, depth: w / 2 },
    { n: [-1, 0, 0], len: d, depth: w / 2 },
  ];
  for (const f of faces) {
    if (rnd() < 0.08) continue;
    const cols = Math.max(1, Math.floor(f.len / 1.7));
    const pw = f.len / cols;
    for (let fl = 0; fl < floors; fl++) {
      const y = 0.4 + fl * 3.2;
      const lit = rnd() < 0.8;
      for (let c = 0; c < cols; c++) {
        if (rnd() < 0.15) continue;
        const u = -f.len / 2 + pw * (c + 0.5);
        const g = new THREE.BoxGeometry(pw - 0.14, 2.3, 0.05);
        g.translate(0, y + 1.15, 0);
        placeOnFace(g, f, u);
        add(lit ? (rnd() < 0.85 ? 'shoji' : 'shojiDim') : 'fusuma' + (1 + ((c + fl) % 3)), g);
      }
      // floor beam + eave
      const beam = new THREE.BoxGeometry(f.len + 0.3, 0.2, 0.25);
      beam.translate(0, y, 0);
      placeOnFace(beam, f, 0);
      add('darkWood', beam);
      const eave = eaveGeo(f.len + 1.0, 1.1);
      eave.translate(0, y + 2.75, 0.1);
      placeOnFace(eave, f, 0);
      add('roof', eave);
    }
    // corner posts
    const post = new THREE.BoxGeometry(0.22, h, 0.22);
    post.translate(0, h / 2, 0);
    for (const u of [-f.len / 2, f.len / 2]) {
      const pg = post.clone();
      placeOnFace(pg, f, u);
      add(rnd() < 0.5 ? 'pillar' : 'darkWood', pg);
    }
  }
}

function placeOnFace(g, f, u) {
  // geometry authored facing +z at the face plane; rotate to face normal and push out
  const ang = Math.atan2(f.n[0], f.n[2]);
  g.translate(u, 0, 0);
  g.rotateY(ang);
  g.translate(f.n[0] * (f.depth + 0.03), 0, f.n[2] * (f.depth + 0.03));
}

function stairs(B, rnd, pos, rot, len, width) {
  const steps = Math.floor(len / 0.35);
  const stepG = new THREE.BoxGeometry(width, 0.18, 0.4);
  const railG = new THREE.BoxGeometry(0.08, 0.08, len * 1.05);
  for (let i = 0; i < steps; i++) {
    const g = stepG.clone();
    g.translate(0, i * 0.24, i * 0.34);
    B.push('darkWood', g, pos, rot);
  }
  // stringers & rails
  const ang = Math.atan2(steps * 0.24, steps * 0.34);
  for (const x of [-width / 2, width / 2]) {
    const s = new THREE.BoxGeometry(0.12, 0.3, len * 1.02);
    s.rotateX(-ang);
    s.translate(x, (steps * 0.24) / 2 - 0.1, (steps * 0.34) / 2);
    B.push('darkWood', s, pos, rot);
    const r = railG.clone();
    r.rotateX(-ang);
    r.translate(x, (steps * 0.24) / 2 + 0.9, (steps * 0.34) / 2);
    B.push('darkWood', r, pos, rot);
  }
}

function lanternGeo() {
  const body = new THREE.CylinderGeometry(0.24, 0.24, 0.8, 14, 5, true);
  // bulge
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = 1 + 0.25 * Math.cos((y / 0.4) * Math.PI * 0.5);
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  body.computeVertexNormals();
  return body;
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
export class World {
  constructor(scene, T) {
    this.scene = scene;
    this.T = T;
    this.mats = makeMaterials(T);
    this.group = new THREE.Group();
    this.dynamic = [];
    this.movers = [];
    this.spawnPoints = [];
    this.pillars = [];
    this.half = 15;
    this.time = 0;
    this.lanternCores = [];
    scene.add(this.group);
    this.sky = makeSky();
    scene.add(this.sky);
  }

  clear() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.movers = [];
    this.spawnPoints = [];
    this.pillars = [];
    this.lanternCores = [];
    this.doors = [];
  }

  /** Keep a point inside the arena and outside pillars. */
  constrain(pos, r = 0.4) {
    const h = this.half - r;
    if (this.round) {
      const d = Math.hypot(pos.x, pos.z);
      if (d > h) {
        pos.x *= h / d;
        pos.z *= h / d;
      }
    } else {
      pos.x = clamp(pos.x, -h, h);
      pos.z = clamp(pos.z, -h, h);
    }
    for (const p of this.pillars) {
      const dx = pos.x - p.x, dz = pos.z - p.z;
      const d = Math.hypot(dx, dz);
      const min = p.r + r;
      if (d < min && d > 1e-4) {
        pos.x = p.x + (dx / d) * min;
        pos.z = p.z + (dz / d) * min;
      }
    }
    pos.y = 0;
    return pos;
  }

  _lantern(B, x, y, z, hang = 1.2) {
    B.push('lantern', lanternGeo(), [x, y, z]);
    B.push('lanternCap', new THREE.CylinderGeometry(0.16, 0.18, 0.08, 12), [x, y + 0.44, z]);
    B.push('lanternCap', new THREE.CylinderGeometry(0.18, 0.16, 0.08, 12), [x, y - 0.44, z]);
    if (hang > 0) B.push('lanternCap', new THREE.CylinderGeometry(0.012, 0.012, hang, 4), [x, y + 0.48 + hang / 2, z]);
    this.lanternCores.push(new THREE.Vector3(x, y, z));
  }

  _pillar(B, x, z, h, r = 0.3, key = 'pillar') {
    B.push(key, new THREE.CylinderGeometry(r, r * 1.05, h, 12), [x, h / 2, z]);
    B.push('darkWood', new THREE.BoxGeometry(r * 2.6, 0.25, r * 2.6), [x, 0.12, z]);
    B.push('darkWood', new THREE.BoxGeometry(r * 2.8, 0.3, r * 2.8), [x, h - 0.1, z]);
    this.pillars.push({ x, z, r: r + 0.05 });
  }

  _background(B, rnd, opts = {}) {
    const n = opts.count ?? 46;
    for (let i = 0; i < n; i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = (opts.minDist ?? 34) + rnd() * (opts.spread ?? 80);
      const y = (rnd() - 0.45) * (opts.ySpread ?? 70);
      const pos = [Math.cos(ang) * dist, y, Math.sin(ang) * dist];
      // most blocks upright; some sideways or upside-down
      const r = rnd();
      const rot = r < 0.6 ? [0, Math.round(rnd() * 4) * (Math.PI / 2) + ang, 0] : r < 0.8 ? [Math.PI, rnd() * Math.PI * 2, 0] : [0, rnd() * Math.PI * 2, Math.PI / 2 * (rnd() < 0.5 ? 1 : -1)];
      building(B, rnd, pos, rot, 6 + rnd() * 12, 6 + Math.floor(rnd() * 4) * 3.2, 5 + rnd() * 8);
    }
    const ns = opts.stairs ?? 18;
    for (let i = 0; i < ns; i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = 26 + rnd() * 70;
      const pos = [Math.cos(ang) * dist, (rnd() - 0.5) * 50, Math.sin(ang) * dist];
      const rot = [rnd() < 0.2 ? Math.PI : 0, rnd() * Math.PI * 2, rnd() < 0.15 ? Math.PI / 2 : 0];
      stairs(B, rnd, pos, rot, 8 + rnd() * 16, 2 + rnd() * 1.5);
    }
    // floating lantern clusters
    for (let i = 0; i < (opts.lanterns ?? 30); i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = 22 + rnd() * 50;
      this._lantern(B, Math.cos(ang) * dist, 2 + (rnd() - 0.3) * 30, Math.sin(ang) * dist, 0);
    }
  }

  /** Moving chunks (shifting castle) */
  _movers(rnd, n = 8) {
    for (let i = 0; i < n; i++) {
      const B = new Builder(this.mats);
      const w = 6 + rnd() * 8, h = 6.4 + Math.floor(rnd() * 3) * 3.2, d = 5 + rnd() * 5;
      building(B, rnd, [0, 0, 0], [0, 0, 0], w, h, d);
      const g = new THREE.Group();
      B.build(g);
      const ang = rnd() * Math.PI * 2;
      const dist = 30 + rnd() * 30;
      g.position.set(Math.cos(ang) * dist, (rnd() - 0.5) * 30, Math.sin(ang) * dist);
      g.rotation.y = ang + Math.PI / 2;
      this.group.add(g);
      this.movers.push({ obj: g, from: g.position.clone(), to: g.position.clone(), fromR: g.rotation.clone(), toR: g.rotation.clone(), t: 1, dur: 1.2, next: 3 + rnd() * 10 });
    }
  }

  /** Nakime shift: move all movers to new random positions. */
  shiftAll(strength = 1) {
    const rnd = Math.random;
    for (const m of this.movers) {
      m.from.copy(m.obj.position);
      m.fromR.copy(m.obj.rotation);
      const axis = rnd();
      m.to.copy(m.from);
      if (axis < 0.5) m.to.y += (rnd() < 0.5 ? -1 : 1) * (8 + rnd() * 14) * strength;
      else m.to.addScaledVector(new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize(), 10 * strength);
      m.toR.set(m.fromR.x + (rnd() < 0.3 ? Math.PI / 2 : 0), m.fromR.y + (rnd() < 0.5 ? Math.PI / 2 : 0), m.fromR.z);
      m.t = 0;
      m.dur = 0.8 + rnd() * 0.6;
    }
  }

  update(dt, audio) {
    this.time += dt;
    this.sky.material.uniforms.uTime.value = this.time;
    for (const m of this.movers) {
      if (m.t < 1) {
        m.t = Math.min(1, m.t + dt / m.dur);
        const k = ease.inOut3(m.t);
        m.obj.position.lerpVectors(m.from, m.to, k);
        m.obj.rotation.set(m.fromR.x + (m.toR.x - m.fromR.x) * k, m.fromR.y + (m.toR.y - m.fromR.y) * k, m.fromR.z + (m.toR.z - m.fromR.z) * k);
      } else {
        m.next -= dt;
        if (m.next <= 0) {
          m.next = 6 + Math.random() * 12;
          // individual idle shift
          m.from.copy(m.obj.position);
          m.fromR.copy(m.obj.rotation);
          m.to.copy(m.from);
          m.to.y += (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 8);
          m.toR.copy(m.fromR);
          if (Math.random() < 0.4) m.toR.y += Math.PI / 2;
          m.t = 0;
          m.dur = 1.4;
          if (audio && Math.random() < 0.35) audio.play('biwa', { volume: 0.25 });
        }
      }
    }
    for (const d of this.doors || []) {
      if (d.t < 1) {
        d.t = Math.min(1, d.t + dt / d.dur);
        const k = ease.out3(d.t);
        d.obj.position.x = d.x0 + (d.x1 - d.x0) * (d.open ? k : 1 - k);
      }
    }
  }

  // ---------------------------------------------------------------- stage 1: the great hall
  buildHall() {
    this.clear();
    this.mode = 'hall';
    this.round = false;
    this.half = 15;
    const rnd = mulberry32(20250718);
    const B = new Builder(this.mats);
    const H = 17;
    // floor slab with planks
    B.box('floor', H * 2, 0.4, H * 2, [0, -0.2, 0]);
    // tatami inlay strips around the centre
    const tat = new THREE.BoxGeometry(1.8, 0.04, 0.9);
    for (let i = -3; i < 3; i++) {
      for (let j = -1; j < 1; j++) {
        B.push('tatami', tat, [i * 1.82 + 0.91, 0.02, j * 0.92 + 0.46 + 7.5]);
        B.push('tatami', tat, [i * 1.82 + 0.91, 0.02, j * 0.92 + 0.46 - 7.5]);
      }
    }
    // perimeter beams
    for (const s of [-1, 1]) {
      B.box('darkWood', H * 2 + 0.6, 0.35, 0.5, [0, 0.05, s * (H + 0.1)]);
      B.box('darkWood', 0.5, 0.35, H * 2 + 0.6, [s * (H + 0.1), 0.05, 0]);
    }
    // north & south: two-storey fusuma/shoji walls with doors (spawn points)
    for (const facing of [0, Math.PI]) {
      shojiWall(B, -H, H, H + 0.2, 0, 3, facing, { fusuma: true, groundH: 3.0, eaveGeo: true });
    }
    // east & west: open balustrade over the void
    for (const s of [-1, 1]) {
      B.box('darkWood', 0.12, 0.12, H * 2, [s * H, 1.0, 0]);
      B.box('darkWood', 0.1, 0.1, H * 2, [s * H, 0.5, 0]);
      for (let z = -H; z <= H; z += 1.2) B.box('darkWood', 0.08, 1.0, 0.08, [s * H, 0.5, z]);
      // hanging floors below the edges
      B.box('darkWood', 3, 0.4, H * 2, [s * (H + 1.5), -0.4, 0]);
    }
    // pillars along the walls + four inner pillars
    for (const x of [-12, -6, 0, 6, 12]) {
      for (const s of [-1, 1]) this._pillar(B, x, s * 15.9, 11, 0.32);
    }
    for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) this._pillar(B, x, z, 14, 0.42);
    // ceiling beams & upside-down rooms overhead
    for (let x = -H; x <= H; x += 4) B.box('darkWood', 0.4, 0.5, H * 2 + 2, [x, 14, 0]);
    for (let z = -H; z <= H; z += 4) B.box('darkWood', H * 2 + 2, 0.4, 0.4, [0, 14.4, z]);
    building(B, rnd, [-6, 22, 4], [Math.PI, 0.3, 0], 12, 9.6, 8);
    building(B, rnd, [9, 20, -6], [Math.PI, -0.4, 0], 9, 6.4, 7);
    // hanging lanterns
    for (let x = -12; x <= 12; x += 6) {
      for (const z of [-13.5, 13.5]) this._lantern(B, x + 3, 4.2, z, 2.0);
    }
    for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) this._lantern(B, x, 5.5, z + 0.6, 1.5);
    // endless castle
    this._background(B, rnd, { count: 60, stairs: 22, lanterns: 40 });
    B.build(this.group);
    this._doors(H);
    this._movers(rnd, 8);
    this.group.add(makeFarWindows(rnd));
    this.spawnPoints = [];
    for (const z of [-14.2, 14.2]) for (const x of [-10, -5, 0, 5, 10]) this.spawnPoints.push(new THREE.Vector3(x, 0, z));
    this.playerStart = new THREE.Vector3(0, 0, 0);
    this.group.traverse((o) => (o.frustumCulled = o.frustumCulled && !(o.isInstancedMesh)));
    return this;
  }

  _doors(H) {
    // sliding doors in front of the spawn points (animated separately)
    this.doors = [];
    const doorGeo = new THREE.BoxGeometry(1.6, 2.8, 0.08);
    for (const s of [-1, 1]) {
      for (const x of [-10, -5, 0, 5, 10]) {
        const m = new THREE.Mesh(doorGeo, this.mats['fusuma' + (1 + ((x / 5 + 2) % 3))]);
        const z = s * (H - 0.05);
        m.position.set(x, 1.45, z);
        this.group.add(m);
        this.doors.push({ obj: m, x0: x, x1: x + 1.6, t: 1, dur: 0.35, open: false, z, x });
      }
    }
  }

  openDoorNear(pos) {
    let best = null, bd = Infinity;
    for (const d of this.doors || []) {
      const dist = Math.hypot(d.x - pos.x, d.z - pos.z);
      if (dist < bd) { bd = dist; best = d; }
    }
    if (best && bd < 3) {
      best.open = true;
      best.t = 0;
      setTimeout(() => { best.open = false; best.t = 0; }, 1600);
    }
  }

  // ---------------------------------------------------------------- boss arena: floating platform
  buildArena() {
    this.clear();
    this.mode = 'arena';
    this.round = false;
    this.half = 14;
    const rnd = mulberry32(7771);
    const B = new Builder(this.mats);
    const H = 15;
    B.box('floor', H * 2, 0.6, H * 2, [0, -0.3, 0]);
    // underside structure
    B.box('darkWood', H * 2 - 2, 3, H * 2 - 2, [0, -2.1, 0]);
    building(B, rnd, [0, -14, 0], [Math.PI, 0.2, 0], 18, 9.6, 16);
    // edge trim + low railing with gaps
    for (const s of [-1, 1]) {
      B.box('darkWood', H * 2 + 0.6, 0.3, 0.5, [0, 0.05, s * (H + 0.1)]);
      B.box('darkWood', 0.5, 0.3, H * 2 + 0.6, [s * (H + 0.1), 0.05, 0]);
      B.box('darkWood', H * 2, 0.1, 0.1, [0, 0.8, s * H]);
      B.box('darkWood', 0.1, 0.1, H * 2, [s * H, 0.8, 0]);
      for (let i = -H; i <= H; i += 1.5) {
        B.box('darkWood', 0.08, 0.8, 0.08, [i, 0.4, s * H]);
        B.box('darkWood', 0.08, 0.8, 0.08, [s * H, 0.4, i]);
      }
    }
    // tatami centre (a dojo floor)
    const tat = new THREE.BoxGeometry(1.8, 0.04, 0.9);
    for (let i = -4; i < 4; i++) for (let j = -4; j < 4; j++) {
      const rotd = (i + j) % 2 === 0;
      B.push('tatami', tat, [i * 1.82 + 0.91, 0.02, j * 1.84 + 0.92], [0, rotd ? Math.PI / 2 : 0, 0], rotd ? [1, 1, 1] : [1, 1, 2]);
    }
    // corner pillars with torii-like beams
    for (const [x, z] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) {
      this._pillar(B, x, z, 12, 0.5);
      this._lantern(B, x * 0.93, 3.2, z * 0.93, 0);
    }
    for (const s of [-1, 1]) {
      B.box('darkWood', H * 2 + 2, 0.6, 0.6, [0, 12, s * 13]);
      B.box('darkWood', 0.6, 0.6, H * 2 + 2, [s * 13, 12.6, 0]);
    }
    // lanterns on posts around
    for (let i = -9; i <= 9; i += 6) {
      for (const s of [-1, 1]) {
        B.box('darkWood', 0.12, 1.6, 0.12, [i, 0.8, s * 14.4]);
        this._lantern(B, i, 1.9, s * 14.4, 0);
        B.box('darkWood', 0.12, 1.6, 0.12, [s * 14.4, 0.8, i]);
        this._lantern(B, s * 14.4, 1.9, i, 0);
      }
    }
    this._background(B, rnd, { count: 80, stairs: 30, lanterns: 55, minDist: 28, spread: 90, ySpread: 90 });
    B.build(this.group);
    this._movers(rnd, 10);
    this.group.add(makeFarWindows(rnd, 1800));
    this.spawnPoints = [new THREE.Vector3(0, 0, 8)];
    this.playerStart = new THREE.Vector3(0, 0, -8);
    return this;
  }

  // ---------------------------------------------------------------- title backdrop (hall reused)
  buildTitle() {
    return this.buildHall();
  }
}
