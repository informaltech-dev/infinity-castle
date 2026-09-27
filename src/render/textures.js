// Procedural hand-painted texture library for the Infinity Castle demo.
// Everything is drawn with Canvas 2D from a seeded RNG, so the output is
// deterministic. See src/render/tex/* for the individual painters.
import * as THREE from 'three';
import { hashString } from './tex/core.js';
import { paper, noise } from './tex/data.js';
import { woodFloor, woodDark, pillarRed, shoji, fusuma1, fusuma2, fusuma3, roofTiles, plaster, tatami, lantern } from './tex/env.js';
import {
  checkerTanjiro, giyuSolid, giyuKikko, uniformBlack, legWraps, akazaSkin, akazaTop, akazaPants,
  demonSkin, demonRags, hairTanjiro, hairGiyu, hairAkaza, rengokuHaori, obanaiStripes,
} from './tex/fabric.js';
import { FACE_MAKERS } from './tex/faces.js';
import { crack, compass, waveCurl, splash, flame, flameTiger, smoke, shadow } from './tex/fx.js';

// kind: 'data' => NoColorSpace, otherwise sRGB colour.
// tile: RepeatWrapping (drawn seamless); clampY: only across (vertical edges clamp). aniso: anisotropy 8 (floors / walls).
// blend: informational hint for effect sprites ('alpha' | 'additive').
const SPECS = [
  { name: 'paper', make: paper, kind: 'data', tile: true },
  { name: 'noise', make: noise, kind: 'data', tile: true },

  { name: 'woodFloor', make: woodFloor, tile: true, aniso: true },
  { name: 'woodDark', make: woodDark, tile: true, aniso: true },
  { name: 'pillarRed', make: pillarRed, tile: true, aniso: true },
  { name: 'shoji', make: shoji, aniso: true },
  { name: 'fusuma1', make: fusuma1, aniso: true },
  { name: 'fusuma2', make: fusuma2, aniso: true },
  { name: 'fusuma3', make: fusuma3, aniso: true },
  { name: 'roofTiles', make: roofTiles, tile: true, aniso: true },
  { name: 'plaster', make: plaster, tile: true, aniso: true },
  { name: 'tatami', make: tatami, aniso: true },
  { name: 'lantern', make: lantern },

  { name: 'checkerTanjiro', make: checkerTanjiro, tile: true },
  { name: 'giyuSolid', make: giyuSolid, tile: true },
  { name: 'giyuKikko', make: giyuKikko, tile: true },
  // seamless left-right only: mapped once vertically (hem = canvas bottom); the top half is plain cream
  { name: 'rengokuHaori', make: rengokuHaori, tile: true, clampY: true }, // hem at the bottom, mapped once vertically
  { name: 'obanaiStripes', make: obanaiStripes, tile: true },
  { name: 'uniformBlack', make: uniformBlack, tile: true },
  { name: 'legWraps', make: legWraps, tile: true },
  { name: 'akazaSkin', make: akazaSkin, tile: true },
  { name: 'akazaTop', make: akazaTop, tile: true },
  { name: 'akazaPants', make: akazaPants, tile: true },
  { name: 'demonSkin', make: demonSkin, tile: true },
  { name: 'demonRags', make: demonRags, tile: true },
  { name: 'hairTanjiro', make: hairTanjiro },
  { name: 'hairGiyu', make: hairGiyu },
  { name: 'hairAkaza', make: hairAkaza },

  ...Object.keys(FACE_MAKERS).map((name) => ({ name, make: FACE_MAKERS[name], face: true })),

  { name: 'crack', make: crack, blend: 'alpha' },
  { name: 'compass', make: compass, blend: 'additive' },
  { name: 'waveCurl', make: waveCurl, blend: 'alpha' },
  { name: 'splash', make: splash, blend: 'alpha' },
  { name: 'flame', make: flame, blend: 'alpha' },
  { name: 'flameTiger', make: flameTiger, blend: 'additive' },
  { name: 'smoke', make: smoke, blend: 'alpha' },
  { name: 'shadow', make: shadow, blend: 'alpha' },
];

/** Metadata for tools / the test page: name -> { tile, kind, aniso, face, blend }. */
export const TEXTURE_INFO = Object.fromEntries(
  SPECS.map((s) => [s.name, { tile: !!s.tile, kind: s.kind || 'color', aniso: !!s.aniso, face: !!s.face, blend: s.blend || null }]),
);

function yieldToBrowser() {
  const sch = globalThis.scheduler;
  if (sch && typeof sch.yield === 'function') return sch.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Generates every texture. Yields to the browser between textures so a
 * loading screen can keep animating.
 * @param {(done:number,total:number,name:string)=>void} [onProgress]
 * @returns {Promise<Record<string, THREE.CanvasTexture>>}
 */
export async function createTextures(onProgress) {
  const out = {};
  const total = SPECS.length;
  for (let i = 0; i < total; i++) {
    const spec = SPECS[i];
    const made = spec.make(hashString(spec.name) ^ 0x5bd1e995);
    const canvas = made instanceof HTMLCanvasElement ? made : made.canvas;
    const tex = new THREE.CanvasTexture(canvas);
    tex.name = spec.name;
    tex.colorSpace = spec.kind === 'data' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    if (spec.tile) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if (spec.clampY) tex.wrapT = THREE.ClampToEdgeWrapping;
    if (spec.aniso) tex.anisotropy = 8;
    if (made.mipmaps) {
      // Exact un-premultiplied data (a 2D canvas stores premultiplied alpha,
      // which would destroy R/G/B wherever the Worley alpha channel is low).
      tex.mipmaps = made.mipmaps;
    }
    if (spec.blend) tex.userData.blend = spec.blend;
    out[spec.name] = tex;
    if (onProgress) onProgress(i + 1, total, spec.name);
    await yieldToBrowser();
  }
  return out;
}

// Give the head a slightly tapered anime jaw. Apply to both the head sphere and the face patch.
export function deformHead(geometry, R) {
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) / R, y = p.getY(i) / R, z = p.getZ(i) / R;
    if (y < 0) {
      const t = -y;
      x *= 1 - 0.28 * t;
      z *= 1 - 0.10 * t;
      y *= 1 + 0.22 * Math.max(z, 0);
    }
    p.setXYZ(i, x * R, y * R * 1.06, z * R);
  }
  geometry.computeVertexNormals();
}
