import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Pipeline, LAYER_MAIN_ONLY } from '../src/render/pipeline.js';
import { toonMaterial } from '../src/render/materials.js';
import { buildTanjiro, buildGiyu, buildRengoku, buildObanai, buildAkaza, buildKokushibo, buildDemon } from '../src/actors/characters.js';
import { createAnimator } from '../src/actors/animsets.js';

const canvas = document.getElementById('c');
const pipe = new Pipeline(canvas);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
camera.position.set(2.2, 1.6, 3.2);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.0, 0);

let T = null;
try {
  const texPath = '../src/render/textures.js';
  const mod = await import(/* @vite-ignore */ texPath);
  T = await mod.createTextures();
  if (T.paper) pipe.setPaper(T.paper);
} catch (e) {
  console.warn('textures unavailable', e.message);
}

// floor
const floorMat = toonMaterial({ color: T?.woodFloor ? 0xffffff : 0x7a5134, map: T?.woodFloor, worldUV: 1 / 3 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
for (let i = 0; i < 6; i++) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 0.4), toonMaterial({ color: 0x8a2a20 }));
  p.position.set(Math.cos(i) * 6, 2.5, Math.sin(i) * 6 - 2);
  scene.add(p);
}
const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 16, 8), toonMaterial({ color: 0x120a10, unlit: true, side: THREE.BackSide, fog: false }));
sky.layers.set(LAYER_MAIN_ONLY);
scene.add(sky);

const builders = {
  tanjiro: () => buildTanjiro(T),
  giyu: () => buildGiyu(T),
  rengoku: () => buildRengoku(T),
  obanai: () => buildObanai(T),
  akaza: () => buildAkaza(T),
  kokushibo: () => buildKokushibo(T),
  grunt: () => buildDemon(T, 'grunt', 1),
  fast: () => buildDemon(T, 'fast', 2),
  brute: () => buildDemon(T, 'brute', 3),
};
const charSel = document.getElementById('char');
const clipSel = document.getElementById('clip');
for (const k of Object.keys(builders)) charSel.add(new Option(k, k));
const params = new URLSearchParams(location.search);
charSel.value = params.get('c') || 'tanjiro';

let model, anim, clips;
let playing = false, looping = false;
function load(name) {
  if (model) scene.remove(model.root);
  model = builders[name]();
  scene.add(model.root);
  ({ anim, clips } = createAnimator(model));
  clipSel.innerHTML = '';
  clipSel.add(new Option('(stance)', ''));
  for (const k of Object.keys(clips)) clipSel.add(new Option(k, k));
  if (params.get('clip') && clips[params.get('clip')]) {
    clipSel.value = params.get('clip');
    setClip();
  }
}
function setClip() {
  const c = clips[clipSel.value];
  if (!c) { anim.stop(0.01); return; }
  anim.play(c, { fade: 0, hold: true });
  anim.clipTime = 0;
}
charSel.onchange = () => load(charSel.value);
clipSel.onchange = () => { setClip(); playing = true; };
document.getElementById('play').onclick = () => { playing = !playing; if (anim.clip && anim.clipTime >= anim.clip.dur) anim.clipTime = 0; };
document.getElementById('loop').onclick = () => { looping = !looping; playing = true; };
const scrub = document.getElementById('scrub');
scrub.oninput = () => {
  playing = false;
  if (anim.clip) { anim.clipTime = +scrub.value * anim.clip.dur; anim.update(0); anim._snap(); }
};
const stepBox = document.getElementById('step');
const runBox = document.getElementById('run');
const spd = document.getElementById('spd');
load(charSel.value);
if (params.get('t') && anim.clip) { anim.clipTime = +params.get('t'); playing = false; }
if (params.get('cam')) {
  const [x, y, z] = params.get('cam').split(',').map(Number);
  camera.position.set(x, y, z);
}
window.__pose = {
  get anim() { return anim; }, get model() { return model; }, camera, controls,
  view(pos, target) { camera.position.set(...pos); controls.target.set(...target); controls.update(); tick(0); },
  at(clipName, t) { clipSel.value = clipName; setClip(); anim.clipTime = t; anim.update(0); anim._snap(); playing = false; tick(0); return anim.clip?.name; },
  char(name) { charSel.value = name; load(name); tick(0); },
  tick: (dt) => tick(dt),
  /** Contact sheet: frames of a clip (rows = camera views, cols = times). */
  sheet(clipName, times, views, cell = [260, 300]) {
    let ov = document.getElementById('sheet');
    if (!ov) {
      ov = document.createElement('canvas');
      ov.id = 'sheet';
      ov.style.cssText = 'position:fixed;inset:0;z-index:5;background:#222;width:100%;height:100%;object-fit:contain';
      document.body.appendChild(ov);
    }
    const [cw, ch] = cell;
    ov.width = cw * times.length;
    ov.height = ch * views.length;
    const ctx = ov.getContext('2d');
    ctx.fillStyle = '#222'; ctx.fillRect(0, 0, ov.width, ov.height);
    const W = innerWidth, H = innerHeight;
    camera.aspect = cw / ch; camera.updateProjectionMatrix();
    pipe.setSize(cw, ch, 1);
    views.forEach((v, r) => {
      times.forEach((t, c) => {
        if (clipName) { clipSel.value = clipName; setClip(); anim.clipTime = t; anim.update(0); anim._snap(); }
        camera.position.set(...v[0]); controls.target.set(...v[1]); controls.update();
        anim.apply(); model.rig.updateSprings(0);
        pipe.render(scene, camera, 1);
        ctx.drawImage(pipe.renderer.domElement, 0, 0, cw, ch, c * cw, r * ch, cw, ch);
        ctx.fillStyle = '#fff'; ctx.font = '12px monospace';
        ctx.fillText(`${clipName || 'stance'} t=${t}`, c * cw + 4, r * ch + 14);
      });
    });
    playing = false;
    camera.aspect = W / H; camera.updateProjectionMatrix();
    pipe.setSize(W, H, Math.min(devicePixelRatio, 1.5));
    ov.style.display = 'block';
    return ov.width + 'x' + ov.height;
  },
  /** Many clips, one camera: rows = clips, cols = normalized times. */
  sheetMany(names, fracs, view, cell = [200, 240]) {
    let ov = document.getElementById('sheet');
    if (!ov) {
      ov = document.createElement('canvas');
      ov.id = 'sheet';
      ov.style.cssText = 'position:fixed;inset:0;z-index:5;background:#222;width:100%;height:100%;object-fit:contain';
      document.body.appendChild(ov);
    }
    const [cw, ch] = cell;
    ov.width = cw * fracs.length;
    ov.height = ch * names.length;
    const ctx = ov.getContext('2d');
    const W = innerWidth, H = innerHeight;
    camera.aspect = cw / ch; camera.updateProjectionMatrix();
    pipe.setSize(cw, ch, 1);
    names.forEach((n, r) => {
      fracs.forEach((f, c) => {
        clipSel.value = n; setClip();
        const t = f <= 1 ? f * anim.clip.dur : f - 1;
        anim.clipTime = t; anim.update(0); anim._snap();
        camera.position.set(...view[0]); controls.target.set(...view[1]); controls.update();
        anim.apply(); model.rig.updateSprings(0);
        pipe.render(scene, camera, 1);
        ctx.drawImage(pipe.renderer.domElement, 0, 0, cw, ch, c * cw, r * ch, cw, ch);
        ctx.fillStyle = '#fff'; ctx.font = '11px monospace';
        ctx.fillText(`${n} ${t.toFixed(2)}`, c * cw + 3, r * ch + 12);
      });
    });
    playing = false;
    camera.aspect = W / H; camera.updateProjectionMatrix();
    pipe.setSize(W, H, Math.min(devicePixelRatio, 1.5));
    ov.style.display = 'block';
    return ov.width + 'x' + ov.height;
  },
  hideSheet() { const ov = document.getElementById('sheet'); if (ov) ov.style.display = 'none'; },
};

function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  pipe.setSize(w, h, Math.min(devicePixelRatio, 1.5));
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
const info = document.getElementById('info');
function frame() {
  requestAnimationFrame(frame);
  tick(Math.min(clock.getDelta(), 0.05) * +spd.value);
}
function tick(dt) {
  anim.stepHz = stepBox.checked ? 12 : 0;
  anim.setLoco(runBox.checked ? 6 : 0, 0, 0);
  if (playing && anim.clip) {
    anim.update(dt);
    if (anim.clipTime >= anim.clip.dur) {
      if (looping) anim.clipTime = 0;
      else { anim.clipTime = anim.clip.dur; playing = false; }
    }
    scrub.value = anim.clip ? anim.clipTime / anim.clip.dur : 0;
  } else {
    anim.update(anim.clip ? 0 : dt);
    if (!anim.clip) anim.update(0);
  }
  anim.apply();
  model.rig.updateSprings(dt);
  controls.update();
  info.textContent = anim.clip ? `${anim.clip.name}  t=${anim.clipTime.toFixed(3)} / ${anim.clip.dur}` : 'stance';
  pipe.render(scene, camera, performance.now() / 1000);
}
frame();
