import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Capsule hanging down from the origin along -Y, tapering from r0 (top) to r1 (bottom). */
export function limb(r0, r1, len, radial = 10, cap = 4) {
  const pts = [];
  for (let i = 0; i <= cap; i++) {
    const a = (Math.PI / 2) * (1 - i / cap);
    pts.push(new THREE.Vector2(Math.max(1e-4, r0 * Math.cos(a)), r0 * Math.sin(a)));
  }
  for (let i = 1; i <= cap; i++) {
    const a = (-Math.PI / 2) * (i / cap);
    pts.push(new THREE.Vector2(Math.max(1e-4, r1 * Math.cos(a)), -len + r1 * Math.sin(a)));
  }
  const g = new THREE.LatheGeometry(pts, radial);
  return g;
}

/** Open cone/cylinder shell (cloth) hanging from y=0 to y=-h. thetaStart measured like CylinderGeometry. */
export function shell(rTop, rBot, h, thetaStart = 0, thetaLen = Math.PI * 2, radial = 16, hSeg = 3) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, radial, hSeg, true, thetaStart, thetaLen);
  g.translate(0, -h / 2, 0);
  return g;
}

export function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

export function sphere(r, ws = 14, hs = 10) {
  return new THREE.SphereGeometry(r, ws, hs);
}

export function cone(r, h, radial = 8) {
  const g = new THREE.ConeGeometry(r, h, radial, 1, false);
  return g;
}

/** Ensure geometry has position/normal/uv and is non-indexed so any set can be merged. */
export function normalizeGeo(g) {
  let out = g.index ? g.toNonIndexed() : g;
  if (!out.attributes.uv) {
    const n = out.attributes.position.count;
    out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  if (!out.attributes.normal) out.computeVertexNormals();
  for (const k of Object.keys(out.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') out.deleteAttribute(k);
  }
  out.morphAttributes = {};
  return out;
}

export function merge(geos) {
  if (geos.length === 1) return geos[0];
  const hasColor = geos.some((g) => g.attributes.color);
  const norm = geos.map((g) => {
    const n = normalizeGeo(g);
    if (hasColor && !n.attributes.color) {
      const c = new Float32Array(n.attributes.position.count * 3).fill(1);
      n.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    if (!hasColor && n.attributes.color) n.deleteAttribute('color');
    return n;
  });
  return mergeGeometries(norm, false);
}

/** Average normals of coincident vertices (fixes seams on deformed spheres). */
export function smoothSeams(g, eps = 1e-4) {
  const p = g.attributes.position, n = g.attributes.normal;
  const map = new Map();
  const key = (i) => `${Math.round(p.getX(i) / eps)},${Math.round(p.getY(i) / eps)},${Math.round(p.getZ(i) / eps)}`;
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    let e = map.get(k);
    if (!e) map.set(k, (e = { x: 0, y: 0, z: 0, ids: [] }));
    e.x += n.getX(i); e.y += n.getY(i); e.z += n.getZ(i);
    e.ids.push(i);
  }
  for (const e of map.values()) {
    const l = Math.hypot(e.x, e.y, e.z) || 1;
    for (const i of e.ids) n.setXYZ(i, e.x / l, e.y / l, e.z / l);
  }
  n.needsUpdate = true;
  return g;
}

export function paint(g, color) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Katana blade along +Y, slight curve toward -Z (spine side). */
export function katanaBlade(len = 0.92, width = 0.034, thick = 0.008, curve = 0.03) {
  const seg = 16;
  const pos = [], nrm = [], uv = [], idx = [];
  // cross-section: diamond-ish (edge at -z... spine at +z)
  const ring = [
    [0, -width * 0.5], // edge
    [thick * 0.5, 0.05 * width],
    [thick * 0.35, width * 0.5], // spine side
    [-thick * 0.35, width * 0.5],
    [-thick * 0.5, 0.05 * width],
  ];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const y = t * len;
    const bend = curve * t * t;
    const taper = t > 0.88 ? 1 - (t - 0.88) / 0.12 * 0.92 : 1;
    for (let k = 0; k < ring.length; k++) {
      const [x, z] = ring[k];
      // tip (kissaki) slants toward the edge
      const zz = z * taper + (t > 0.88 ? -(t - 0.88) * width * 1.2 : 0);
      pos.push(x * (0.3 + 0.7 * taper), y, zz + bend);
      nrm.push(x, 0, z);
      uv.push(k / ring.length, t);
    }
  }
  const R = ring.length;
  for (let i = 0; i < seg; i++) {
    for (let k = 0; k < R; k++) {
      const a = i * R + k, b = i * R + ((k + 1) % R), c = (i + 1) * R + k, d = (i + 1) * R + ((k + 1) % R);
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Flame-shaped tsuba (Rengoku's guard, inherited by Tanjiro) in the XZ plane. */
export function flameTsuba(r = 0.055, thick = 0.012) {
  const shape = new THREE.Shape();
  const n = 8;
  for (let i = 0; i <= n * 4; i++) {
    const a = (i / (n * 4)) * Math.PI * 2;
    const k = i % 4;
    const rr = k === 0 ? r * 1.15 : k === 1 ? r * 0.92 : k === 2 ? r * 1.02 : r * 0.84;
    const x = Math.cos(a + (k === 0 ? 0.08 : 0)) * rr;
    const y = Math.sin(a + (k === 0 ? 0.08 : 0)) * rr;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const hole = new THREE.Path();
  hole.absellipse(0, 0, 0.012, 0.02, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -thick / 2);
  g.rotateX(Math.PI / 2);
  return g;
}

export function hexTsuba(r = 0.05, thick = 0.01) {
  const g = new THREE.CylinderGeometry(r, r, thick, 6, 1, false);
  return g;
}
