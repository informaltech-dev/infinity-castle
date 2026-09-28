import * as THREE from 'three';
import { createTextures, deformHead, TEXTURE_INFO } from '../src/render/textures.js';
import { setCpuCanvases } from '../src/render/tex/core.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const SECTIONS = [
  ['sec-data', 'Data', (n) => n === 'paper' || n === 'noise'],
  ['sec-env', 'Environment', (n) => ['woodFloor', 'woodDark', 'pillarRed', 'shoji', 'fusuma1', 'fusuma2', 'fusuma3', 'roofTiles', 'plaster', 'tatami', 'lantern'].includes(n)],
  ['sec-char', 'Characters', (n) => !n.startsWith('face_') && ['checkerTanjiro', 'giyuSolid', 'giyuKikko', 'rengokuHaori', 'obanaiStripes', 'uniformBlack', 'legWraps', 'akazaSkin', 'akazaTop', 'akazaPants', 'kokushiboKimono', 'kokushiboHakama', 'demonSkin', 'demonRags', 'hairTanjiro', 'hairGiyu', 'hairAkaza'].includes(n)],
  ['sec-face', 'Face decals (canvas space, transparent)', (n) => n.startsWith('face_')],
  ['sec-fx', 'Effects', (n) => ['crack', 'compass', 'waveCurl', 'splash', 'flame', 'flameTiger', 'smoke', 'shadow'].includes(n)],
];

const TRANSPARENT = new Set(['crack', 'waveCurl', 'splash', 'flame', 'flameTiger', 'smoke', 'shadow', 'demonRags']);
// tileable left-right only (mapped once vertically): shown 2x1, seam checked in x only
const TILE_X_ONLY = new Set(['rengokuHaori']);

// ---------------------------------------------------------------------------
// Generation with timing
// ---------------------------------------------------------------------------
if (params.has('gpu')) setCpuCanvases(params.get('gpu') === '0');
const perTex = {};
let last = 0;
const t0 = performance.now();
last = t0;
const textures = await createTextures((done, total, name) => {
  const now = performance.now();
  perTex[name] = now - last;
  last = now;
  $('bar').firstElementChild.style.width = `${(done / total) * 100}%`;
  $('status').textContent = `${done}/${total} ${name}`;
});
const genMs = performance.now() - t0;
const names = Object.keys(textures);
$('status').textContent = `${names.length} textures generated`;
console.log(`[textures] generated ${names.length} in ${genMs.toFixed(1)} ms`);

// ---------------------------------------------------------------------------
// Three.js face viewer (also used to time the GPU upload of every texture)
// ---------------------------------------------------------------------------
const R = 1;
const SKIN = { tanjiro: '#f6d6c2', giyu: '#f4d5c3', akaza: '#f2d9cf', rengoku: '#f6d8c4', obanai: '#f3d7c6', kokushibo: '#eedad2', demon_a: '#8f9b86', demon_b: '#9aa08e' };
// texture name, or [root, tip] colours for a plain gradient when the library has no hair texture for them
const HAIR = { tanjiro: 'hairTanjiro', giyu: 'hairGiyu', akaza: 'hairAkaza', rengoku: ['#f2c230', '#d2381c'], obanai: 'hairGiyu', kokushibo: ['#141018', '#3a2248'], demon_a: 'hairGiyu', demon_b: 'hairGiyu' };
function hairTexture(h) {
  if (typeof h === 'string') return textures[h];
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, h[0]); g.addColorStop(0.8, h[0]); g.addColorStop(1, h[1]);
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const faceNames = names.filter((n) => n.startsWith('face_'));
const who = (n) => (n.startsWith('face_demon') ? n.slice(5) : n.split('_')[1]);

const bigRenderer = new THREE.WebGLRenderer({ canvas: $('bigView'), antialias: true });
bigRenderer.setPixelRatio(Math.min(2, devicePixelRatio));
bigRenderer.setSize(840, 420, false);
bigRenderer.outputColorSpace = THREE.SRGBColorSpace;
bigRenderer.setScissorTest(true);
const allRenderer = new THREE.WebGLRenderer({ canvas: $('allView'), antialias: true });
allRenderer.setPixelRatio(Math.min(2, devicePixelRatio));
allRenderer.setSize(900, 720, false);
allRenderer.setScissorTest(true);

// honest cost: force every canvas to be flushed and uploaded once
const tu = performance.now();
for (const n of names) bigRenderer.initTexture(textures[n]);
const uploadMs = performance.now() - tu;
$('timing').innerHTML = `generate <b>${genMs.toFixed(0)} ms</b> &middot; first GPU upload (flush) <b>${uploadMs.toFixed(0)} ms</b>`;
console.log(`[textures] upload ${uploadMs.toFixed(1)} ms`);

function hairShell(tex) {
  // spherical cap whose lower rim is cut into bangs at the front and longer at the back
  const geo = new THREE.SphereGeometry(R * 1.05, 96, 24, 0, Math.PI * 2, 0, 1);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i), v = 1 - uv.getY(i);
    const phi = u * Math.PI * 2;
    const front = Math.max(0, Math.sin(phi)); // 1 at +z (face), 0 at the sides/back
    const k = Math.abs(((u * 40) % 2) - 1); // zig-zag strands
    const rim = front > 0.2
      ? 1.08 + 0.14 * k * front + (1 - front) * 0.55
      : 1.66 + 0.5 * (1 - Math.abs(Math.cos(phi))) + 0.12 * k;
    const theta = v * Math.min(rim, 2.35);
    const rr = R * 1.05;
    pos.setXYZ(i, -rr * Math.cos(phi) * Math.sin(theta), rr * Math.cos(theta), rr * Math.sin(phi) * Math.sin(theta));
  }
  deformHead(geo, R);
  const t = tex.clone();
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(10, 1);
  t.needsUpdate = true;
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
}

function makeHead(faceName) {
  const g = new THREE.Group();
  const headGeo = new THREE.SphereGeometry(R, 64, 48);
  deformHead(headGeo, R);
  g.add(new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: SKIN[who(faceName)] })));
  const faceGeo = new THREE.SphereGeometry(R * 1.015, 32, 20, Math.PI / 2 - 1.05, 2.1, 0.55, 1.5);
  deformHead(faceGeo, R);
  g.add(new THREE.Mesh(faceGeo, new THREE.MeshLambertMaterial({ map: textures[faceName], transparent: true, alphaTest: 0.4 })));
  const hair = hairShell(hairTexture(HAIR[who(faceName)]));
  hair.name = 'hair';
  g.add(hair);
  // simple neck so the jaw reads
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.9, 24), new THREE.MeshLambertMaterial({ color: SKIN[who(faceName)] }));
  neck.position.set(0, -1.2, -0.12);
  g.add(neck);
  return g;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color('#5a5160');
scene.add(new THREE.HemisphereLight(0xfff4ea, 0x6a5a6a, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
scene.add(sun);
const heads = Object.fromEntries(faceNames.map((n) => [n, makeHead(n)]));
for (const h of Object.values(heads)) { h.visible = false; scene.add(h); }

const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
const target = new THREE.Vector3(0, -0.12, 0);
function placeCam(yawDeg, dist = 5.4) {
  const a = (yawDeg * Math.PI) / 180;
  cam.position.set(Math.sin(a) * dist, 0.1, Math.cos(a) * dist);
  cam.lookAt(target);
}
function setLight() {
  const a = (Number($('optLight').value) * Math.PI) / 180;
  sun.position.set(Math.sin(a) * 3, 2.5, Math.cos(a) * 3);
}

let current = params.get('face') || 'face_tanjiro_neutral';
let yaw = Number($('optYaw').value);
function show(name, on) {
  heads[name].visible = on;
  heads[name].getObjectByName('hair').visible = $('optHair').checked;
}
function renderBig() {
  setLight();
  const W = 840, H = 420;
  for (const n of faceNames) heads[n].visible = false;
  show(current, true);
  cam.aspect = 1;
  cam.updateProjectionMatrix();
  for (const [i, y] of [[0, 0], [1, yaw]]) {
    placeCam(y);
    bigRenderer.setViewport(i * H, 0, H, H);
    bigRenderer.setScissor(i * H, 0, H, H);
    bigRenderer.render(scene, cam);
  }
  show(current, false);
}
function renderAll() {
  // rows: first half of the faces front, then at 3/4; second half front, then at 3/4
  setLight();
  const cols = Math.ceil(faceNames.length / 2), cell = 180, H = cell * 4;
  allRenderer.setSize(cols * cell, H, false);
  cam.aspect = 1;
  cam.updateProjectionMatrix();
  for (const n of faceNames) heads[n].visible = false;
  faceNames.forEach((n, idx) => {
    show(n, true);
    const col = idx % cols, group = Math.floor(idx / cols);
    for (const [k, y] of [[0, 0], [1, 40]]) {
      placeCam(y, 6.2);
      const row = group * 2 + k;
      const x = col * cell, yPix = H - (row + 1) * cell;
      allRenderer.setViewport(x, yPix, cell, cell);
      allRenderer.setScissor(x, yPix, cell, cell);
      allRenderer.render(scene, cam);
    }
    show(n, false);
  });
}

// buttons
for (const n of faceNames) {
  const b = document.createElement('button');
  b.textContent = n.replace('face_', '');
  b.onclick = () => { current = n; syncButtons(); renderBig(); };
  b.dataset.name = n;
  $('faceButtons').appendChild(b);
}
function syncButtons() {
  for (const b of $('faceButtons').children) b.classList.toggle('on', b.dataset.name === current);
}
syncButtons();
$('optYaw').oninput = () => { yaw = Number($('optYaw').value); $('yawVal').textContent = yaw; renderBig(); };
$('optHair').onchange = () => { renderBig(); renderAll(); };
$('optLight').oninput = () => { renderBig(); renderAll(); };
let drag = null;
$('bigView').addEventListener('pointerdown', (e) => { drag = { x: e.clientX, yaw }; $('bigView').setPointerCapture(e.pointerId); });
$('bigView').addEventListener('pointermove', (e) => {
  if (!drag) return;
  yaw = Math.max(-90, Math.min(90, drag.yaw + (e.clientX - drag.x) * 0.5));
  $('optYaw').value = yaw; $('yawVal').textContent = Math.round(yaw);
  renderBig();
});
$('bigView').addEventListener('pointerup', () => { drag = null; });
renderBig();
renderAll();

// small prop preview: checks the lantern crest proportions and a few tileable wraps
function renderProps(canvas, W, H) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio));
  r.setSize(W, H, false);
  const sc = new THREE.Scene();
  sc.background = new THREE.Color('#2a2430');
  sc.add(new THREE.HemisphereLight(0xfff4ea, 0x40304a, 1.5));
  const dl = new THREE.DirectionalLight(0xffffff, 1.4);
  dl.position.set(2, 3, 4);
  sc.add(dl);
  const prof = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const y = -0.8 + 1.6 * t;
    const bulge = Math.sin(t * Math.PI);
    prof.push(new THREE.Vector2(0.22 + 0.34 * Math.pow(bulge, 0.6), y));
  }
  const lanternMesh = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), new THREE.MeshBasicMaterial({ map: textures.lantern }));
  lanternMesh.position.x = -2.2;
  sc.add(lanternMesh);
  const roof = textures.roofTiles.clone();
  roof.repeat.set(2, 2);
  roof.needsUpdate = true;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), new THREE.MeshLambertMaterial({ map: roof }));
  plane.rotation.x = -0.6;
  sc.add(plane);
  const pil = textures.pillarRed.clone();
  pil.repeat.set(1, 2);
  pil.needsUpdate = true;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.8, 32), new THREE.MeshLambertMaterial({ map: pil }));
  pillar.position.x = 2.2;
  sc.add(pillar);
  const pc = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  pc.position.set(0, 0.3, 6.2 * Math.max(1, 2.8 / (W / H)));
  pc.lookAt(0, 0, 0);
  r.render(sc, pc);
}
renderProps($('propView'), 840, 300);

// ---------------------------------------------------------------------------
// Texture grid
// ---------------------------------------------------------------------------
/**
 * Seam check: the colour jump across the wrap edge (last column -> first
 * column) compared with every interior column-to-column jump. A seamless tile
 * has a wrap jump no larger than what already occurs inside the texture (ratio
 * vs. the 99th percentile <= ~1.2), even when a structural edge such as a
 * checker border lies exactly on the wrap.
 */
function seamScore(canvas) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const colDiff = (xa, xb) => { let s = 0; for (let y = 0; y < h; y++) { const a = (y * w + xa) * 4, b = (y * w + xb) * 4; for (let k = 0; k < 4; k++) s += Math.abs(d[a + k] - d[b + k]); } return s / h; };
  const rowDiff = (ya, yb) => { let s = 0; for (let x = 0; x < w; x++) { const a = (ya * w + x) * 4, b = (yb * w + x) * 4; for (let k = 0; k < 4; k++) s += Math.abs(d[a + k] - d[b + k]); } return s / w; };
  const p99 = (arr) => { const s2 = arr.slice().sort((a, b) => a - b); return s2[Math.floor(s2.length * 0.99)] || 1e-3; };
  const cx = [], cy = [];
  for (let x = 0; x < w - 1; x++) cx.push(colDiff(x, x + 1));
  for (let y = 0; y < h - 1; y++) cy.push(rowDiff(y, y + 1));
  return { x: colDiff(w - 1, 0) / Math.max(1e-3, p99(cx)), y: rowDiff(h - 1, 0) / Math.max(1e-3, p99(cy)) };
}

function channelsView(tex) {
  // noise: show exact R, G, B, A channels side by side
  const lvl = tex.mipmaps && tex.mipmaps[0];
  const N = tex.image.width;
  const c = document.createElement('canvas');
  c.width = N * 2; c.height = N * 2;
  const ctx = c.getContext('2d');
  const src = lvl ? lvl.data : tex.image.getContext('2d').getImageData(0, 0, N, N).data;
  for (let k = 0; k < 4; k++) {
    const img = ctx.createImageData(N, N);
    for (let i = 0; i < N * N; i++) {
      const v = src[i * 4 + k];
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, (k % 2) * N, Math.floor(k / 2) * N);
  }
  ctx.fillStyle = '#e0a64a';
  ctx.font = 'bold 14px sans-serif';
  ['R fine', 'G medium', 'B coarse', 'A worley'].forEach((t, k) => ctx.fillText(t, (k % 2) * N + 6, Math.floor(k / 2) * N + 18));
  return c;
}

function displayCanvas(name, tex) {
  const info = TEXTURE_INFO[name];
  const src = tex.image;
  if (name === 'noise') return channelsView(tex);
  const reps = info.tile ? 2 : 1;
  const repsY = TILE_X_ONLY.has(name) ? 1 : reps;
  const c = document.createElement('canvas');
  c.width = src.width * reps;
  c.height = src.height * repsY;
  const ctx = c.getContext('2d');
  for (let j = 0; j < repsY; j++) for (let i = 0; i < reps; i++) ctx.drawImage(src, i * src.width, j * src.height);
  return c;
}

const lb = $('lightbox');
function openLightbox(name) {
  const tex = textures[name];
  const info = TEXTURE_INFO[name];
  const view = $('lbView');
  view.innerHTML = '';
  view.className = 'view ' + (info.blend === 'additive' ? 'black' : TRANSPARENT.has(name) || info.face ? 'checker' : '');
  view.appendChild(displayCanvas(name, tex));
  $('lbCap').textContent = `${name}  ${tex.image.width}x${tex.image.height}${info.tile ? (TILE_X_ONLY.has(name) ? '  (shown 2x1)' : '  (shown 2x2)') : ''}`;
  lb.classList.add('open');
}
lb.onclick = () => lb.classList.remove('open');
addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.classList.remove('open'); });

const sectionsEl = $('sections');
for (const [id, title, test] of SECTIONS) {
  const h = document.createElement('h2');
  h.id = id;
  h.textContent = title;
  sectionsEl.appendChild(h);
  const grid = document.createElement('div');
  grid.className = 'grid';
  sectionsEl.appendChild(grid);
  for (const name of names.filter(test)) {
    const tex = textures[name];
    const info = TEXTURE_INFO[name];
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `card-${name}`;
    const view = document.createElement('div');
    view.className = 'view ' + (info.blend === 'additive' ? 'black' : TRANSPARENT.has(name) || info.face ? 'checker' : '');
    view.appendChild(displayCanvas(name, tex));
    card.appendChild(view);
    const nm = document.createElement('div');
    nm.className = 'name';
    nm.textContent = name;
    card.appendChild(nm);
    const meta = document.createElement('div');
    meta.className = 'meta';
    const tags = [
      `${tex.image.width}x${tex.image.height}`,
      tex.colorSpace === THREE.SRGBColorSpace ? 'sRGB' : 'NoColorSpace',
      info.tile ? (TILE_X_ONLY.has(name) ? 'repeat x (2x1 shown)' : 'repeat (2x2 shown)') : 'clamp',
      tex.anisotropy > 1 ? `aniso ${tex.anisotropy}` : null,
      info.blend ? `${info.blend} blend` : null,
      tex.mipmaps && tex.mipmaps.length ? `exact mips x${tex.mipmaps.length}` : null,
      `${perTex[name].toFixed(1)} ms`,
    ].filter(Boolean);
    meta.innerHTML = tags.map((t) => `<span class="tag">${t}</span>`).join('');
    if (info.tile) {
      const s = seamScore(tex.image);
      const xOnly = TILE_X_ONLY.has(name);
      const ok = s.x < 1.5 && (xOnly || s.y < 1.5);
      meta.innerHTML += `<div class="${ok ? 'seam-ok' : 'seam-bad'}">seam ratio x ${s.x.toFixed(2)} / y ${xOnly ? 'n/a (x only)' : s.y.toFixed(2)} ${ok ? '(seamless)' : '(CHECK)'}</div>`;
    }
    card.appendChild(meta);
    card.onclick = () => openLightbox(name);
    grid.appendChild(card);
  }
}

if (params.get('view')) openLightbox(params.get('view'));
if (params.get('scroll')) document.getElementById(params.get('scroll'))?.scrollIntoView();
window.__textures = textures;
window.__timing = { genMs, uploadMs, perTex };

// ---------------------------------------------------------------------------
// Inspection overlays (handy for close-up screenshots)
//   ?sheet=a,b,c        textures side by side, each scaled to fit a cell
//   ?inspect=name&z=3&x=0.5&y=0.5   one texture magnified around (x, y)
//   ?solo3d=face_a,face_b&yaw=0,35&dist=3.4   close-up 3D heads
// ---------------------------------------------------------------------------
function overlay(bg = '#101014') {
  const o = document.createElement('div');
  o.style.cssText = `position:fixed;inset:0;z-index:50;background:${bg};overflow:hidden;`;
  document.body.appendChild(o);
  return o;
}
function viewClass(name) {
  const info = TEXTURE_INFO[name];
  return info.blend === 'additive' ? 'black' : TRANSPARENT.has(name) || info.face ? 'checker' : '';
}
if (params.get('sheet')) {
  const list = params.get('sheet').split(',');
  const o = overlay();
  const cols = Number(params.get('cols')) || Math.ceil(Math.sqrt(list.length));
  const rows = Math.ceil(list.length / cols);
  o.style.display = 'grid';
  o.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  o.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  o.style.gap = '4px';
  for (const name of list) {
    const cell = document.createElement('div');
    cell.className = 'card';
    cell.style.cssText = 'padding:2px;display:flex;flex-direction:column;min-height:0;cursor:default';
    const v = document.createElement('div');
    v.className = 'view ' + viewClass(name);
    v.style.cssText = 'flex:1;min-height:0;height:auto;display:flex;align-items:center;justify-content:center';
    const cv = displayCanvas(name, textures[name]);
    cv.style.cssText = 'max-width:100%;max-height:100%;';
    v.appendChild(cv);
    const cap = document.createElement('div');
    cap.style.cssText = 'font-size:11px;color:#bbb;text-align:center';
    cap.textContent = name;
    cell.append(v, cap);
    o.appendChild(cell);
  }
}
if (params.get('inspect')) {
  const name = params.get('inspect');
  const z = Number(params.get('z') || 2), fx = Number(params.get('x') || 0.5), fy = Number(params.get('y') || 0.5);
  const o = overlay();
  o.className = 'view ' + viewClass(name);
  const cv = displayCanvas(name, textures[name]);
  const w = cv.width * z, h = cv.height * z;
  cv.style.cssText = `position:absolute;width:${w}px;height:${h}px;left:${innerWidth / 2 - fx * w}px;top:${innerHeight / 2 - fy * h}px;image-rendering:${params.get('px') ? 'pixelated' : 'auto'}`;
  o.appendChild(cv);
}
if (params.get('solo3d')) {
  const list = params.get('solo3d').split(',');
  const yaws = (params.get('yaw') || '0').split(',').map(Number);
  const dist = Number(params.get('dist') || 3.6);
  const o = overlay('#5a5160');
  const cv = document.createElement('canvas');
  o.appendChild(cv);
  const W = innerWidth, H = innerHeight;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio));
  r.setSize(W, H);
  r.setScissorTest(true);
  const cells = [];
  for (const f of list) for (const yv of yaws) cells.push([f, yv]);
  const cols = Number(params.get('cols')) || Math.min(cells.length, Math.ceil(Math.sqrt(cells.length * (W / H))));
  const rows = Math.ceil(cells.length / cols);
  const cw = W / cols, ch = H / rows;
  setLight();
  for (const n of faceNames) heads[n].visible = false;
  cells.forEach(([f, yv], i) => {
    show(f, true);
    heads[f].getObjectByName('hair').visible = params.get('hair') !== '0';
    cam.aspect = cw / ch;
    cam.updateProjectionMatrix();
    placeCam(yv, dist);
    const x = (i % cols) * cw, y = H - (Math.floor(i / cols) + 1) * ch;
    r.setViewport(x, y, cw, ch);
    r.setScissor(x, y, cw, ch);
    r.render(scene, cam);
    show(f, false);
  });
}
if (params.get('props')) {
  const o = overlay('#2a2430');
  const cv = document.createElement('canvas');
  cv.style.cssText = 'width:100%;height:100%;display:block';
  o.appendChild(cv);
  renderProps(cv, innerWidth, innerHeight);
}
if (params.get('allfaces')) {
  const o = overlay('#5a5160');
  const cv = $('allView');
  cv.style.cssText = 'height:100%;width:auto;display:block;margin:0 auto;border-radius:0';
  o.appendChild(cv);
  renderAll();
}
