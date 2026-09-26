// The trailer: ~80 s, cut to the battle theme's bar lines (132 BPM) with Akaza's entrance theme in the middle.
//
//   0.0   cold open      biwa, the castle shifts                          (no music)
//   4.0   act 1          fall, the two swordsmen, demons, breathing forms  battle theme bars 0-13
//  29.3   act 2          Akaza's entrance, title card, technique           entrance theme 0-11.75 s
//  41.0   act 3          the fight: gameplay, then the climax              battle theme bars 22-37
//  70.1   finisher       beheading on the bar-38 hit, then the end card    battle theme bars 38-41, fade
//
// Scene times are trailer seconds; every scene rebuilds its own stage, so any range renders on its own.
import * as THREE from 'three';
import { Scene } from './trailer.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BEAT = 60 / 132;
const BAR = 4 * BEAT;
const BATTLE_BAR0 = 0.416; // first downbeat of akaza-battle.mp3 (the grid holds to within 10 ms)

const T_A = 4.0;
const b1 = (n) => T_A + n * BAR; // act 1: battle bar n
const T_APP = b1(14) - 0.178; // entrance theme placed so its opening hit (0.178 s) takes the bar-14 slot
const ap = (a) => T_APP + a;
const B22 = ap(11.747); // battle bar 22 hit lands on the entrance theme's last hit
const b2 = (n) => B22 + (n - 22) * BAR; // act 3: battle bar n
const T_END = b2(38) + 0.5;
const DURATION = b2(42) + 2.6;

const chest = (a) => a.chest(new THREE.Vector3());
const head = (a) => a.head(new THREE.Vector3());

/** Park a player above the frame and drop them so they land exactly at scene time `land`. */
function dropIn(S, land, h = 18, v0 = -4) {
  const p = S.p;
  p.control = false;
  p.setState('cine');
  p.anim.play(p.clips.fall, { fade: 0, hold: true });
  const start = land - Scene.fallFrames(h, v0) / 60;
  p.posY = start > 0.05 ? 60 : h;
  p.onGround = start > 0.05;
  if (start <= 0.05) p.yVel = v0;
  if (start > 0.05) S.at(start, () => {
    p.posY = h;
    p.yVel = v0;
    p.onGround = false;
  });
  S.data.landT = land;
  p.onLand = () => {
    const g = S.g;
    p.anim.play(p.clips.landing, { fade: 0.02 });
    g.fx.ground(p.pos, { size: 2.6, color: 0xfff0d8, crack: true });
    g.cameraRig.shake(0.7);
    g.fx.screen.impact(0.05);
    g.fx.screen.radial(0.35);
    g.audio.play('land', { volume: 1 });
    g.audio.play('groundSlam', { volume: 0.6 });
    p.onLand = null;
  };
}

/** Akaza's technique development without his line (the trailer's subtitles are its own). */
function techniqueDev(S, b) {
  const g = S.g;
  b.phase = 2;
  b.action = null;
  b.queue = [];
  b.setState('action');
  b.run(b.moves.techniqueDev);
  b.curMove = 'techniqueDev';
  b.invuln = 2;
  g.hud.callout({ school: '術式展開', form: '', name: '破壞殺・羅針', style: 'demon', side: 'left' });
  g.onBossPhase?.(2);
}

const scenes = [
  // ------------------------------------------------------------------ cold open
  {
    id: 'open',
    at: 0,
    stage: { world: 'hall', player: false },
    hud: 'none',
    setup(S) {
      S.at(2.2, () => {
        S.g.world.shiftAll(1.3);
        S.g.cameraRig.shake(0.4);
      });
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [0.4, 0.8, 12], look: [0, 16, -2], fov: 62 },
        { t: 4.2, pos: [0, 2.2, 8.5], look: [0, 4.5, -16], fov: 50, e: 'inOut' },
      ], t);
    },
  },

  // ------------------------------------------------------------------ act 1
  {
    // bars 0-1: Tanjiro drops into the hall — falling with him, then from above as he lands on bar 1
    id: 'fall',
    at: b1(0),
    stage: { world: 'hall', char: 'tanjiro', player: { pos: [0, 0, 0], yaw: 0 } },
    hud: 'none',
    setup(S) {
      dropIn(S, BAR, 34, 0);
    },
    camera(S, t) {
      const p = S.p;
      if (t < 1.45) {
        const y = p.posY;
        S.cam(V(1.5, y + 1.7, 1.9), V(0, y + 0.8, 0), 50, 0.14);
      } else if (t < BAR) {
        S.cam(V(1.6, 0.35, 2.6), V(0, Math.min(8, p.posY * 0.75 + 0.9), 0), 56, -0.06);
      } else {
        S.path([
          { t: BAR, pos: [1.6, 0.35, 2.6], look: [0, 0.9, 0], fov: 54, roll: -0.06 },
          { t: 2 * BAR, pos: [1.1, 1.05, 2.5], look: [0, 1.2, 0], fov: 40, roll: 0, e: 'out3' },
        ], t);
      }
    },
  },
  {
    // bars 2-3: Tanjiro, slow-motion combo (name card on the right)
    id: 'tanjiro',
    at: b1(2),
    stage: { world: 'hall', char: 'tanjiro', player: { pos: [-3, 0, 1], yaw: 0 } },
    hud: 'none',
    setup(S) {
      S.demon('grunt', [-3, 0, 3.3], { cooldown: 99 });
      S.slow(0.4);
      S.at(0.1, () => S.tap('light'));
      S.at(1.05, () => S.tap('light'));
      S.at(2.0, () => S.tap('light'));
      S.at(2.95, () => S.tap('light'));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-5.9, 0.75, 1.3], look: [-2.5, 1.25, 2.3], fov: 44 },
        { t: 2 * BAR, pos: [-5.4, 0.95, 1.9], look: [-2.5, 1.3, 2.4], fov: 40, e: 'linear' },
      ], t);
    },
  },
  {
    // bars 4-5: Giyu, still, then one cut through a leaping demon (name card on the left)
    id: 'giyu',
    at: b1(4),
    stage: { world: 'hall', char: 'giyu', player: { pos: [2, 0, -2], yaw: 0 } },
    hud: 'none',
    setup(S) {
      const e = S.demon('fast', [2, 0, 3.4], { cooldown: 99, hp: 20 });
      S.data.e = e;
      S.at(2.3, () => e.startAttack('lunge'));
      S.at(2.72, () => S.tap('skill1'));
      S.at(3.0, () => S.slow(0.3));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [4.4, 0.6, 1.2], look: [0.9, 1.35, -1.2], fov: 42 },
        { t: 2.3, pos: [4.0, 0.75, 1.5], look: [1.0, 1.35, -0.9], fov: 38, e: 'linear' },
        { t: 2.9, pos: [5.2, 1.0, 2.6], look: [2.0, 1.2, 0.6], fov: 48, e: 'out3' },
        { t: 2 * BAR, pos: [5.4, 1.1, 2.9], look: [2.0, 1.2, 1.0], fov: 50, e: 'linear' },
      ], t);
    },
  },
  {
    // bar 6 (hit): the sliding doors burst open on the stabs
    id: 'doors',
    at: b1(6),
    stage: { world: 'hall', char: 'tanjiro', player: { pos: [1.5, 0, 11.3], yaw: -0.12 } },
    hud: 'none',
    setup(S) {
      const w = S.g.world;
      const burst = (x) => {
        const pt = V(x, 0, 14.2);
        w.openDoorNear(V(x, 0, 16.9));
        S.demon(x === 0 ? 'brute' : 'grunt', pt, { spawn: true, cooldown: 99 });
        S.g.cameraRig.shake(0.3);
      };
      S.at(0.22, () => burst(0));
      S.at(0.44, () => {
        burst(-5);
        burst(5);
      });
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-0.7, 0.6, 9.0], look: [0.7, 1.9, 16.9], fov: 56 },
        { t: BAR, pos: [-1.0, 0.55, 8.4], look: [0.6, 1.8, 16.9], fov: 60, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 7: 壹之型 水面斬擊 through a charging line
    id: 'wave',
    at: b1(7),
    stage: { world: 'hall', char: 'tanjiro', player: { pos: [0, 0, -1], yaw: 0 } },
    hud: 'cine',
    preroll: 0.3,
    setup(S) {
      for (const [x, z, v] of [[-1.9, 3.4, 'grunt'], [0.2, 4.1, 'fast'], [2.0, 3.3, 'grunt']]) S.demon(v, [x, 0, z], { cooldown: 99, hp: 30 });
      S.at(0.1, () => S.tap('skill1'));
      S.at(0.4, () => S.slow(0.3));
      S.at(1.2, () => S.slow(null));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-4.6, 0.55, 5.4], look: [0.2, 1.1, 1.4], fov: 52 },
        { t: BAR, pos: [-4.0, 0.7, 6.4], look: [0.4, 1.0, 2.4], fov: 46, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 8: 陸之型 扭轉漩渦 from above
    id: 'whirl',
    at: b1(8),
    stage: { world: 'hall', char: 'giyu', player: { pos: [0, 0, 0], yaw: 0 } },
    hud: 'cine',
    setup(S) {
      for (let i = 0; i < 6; i++) S.demon(i % 3 ? 'grunt' : 'fast', [Math.sin(i * 1.05) * 2.3, 0, Math.cos(i * 1.05) * 2.3], { cooldown: 99 });
      S.at(0.05, () => S.tap('skill2'));
    },
    camera(S, t) {
      const a = 0.7 + t * 0.45;
      S.cam(V(Math.sin(a) * 4.2, 7.2 - t * 0.6, Math.cos(a) * 4.2), V(0, 0.4, 0), 52);
    },
  },
  {
    // bar 9 (quiet): a brute's smash, a perfect dodge in slow motion
    id: 'brute',
    at: b1(9),
    stage: { world: 'hall', char: 'tanjiro', player: { pos: [0, 0, 0], yaw: 0 } },
    hud: 'cine',
    setup(S) {
      const e = S.demon('brute', [0, 0, 2.7], { cooldown: 99 });
      S.data.e = e;
      S.at(0.0, () => e.startAttack('smash'));
      S.at(0.72, () => {
        S.move('D');
        S.tap('dodge');
      });
      S.at(0.8, () => S.move(null));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-1.4, 0.4, -2.6], look: [0.3, 2.3, 2.7], fov: 48 },
        { t: BAR, pos: [-1.9, 0.5, -3.1], look: [0.5, 1.6, 2.4], fov: 50, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 10 (hit): 火之神神樂 圓舞 on the brute
    id: 'enbu',
    at: b1(10),
    stage: { world: 'hall', char: 'tanjiro', player: { pos: [0, 0, 0], yaw: 0 } },
    hud: 'cine',
    preroll: 0.3,
    setup(S) {
      S.demon('brute', [0.2, 0, 2.4], { cooldown: 99 });
      S.demon('grunt', [-1.9, 0, 2.2], { cooldown: 99 });
      S.at(-0.28, () => S.tap('skill3'));
      S.at(0.2, () => S.slow(0.35));
      S.at(1.2, () => S.slow(null));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [3.6, 0.9, 1.6], look: [-0.2, 1.3, 1.2], fov: 50 },
        { t: BAR, pos: [4.4, 1.2, 1.2], look: [-0.2, 1.4, 1.4], fov: 54, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 11: 拾之型 生生流轉, tracked from the side
    id: 'flux',
    at: b1(11),
    stage: { world: 'hall', char: 'giyu', player: { pos: [-6, 0, 0], yaw: Math.PI / 2 } },
    hud: 'cine',
    setup(S) {
      for (let i = 0; i < 4; i++) S.demon(i % 2 ? 'fast' : 'grunt', [-3.2 + i * 1.7, 0, (i % 2 ? 0.9 : -0.8)], { cooldown: 99 });
      S.at(0.02, () => S.tap('skill3'));
    },
    camera(S, t) {
      const x = S.p.pos.x;
      if (!S.data.cx) S.data.cx = x;
      S.data.cx += (x - S.data.cx) * 0.12;
      S.cam(V(S.data.cx + 1.2, 1.3, 6.2), V(S.data.cx + 0.6, 1.2, 0), 50);
    },
  },
  {
    // bar 12: kill-cam on the last demon
    id: 'killcam',
    at: b1(12),
    stage: { world: 'hall', char: 'tanjiro', player: { pos: [0, 0, 0], yaw: 0 } },
    hud: 'cine',
    preroll: 0.2,
    setup(S) {
      const e = S.demon('grunt', [0, 0, 1.9], { cooldown: 99, hp: 10 });
      S.data.e = e;
      S.p.comboIdx = 3;
      S.p.comboTimer = 1;
      S.at(-0.15, () => S.tap('light'));
      S.at(0.08, () => {
        const g = S.g;
        g.slowmo(0.2, 1.4);
        g.fx.screen.impact(0.08, 0x0a0608, 0xf6efe2);
        g.fx.screen.radial(0.4);
        g.cameraRig.kick(8);
        g.audio.play('impactFrame');
      });
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [2.3, 1.2, 3.5], look: [0, 1.4, 1.6], fov: 40 },
        { t: BAR, pos: [2.8, 1.0, 4.4], look: [0, 1.2, 1.4], fov: 44, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 13 (quiet): the biwa, the castle shifts, Upper Rank Three is waiting
    id: 'shift',
    at: b1(13),
    stage: { world: 'hall', char: 'tanjiro', player: { pos: [0, 0, 0], yaw: Math.PI } },
    hud: 'none',
    setup(S) {
      S.p.control = false;
      S.at(0.35, () => {
        S.g.world.shiftAll(1.5);
        S.g.cameraRig.shake(0.35);
      });
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [1.6, 1.0, -3.4], look: [0, 1.4, 0], fov: 46 },
        { t: BAR, pos: [1.2, 1.4, -4.6], look: [0, 9, 6], fov: 58, e: 'inOut' },
      ], t);
    },
  },

  // ------------------------------------------------------------------ act 2: Akaza's entrance
  {
    id: 'arrival',
    at: ap(0.178),
    stage: { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -8], yaw: 0 } },
    hud: 'cine',
    setup(S) {
      const g = S.g;
      const p = S.p;
      p.control = false;
      p.setState('cine');
      const b = S.akaza([0, 0, 6], Math.PI, { state: 'intro' });
      b.anim.play(b.clips.taunt, { fade: 0, hold: true });
      const L = (a) => a - 0.178; // entrance-theme time → scene time
      S.at(L(2.283), () => {
        g.hud.bossIntro({ title: '上弦之參', name: '猗窩座', subtitle: '破壞殺・羅針' });
        g.audio.play('bossRoar');
        g.fx.screen.flash(0x7fe6ff, 0.35, 4);
        g.cameraRig.shake(0.25);
      });
      S.at(L(5.4), () => {
        g.hud.subtitle('猗窩座', '又見面了，炭治郎。讓我看看你變得多強了！', 2.6);
        b.anim.stop(0.3);
      });
      S.at(L(8.05), () => {
        g.hud.subtitle('竈門炭治郎', '猗窩座——！這次我一定要斬下你的頸！', 1.9);
        p.anim.play(p.clips.thrustCharge, { fade: 0.15, hold: true });
      });
      S.at(L(9.95), () => {
        g.hud.sub?.clear();
        techniqueDev(S, b);
        g.fx.screen.flash(0x7fe6ff, 0.3, 5);
      });
    },
    camera(S, t) {
      const a = t + 0.178; // entrance-theme time
      const b = S.boss;
      if (a < 2.283) {
        S.path([
          { t: 0.178, pos: [1.5, 1.5, -12.5], look: [0, 1.5, 6], fov: 46 },
          { t: 2.283, pos: [1.2, 1.6, -9.0], look: [0, 1.6, 6], fov: 40, e: 'linear' },
        ], a);
      } else if (a < 5.3) {
        S.path([
          { t: 2.283, pos: [0.8, 1.72, 3.2], look: [0, 1.66, 6], fov: 30 },
          { t: 5.3, pos: [0.55, 1.75, 3.8], look: [0, 1.7, 6], fov: 28, e: 'linear' },
        ], a);
      } else if (a < 8.0) {
        S.path([
          { t: 5.3, pos: [-1.6, 0.55, 3.4], look: [0, 1.9, 6], fov: 42 },
          { t: 8.0, pos: [-1.3, 0.6, 3.9], look: [0, 1.95, 6], fov: 40, e: 'linear' },
        ], a);
      } else if (a < 9.95) {
        S.path([
          { t: 8.0, pos: [-1.0, 1.45, -6.4], look: [0, 1.45, -8], fov: 36 },
          { t: 9.95, pos: [-0.85, 1.5, -6.65], look: [0, 1.5, -8], fov: 34, e: 'linear' },
        ], a);
      } else {
        S.path([
          { t: 9.95, pos: [0, 9.5, 1.5], look: [0, 0, 6], fov: 50 },
          { t: 11.75, pos: [0, 6.0, 1.0], look: [0, 0.6, 6], fov: 56, e: 'out3' },
        ], a);
      }
      void b;
    },
  },

  // ------------------------------------------------------------------ act 3: the fight (gameplay first)
  {
    // bar 22 (hit): 空式 — and a perfect dodge, from the player's camera
    id: 'airtype',
    at: b2(22),
    stage: { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -5], yaw: 0, conc: 55 } },
    hud: 'game',
    preroll: 0.5,
    setup(S) {
      const b = S.akaza([0, 0, 4], Math.PI);
      S.p.lockTarget = b;
      S.g.cameraRig.lock = b;
      S.g.cameraRig.yaw = Math.PI;
      S.g.cameraRig.pitch = 0.18;
      S.at(-0.45, () => b._execute('airType'));
      S.at(0.3, () => {
        S.move('A');
        S.tap('dodge');
      });
      S.at(0.45, () => S.move(null));
    },
  },
  {
    // bar 23: Akaza closes in; a perfect parry and Giyu's instant counter
    id: 'parry',
    at: b2(23),
    stage: { world: 'arena', char: 'giyu', player: { pos: [0, 0, -2], yaw: 0, god: false, conc: 70 } },
    hud: 'game',
    preroll: 0.2,
    setup(S) {
      const b = S.akaza([0, 0, 1.3], Math.PI);
      S.p.lockTarget = b;
      S.g.cameraRig.lock = b;
      S.g.cameraRig.yaw = Math.PI;
      S.g.cameraRig.pitch = 0.2;
      S.data.autoParry = true;
      S.at(-0.1, () => b._chain(['jab', 'cross', 'hook']));
    },
  },
  {
    // bar 24, beats 1-2: 亂式 barrage, head-on
    id: 'barrage',
    at: b2(24),
    stage: { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -1.8], yaw: 0 } },
    hud: 'cine',
    preroll: 0.35,
    setup(S) {
      const b = S.akaza([0, 0, 1.6], Math.PI);
      S.at(-0.3, () => b._execute('barrage'));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [0.75, 1.55, -3.6], look: [-0.1, 1.45, 1.0], fov: 42 },
        { t: 2 * BEAT, pos: [0.65, 1.5, -3.3], look: [-0.1, 1.45, 0.6], fov: 40, e: 'linear' },
      ], t);
    },
  },
  {
    // bar 24, beats 3-4: 貳之型 水車 on Akaza
    id: 'wheel',
    at: b2(24) + 2 * BEAT,
    stage: { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -2], yaw: 0 } },
    hud: 'cine',
    preroll: 0.12,
    setup(S) {
      const b = S.akaza([0, 0, 1.6], Math.PI);
      b.cooldown = 1e9;
      S.at(-0.1, () => S.tap('skill2'));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [4.3, 0.9, -0.6], look: [0, 1.6, -0.2], fov: 50 },
        { t: 2 * BEAT, pos: [4.6, 0.8, -0.2], look: [0, 1.8, 0.2], fov: 54, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 25: 碎式 萬葉閃柳 — the leap and the slam
    id: 'slam',
    at: b2(25),
    stage: { world: 'arena', char: 'giyu', player: { pos: [0, 0, -2.5], yaw: 0 } },
    hud: 'cine',
    setup(S) {
      const b = S.akaza([0, 0, 3.2], Math.PI);
      S.at(0.02, () => b._execute('groundSlam'));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-3.4, 0.35, -3.8], look: [0, 1.8, 2.2], fov: 50 },
        { t: 0.7, pos: [-3.2, 0.4, -3.5], look: [0, 3.2, 1.0], fov: 52, e: 'out3' },
        { t: BAR, pos: [-4.0, 0.9, -4.6], look: [0, 0.8, -1.0], fov: 56, e: 'out3' },
      ], t);
    },
  },

  // ------------------------------------------------------------------ the drop: cinematic from here
  {
    // bars 26-27: 日暈之龍・頭舞
    id: 'hinokami',
    at: b2(26),
    stage: { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -3], yaw: 0, conc: 100 } },
    hud: 'cine',
    preroll: 0.16,
    setup(S) {
      const b = S.akaza([0, 0, 1.5], Math.PI, { light: 2 });
      S.at(-0.16, () => S.tap('ult'));
    },
    camera(S, t) {
      if (t < 0.74) return false; // the game's own close-up on the ready pose
      const a = -2.3 + (t - 0.74) * 0.55;
      const r = t < 1.9 ? 5.6 : 5.6 - Math.min(1.6, (t - 1.9) * 2.2);
      S.cam(V(Math.sin(a) * r, 1.7 + (t - 0.74) * 0.25, 1.5 + Math.cos(a) * r), V(0, 1.2, 1.2), 52);
    },
  },
  {
    // bar 28: 滅式
    id: 'annihilation',
    at: b2(28),
    stage: { world: 'arena', char: 'giyu', player: { pos: [0, 0, -6], yaw: 0 } },
    hud: 'cine',
    preroll: 0.1,
    setup(S) {
      const b = S.akaza([0, 0, 5.5], Math.PI, { phase: 2, light: 2 });
      S.at(-0.1, () => b._execute('annihilation'));
      S.at(1.05, () => {
        S.move('D');
        S.tap('dodge');
      });
      S.at(1.2, () => S.move(null));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [0.9, 1.05, -9.4], look: [0, 1.35, 4], fov: 42 },
        { t: 1.0, pos: [1.0, 1.0, -9.8], look: [0, 1.3, 2], fov: 44, e: 'linear' },
        { t: BAR, pos: [2.4, 0.8, -10.2], look: [0, 1.2, -4], fov: 50, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 29: 拾壹之型 凪 — the release on beat 3
    id: 'nagi',
    at: b2(29),
    stage: { world: 'arena', char: 'giyu', player: { pos: [0, 0, -1.5], yaw: 0, conc: 100 } },
    hud: 'cine',
    preroll: 2.8,
    setup(S) {
      const b = S.akaza([0, 0, 1.3], Math.PI, { light: 2 });
      S.at(-2.8, () => S.tap('ult'));
      S.at(-2.2, () => b._execute('barrage'));
      S.at(-0.9, () => b._execute('combo'));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [2.8, 1.2, -3.4], look: [0, 1.3, 0], fov: 44 },
        { t: BAR, pos: [3.8, 2.2, -4.6], look: [0, 1.0, 0], fov: 50, e: 'out3' },
      ], t);
    },
  },
  {
    // bars 30-31: 終式 青銀亂殘光
    id: 'final',
    at: b2(30),
    stage: { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -7], yaw: 0 } },
    hud: 'cine',
    preroll: 0.05,
    setup(S) {
      const b = S.akaza([0, 0, 0], Math.PI, { phase: 3, light: 3 });
      S.at(-0.05, () => b._startFinal());
      S.at(1.6, () => {
        S.move('A');
        S.tap('dodge');
      });
      S.at(1.75, () => S.move(null));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [1.7, 0.75, -2.5], look: [0, 1.65, 0], fov: 40 },
        { t: 0.9, pos: [2.3, 1.3, -4.2], look: [0, 1.4, 0], fov: 44, e: 'out3' },
        { t: 2.3, pos: [5.2, 6.4, -11], look: [0, 0.5, -1.5], fov: 52, e: 'inOut' },
        { t: 2 * BAR, pos: [6.4, 8.2, -13], look: [0, 0.3, -2.2], fov: 54, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 32: fire against fists
    id: 'clash',
    at: b2(32),
    stage: { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -2], yaw: 0 } },
    hud: 'cine',
    preroll: 0.2,
    setup(S) {
      const b = S.akaza([0, 0, 1.2], Math.PI, { phase: 3, light: 3 });
      S.at(-0.2, () => b._chain(['hook']));
      S.at(-0.05, () => S.tap('skill3'));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-3.2, 0.8, 0.8], look: [0, 1.4, -0.4], fov: 46 },
        { t: BAR, pos: [-3.6, 1.1, 1.4], look: [0, 1.3, -0.2], fov: 50, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 33: 生生流轉 on Akaza
    id: 'dragon',
    at: b2(33),
    stage: { world: 'arena', char: 'giyu', player: { pos: [-5, 0, 0], yaw: Math.PI / 2 } },
    hud: 'cine',
    preroll: 0.15,
    setup(S) {
      S.akaza([1.5, 0, 0], -Math.PI / 2, { phase: 3, light: 3 });
      S.at(-0.12, () => S.tap('skill3'));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-3, 1.0, 6.2], look: [-1.5, 1.4, 0], fov: 48 },
        { t: BAR, pos: [1.0, 1.6, 6.8], look: [1.0, 1.4, 0], fov: 52, e: 'inOut' },
      ], t);
    },
  },
  {
    // bar 34: 漆之型 雫波紋擊刺 — and Akaza goes down on one knee
    id: 'thrust',
    at: b2(34),
    stage: { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -4.5], yaw: 0 } },
    hud: 'cine',
    preroll: 0.75,
    setup(S) {
      const b = S.akaza([0, 0, 0.5], Math.PI, { lowHp: 60, light: 3 });
      S.at(-0.75, () => S.hold('heavy', 0.72));
      S.at(0.3, () => {
        if (b.alive && b.state !== 'finisher') b.die(S.p, {});
      });
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-4.2, 0.75, -2.6], look: [0, 1.1, -1.4], fov: 50 },
        { t: BAR, pos: [-4.6, 0.9, -1.6], look: [0, 1.0, -0.6], fov: 52, e: 'out3' },
      ], t);
    },
  },
  {
    // bars 35-37: the kneeling demon, the prompt, the press on bar 38
    id: 'finisher',
    at: b2(35),
    stage: { world: 'arena', char: 'tanjiro', player: { pos: [0, 0, -2.6], yaw: 0 } },
    hud: 'cine',
    setup(S) {
      const g = S.g;
      const b = S.akaza([0, 0, 0.6], Math.PI, { lowHp: 1, light: 3 });
      b.die(S.p, {});
      g.fx.screen.desatTarget = 0.35;
      S.p.control = false;
      S.p.setState('cine');
      S.at(0.4, () => g.hud.subtitle('猗窩座', '……還不夠……我還能……', 2.2));
      const press = b2(38) - b2(35) - 1 / 60;
      S.at(press - 3.6, () => {
        S.p.control = true;
        S.p.setState('move');
        g.director.run(g.director.finisher(b));
      });
      S.at(press, () => S.tap('light'));
      S.data.press = press;
    },
    camera(S, t) {
      if (t >= S.data.press) return false; // the game's own beheading shot
      if (t < 2.5) {
        S.path([
          { t: 0, pos: [1.2, 0.9, 2.8], look: [0, 1.0, 0.6], fov: 36 },
          { t: 2.5, pos: [0.9, 0.95, 2.4], look: [0, 1.0, 0.6], fov: 32, e: 'linear' },
        ], t);
      } else {
        S.path([
          { t: 2.5, pos: [1.2, 1.5, -0.2], look: [0, 1.45, -2.6], fov: 34 },
          { t: S.data.press, pos: [0.9, 1.5, -0.8], look: [0, 1.45, -2.6], fov: 30, e: 'linear' },
        ], t);
      }
    },
  },
  {
    // end card over the drifting hall
    id: 'end',
    at: T_END,
    stage: { world: 'title' },
    hud: 'none',
  },
];

const bars = (at, dur, o = {}) => ({ type: 'bars', at, dur, ...o });

export const TIMELINE = {
  duration: DURATION,
  tail: 0.4,
  scenes,
  mix: { music: 0.7, sfx: 0.6, lufs: -14 },
  overlays: [
    // cold open
    { type: 'black', at: 0, dur: 2.2, keys: [[0, 1], [0.35, 1], [1.9, 0]] },
    { type: 'line', at: 0.6, dur: 3.1, text: '琵琶聲起——' },
    { type: 'line', at: b1(1) + 0.15, dur: 1.65, text: '鬼殺隊，墜入無限城。', pos: 'low', small: true },
    // act 1 name cards
    { type: 'name', at: b1(2) + 0.25, dur: 2 * BAR - 0.3, side: 'right', label: '鬼殺隊', name: '竈門炭治郎', school: '水之呼吸・火之神神樂', color: '#b3301f' },
    { type: 'name', at: b1(4) + 0.25, dur: 2 * BAR - 0.3, side: 'left', label: '鬼殺隊・水柱', name: '富岡義勇', school: '水之呼吸', color: '#2c6aa6' },
    { type: 'flash', at: b1(6) + 0.234, dur: 0.14, color: '#ffffff', amount: 0.3 },
    { type: 'flash', at: b1(10), dur: 0.22, color: '#ffd9a0', amount: 0.45 },
    // the shift
    { type: 'line', at: b1(13) + 0.3, dur: 1.5, text: '上弦之鬼，正在等待。', small: true },
    { type: 'black', at: b1(13) + 1.0, dur: 0.9, keys: [[0, 0], [0.6, 1], [0.9, 1]] },
    // act 2: cinematic bars
    bars(ap(0.178), B22 - ap(0.178), { in: 0.01, out: 0.25 }),
    { type: 'flash', at: ap(2.283), dur: 0.25, color: '#dff6ff', amount: 0.55 },
    { type: 'flash', at: B22, dur: 0.18, color: '#ffffff', amount: 0.5 },
    { type: 'flash', at: b2(26), dur: 0.3, color: '#ffd9a0', amount: 0.6 },
    { type: 'flash', at: b2(30), dur: 0.25, color: '#dff6ff', amount: 0.5 },
    // the finisher
    bars(b2(35), b2(38) - b2(35) + 0.4, { in: 0.6, out: 0.01 }),
    { type: 'flash', at: b2(38), dur: 0.5, color: '#ffffff', amount: 0.9 },
    { type: 'black', at: b2(38) + 0.42, dur: DURATION - b2(38), keys: [[0, 0], [0.08, 1], [1.0, 1], [1.8, 0.62], [9, 0.62]] },
    // end card
    {
      type: 'logo',
      at: b2(38) + 2 * BEAT,
      dur: DURATION - b2(38) - 2 * BEAT,
      kicker: '鬼滅之刃　同人動作演示',
      text: '無限城',
      seal: '同人',
      sub: '瀏覽器即玩',
      url: 'infinity-castle.informaltech.workers.dev',
      note: '支援鍵盤滑鼠與手把　非官方同人作品',
      urlAt: 1.6,
      fadeOut: 1.2,
      z: 60,
    },
  ],
  music: [
    { src: 'battle', at: T_A, from: BATTLE_BAR0, to: BATTLE_BAR0 + 14 * BAR + 0.02, gain: 1, fadeIn: 0.004, fadeOut: 0.4 },
    { src: 'appear', at: T_APP, from: 0, to: 12.05, gain: 2.1, fadeIn: 0.004, fadeOut: 0.3 },
    { src: 'battle', at: B22, from: 40.416, to: 40.416 + (DURATION - B22), gain: 1, fadeIn: 0.004, fadeOut: 2.4 },
  ],
  cues: [
    { at: 0.32, name: 'biwa', o: { note: 0, volume: 1 } },
    { at: 1.2, name: 'biwa', o: { note: 7, volume: 0.7 } },
    { at: 2.2, name: 'biwaShift', o: { volume: 1 } },
    { at: b1(13) + 0.05, name: 'biwa', o: { note: 5, volume: 0.8 } },
    { at: b1(13) + 0.35, name: 'biwaShift', o: { volume: 0.9 } },
    ...[0.35, 1.15, 1.9, 2.6, 3.25, 3.85, 4.4, 4.9, 5.35].map((dt, i) => ({ at: b2(35) + dt, name: 'heartbeat', o: { intensity: 0.4 + i * 0.07, volume: 0.45 + i * 0.06 } })),
    { at: b2(38), name: 'finisher', o: { volume: 1 } },
    { at: b2(38) + 2 * BEAT, name: 'impactFrame', o: { volume: 0.8 } },
    { at: DURATION - 1.4, name: 'biwa', o: { note: 0, volume: 0.6 } },
  ],
};
