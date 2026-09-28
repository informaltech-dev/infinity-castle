// The second trailer: the Wind and Stone Hashira against Upper Moon One, and the 真劍 difficulty. ~98 s, cut to
// Kokushibo's own score (the synthesized 'moon' theme, 120 BPM, a bar every 2 s; 'moon2' once his blade grows).
//
//   0.0   cold open      black, a slow-motion crescent, the two of them, his eyes          (biwa only)
//   9.0   moon bar 0     his eyes open on the gong: the card, his line
//  13.0   bars 2-7       Sanemi, Gyomei (name cards, a line and a form each), his first form
//  25.0   bars 8-15      the fight: their forms against his crescents
//  41.0   bars 16-23     真劍: the title, then four beats with the HUD (parry, 危, posture break, his read)
//  55.0   bar 23         "……不錯。" -- the transformation; the score cuts out, the blade grows
//  59.0   moon2 bar 0    虛哭神去 bursts: the second state, the Hashira's ultimates, the last exchange
//  87.0   moon2 bar 14   he kneels; silence and a heartbeat; the beheading on bar 16, then the end card
//
// Scene times are trailer seconds; every scene rebuilds its own stage, so any range renders on its own.
import * as THREE from 'three';
import { SYNTH_T0 } from './audio-render.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BAR = 2;
const BEAT = BAR / 4;

const T_M = 9.0; // moon bar 0: his eyes open, the card, the gong
const m = (k) => T_M + k * BAR;
const T_X = m(24); // the transformation begins on bar 24's gong
const T_B = T_X + 2.0; // 虛哭神去 bursts 2.0 s into it: moon2 bar 0
const n = (k) => T_B + k * BAR;
const T_CUT = n(16); // the beheading
const DURATION = T_CUT + 7.6;

const MOON = { world: 'arena', light: 'moon' };
const GREEN = '#3fbf7f';
const STONE = '#c4a46a';
const MOONC = '#9d7ce0';
const BLOOD = '#8e1b1b';

const chest = (a) => a.chest(new THREE.Vector3());
const head = (a) => a.head(new THREE.Vector3());

/** The player locks on to him, the game's camera behind the player (for the scenes played with the HUD). */
function lockOn(S, b, pitch = 0.2) {
  S.p.lockTarget = b;
  S.g.cameraRig.lock = b;
  S.g.cameraRig.yaw = S.p.yaw + Math.PI;
  S.g.cameraRig.pitch = pitch;
}

/** His second state, on the scene's clock (the game's own slow motion and line left out: the cut is the edit's). */
function transform(S, b) {
  const g = S.g;
  b.phase = 2;
  b.action = null;
  b.queue = [];
  b.moons.cancel();
  b._era++;
  b.setState('action');
  b.run(b.moves.transform);
  b.curMove = 'transform';
  b.invuln = 3.0;
  b.recentHits = 0;
  g.onBossPhase?.(2);
}

/** A cut made on the scene's clock regardless of the player's own state (a move the player cannot be told to make). */
function force(S, move) {
  const p = S.p;
  p.control = true;
  if (p.state !== 'move') p.setState('move');
  p.startMove(move);
}

const scenes = [
  // ------------------------------------------------------------------ cold open
  {
    // black: the biwa, and where we are
    id: 'open',
    at: 0,
    stage: { ...MOON, player: false },
    hud: 'none',
    setup(S) {
      S.kokushibo([0, 0, 13], Math.PI);
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [0.3, 0.5, -12], look: [0, 3.2, 13], fov: 56 },
        { t: 2.2, pos: [0.25, 0.7, -10.4], look: [0, 2.6, 13], fov: 52, e: 'linear' },
      ], t);
    },
  },
  {
    // a crescent wave in slow motion: 月之呼吸
    id: 'bloom',
    at: 2.2,
    stage: { ...MOON, player: false },
    hud: 'none',
    preroll: 0.45,
    setup(S) {
      const b = S.kokushibo([0, 0, 4.2], Math.PI);
      S.at(-0.45, () => b._chain(['pearl']));
      S.at(-0.05, () => S.slow(0.16));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-0.75, 1.05, 0.2], look: [0.1, 1.45, 4.2], fov: 40 },
        { t: 2.4, pos: [-0.6, 1.1, 0.7], look: [0.1, 1.5, 4.2], fov: 36, e: 'linear' },
      ], t);
    },
  },
  {
    // the two of them, from behind, walking in across the moonlit floor
    id: 'pair',
    at: 4.6,
    stage: { ...MOON, player: false },
    hud: 'none',
    setup(S) {
      S.kokushibo([0, 0, 7.6], Math.PI);
      const a = S.extra('sanemi', [-1.25, 0, -3.4], 0, { face: 'fierce' });
      const b = S.extra('gyomei', [1.35, 0, -3.6], 0);
      a.walk(1.15);
      b.walk(1.05);
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [0.15, 0.85, -8.6], look: [0, 1.5, 7.6], fov: 44 },
        { t: 2.4, pos: [0.1, 1.0, -6.9], look: [0, 1.45, 7.6], fov: 40, e: 'linear' },
      ], t);
    },
  },
  {
    // his face; the eyes open on the gong (bar 0), the card, his line
    id: 'eyes',
    at: 7.0,
    stage: { ...MOON, player: false },
    hud: 'cine',
    setup(S) {
      const g = S.g;
      const b = S.kokushibo([0, 0, 8], Math.PI, { state: 'intro' });
      b.anim.play(b.clips.taunt, { fade: 0, hold: true });
      const L = (a) => a - 7.0;
      S.at(L(T_M), () => {
        b.eyeFlash();
        g.hud.bossIntro({ title: '上弦之壹', name: '黑死牟', subtitle: '月之呼吸', theme: 'moon' });
        g.audio.play('moonRead');
        g.fx.screen.flash(0xc8a0ff, 0.35, 4);
        g.cameraRig.shake(0.2);
      });
      S.at(L(T_M + 1.4), () => b.anim.stop(0.5));
      S.at(L(T_M + 1.7), () => g.hud.subtitle('黑死牟', '稀血……以及鍛鍊至極的肉體。兩位柱，一起上吧。', 2.3));
    },
    camera(S, t) {
      const a = t + 7.0;
      if (a < T_M) {
        S.path([
          { t: 7.0, pos: [0.9, 1.7, 3.4], look: [0, 1.72, 8], fov: 38 },
          { t: T_M, pos: [0.3, 1.77, 6.45], look: [0, 1.74, 8], fov: 26, e: 'inOut' },
        ], a);
      } else {
        S.path([
          { t: T_M, pos: [0.3, 1.77, 6.45], look: [0, 1.74, 8], fov: 26 },
          { t: m(2), pos: [0.22, 1.78, 6.7], look: [0, 1.74, 8], fov: 24, e: 'linear' },
        ], a);
      }
    },
  },

  // ------------------------------------------------------------------ the two Hashira
  {
    // bars 2-3: Sanemi -- his line, then 爪爪・科戶風 at him
    id: 'sanemi',
    at: m(2),
    stage: { ...MOON, char: 'sanemi', player: { pos: [0, 0, -3], yaw: 0 } },
    hud: 'cine',
    setup(S) {
      const g = S.g;
      const p = S.p;
      const b = S.kokushibo([0, 0, 4.6], Math.PI);
      p.control = false;
      p.setState('cine');
      p.anim.play(p.clips.thrustCharge, { fade: 0.2, hold: true });
      p.model.setFace('fierce');
      S.at(0.15, () => g.hud.subtitle('不死川實彌', '好啊……就讓你嘗嘗我這身血的滋味！', 2.2));
      S.at(1.86, () => {
        p.control = true;
        p.setState('move');
        S.tap('skill1');
      });
      S.at(2.25, () => S.slow(0.4));
      S.at(2.95, () => S.slow(null));
      S.at(2.7, () => b._chain(['stepL']));
    },
    camera(S, t) {
      if (t < BAR) {
        S.path([
          { t: 0, pos: [-1.3, 1.3, -1.15], look: [-0.6, 1.5, -3], fov: 38 },
          { t: BAR, pos: [-1.1, 1.35, -1.5], look: [-0.55, 1.55, -3], fov: 35, e: 'linear' },
        ], t);
      } else {
        S.path([
          { t: BAR, pos: [1.0, 1.45, -5.6], look: [0, 1.25, 4.6], fov: 44 },
          { t: 2 * BAR, pos: [0.8, 1.35, -4.9], look: [0, 1.25, 4.6], fov: 42, e: 'out3' },
        ], t);
      }
    },
  },
  {
    // bars 4-5: Gyomei -- the ball whirling overhead through his line, then 天面碎 where Kokushibo stood
    id: 'gyomei',
    at: m(4),
    stage: { ...MOON, char: 'gyomei', player: { pos: [0, 0, -3.4], yaw: 0 } },
    hud: 'cine',
    setup(S) {
      const g = S.g;
      const b = S.kokushibo([0, 0, 1.2], Math.PI);
      S.at(0.4, () => S.hold('heavy', 1.6));
      S.at(0.15, () => g.hud.subtitle('悲鳴嶼行冥', '南無阿彌陀佛——我會將你的頸，擊碎在此。', 2.4));
      S.at(2.3, () => b._chain(['hop']));
    },
    camera(S, t) {
      if (t < BAR) {
        S.path([
          { t: 0, pos: [1.1, 1.25, -0.2], look: [-0.55, 2.15, -3.4], fov: 50 },
          { t: BAR, pos: [0.95, 1.3, -0.5], look: [-0.55, 2.2, -3.4], fov: 48, e: 'linear' },
        ], t);
      } else {
        S.path([
          { t: BAR, pos: [2.2, 0.45, 2.6], look: [0, 2.4, -1.6], fov: 58 },
          { t: 2 * BAR, pos: [2.6, 0.6, 3.1], look: [0, 1.4, -0.6], fov: 58, e: 'out3' },
        ], t);
      }
    },
  },
  {
    // bars 6-7: his answer -- 壹之型・闇月・宵之宮, the draw falling on bar 7
    id: 'draw',
    at: m(6),
    stage: { ...MOON, char: 'sanemi', player: { pos: [0, 0, -3.4], yaw: 0 } },
    hud: 'cine',
    setup(S) {
      const b = S.kokushibo([0, 0, 1.4], Math.PI);
      S.at(0.9, () => b._execute('iai'));
      S.data.autoRead = { dodge: 'S', parry: false };
      S.at(BAR - 0.1, () => S.slow(0.3));
      S.at(BAR + 1.0, () => S.slow(null));
    },
    camera(S, t) {
      if (t < BAR - 0.1) {
        S.path([
          { t: 0, pos: [-1.35, 1.4, -0.3], look: [-0.05, 1.42, 1.4], fov: 34 },
          { t: BAR, pos: [-1.1, 1.42, -0.05], look: [-0.05, 1.45, 1.4], fov: 31, e: 'linear' },
        ], t);
      } else {
        S.path([
          { t: BAR - 0.1, pos: [5.4, 1.3, -1.4], look: [0, 1.1, -0.9], fov: 50 },
          { t: 2 * BAR, pos: [5.9, 1.5, -1.2], look: [0, 1.0, -0.9], fov: 52, e: 'out3' },
        ], t);
      }
    },
  },

  // ------------------------------------------------------------------ the fight (bars 8-15)
  {
    // bar 8: 參之型・岩軀之膚 beating down 珠華之弄月
    id: 'skin',
    at: m(8),
    stage: { ...MOON, char: 'gyomei', player: { pos: [0, 0, -2.6], yaw: 0 } },
    hud: 'cine',
    preroll: 0.6,
    setup(S) {
      const b = S.kokushibo([0, 0, 2.4], Math.PI);
      S.at(-0.55, () => b._chain(['pearl']));
      S.at(-0.3, () => S.tap('skill2'));
    },
    camera(S, t) {
      const a = 0.55 + t * 0.32;
      const c = chest(S.p);
      S.cam(V(c.x + Math.sin(a) * 4.6, 1.05, c.z - Math.cos(a) * 4.6), V(c.x, 1.35, c.z + 0.6), 48);
    },
  },
  {
    // bar 9: 肆之型・昇上砂塵嵐 against 厭忌月・銷蝕
    id: 'storm',
    at: m(9),
    stage: { ...MOON, char: 'sanemi', player: { pos: [0, 0, -1.7], yaw: 0 } },
    hud: 'cine',
    preroll: 0.4,
    setup(S) {
      const b = S.kokushibo([0, 0, 2.3], Math.PI);
      S.at(-0.38, () => b._chain(['loathe']));
      S.at(-0.12, () => S.tap('skill2'));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [3.0, 0.35, -3.4], look: [0, 2.2, -1.2], fov: 56 },
        { t: BAR, pos: [3.4, 0.6, -3.0], look: [0, 3.2, -1.0], fov: 58, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 10: 陸之型・常夜孤月・無間 -- the whole floor, from above and behind him
    id: 'eternal',
    sfx: 1.7,
    at: m(10),
    stage: { ...MOON, char: 'gyomei', player: { pos: [0, 0, -4.2], yaw: 0 } },
    hud: 'cine',
    preroll: 0.3,
    setup(S) {
      const b = S.kokushibo([0, 0, 3.2], Math.PI);
      S.at(-0.28, () => b._chain(['eternal']));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-2.4, 3.4, 6.6], look: [0, 0.8, -1.6], fov: 50 },
        { t: BAR, pos: [-2.0, 3.0, 6.0], look: [0, 0.9, -2.0], fov: 48, e: 'linear' },
      ], t);
    },
  },
  {
    // bar 11: 壹之型・塵旋風・削斬, the whirlwind drilling through him
    id: 'whirl',
    at: m(11),
    stage: { ...MOON, char: 'sanemi', player: { pos: [0, 0, -5.8], yaw: 0 } },
    hud: 'cine',
    preroll: 0.9,
    setup(S) {
      S.kokushibo([0, 0, 1.6], Math.PI);
      S.at(-0.85, () => S.hold('heavy', 0.72));
    },
    camera(S, t) {
      const x = S.p.pos.z;
      if (S.data.cz == null) S.data.cz = x;
      S.data.cz += (x - S.data.cz) * 0.14;
      S.cam(V(5.4, 1.15, S.data.cz + 0.6), V(0, 1.2, S.data.cz + 1.4), 48);
    },
  },
  {
    // bar 12: 壹之型・蛇紋岩・雙極 -- ball and axe from either side
    id: 'poles',
    at: m(12),
    stage: { ...MOON, char: 'gyomei', player: { pos: [0, 0, -2.9], yaw: 0 } },
    hud: 'cine',
    setup(S) {
      S.kokushibo([0, 0, 1.4], Math.PI);
      S.at(0.05, () => S.tap('skill1'));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [0.4, 4.4, -5.4], look: [0, 0.7, 0.9], fov: 48 },
        { t: BAR, pos: [0.3, 3.8, -4.8], look: [0, 0.8, 1.1], fov: 46, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 13: 伍之型・月魄災渦 -- the moons simply come; Sanemi slips out between them
    id: 'cast',
    at: m(13),
    stage: { ...MOON, char: 'sanemi', player: { pos: [0, 0, -1.2], yaw: 0 } },
    hud: 'cine',
    preroll: 0.2,
    setup(S) {
      const b = S.kokushibo([0, 0, 1.8], Math.PI);
      S.at(-0.18, () => b._chain(['cast']));
      S.at(0.22, () => {
        S.move('S');
        S.tap('dodge');
      });
      S.at(0.42, () => S.move(null));
    },
    camera(S, t) {
      const a = 2.2 + t * 0.35;
      S.cam(V(Math.sin(a) * 6.0, 2.2, 1.8 + Math.cos(a) * 6.0), V(0, 1.2, 0.8), 50);
    },
  },
  {
    // bar 14: 伍之型・木枯颪 -- up, and spinning down on him
    id: 'kogarashi',
    at: m(14),
    stage: { ...MOON, char: 'sanemi', player: { pos: [0, 0, -3.4], yaw: 0 } },
    hud: 'cine',
    setup(S) {
      S.kokushibo([0, 0, 1.5], Math.PI);
      S.at(0.05, () => S.tap('skill3'));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [3.8, 0.35, -1.6], look: [0, 2.2, -1.0], fov: 54 },
        { t: BAR, pos: [4.2, 0.6, -1.0], look: [0, 1.4, 0.2], fov: 52, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 15: 肆之型・流紋岩・速征 -- striding in, the ball coming down on beat 3
    id: 'rhyolite',
    at: m(15),
    stage: { ...MOON, char: 'gyomei', player: { pos: [0, 0, -5.6], yaw: 0 } },
    hud: 'cine',
    setup(S) {
      S.kokushibo([0, 0, 0.6], Math.PI);
      S.at(0.5, () => S.tap('skill3'));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [3.0, 0.8, 2.2], look: [0, 1.3, -3.0], fov: 48 },
        { t: BAR, pos: [3.4, 0.95, 2.6], look: [0, 1.1, -1.4], fov: 52, e: 'out3' },
      ], t);
    },
  },

  // ------------------------------------------------------------------ 真劍 (bars 16-23)
  {
    // bars 16-17: the title over his held draw
    id: 'duelTitle',
    at: m(16),
    stage: { ...MOON, diff: 'duel', char: 'sanemi', player: { pos: [0, 0, -4], yaw: 0 } },
    hud: 'none',
    setup(S) {
      const b = S.kokushibo([0, 0, 2], Math.PI);
      b.anim.play(b.clips.iaiReady, { fade: 0, hold: true, time: 0.4 });
      S.g.fx.screen.desatTarget = 0.35;
      S.at(1.6, () => b.drawTell());
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-1.7, 1.25, 0.4], look: [0, 1.2, 2], fov: 30 },
        { t: 2 * BAR, pos: [-1.35, 1.3, 0.8], look: [0, 1.25, 2], fov: 27, e: 'linear' },
      ], t);
    },
  },
  {
    // bar 18: 壹 看破預兆 -- every cut held and flashed before it falls; parried
    id: 'duelParry',
    at: m(18),
    stage: { ...MOON, diff: 'duel', char: 'sanemi', player: { pos: [0, 0, -1.7], yaw: 0, god: false, real: true, hp: 0.92 } },
    hud: 'game',
    preroll: 0.3,
    setup(S) {
      const b = S.kokushibo([0, 0, 1.2], Math.PI, { hp: 4600 });
      lockOn(S, b);
      S.data.autoRead = { parry: true };
      S.at(-0.28, () => b._execute('c2'));
    },
  },
  {
    // bar 19: 貳 見危即避 -- the thrust no guard stops, stepped off, and the counter
    id: 'duelPeril',
    at: m(19),
    stage: { ...MOON, diff: 'duel', char: 'sanemi', player: { pos: [0, 0, -3.0], yaw: 0, god: false, real: true, hp: 0.84 } },
    hud: 'game',
    preroll: 0.1,
    setup(S) {
      const b = S.kokushibo([0, 0, 1.3], Math.PI, { hp: 4150 });
      lockOn(S, b);
      S.data.autoRead = { dodge: 'D', parry: false };
      S.at(-0.08, () => b._execute('thrust'));
      S.at(1.05, () => S.tap('light'));
      S.at(1.4, () => S.tap('light'));
    },
  },
  {
    // bars 20-21: 參 瓦解架勢 -- the last parry breaks his posture; the execution
    id: 'duelBreak',
    at: m(20),
    stage: { ...MOON, diff: 'duel', char: 'gyomei', player: { pos: [0, 0, -1.8], yaw: 0, god: false, real: true, hp: 0.78 } },
    hud: 'game',
    preroll: 0.3,
    setup(S) {
      const b = S.kokushibo([0, 0, 1.2], Math.PI, { hp: 3700 });
      lockOn(S, b);
      b.poise = 14;
      S.data.autoRead = { parry: true };
      S.at(-0.28, () => b._execute('c2'));
      for (let i = 0; i < 20; i++) S.at(0.4 + i * 0.1, () => S.p.curMove !== 'execute' && S.p.execTarget() && S.tap('light'));
    },
  },
  {
    // bar 22: 肆 他也在看破你 -- a flurry too long, read: 通透世界, and the draw
    id: 'duelRead',
    at: m(22),
    stage: { ...MOON, diff: 'duel', char: 'sanemi', player: { pos: [0, 0, -1.5], yaw: 0, god: false, real: true, hp: 0.7 } },
    hud: 'game',
    setup(S) {
      const b = S.kokushibo([0, 0, 1.0], Math.PI, { hp: 2950 });
      lockOn(S, b);
      S.at(0.02, () => S.tap('light'));
      S.at(0.36, () => S.tap('light'));
      S.at(0.7, () => S.tap('light'));
      S.at(1.02, () => b._read(S.p));
    },
  },

  // ------------------------------------------------------------------ the transformation
  {
    // bar 23: his line; bar 24 (the gong): the transformation -- the score cuts, the blade grows, it bursts
    id: 'transform',
    at: m(23),
    stage: { ...MOON, char: 'gyomei', player: { pos: [0, 0, -4.2], yaw: 0 } },
    hud: 'cine',
    setup(S) {
      const g = S.g;
      const b = S.kokushibo([0, 0, 1.4], Math.PI);
      S.p.control = false;
      S.p.setState('cine');
      S.at(0.1, () => g.hud.subtitle('黑死牟', '……不錯。那就讓你見識，月之呼吸真正的樣子。', 3.3));
      S.at(T_X - m(23), () => transform(S, b));
    },
    camera(S, t) {
      const a = t + m(23);
      if (a < T_X) {
        S.path([
          { t: m(23), pos: [-1.5, 1.0, -0.9], look: [0, 1.6, 1.4], fov: 40 },
          { t: T_X, pos: [-1.3, 1.0, -0.6], look: [0, 1.65, 1.4], fov: 38, e: 'linear' },
        ], a);
      } else if (a < T_B) {
        S.path([
          { t: T_X, pos: [-1.35, 0.8, -1.3], look: [0, 1.85, 1.4], fov: 44 },
          { t: T_B, pos: [-1.0, 0.7, -0.8], look: [0, 2.05, 1.4], fov: 40, e: 'in' },
        ], a);
      } else {
        S.path([
          { t: T_B, pos: [-5.6, 4.4, -6.6], look: [0, 1.0, 1.4], fov: 56 },
          { t: n(1), pos: [-5.0, 3.9, -6.0], look: [0, 1.1, 1.4], fov: 54, e: 'out3' },
        ], a);
      }
    },
  },

  // ------------------------------------------------------------------ the second state (moon2)
  {
    // bar 1: 漆之型・厄鏡・月映 -- crescents run the floor at Gyomei, beaten down by 岩軀之膚
    id: 'mirror',
    at: n(1),
    stage: { ...MOON, char: 'gyomei', player: { pos: [0, 0, -3.4], yaw: 0 } },
    hud: 'cine',
    preroll: 0.3,
    setup(S) {
      const b = S.kokushibo([0, 0, 2.2], Math.PI, { phase: 2 });
      S.at(-0.28, () => b._chain(['mirror']));
      S.at(-0.05, () => S.tap('skill2'));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-1.8, 0.45, -6.6], look: [0, 1.2, 2.2], fov: 46 },
        { t: BAR, pos: [-2.4, 0.6, -6.9], look: [0, 1.2, 1.2], fov: 50, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 2: 捌之型・月龍輪尾 -- the long blade swept round; Sanemi goes over it
    id: 'dragon',
    at: n(2),
    stage: { ...MOON, char: 'sanemi', player: { pos: [0, 0, -2.8], yaw: 0 } },
    hud: 'cine',
    preroll: 0.3,
    setup(S) {
      const b = S.kokushibo([0, 0, 1.8], Math.PI, { phase: 2 });
      S.at(-0.28, () => b._chain(['dragon']));
      S.at(0.02, () => S.tap('skill3'));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [6.4, 0.55, -0.8], look: [0, 1.4, -0.2], fov: 52 },
        { t: BAR, pos: [6.8, 0.8, -0.2], look: [0, 1.2, 0.2], fov: 54, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 3: 玖之型・墮月・連面 -- down along a line beside Gyomei, crescents curling everywhere
    id: 'descend',
    sfx: 1.7,
    at: n(3),
    stage: { ...MOON, char: 'gyomei', player: { pos: [1.7, 0, -3.2], yaw: 0 } },
    hud: 'cine',
    preroll: 0.2,
    setup(S) {
      const b = S.kokushibo([0, 0, 4.2], Math.PI, { phase: 2 });
      S.at(-0.18, () => b._chain(['descend']));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [3.6, 1.1, -6.8], look: [0, 2.2, 1.8], fov: 50 },
        { t: BAR, pos: [3.9, 1.3, -7.4], look: [0, 1.6, 1.0], fov: 54, e: 'out3' },
      ], t);
    },
  },
  {
    // bars 4-5: 玖之型・韋馱天颱風
    id: 'typhoon',
    at: n(4),
    stage: { ...MOON, char: 'sanemi', player: { pos: [0, 0, -3.2], yaw: 0, conc: 100 } },
    hud: 'cine',
    preroll: 0.2,
    setup(S) {
      S.kokushibo([0, 0, 2.2], Math.PI, { phase: 2 });
      S.at(-0.18, () => S.tap('ult'));
    },
    camera(S, t) {
      if (t < 0.7) return false; // the game's own close-up on the ready pose
      const a = 2.6 + (t - 0.7) * 0.5;
      S.cam(V(Math.sin(a) * 10, 3.6 + (t - 0.7) * 0.3, 1.0 + Math.cos(a) * 10), V(0, 2.0, 1.2), 54);
    },
  },
  {
    // bar 6: 拾肆之型・兇變・天滿纖月, from above
    id: 'spiral',
    sfx: 1.7,
    at: n(6),
    stage: { ...MOON, char: 'gyomei', player: { pos: [0, 0, -5.8], yaw: 0 } },
    hud: 'cine',
    preroll: 0.2,
    setup(S) {
      const b = S.kokushibo([0, 0, 0], Math.PI, { phase: 2 });
      S.at(-0.18, () => b._chain(['spiral']));
    },
    camera(S, t) {
      const a = t * 0.35;
      S.cam(V(Math.sin(a) * 3.2, 11.5 - t * 0.6, -6.5 + Math.cos(a) * 0.6), V(0, 0, -0.4), 56);
    },
  },
  {
    // bar 7: 拾之型・穿面斬・籮月 -- two great wheels of moons down the floor; Sanemi slips between
    id: 'saw',
    at: n(7),
    stage: { ...MOON, char: 'sanemi', player: { pos: [0, 0, -4.4], yaw: 0 } },
    hud: 'cine',
    preroll: 0.15,
    setup(S) {
      const b = S.kokushibo([0, 0, 3.6], Math.PI, { phase: 2 });
      S.at(-0.12, () => b._chain(['saw']));
      S.at(0.62, () => {
        S.move('D');
        S.tap('dodge');
      });
      S.at(0.8, () => S.move(null));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [1.6, 0.35, -7.4], look: [0, 1.4, 3.0], fov: 46 },
        { t: BAR, pos: [2.2, 0.5, -7.8], look: [0, 1.2, 1.0], fov: 50, e: 'out3' },
      ], t);
    },
  },
  {
    // bars 8-9: 伍之型・瓦輪刑部
    id: 'garin',
    at: n(8),
    stage: { ...MOON, char: 'gyomei', player: { pos: [0, 0, -3.2], yaw: 0, conc: 100 } },
    hud: 'cine',
    preroll: 0.1,
    setup(S) {
      S.kokushibo([0, 0, 2.6], Math.PI, { phase: 2 });
      S.at(-0.08, () => S.tap('ult'));
    },
    camera(S, t) {
      if (t < 0.5) return false;
      const a = -2.4 - (t - 0.5) * 0.35;
      S.cam(V(Math.sin(a) * 8.2, 3.4, 0.4 + Math.cos(a) * 8.2), V(0, 2.4, 0.4), 56);
    },
  },
  {
    // bar 10: 拾陸之型・月虹・孤留月 -- the blade to the sky, moons falling on the marks
    id: 'sky',
    sfx: 1.7,
    at: n(10),
    stage: { ...MOON, char: 'sanemi', player: { pos: [0, 0, -2.6], yaw: 0 } },
    hud: 'cine',
    preroll: 0.3,
    setup(S) {
      const b = S.kokushibo([0, 0, 2.4], Math.PI, { phase: 2 });
      S.at(-0.28, () => b._chain(['sky']));
      S.at(0.55, () => {
        S.move('A');
        S.tap('dodge');
      });
      S.at(0.7, () => S.move(null));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-4.6, 6.4, -6.8], look: [0, 0.6, 0], fov: 52 },
        { t: BAR, pos: [-5.2, 5.6, -6.2], look: [0, 0.8, 0.2], fov: 54, e: 'linear' },
      ], t);
    },
  },
  {
    // bar 11: the long blade against Sanemi's guard, in slow motion
    id: 'clash',
    at: n(11),
    stage: { ...MOON, diff: 'duel', char: 'sanemi', player: { pos: [0, 0, -2.2], yaw: 0, god: false } },
    hud: 'cine',
    preroll: 0.25,
    setup(S) {
      const b = S.kokushibo([0, 0, 1.8], Math.PI, { phase: 2 });
      S.p.lockTarget = b;
      S.data.autoRead = { parry: true };
      S.at(-0.22, () => b._execute('c2'));
      S.at(0.25, () => S.slow(0.3));
      S.at(1.3, () => S.slow(null));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [4.7, 1.5, -0.3], look: [0, 1.35, -0.2], fov: 40 },
        { t: BAR, pos: [4.3, 1.45, -0.1], look: [0, 1.35, -0.1], fov: 38, e: 'linear' },
      ], t);
    },
  },
  {
    // bar 12: posture broken; the ball comes down: 處決
    id: 'exec',
    at: n(12),
    stage: { ...MOON, diff: 'duel', char: 'gyomei', player: { pos: [0, 0, -1.8], yaw: 0, god: false } },
    hud: 'cine',
    preroll: 1.0,
    setup(S) {
      const b = S.kokushibo([0, 0, 1.2], Math.PI, { phase: 2 });
      S.p.lockTarget = b;
      b.poise = 14;
      S.data.autoRead = { parry: true };
      S.at(-0.98, () => b._execute('c2'));
      for (let i = 0; i < 24; i++) S.at(-0.5 + i * 0.08, () => S.p.curMove !== 'execute' && S.p.execTarget() && S.tap('light'));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-2.6, 0.8, -3.2], look: [0, 1.3, 0.6], fov: 44 },
        { t: BAR, pos: [-3.0, 1.0, -3.6], look: [0, 1.0, 0.8], fov: 48, e: 'out3' },
      ], t);
    },
  },
  {
    // bar 13: the whirlwind through him -- and he goes down on one knee
    id: 'last',
    at: n(13),
    stage: { ...MOON, char: 'sanemi', player: { pos: [0, 0, -5.4], yaw: 0 } },
    hud: 'cine',
    preroll: 0.9,
    setup(S) {
      const b = S.kokushibo([0, 0, 1.2], Math.PI, { phase: 2, hp: 60 });
      S.at(-0.85, () => S.hold('heavy', 0.72));
      S.at(0.35, () => {
        if (b.alive && b.state !== 'finisher') b.die(S.p, {});
      });
      S.at(0.1, () => S.slow(0.35));
      S.at(0.9, () => S.slow(null));
    },
    camera(S, t) {
      S.path([
        { t: 0, pos: [-4.4, 0.8, -2.4], look: [0, 1.2, -0.6], fov: 50 },
        { t: BAR, pos: [-4.8, 1.0, -1.4], look: [0, 1.0, 0.8], fov: 52, e: 'out3' },
      ], t);
    },
  },
  {
    // bars 14-15: the kneeling demon between them; the prompt; the press on bar 16
    id: 'finisher',
    at: n(14),
    stage: { ...MOON, char: 'sanemi', player: { pos: [-0.9, 0, -2.4], yaw: 0.3 } },
    hud: 'cine',
    setup(S) {
      const g = S.g;
      const b = S.kokushibo([0, 0, 0.6], Math.PI, { phase: 2, hp: 1 });
      b.die(S.p, {});
      const x = S.extra('gyomei', [1.5, 0, -1.9], -0.45);
      void x;
      g.fx.screen.desatTarget = 0.35;
      S.p.control = false;
      S.p.setState('cine');
      S.at(0.3, () => g.hud.subtitle('黑死牟', '……我……會輸……？', 2.0));
      const press = T_CUT - n(14) - 1 / 60;
      S.at(press - 1.6, () => {
        S.p.control = true;
        S.p.setState('move');
        g.director.run(g.director._decapitate(b));
      });
      S.at(press, () => S.tap('light'));
      S.data.press = press;
    },
    camera(S, t) {
      if (t >= S.data.press) {
        S.cam(V(2.7, 1.35, 0.4), V(0, 1.35, 0.4), 42);
        return;
      }
      if (t < 2.2) {
        S.path([
          { t: 0, pos: [0.55, 0.95, -0.9], look: [0, 1.05, 0.6], fov: 34 },
          { t: 2.2, pos: [0.45, 0.98, -0.6], look: [0, 1.08, 0.6], fov: 31, e: 'linear' },
        ], t);
      } else {
        S.path([
          { t: 2.2, pos: [0.2, 1.3, 3.4], look: [0, 1.0, -1.6], fov: 44 },
          { t: S.data.press, pos: [0.15, 1.25, 3.0], look: [0, 1.0, -1.6], fov: 40, e: 'linear' },
        ], t);
      }
    },
  },
  {
    // end card over the drifting hall
    id: 'end',
    at: T_CUT + 0.5,
    stage: { world: 'title' },
    hud: 'none',
  },
];

const bars = (at, dur, o = {}) => ({ type: 'bars', at, dur, ...o });
const feature = (at, dur, no, text, sub, o = {}) => ({ type: 'feature', at, dur, no, text, sub, color: BLOOD, ...o });

export const TIMELINE = {
  duration: DURATION,
  tail: 0.4,
  scenes,
  mix: { music: 0.7, sfx: 0.6, lufs: -14 },
  overlays: [
    // cold open
    { type: 'black', at: 0, dur: 2.3, keys: [[0, 1], [0.4, 1], [2.3, 0.35]] },
    { type: 'line', at: 0.5, dur: 1.7, text: '無限城　最深處' },
    { type: 'flash', at: 2.2, dur: 0.18, color: '#000000', amount: 0.8 },
    { type: 'line', at: 4.8, dur: 2.0, text: '上弦之首，已等候多時。', pos: 'low', small: true },
    { type: 'flash', at: T_M, dur: 0.3, color: '#e2d4ff', amount: 0.5 },
    bars(7.0, m(2) - 7.0, { in: 0.5, out: 0.25 }),
    // the two Hashira
    { type: 'name', at: m(2) + 0.2, dur: 2 * BAR - 0.3, side: 'left', label: '風柱', name: '不死川實彌', school: '風之呼吸', color: GREEN },
    { type: 'name', at: m(4) + 0.2, dur: 2 * BAR - 0.3, side: 'left', label: '岩柱', name: '悲鳴嶼行冥', school: '岩之呼吸', color: STONE },
    { type: 'flash', at: m(8), dur: 0.2, color: '#ffffff', amount: 0.35 },
    // 真劍
    { type: 'flash', at: m(16), dur: 0.35, color: '#ffffff', amount: 0.7 },
    { type: 'title', at: m(16) + 0.1, dur: 2 * BAR - 0.2, kicker: '全新難度', text: '真劍', sub: '每一刀，皆是生死', color: BLOOD },
    feature(m(18) + 0.05, BAR - 0.1, '壹', '看破預兆', '每一刀落下之前，都有預兆可循'),
    feature(m(19) + 0.05, BAR - 0.1, '貳', '見危即避', '「危」字之刀無法格擋，只能閃開'),
    feature(m(20) + 0.05, 2 * BAR - 0.1, '參', '瓦解架勢', '格擋與閃避削其架勢，崩潰之時一擊處決'),
    feature(m(22) + 0.05, BAR - 0.1, '肆', '他也在看破你', '貪刀與慣性，都逃不過上弦之壹的眼', { color: MOONC }),
    // the transformation
    bars(m(23), n(1) - m(23), { in: 0.4, out: 0.2 }),
    { type: 'flash', at: T_B, dur: 0.45, color: '#d8c0ff', amount: 0.75 },
    { type: 'flash', at: n(4), dur: 0.2, color: '#c8ffe0', amount: 0.35 },
    { type: 'flash', at: n(8), dur: 0.25, color: '#fff0d0', amount: 0.45 },
    // the end
    bars(n(14), T_CUT - n(14) + 0.4, { in: 0.6, out: 0.01 }),
    { type: 'flash', at: T_CUT + 0.2, dur: 0.5, color: '#ffffff', amount: 0.85 },
    { type: 'black', at: T_CUT + 0.42, dur: DURATION - T_CUT, keys: [[0, 0], [0.08, 1], [1.0, 1], [1.8, 0.62], [9, 0.62]] },
    {
      type: 'logo',
      at: T_CUT + 2 * BEAT,
      dur: DURATION - T_CUT - 2 * BEAT,
      kicker: '鬼滅之刃　同人動作演示',
      text: '無限城',
      seal: '同人',
      sub: '風柱・岩柱參戰　上弦之壹降臨　全新難度「真劍」',
      url: 'infinity-castle.informaltech.workers.dev',
      note: '支援鍵盤滑鼠與手把　非官方同人作品',
      urlAt: 1.6,
      fadeOut: 1.2,
      z: 60,
    },
  ],
  music: [
    // his theme from its first bar on the eyes opening, cut out as he transforms (the gong of bar 24 left ringing)
    { src: 'synth:moon', intensity: 0.75, at: T_M, from: SYNTH_T0, to: SYNTH_T0 + 24 * BAR + 1.35, gain: 1.9, fadeIn: 0.004, fadeOut: 1.0 },
    // the second state from its first bar on the burst, dropping out as he kneels ...
    { src: 'synth:moon2', intensity: 0.9, at: T_B, from: SYNTH_T0, to: SYNTH_T0 + 14 * BAR + 0.5, gain: 1.9, fadeIn: 0.004, fadeOut: 1.1 },
    // ... and back in from bar 16 under the end card
    { src: 'synth:moon2', intensity: 0.9, at: T_CUT, from: SYNTH_T0 + 16 * BAR, to: SYNTH_T0 + 16 * BAR + (DURATION - T_CUT), gain: 1.9, fadeIn: 0.004, fadeOut: 3.2 },
  ],
  cues: [
    { at: 0.3, name: 'biwa', o: { note: 0, volume: 0.85 } },
    { at: 1.25, name: 'biwa', o: { note: 7, volume: 0.7 } },
    { at: 4.6, name: 'biwa', o: { note: 5, volume: 0.55 } },
    { at: 7.05, name: 'biwa', o: { note: 3, volume: 0.75 } },
    ...[0.2, 0.95, 1.65, 2.3, 2.9, 3.45, 3.95].map((dt, i) => ({ at: n(14) + dt, name: 'heartbeat', o: { intensity: 0.45 + i * 0.08, volume: 0.5 + i * 0.07 } })),
    { at: T_CUT, name: 'finisher', o: { volume: 1 } },
    { at: T_CUT + 2 * BEAT, name: 'impactFrame', o: { volume: 0.8 } },
    { at: DURATION - 1.4, name: 'biwa', o: { note: 0, volume: 0.6 } },
  ],
};
