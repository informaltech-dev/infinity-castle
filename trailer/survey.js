// Survey timeline: one short scene per feature, orbit camera, for choosing shots (?tl=survey).
import * as THREE from 'three';

const D = 3.5;
const orbit = (focus, r = 6.5, h = 2.0, a0 = 0.5, w = 0.25, fov = 48) => (S, t) => {
  const f = typeof focus === 'function' ? focus(S) : new THREE.Vector3(...focus);
  const a = a0 + t * w;
  S.cam(new THREE.Vector3(f.x + Math.sin(a) * r, h, f.z + Math.cos(a) * r), new THREE.Vector3(f.x, 1.1, f.z), fov);
};
const mid = (S) => (S.boss ? S.p.pos.clone().lerp(S.boss.pos, 0.5) : S.p.pos.clone());

const list = [
  ['doors', { world: 'hall', char: 'tanjiro' }, (S) => {
    const pts = S.g.world.spawnPoints;
    pts.slice(0, 4).forEach((pt, i) => S.at(0.2 + i * 0.35, () => S.demon(i === 3 ? 'brute' : 'grunt', pt, { spawn: true, door: true })));
  }, orbit([0, 0, 0], 10, 3, 0.3, 0.1, 55)],
  ['enbu', { world: 'hall', char: 'tanjiro' }, (S) => {
    S.demon('grunt', [0, 0, 2.6], { cooldown: 9 });
    S.demon('grunt', [1.8, 0, 2], { cooldown: 9 });
    S.demon('fast', [-1.8, 0, 2], { cooldown: 9 });
    S.at(0.3, () => S.tap('skill3'));
  }, orbit([0, 0, 1])],
  ['giyu-whirl', { world: 'hall', char: 'giyu' }, (S) => {
    for (let i = 0; i < 5; i++) S.demon(i % 2 ? 'fast' : 'grunt', [Math.sin(i * 1.26) * 2.2, 0, Math.cos(i * 1.26) * 2.2], { cooldown: 9 });
    S.at(0.3, () => S.tap('skill2'));
  }, orbit([0, 0, 0], 7, 2.6)],
  ['giyu-flux', { world: 'hall', char: 'giyu' }, (S) => {
    for (let i = 0; i < 4; i++) S.demon('grunt', [-3 + i * 2, 0, 4 + (i % 2)], { cooldown: 9 });
    S.at(0.2, () => S.tap('skill3'));
  }, orbit([0, 0, 2], 8, 2.4, 1.2)],
  ['tanjiro-ult', { world: 'hall', char: 'tanjiro', player: { conc: 100 } }, (S) => {
    for (let i = 0; i < 5; i++) S.demon(i === 2 ? 'brute' : 'grunt', [Math.sin(i * 1.26) * 3.2, 0, 2 + Math.cos(i * 1.26) * 3.2], { cooldown: 9 });
    S.at(0.2, () => S.tap('ult'));
  }, orbit([0, 0, 2], 9, 3)],
  ['giyu-ult', { world: 'arena', char: 'giyu', player: { pos: [0, 0, -3], conc: 100 } }, (S) => {
    const b = S.akaza([0, 0, 1.5], Math.PI);
    S.at(0.1, () => b._execute('combo'));
    S.at(0.25, () => S.tap('ult'));
  }, orbit(mid)],
  ['akaza-air', { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -6] } }, (S) => {
    const b = S.akaza([0, 0, 4], Math.PI);
    S.at(0.2, () => b._execute('airType'));
    S.at(1.4, () => S.tap('dodge'));
  }, orbit(mid, 9)],
  ['akaza-barrage', { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -1.5] } }, (S) => {
    const b = S.akaza([0, 0, 1.5], Math.PI);
    S.at(0.2, () => b._execute('barrage'));
  }, orbit(mid)],
  ['akaza-slam', { world: 'arena', char: 'giyu', player: { pos: [0, 0, -3] } }, (S) => {
    const b = S.akaza([0, 0, 3], Math.PI);
    S.at(0.2, () => b._execute('groundSlam'));
  }, orbit(mid, 8)],
  ['akaza-annihilation', { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -7] } }, (S) => {
    const b = S.akaza([0, 0, 5], Math.PI, { phase: 2 });
    S.at(0.2, () => b._execute('annihilation'));
  }, orbit(mid, 10)],
  ['akaza-tech', { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -4] } }, (S) => {
    const b = S.akaza([0, 0, 2], Math.PI);
    S.at(0.2, () => b._enterPhase(2));
  }, orbit(mid)],
  ['akaza-final', { world: 'arena', char: 'giyu', player: { pos: [0, 0, -6] } }, (S) => {
    const b = S.akaza([0, 0, 2], Math.PI, { phase: 3 });
    S.at(0.2, () => b._startFinal());
  }, orbit(mid, 11, 3.5)],
  ['parry', { world: 'arena', char: 'giyu', player: { pos: [0, 0, -1.2], god: false } }, (S) => {
    const b = S.akaza([0, 0, 1.2], Math.PI);
    S.data.autoParry = true;
    S.at(0.2, () => b._chain(['jab', 'cross', 'hook']));
  }, orbit(mid, 5)],
  ['finisher', { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -3] } }, (S) => {
    const b = S.akaza([0, 0, 1], Math.PI);
    S.at(0.1, () => {
      b.hp = 1;
      S.g.director.run(S.g.director.finisher(b));
    });
    S.at(0.5, () => S.tap('light'));
  }, () => false],
  ['boss-intro', { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -8] } }, (S) => {
    S.g.director.run(S.g.director.bossFight());
  }, () => false],
];

export const SURVEY = {
  duration: list.length * D,
  scenes: list.map(([id, stage, setup, camera], i) => ({ id, at: i * D, stage, hud: 'cine', setup, camera })),
  overlays: [],
  music: [],
  cues: [],
};
