import * as THREE from 'three';
import { Rig } from './rig.js';
import { toonMaterial } from '../render/materials.js';
import { limb, shell, box, sphere, cone, merge, smoothSeams, katanaBlade, flameTsuba, hexTsuba } from '../render/geo.js';
import { mulberry32 } from '../core/math.js';

// Same formula as textures.js deformHead (kept local so geometry never depends on texture generation).
export function deformHead(geometry, R) {
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) / R, y = p.getY(i) / R, z = p.getZ(i) / R;
    if (y < 0) {
      const t = -y;
      x *= 1 - 0.28 * t;
      z *= 1 - 0.1 * t;
      y *= 1 + 0.22 * Math.max(z, 0);
    }
    p.setXYZ(i, x * R, y * R * 1.06, z * R);
  }
  geometry.computeVertexNormals();
}

const up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

/** Torso lathe that grows upward from y=0 (waist radius r0) to y=h (shoulder radius r1), depth-scaled. */
function torso(r0, r1, h, depth = 0.72, radial = 14) {
  const pts = [];
  pts.push(new THREE.Vector2(0.0001, -0.02));
  pts.push(new THREE.Vector2(r0 * 0.96, 0));
  pts.push(new THREE.Vector2(r0, h * 0.25));
  pts.push(new THREE.Vector2((r0 + r1) * 0.5, h * 0.6));
  pts.push(new THREE.Vector2(r1, h * 0.85));
  pts.push(new THREE.Vector2(r1 * 0.85, h * 0.98));
  pts.push(new THREE.Vector2(r1 * 0.45, h * 1.05));
  pts.push(new THREE.Vector2(0.0001, h * 1.07));
  const g = new THREE.LatheGeometry(pts, radial);
  g.scale(1, 1, depth);
  return g;
}

/** Cone placed with its base at `p`, pointing along `dir`. */
function spike(p, dir, radius, length, radial = 6) {
  const g = new THREE.ConeGeometry(radius, length, radial, 1, true);
  g.translate(0, length / 2, 0);
  _q.setFromUnitVectors(up, dir.clone().normalize());
  _m.makeRotationFromQuaternion(_q);
  g.applyMatrix4(_m);
  g.translate(p.x, p.y, p.z);
  return g;
}

function gradientColors(g, c0, c1, axisFn) {
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const a = new THREE.Color(c0), b = new THREE.Color(c1), c = new THREE.Color();
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = axisFn ? axisFn(i, pos) : uv.getY(i);
    c.copy(a).lerp(b, THREE.MathUtils.clamp(t, 0, 1));
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function solid(g, color) {
  return gradientColors(g, color, color, () => 0);
}

/**
 * Spiky anime hair around a head centred at `c` with radius r.
 * opts: seed, count, len [min,max], rad [min,max], sweep (Vector3 bias), frontCut (skip spikes over face),
 *       crown (spikes rooted higher than this over the face still grow; default 0.75),
 *       root, tip colours, bangs: [{u, len, rad}]
 */
function spikyHair(c, r, opts) {
  const rnd = mulberry32(opts.seed ?? 7);
  const geos = [];
  // skull cap
  const cap = new THREE.SphereGeometry(r * 1.06, 20, 12, 0, Math.PI * 2, 0, opts.capTheta ?? 1.95);
  cap.rotateX(opts.capTilt ?? -0.5);
  cap.translate(c.x, c.y + 0.004, c.z - 0.008);
  geos.push(gradientColors(cap, opts.root, opts.root, () => 0));
  const count = opts.count ?? 26;
  for (let i = 0; i < count; i++) {
    // fibonacci-ish distribution on the upper/back hemisphere
    const t = (i + 0.5) / count;
    const polar = Math.acos(1 - t * (opts.coverage ?? 1.25)); // 0 top .. ~1.8
    const az = i * 2.39996 + rnd() * 0.4;
    const dir = new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az));
    // skip the face region (spikes rooted above it, on the crown, still grow)
    if (dir.z > (opts.frontCut ?? 0.35) && dir.y < (opts.crown ?? 0.75)) continue;
    const base = c.clone().addScaledVector(dir, r * 0.92);
    const out = dir.clone().multiplyScalar(opts.outward ?? 0.8).add(opts.sweep ?? new THREE.Vector3(0, -0.5, -0.6));
    const len = THREE.MathUtils.lerp(opts.len[0], opts.len[1], rnd());
    const rad = THREE.MathUtils.lerp(opts.rad[0], opts.rad[1], rnd());
    const g = spike(base, out, rad, len);
    geos.push(gradientColors(g, opts.root, opts.tip));
  }
  for (const b of opts.bangs || []) {
    const az = b.u; // radians, 0 = front
    const polar = b.polar ?? 0.62;
    const dir = new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az));
    const base = c.clone().addScaledVector(dir, r * 0.98);
    const d = new THREE.Vector3(Math.sin(az) * 0.35 + (b.dx ?? 0), -1, 0.42 + (b.dz ?? 0));
    const g = spike(base, d, b.rad, b.len);
    geos.push(gradientColors(g, opts.root, opts.tip));
  }
  return merge(geos);
}

function mat(T, key, color, opts = {}) {
  const tex = key && T ? T[key] : null;
  return toonMaterial({ color: tex ? opts.tint ?? 0xffffff : color, map: tex || undefined, ...opts });
}

// ---------------------------------------------------------------------------
// Swords
// ---------------------------------------------------------------------------
/** Bend a blade (built along +Y) into a serpentine wave across its width, fading in from the guard. */
function waveBlade(g, amp, waves, len) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = THREE.MathUtils.clamp(y / len, 0, 1);
    p.setZ(i, p.getZ(i) + Math.sin(t * Math.PI * 2 * waves) * amp * Math.min(1, t * 4) * (1 - t * 0.35));
  }
  g.computeVertexNormals();
  return g;
}

function buildSword(rig, T, style) {
  const grip = rig.socket('grip', 'handR', [0, -0.055, 0.012], [Math.PI / 2, 0, 0]);
  const blade = katanaBlade(0.9, 0.034, 0.009, 0.035);
  if (style.wave) waveBlade(blade, style.wave, 3, 0.9);
  blade.translate(0, 0.135, 0);
  const bladeMat = toonMaterial({
    color: style.blade,
    shade: style.bladeShade ?? 0x6f7890,
    rim: 0.6,
    spec: 1.2,
    emissive: style.bladeGlow ?? 0x000000,
  });
  const edgeMat = toonMaterial({ color: style.edge ?? 0xdfe8f0, unlit: true });
  const edge = katanaBlade(0.9, 0.012, 0.0095, 0.035);
  edge.translate(0, 0, -0.012);
  if (style.wave) waveBlade(edge, style.wave, 3, 0.9);
  edge.translate(0, 0.135, 0);
  const guardMat = toonMaterial({ color: style.guard, rim: 0.5, spec: 0.6 });
  const hiltMat = toonMaterial({ color: style.hilt, shade: 0x777777 });
  const tsuba = style.flame ? flameTsuba(0.052, 0.012) : hexTsuba(0.046, 0.012);
  tsuba.translate(0, 0.118, 0);
  const hilt = new THREE.CylinderGeometry(0.017, 0.019, 0.25, 8);
  hilt.translate(0, -0.005, 0);
  const pommel = new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8);
  pommel.translate(0, -0.13, 0);
  const habaki = new THREE.CylinderGeometry(0.014, 0.016, 0.03, 6);
  habaki.translate(0, 0.14, 0);
  const g = new THREE.Group();
  g.name = 'sword';
  g.add(new THREE.Mesh(blade, bladeMat));
  g.add(new THREE.Mesh(edge, edgeMat));
  g.add(new THREE.Mesh(tsuba, guardMat));
  g.add(new THREE.Mesh(merge([hilt, pommel]), hiltMat));
  g.add(new THREE.Mesh(habaki, guardMat));
  g.traverse((o) => (o.frustumCulled = false));
  grip.add(g);
  const base = new THREE.Object3D();
  base.position.set(0, 0.2, 0);
  const mid = new THREE.Object3D();
  mid.position.set(0, 0.6, 0);
  const tip = new THREE.Object3D();
  tip.position.set(0, 1.03, 0);
  const offhand = new THREE.Object3D();
  offhand.position.set(0, -0.085, 0);
  g.add(base, mid, tip, offhand);
  for (const m of [bladeMat, edgeMat, guardMat, hiltMat]) rig.materials.add(m);
  return { group: g, grip, base, mid, tip, offhand, bladeMat };
}

function scabbard(rig, T, color = 0x16131a, ring = 0xb08a3e) {
  const s = rig.socket('saya', 'hips', [0.15, 0.02, 0.06], [1.95, 0.25, -0.2]);
  const m = toonMaterial({ color, rim: 0.4 });
  const mr = toonMaterial({ color: ring });
  const body = new THREE.CylinderGeometry(0.02, 0.024, 0.95, 8);
  body.translate(0, -0.47, 0);
  body.scale(1, 1, 1.4);
  const mouth = new THREE.CylinderGeometry(0.026, 0.026, 0.03, 8);
  mouth.translate(0, -0.01, 0);
  s.add(new THREE.Mesh(body, m));
  s.add(new THREE.Mesh(mouth, mr));
  s.traverse((o) => (o.frustumCulled = false));
  rig.materials.add(m);
  rig.materials.add(mr);
  return s;
}

// ---------------------------------------------------------------------------
// Shared body builder for the human swordsmen
// ---------------------------------------------------------------------------
function buildHead(rig, T, cfg) {
  const R = rig.d.headR;
  const head = rig.j('head');
  const c = new THREE.Vector3(0, 0.1, 0.012);
  const skinMat = cfg.skinMat;
  const hg = new THREE.SphereGeometry(R, 26, 20);
  deformHead(hg, R);
  smoothSeams(hg);
  hg.translate(c.x, c.y, c.z);
  rig.add(head, hg, skinMat, { name: 'headMesh' });
  // ears
  const earG = merge([sphere(0.026, 8, 6).scale(0.45, 1, 0.8).translate(R * 0.97, -0.005, 0), sphere(0.026, 8, 6).scale(0.45, 1, 0.8).translate(-R * 0.97, -0.005, 0)]);
  earG.translate(c.x, c.y, c.z);
  rig.add(head, earG, skinMat);
  // face patch
  const fg = new THREE.SphereGeometry(R * 1.015, 32, 20, Math.PI / 2 - 1.05, 2.1, 0.55, 1.5);
  deformHead(fg, R * 1.015);
  fg.translate(c.x, c.y, c.z);
  const faceTex = T?.[cfg.faces?.neutral];
  const faceMat = toonMaterial({
    color: 0xffffff,
    map: faceTex || undefined,
    alphaTest: 0.04,
    transparent: true,
    mapBias: -1.3,
    shade: 0xe6d8dc,
    rim: 0,
    paint: 0,
  });
  const face = rig.add(head, fg, faceMat, { name: 'face' });
  face.renderOrder = 1;
  face.visible = !!faceTex;
  // hair
  const hair = spikyHair(c, R, cfg.hair);
  const hairMat = toonMaterial({ color: 0xffffff, vertexColors: true, shade: cfg.hairShade ?? 0x8a7a9a, rim: 0.5, spec: 0.08, side: THREE.DoubleSide });
  rig.add(head, hair, hairMat);
  // neck
  const neck = new THREE.CylinderGeometry(0.045, 0.05, 0.12, 10);
  neck.translate(0, 0.03, 0);
  rig.add('neck', neck, skinMat);
  return { face, faceMat, headCenter: c, hairMat };
}

function buildSwordsman(T, cfg) {
  const rig = new Rig(cfg.dims);
  const d = rig.d;
  const skinMat = mat(null, null, cfg.skin ?? 0xf3d6c2, { shade: 0xc98f86, rim: 0.3 });
  const uniMat = mat(T, 'uniformBlack', 0x1b1d26, { shade: 0x6a6f90, rim: 0.55, repeat: [2, 2] });
  const wrapMat = mat(T, 'legWraps', 0xe9e4d8, { shade: 0x9c95a8, repeat: [1, 2] });
  const beltMat = toonMaterial({ color: cfg.belt ?? 0xe8e2d4, shade: 0x9a92a6 });
  const sandalMat = toonMaterial({ color: 0x5a4030, shade: 0x6e5a6a });
  const tabiMat = toonMaterial({ color: 0xf0ece4, shade: 0xa6a0b0 });
  const goldMat = toonMaterial({ color: 0xc9a45c, rim: 0.4, spec: 0.8 });

  // torso & hips (uniform)
  const pelvis = sphere(0.16, 14, 10);
  pelvis.scale(1, 0.75, 0.78);
  pelvis.translate(0, -0.01, 0);
  rig.add('hips', pelvis, uniMat);
  const abdomen = new THREE.CylinderGeometry(0.13, 0.145, 0.16, 12);
  abdomen.scale(1, 1, 0.78);
  abdomen.translate(0, 0.07, 0);
  rig.add('spine', abdomen, uniMat);
  rig.add('chest', torso(0.135, 0.175, 0.24, 0.7), uniMat);
  // gakuran collar + buttons
  const collar = new THREE.CylinderGeometry(0.06, 0.075, 0.05, 12, 1, true);
  collar.translate(0, 0.245, 0.005);
  rig.add('chest', collar, uniMat);
  for (let i = 0; i < 3; i++) {
    const b = sphere(0.009, 6, 4);
    b.translate(0, 0.19 - i * 0.07, 0.122 - i * 0.004);
    rig.add('chest', b, goldMat);
  }
  // belt
  const belt = new THREE.CylinderGeometry(0.15, 0.15, 0.045, 14, 1, true);
  belt.scale(1, 1, 0.8);
  belt.translate(0, 0.02, 0);
  rig.add('spine', belt, beltMat);

  // arms
  for (const s of ['L', 'R']) {
    rig.add('upperArm' + s, limb(0.056, 0.047, d.upperArm), uniMat);
    rig.add('foreArm' + s, limb(0.047, 0.037, d.foreArm - 0.03), uniMat);
    const cuff = new THREE.CylinderGeometry(0.041, 0.041, 0.03, 10, 1, true);
    cuff.translate(0, -d.foreArm + 0.04, 0);
    rig.add('foreArm' + s, cuff, uniMat);
    const hand = sphere(0.043, 10, 8);
    hand.scale(0.85, 1.15, 1.0);
    hand.translate(0, -0.045, 0.008);
    rig.add('hand' + s, hand, skinMat);
    const thumb = limb(0.014, 0.012, 0.035, 6, 2);
    thumb.rotateZ(s === 'L' ? -0.9 : 0.9);
    thumb.translate(s === 'L' ? -0.03 : 0.03, -0.02, 0.02);
    rig.add('hand' + s, thumb, skinMat);
  }
  // legs: baggy hakama pants + wraps
  for (const s of ['L', 'R']) {
    const x = s === 'L' ? 1 : -1;
    rig.add('thigh' + s, limb(0.095, 0.085, d.thigh - 0.02, 12), uniMat);
    const pants = shell(0.11, 0.1, d.thigh + 0.06, 0, Math.PI * 2, 12, 2);
    pants.translate(0, 0.03, 0);
    rig.add('thigh' + s, pants, uniMat);
    rig.add('shin' + s, limb(0.066, 0.045, d.shin - 0.02, 10), wrapMat);
    const knee = sphere(0.075, 10, 8);
    knee.scale(1, 0.85, 1);
    rig.add('shin' + s, knee, uniMat);
    const foot = box(0.085, 0.05, 0.2, 0, -0.035, 0.045);
    rig.add('foot' + s, foot, tabiMat);
    const sole = box(0.095, 0.018, 0.23, 0, -0.065, 0.045);
    rig.add('foot' + s, sole, sandalMat);
    void x;
  }

  const head = buildHead(rig, T, { ...cfg, skinMat });
  const materials = [skinMat, uniMat, wrapMat, beltMat, sandalMat, tabiMat, goldMat];
  for (const m of materials) rig.materials.add(m);
  return { rig, skinMat, uniMat, head };
}

// Haori: rigid shoulder shell + spring-driven skirt panels, open at the front.
// opts.skirt / opts.sleeve: [left, right] fabrics for the skirt and the sleeves (default: the halves' own).
function buildHaori(rig, T, matLeft, matRight, opts = {}) {
  const d = rig.d;
  const len = opts.length ?? 0.62;
  const [skirtL, skirtR] = opts.skirt ?? [matLeft, matRight];
  const [sleeveL, sleeveR] = opts.sleeve ?? [matLeft, matRight];
  // torso part: two halves so left/right can use different fabrics (Giyu)
  const gap = 0.55; // radians of front opening
  const half = (Math.PI * 2 - gap) / 2;
  // CylinderGeometry theta: 0 at +Z, increasing toward +X
  const upperL = shell(0.15, 0.19, 0.34, gap / 2, half, 10, 2);
  upperL.scale(1, 1, 0.8);
  upperL.translate(0, 0.27, -0.005);
  const upperR = shell(0.15, 0.19, 0.34, gap / 2 + half, half, 10, 2);
  upperR.scale(1, 1, 0.8);
  upperR.translate(0, 0.27, -0.005);
  rig.add('chest', upperL, matLeft);
  rig.add('chest', upperR, matRight);
  // shoulder yoke
  const yoke = new THREE.SphereGeometry(0.19, 14, 6, 0, Math.PI * 2, 0, 0.9);
  yoke.scale(1.05, 0.55, 0.8);
  yoke.translate(0, 0.21, -0.005);
  rig.add('chest', yoke, matRight);
  // skirt panels on springs
  const panels = opts.panels ?? 6;
  const span = (Math.PI * 2 - gap) / panels;
  for (let i = 0; i < panels; i++) {
    const th0 = gap / 2 + i * span;
    const mid = th0 + span / 2;
    const px = Math.sin(mid) * 0.17, pz = Math.cos(mid) * 0.17 * 0.82;
    const bone = rig.spring('haori' + i, 'hips', [px, 0.12, pz], len, {
      stiffness: 0.16,
      damping: 0.8,
      gravity: 0.03,
      maxAngle: 1.1,
    });
    const g = shell(0.175, 0.24, len, th0 - 0.02, span + 0.04, 3, 3);
    g.scale(1, 1, 0.82);
    g.translate(-px, 0, -pz);
    const m = mid < Math.PI ? skirtL : skirtR;
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    bone.add(mesh);
    rig.meshes.push(mesh);
  }
  // wide sleeves
  for (const s of ['L', 'R']) {
    const sl = shell(0.07, 0.12, 0.34, 0, Math.PI * 2, 10, 2);
    sl.translate(0, 0.02, 0);
    rig.add('upperArm' + s, sl, s === 'L' ? sleeveL : sleeveR);
  }
  for (const m of [skirtL, skirtR, sleeveL, sleeveR]) rig.materials.add(m);
  void d;
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------
export function buildTanjiro(T) {
  const hairOpts = {
    seed: 11,
    count: 34,
    len: [0.1, 0.17],
    rad: [0.035, 0.05],
    root: 0x1a0c0c,
    tip: 0x8a2420,
    sweep: new THREE.Vector3(0, -0.35, -0.75),
    outward: 1.0,
    frontCut: 0.25,
    coverage: 1.35,
    capTilt: -0.55,
    bangs: [
      { u: 0, len: 0.1, rad: 0.03, dz: 0.1 },
      { u: 0.35, len: 0.11, rad: 0.032, dx: 0.1 },
      { u: -0.35, len: 0.11, rad: 0.032, dx: -0.1 },
      { u: 0.7, len: 0.12, rad: 0.03, dx: 0.25 },
      { u: -0.7, len: 0.12, rad: 0.03, dx: -0.25 },
      { u: 0.18, polar: 0.4, len: 0.09, rad: 0.028 },
      { u: -0.2, polar: 0.4, len: 0.09, rad: 0.028 },
    ],
  };
  const faces = { neutral: 'face_tanjiro_neutral', fierce: 'face_tanjiro_fierce', hurt: 'face_tanjiro_hurt' };
  const { rig, head } = buildSwordsman(T, { hair: hairOpts, faces, dims: {} });
  const checker = mat(T, 'checkerTanjiro', 0x2a7a5e, { shade: 0x6a7fa0, rim: 0.45, repeat: [3, 2], side: THREE.DoubleSide });
  buildHaori(rig, T, checker, checker, { length: 0.6 });
  rig.materials.add(checker);
  // hanafuda earrings
  const earMat = toonMaterial({ color: 0xf2eee6, shade: 0xb0a8b8 });
  const sunMat = toonMaterial({ color: 0xd8312a, unlit: true });
  const R = rig.d.headR;
  for (const x of [1, -1]) {
    const card = box(0.012, 0.055, 0.032, x * R * 1.0, head.headCenter.y - 0.045, head.headCenter.z - 0.005);
    rig.add('head', card, earMat);
    const sun = sphere(0.009, 8, 6);
    sun.scale(0.5, 1, 1);
    sun.translate(x * (R * 1.0 + 0.007), head.headCenter.y - 0.04, head.headCenter.z - 0.005);
    rig.add('head', sun, sunMat);
  }
  const sword = buildSword(rig, T, { blade: 0x15161c, bladeShade: 0x4c4f66, guard: 0xc0462a, hilt: 0x1d2440, edge: 0xc8d2dc, flame: true });
  scabbard(rig, T, 0x14120f, 0xb34a2a);
  rig.build();
  return finalize(rig, { id: 'tanjiro', head, sword, faces, T });
}

export function buildGiyu(T) {
  const hairOpts = {
    seed: 23,
    count: 30,
    len: [0.1, 0.18],
    rad: [0.035, 0.05],
    root: 0x121420,
    tip: 0x1d2236,
    sweep: new THREE.Vector3(0, -0.8, -0.45),
    outward: 0.6,
    frontCut: 0.25,
    coverage: 1.4,
    capTilt: -0.5,
    bangs: [
      { u: 0.05, len: 0.13, rad: 0.03, dz: 0.05 },
      { u: 0.35, len: 0.14, rad: 0.034, dx: 0.12 },
      { u: -0.3, len: 0.13, rad: 0.034, dx: -0.1 },
      { u: 0.75, len: 0.17, rad: 0.035, dx: 0.1 },
      { u: -0.75, len: 0.17, rad: 0.035, dx: -0.1 },
      { u: 1.05, len: 0.18, rad: 0.03 },
      { u: -1.05, len: 0.18, rad: 0.03 },
    ],
  };
  const faces = { neutral: 'face_giyu_neutral', fierce: 'face_giyu_fierce', hurt: 'face_giyu_hurt' };
  const { rig, head } = buildSwordsman(T, { hair: hairOpts, faces, dims: { hipY: 0.96, upperArm: 0.29, thigh: 0.44 }, hairShade: 0x6d7090 });
  const solidM = mat(T, 'giyuSolid', 0x7b2331, { shade: 0x7a6090, rim: 0.45, repeat: [2, 2], side: THREE.DoubleSide });
  const kikkoM = mat(T, 'giyuKikko', 0xd9ad3c, { shade: 0x8a7a8a, rim: 0.45, repeat: [2, 1.5], side: THREE.DoubleSide });
  // his left (+X) is tortoiseshell, his right (-X) solid wine red
  buildHaori(rig, T, kikkoM, solidM, { length: 0.66 });
  rig.materials.add(solidM);
  rig.materials.add(kikkoM);
  // low ponytail on a spring chain
  const pony = rig.spring('ponytail', 'head', [0, 0.02, -0.12], 0.34, { rest: [0.35, 0, 0], stiffness: 0.1, damping: 0.86, gravity: 0.06, maxAngle: 1.3 });
  const hairMat = head.hairMat;
  const pg = [];
  const tail = limb(0.05, 0.02, 0.32, 8, 3);
  gradientColors(tail, 0x151827, 0x1d2236, (i, p) => -p.getY(i) / 0.34);
  pg.push(tail);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sp = spike(new THREE.Vector3(Math.cos(a) * 0.02, -0.26, Math.sin(a) * 0.02), new THREE.Vector3(Math.cos(a) * 0.4, -1, Math.sin(a) * 0.4), 0.022, 0.12);
    gradientColors(sp, 0x151827, 0x232a44);
    pg.push(sp);
  }
  const tie = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8);
  tie.translate(0, -0.02, 0);
  const pMesh = new THREE.Mesh(merge(pg), hairMat);
  pMesh.frustumCulled = false;
  pony.add(pMesh);
  rig.meshes.push(pMesh);
  const sword = buildSword(rig, T, { blade: 0x2c63c4, bladeShade: 0x3a4f8a, guard: 0x2a2a33, hilt: 0x2a2f4a, edge: 0xd8ecff, flame: false, bladeGlow: 0x061430 });
  scabbard(rig, T, 0x151515, 0x8a7a50);
  rig.build();
  return finalize(rig, { id: 'giyu', head, sword, faces, T });
}

export function buildRengoku(T) {
  // a mane of gold that flares up and back like a flame, crimson at the tips, long locks framing the face
  const hairOpts = {
    seed: 31,
    count: 42,
    len: [0.12, 0.23],
    rad: [0.042, 0.06],
    root: 0xf2bf2c,
    tip: 0xd4381a,
    sweep: new THREE.Vector3(0, 0.45, -0.95),
    outward: 0.62,
    frontCut: 0.3,
    crown: 0.9,
    coverage: 1.45,
    // the cap stops at a clean hairline (with the default fit the brow shows through it in streaks)
    capTilt: -0.8,
    capTheta: 1.62,
    bangs: [
      { u: 0.9, len: 0.21, rad: 0.036, dx: 0.02 },
      { u: -0.9, len: 0.21, rad: 0.036, dx: -0.02 },
      { u: 1.2, len: 0.23, rad: 0.034 },
      { u: -1.2, len: 0.23, rad: 0.034 },
    ],
  };
  const faces = { neutral: 'face_rengoku_neutral', fierce: 'face_rengoku_fierce', hurt: 'face_rengoku_hurt' };
  const { rig, head } = buildSwordsman(T, {
    hair: hairOpts, faces, skin: 0xf5d8c4, hairShade: 0xb0704a,
    dims: { hipY: 0.99, upperArm: 0.3, foreArm: 0.26, thigh: 0.46, shin: 0.44, shoulderX: 0.188, headR: 0.119 },
  });
  // white haori with flames rising from the hem and the cuffs; the body of it samples only the plain upper half
  const plain = mat(T, 'rengokuHaori', 0xefe9dc, { shade: 0x9c92a8, rim: 0.45, repeat: [2, 0.5], offset: [0, 0.5], side: THREE.DoubleSide });
  const hem = mat(T, 'rengokuHaori', 0xe8e0d0, { shade: 0x9c92a8, rim: 0.45, repeat: [0.5, 1], side: THREE.DoubleSide });
  // (a whole number of tiles round the closed sleeve, or the pattern breaks down its front)
  const cuff = mat(T, 'rengokuHaori', 0xe8e0d0, { shade: 0x9c92a8, rim: 0.45, repeat: [2, 1], side: THREE.DoubleSide });
  buildHaori(rig, T, plain, plain, { length: 0.66, skirt: [hem, hem], sleeve: [cuff, cuff] });
  rig.materials.add(plain);
  const sword = buildSword(rig, T, { blade: 0xc8321c, bladeShade: 0x6e1c1a, guard: 0xd87a22, hilt: 0x7e1a14, edge: 0xffe0bc, flame: true, bladeGlow: 0x1a0500 });
  scabbard(rig, T, 0x1a1210, 0xc8561c);
  rig.build();
  return finalize(rig, { id: 'rengoku', head, sword, faces, T });
}

/** Kaburamaru: the white snake coiled round Obanai's neck, head raised by his right cheek (chest-joint space). */
function kaburamaru(rig) {
  const pts = [
    [0.13, 0.215, 0.118], [0.168, 0.278, 0.03], [0.12, 0.312, -0.1], [-0.02, 0.322, -0.132], [-0.14, 0.305, -0.06],
    [-0.13, 0.268, 0.085], [-0.03, 0.246, 0.14], [0.1, 0.262, 0.112], [0.165, 0.302, 0.0], [0.07, 0.338, -0.112],
    [-0.07, 0.342, -0.11], [-0.155, 0.358, -0.02], [-0.176, 0.39, 0.035], [-0.166, 0.41, 0.086],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(curve, 90, 1, 8, false);
  const pos = tube.attributes.position, uv = tube.attributes.uv;
  const c = new THREE.Vector3(), q = new THREE.Vector3();
  const col = new Float32Array(pos.count * 3);
  const belly = new THREE.Color(0xe8e2d8), back = new THREE.Color(0xfbfaff), band = new THREE.Color(0xcfc8dc), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    curve.getPointAt(Math.min(1, u), c);
    q.fromBufferAttribute(pos, i).sub(c);
    const r = 0.0155 * Math.min(1, 0.22 + u * 2.4) * (u > 0.94 ? 1.08 : 1);
    q.multiplyScalar(r);
    pos.setXYZ(i, c.x + q.x, c.y + q.y, c.z + q.z);
    tmp.copy(back).lerp(belly, 0.5 + 0.5 * Math.cos(v * Math.PI * 2));
    // faint scale bands along the back
    if (Math.sin(u * 220) > 0.55) tmp.lerp(band, 0.35 * (0.5 - 0.5 * Math.cos(v * Math.PI * 2)));
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  tube.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tube.computeVertexNormals();
  const skin = toonMaterial({ color: 0xffffff, vertexColors: true, shade: 0x9a90b8, rim: 0.55, spec: 0.3 });
  rig.add('chest', tube, skin);
  // head: a blunt wedge along the curve's end, red eyes, forked tongue
  const end = curve.getPointAt(1), dir = curve.getTangentAt(1).normalize();
  const hg = sphere(0.024, 12, 8);
  hg.scale(0.9, 0.62, 1.5);
  const basis = new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, new THREE.Vector3(0, 1, 0));
  // lookAt points -Z at the target: flip so the snout leads
  hg.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI));
  hg.applyMatrix4(basis);
  hg.translate(end.x + dir.x * 0.02, end.y + dir.y * 0.02, end.z + dir.z * 0.02);
  solid(hg, 0xfbfaff);
  rig.add('chest', hg, skin);
  const eyeMat = toonMaterial({ color: 0xd8203a, unlit: true });
  const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const eyes = [];
  for (const sgn of [1, -1]) {
    const e = sphere(0.0065, 6, 4);
    const p = end.clone().addScaledVector(dir, 0.03).addScaledVector(side, sgn * 0.016).add(new THREE.Vector3(0, 0.009, 0));
    e.translate(p.x, p.y, p.z);
    eyes.push(e);
  }
  const tongue = new THREE.ConeGeometry(0.004, 0.035, 4);
  tongue.rotateX(Math.PI / 2);
  tongue.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(dir.x, dir.z)));
  const tp = end.clone().addScaledVector(dir, 0.07).add(new THREE.Vector3(0, -0.005, 0));
  tongue.translate(tp.x, tp.y, tp.z);
  rig.add('chest', merge([...eyes, tongue]), eyeMat);
  rig.materials.add(skin);
  rig.materials.add(eyeMat);
}

/**
 * Obanai's bandage beyond the face decal: under the chin and round the sides of the jaw (the decal paints the
 * front, down to where it ends at the jaw). Same jaw deformation as the head so it hugs it.
 */
function jawBandage(rig, head) {
  const R = rig.d.headR * 1.022;
  const c = head.headCenter;
  const pieces = [
    new THREE.SphereGeometry(R, 30, 6, Math.PI / 2 - 2.2, 4.4, 2.02, 0.74), // under the chin, ear to ear
    // the cheek wraps, which dip below the ears (phi 2.96-3.32 and -0.18-0.18) on their way round
    new THREE.SphereGeometry(R, 3, 5, Math.PI / 2 + 1.02, 0.31, 1.66, 0.4), // his right cheek
    new THREE.SphereGeometry(R, 6, 3, 2.9, 0.871, 1.86, 0.2), // under his right ear
    new THREE.SphereGeometry(R, 3, 5, 0.24, 0.311, 1.66, 0.4), // his left cheek
    new THREE.SphereGeometry(R, 6, 3, Math.PI / 2 - 2.2, 0.869, 1.86, 0.2), // under his left ear
  ];
  const cream = new THREE.Color(0xf1ebdf), fold = new THREE.Color(0xd2cbd8), tmp = new THREE.Color();
  for (const g of pieces) {
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      // polar angle of this vertex: faint lines where one wrap overlaps the next
      const th = Math.acos(THREE.MathUtils.clamp(p.getY(i) / R, -1, 1));
      const k = Math.max(0, 1 - Math.abs(th - 2.2) / 0.035) + Math.max(0, 1 - Math.abs(th - 2.46) / 0.035) * 0.8 + Math.max(0, 1 - Math.abs(th - 1.86) / 0.03) * 0.7;
      tmp.copy(cream).lerp(fold, Math.min(1, k));
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    deformHead(g, R);
    g.translate(c.x, c.y, c.z);
  }
  const m = toonMaterial({ color: 0xffffff, vertexColors: true, shade: 0xa39bb5, rim: 0.2 });
  rig.add('head', merge(pieces), m);
  rig.materials.add(m);
}

export function buildObanai(T) {
  // straight black hair to the jaw, a heavy fringe over the brow
  const hairOpts = {
    seed: 47,
    count: 34,
    len: [0.13, 0.22],
    rad: [0.034, 0.05],
    root: 0x131218,
    tip: 0x24212e,
    sweep: new THREE.Vector3(0, -0.95, -0.28),
    outward: 0.4,
    frontCut: 0.3,
    coverage: 1.45,
    capTilt: -0.55,
    bangs: [
      { u: 0.0, polar: 0.5, len: 0.075, rad: 0.036, dz: 0.1 },
      { u: 0.3, polar: 0.52, len: 0.075, rad: 0.036, dx: 0.12 },
      { u: -0.3, polar: 0.52, len: 0.075, rad: 0.036, dx: -0.12 },
      { u: 0.72, len: 0.17, rad: 0.034, dx: 0.06 },
      { u: -0.72, len: 0.17, rad: 0.034, dx: -0.06 },
      { u: 1.02, len: 0.21, rad: 0.033 },
      { u: -1.02, len: 0.21, rad: 0.033 },
    ],
  };
  const faces = { neutral: 'face_obanai_neutral', fierce: 'face_obanai_fierce', hurt: 'face_obanai_hurt' };
  const { rig, head } = buildSwordsman(T, {
    hair: hairOpts, faces, skin: 0xf3d7c6, hairShade: 0x6a6480,
    dims: { hipY: 0.88, spine: 0.105, chest: 0.18, upperArm: 0.265, foreArm: 0.235, thigh: 0.405, shin: 0.4, shoulderX: 0.165, headR: 0.114 },
  });
  jawBandage(rig, head);
  const stripes = mat(T, 'obanaiStripes', 0xd8d4cc, { shade: 0x8a8298, rim: 0.45, repeat: [3, 2], side: THREE.DoubleSide });
  buildHaori(rig, T, stripes, stripes, { length: 0.6 });
  rig.materials.add(stripes);
  kaburamaru(rig);
  const sword = buildSword(rig, T, { blade: 0x7a52b8, bladeShade: 0x3c2a66, guard: 0x3a3148, hilt: 0x2a2440, edge: 0xeee6ff, flame: false, bladeGlow: 0x0d051a, wave: 0.009 });
  scabbard(rig, T, 0x16141c, 0x7a5ab0);
  rig.build();
  return finalize(rig, { id: 'obanai', head, sword, faces, T });
}

export function buildAkaza(T) {
  const rig = new Rig({ hipY: 0.98, upperArm: 0.3, foreArm: 0.27, thigh: 0.45, shin: 0.44, shoulderX: 0.19, headR: 0.116 });
  const d = rig.d;
  const skin = mat(T, 'akazaSkin', 0xf2d9cf, { shade: 0xb68a9e, rim: 0.4, repeat: [1, 1.5] });
  const skinTorso = mat(T, 'akazaSkin', 0xf2d9cf, { shade: 0xb68a9e, rim: 0.4, repeat: [1, 0.55], offset: [0, 0.2] });
  const skinFace = toonMaterial({ color: 0xf2d9cf, shade: 0xb68a9e, rim: 0.3 });
  const top = mat(T, 'akazaTop', 0xa4235e, { shade: 0x6a3a7a, rim: 0.45, repeat: [2, 2], side: THREE.DoubleSide });
  const pants = mat(T, 'akazaPants', 0xece4d6, { shade: 0x8f88a8, rim: 0.4, repeat: [2, 2], side: THREE.DoubleSide });
  const rope = toonMaterial({ color: 0x27306e, shade: 0x55608a });
  const nails = toonMaterial({ color: 0x3a6fd0, shade: 0x445599 });
  // torso (bare, tattooed) with open short jacket
  const pelvis = sphere(0.165, 14, 10);
  pelvis.scale(1, 0.75, 0.8);
  rig.add('hips', pelvis, pants);
  const abdomen = new THREE.CylinderGeometry(0.13, 0.15, 0.17, 12);
  abdomen.scale(1, 1, 0.78);
  abdomen.translate(0, 0.07, 0);
  rig.add('spine', abdomen, skinTorso);
  rig.add('chest', torso(0.145, 0.2, 0.25, 0.68), skinTorso);
  const jacketGap = 1.4;
  const jl = shell(0.17, 0.2, 0.3, jacketGap / 2, Math.PI - jacketGap / 2, 10, 2);
  jl.scale(1, 1, 0.8);
  jl.translate(0, 0.28, -0.01);
  const jr = shell(0.17, 0.2, 0.3, Math.PI, Math.PI - jacketGap / 2, 10, 2);
  jr.scale(1, 1, 0.8);
  jr.translate(0, 0.28, -0.01);
  rig.add('chest', jl, top);
  rig.add('chest', jr, top);
  const yoke = new THREE.SphereGeometry(0.2, 14, 6, 0, Math.PI * 2, 0, 0.85);
  yoke.scale(1.05, 0.5, 0.8);
  yoke.translate(0, 0.22, -0.02);
  rig.add('chest', yoke, top);
  // sash
  const sash = new THREE.CylinderGeometry(0.155, 0.16, 0.06, 14, 1, true);
  sash.scale(1, 1, 0.8);
  sash.translate(0, 0.01, 0);
  rig.add('spine', sash, rope);
  const knot = sphere(0.035, 8, 6);
  knot.translate(0.06, 0.0, 0.13);
  rig.add('spine', knot, rope);
  // arms: short sleeves then bare tattooed arms
  for (const s of ['L', 'R']) {
    rig.add('upperArm' + s, limb(0.064, 0.052, d.upperArm), skin);
    const sl = shell(0.075, 0.09, 0.14, 0, Math.PI * 2, 10, 1);
    sl.translate(0, 0.02, 0);
    rig.add('upperArm' + s, sl, top);
    rig.add('foreArm' + s, limb(0.052, 0.04, d.foreArm - 0.02), skin);
    const fist = sphere(0.05, 10, 8);
    fist.scale(0.9, 1.05, 1.0);
    fist.translate(0, -0.05, 0.01);
    rig.add('hand' + s, fist, skinFace);
    const knuckles = box(0.07, 0.03, 0.05, 0, -0.085, 0.03);
    rig.add('hand' + s, knuckles, skinFace);
    const nail = box(0.06, 0.008, 0.012, 0, -0.1, 0.05);
    rig.add('hand' + s, nail, nails);
  }
  // legs: wide pale trousers to mid-shin, bare tattooed feet
  for (const s of ['L', 'R']) {
    rig.add('thigh' + s, limb(0.1, 0.085, d.thigh), pants);
    const p = shell(0.12, 0.115, d.thigh + 0.08, 0, Math.PI * 2, 12, 2);
    p.translate(0, 0.03, 0);
    rig.add('thigh' + s, p, pants);
    const lowerPants = shell(0.11, 0.085, 0.24, 0, Math.PI * 2, 12, 1);
    lowerPants.translate(0, 0.02, 0);
    rig.add('shin' + s, lowerPants, pants);
    rig.add('shin' + s, limb(0.068, 0.045, d.shin - 0.02), skin);
    const foot = box(0.09, 0.055, 0.22, 0, -0.035, 0.05);
    rig.add('foot' + s, foot, skin);
  }
  const hairOpts = {
    seed: 5,
    count: 30,
    len: [0.08, 0.14],
    rad: [0.03, 0.045],
    root: 0xd9607a,
    tip: 0xffb2c0,
    sweep: new THREE.Vector3(0, 0.25, -0.35),
    outward: 1.1,
    frontCut: 0.3,
    coverage: 1.1,
    capTilt: -0.45,
    bangs: [
      { u: 0.0, polar: 0.55, len: 0.08, rad: 0.028, dz: 0.3 },
      { u: 0.4, polar: 0.55, len: 0.09, rad: 0.03, dx: 0.3 },
      { u: -0.4, polar: 0.55, len: 0.09, rad: 0.03, dx: -0.3 },
    ],
  };
  const faces = { neutral: 'face_akaza_neutral', fierce: 'face_akaza_fierce', hurt: 'face_akaza_fierce' };
  const head = buildHead(rig, T, { skinMat: skinFace, hair: hairOpts, faces, hairShade: 0xb06a8a });
  for (const m of [skin, skinTorso, skinFace, top, pants, rope, nails]) rig.materials.add(m);
  rig.build();
  return finalize(rig, { id: 'akaza', head, sword: null, faces, T });
}

export function buildDemon(T, variant = 'grunt', seed = 1) {
  const rnd = mulberry32(seed * 97 + 13);
  const big = variant === 'brute';
  const fast = variant === 'fast';
  const dims = big
    ? { hipY: 1.12, spine: 0.14, chest: 0.24, neck: 0.25, upperArm: 0.42, foreArm: 0.4, thigh: 0.5, shin: 0.5, shoulderX: 0.28, hipX: 0.14, headR: 0.14 }
    : fast
      ? { hipY: 0.9, upperArm: 0.36, foreArm: 0.34, thigh: 0.42, shin: 0.43, shoulderX: 0.16, headR: 0.11 }
      : { hipY: 0.92, upperArm: 0.33, foreArm: 0.31, shoulderX: 0.18, headR: 0.12 };
  const rig = new Rig(dims);
  const d = rig.d;
  const hue = rnd();
  const skinCol = new THREE.Color().setHSL(0.28 + hue * 0.12, 0.12, big ? 0.42 : 0.55);
  const skin = mat(T, 'demonSkin', skinCol.getHex(), { shade: 0x6a5a7a, rim: 0.45, tint: skinCol.clone().lerp(new THREE.Color(1, 1, 1), 0.5).getHex(), repeat: [1, 1], dissolve: true });
  const rag = mat(T, 'demonRags', 0x5a2222, { shade: 0x5a4a6a, rim: 0.4, repeat: [2, 2], side: THREE.DoubleSide, dissolve: true, alphaTest: 0.5 });
  const horn = toonMaterial({ color: big ? 0x3a2a24 : 0xd8cbb0, shade: 0x6a5a6a, dissolve: true });
  const claw = toonMaterial({ color: 0x2a1f22, shade: 0x5a4a5a, dissolve: true });
  const skinFace = toonMaterial({ color: skinCol, shade: 0x6a5a7a, rim: 0.3, dissolve: true });
  const r = big ? 1.5 : fast ? 0.85 : 1;
  const pelvis = sphere(0.16 * r, 12, 8);
  pelvis.scale(1, 0.75, 0.8);
  rig.add('hips', pelvis, rag);
  const abdomen = new THREE.CylinderGeometry(0.12 * r, 0.14 * r, 0.16, 10);
  abdomen.translate(0, 0.07, 0);
  rig.add('spine', abdomen, skin);
  rig.add('chest', torso(0.13 * r, 0.18 * r, d.chest + 0.05, 0.75), skin);
  // tattered robe hanging from the hips
  const skirt = shell(0.17 * r, 0.24 * r, 0.45 + (big ? 0.15 : 0), 0.4, Math.PI * 2 - 0.8, 10, 3);
  skirt.translate(0, 0.05, 0);
  rig.add('hips', skirt, rag);
  const shoulderRag = shell(0.16 * r, 0.2 * r, 0.22, Math.PI * 0.6, Math.PI * 1.2, 10, 2);
  shoulderRag.translate(0, d.chest + 0.08, 0);
  rig.add('chest', shoulderRag, rag);
  for (const s of ['L', 'R']) {
    rig.add('upperArm' + s, limb(0.052 * r, 0.042 * r, d.upperArm), skin);
    rig.add('foreArm' + s, limb(0.045 * r, 0.035 * r, d.foreArm), skin);
    const hand = sphere(0.05 * r, 8, 6);
    hand.scale(1, 1.2, 0.7);
    hand.translate(0, -0.05 * r, 0);
    rig.add('hand' + s, hand, skin);
    for (let k = 0; k < 4; k++) {
      const x = (k - 1.5) * 0.022 * r;
      const cl = spike(new THREE.Vector3(x, -0.09 * r, 0.01), new THREE.Vector3(x * 2, -1, 0.35), 0.012 * r, 0.1 * r, 5);
      rig.add('hand' + s, cl, claw);
    }
    rig.add('thigh' + s, limb(0.085 * r, 0.065 * r, d.thigh), skin);
    rig.add('shin' + s, limb(0.062 * r, 0.045 * r, d.shin), skin);
    const foot = box(0.09 * r, 0.05, 0.2 * r, 0, -0.035, 0.05);
    rig.add('foot' + s, foot, skin);
    for (let k = 0; k < 3; k++) {
      const x = (k - 1) * 0.03 * r;
      rig.add('foot' + s, spike(new THREE.Vector3(x, -0.04, 0.14 * r), new THREE.Vector3(0, -0.3, 1), 0.012 * r, 0.06 * r, 5), claw);
    }
  }
  const hairOpts = {
    seed: seed * 3 + 1,
    count: big ? 14 : 20,
    len: [0.08, 0.2],
    rad: [0.025, 0.045],
    root: 0x14100f,
    tip: 0x2a2020,
    sweep: new THREE.Vector3(0, -0.9, -0.5),
    outward: 0.5,
    frontCut: 0.1,
    coverage: 1.3,
    capTilt: -0.85,
    capTheta: 1.7,
    bangs: [{ u: 0.9, len: 0.14, rad: 0.03 }, { u: -1.0, len: 0.16, rad: 0.03 }],
  };
  const faceKey = variant === 'brute' || rnd() < 0.4 ? 'face_demon_b' : 'face_demon_a';
  const head = buildHead(rig, T, { skinMat: skinFace, hair: hairOpts, faces: { neutral: faceKey, fierce: faceKey, hurt: faceKey } });
  // horns
  const R = d.headR;
  const hc = head.headCenter;
  const horns = [];
  const nH = big ? 2 : rnd() < 0.5 ? 1 : 2;
  for (let i = 0; i < nH; i++) {
    const x = nH === 1 ? 0 : i === 0 ? 0.5 : -0.5;
    const dir = new THREE.Vector3(x * 0.8, 1, 0.25);
    const base = hc.clone().add(new THREE.Vector3(x * R * 0.7, R * 0.75, R * 0.3));
    horns.push(spike(base, dir, (big ? 0.035 : 0.025), big ? 0.2 : 0.12, 6));
  }
  rig.add('head', merge(horns), horn);
  head.faceMat.defines.USE_DISSOLVE = '';
  head.faceMat.needsUpdate = true;
  head.hairMat.defines.USE_DISSOLVE = '';
  head.hairMat.needsUpdate = true;
  for (const m of [skin, rag, horn, claw, skinFace]) rig.materials.add(m);
  rig.build();
  return finalize(rig, { id: 'demon_' + variant, head, sword: null, faces: { neutral: faceKey }, T });
}

function finalize(rig, info) {
  for (const m of rig.materials) if (m.uniforms?.uCamMix) m.uniforms.uCamMix.value = 0.65;
  const model = {
    id: info.id,
    rig,
    root: rig.root,
    head: info.head,
    sword: info.sword,
    materials: [...rig.materials],
    faces: info.faces,
    T: info.T,
    face: 'neutral',
    setFace(name) {
      if (this.face === name) return;
      const key = this.faces[name] || this.faces.neutral;
      const tex = this.T?.[key];
      if (!tex) return;
      this.face = name;
      const u = this.head.faceMat.uniforms;
      if (u.uMap) u.uMap.value = tex;
    },
  };
  // face uses toon map define only if a texture was present at build time
  return model;
}
