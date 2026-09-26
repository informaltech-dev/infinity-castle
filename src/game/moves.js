// Player move definitions (timings in seconds of clip time at speed 1).
// Arc fx: { t, tilt, yaw, a0, a1, r, width, style, life } in body space (see Animator swing plane).

const arc = (t, tilt, a0, a1, o = {}) => ({ t, fn: (p) => p.spawnArc({ tilt, a0, a1, ...o }) });
const trail = (t, style, on = true) => ({ t, fn: (p) => p.setTrail(on ? style : null) });
const call = (t, fn) => ({ t, fn });

const L = (o) => ({ range: 2.7, arc: 150, dmg: 16, poise: 12, knock: 1.6, hitstop: 0.055, shake: 0.16, power: 0.4, stun: 'light', ...o });

export function playerMoves(id) {
  const water = 'water';
  const lightStyle = id === 'giyu' ? 'water' : 'steel';
  const M = {
    light1: {
      clip: 'light1', dur: 0.46, cancel: 0.19, turn: [0, 0.1, 16], motion: [[0.04, 0.16, 0.8]],
      hits: [L({ t: 0.1, style: lightStyle })],
      events: [trail(0, 'steel'), arc(0.075, 40, 134, -38, { r: 1.45, width: 0.42, style: 'steel', life: 0.22 })],
      sfx: [{ t: 0.06, name: 'swingLight' }],
    },
    light2: {
      clip: 'light2', dur: 0.44, cancel: 0.18, turn: [0, 0.09, 16], motion: [[0.03, 0.15, 0.7]],
      hits: [L({ t: 0.1, style: lightStyle })],
      events: [trail(0, 'steel'), arc(0.07, 45, -122, 88, { r: 1.45, width: 0.42, style: 'steel', life: 0.22 })],
      sfx: [{ t: 0.06, name: 'swingLight' }],
    },
    light3: {
      clip: 'light3', dur: 0.5, cancel: 0.21, turn: [0, 0.1, 16], motion: [[0.05, 0.18, 1.0]],
      hits: [L({ t: 0.12, arc: 200, dmg: 19, poise: 14, knock: 2.2, style: lightStyle })],
      events: [trail(0, 'steel'), arc(0.08, 86, 112, -104, { r: 1.6, width: 0.5, style: 'steel', life: 0.24 })],
      sfx: [{ t: 0.08, name: 'swingLight', opts: { pitch: 0.92 } }],
    },
    light4: {
      clip: 'light4', dur: 0.74, cancel: 0.5, turn: [0, 0.2, 12], motion: [[0.05, 0.26, 1.5]],
      hits: [L({ t: 0.23, range: 3.0, arc: 110, dmg: 34, poise: 36, knock: 5.5, hitstop: 0.11, shake: 0.42, power: 0.85, stun: 'heavy', style: water, radial: 0.25, fov: 4 })],
      events: [
        trail(0, water),
        arc(0.19, 0, 160, -48, { r: 1.7, width: 0.9, style: water, life: 0.35 }),
        call(0.24, (p) => p.splashGround(1.6, 1.2)),
      ],
      sfx: [{ t: 0.14, name: 'swingWater' }, { t: 0.24, name: 'waterSplash', opts: { volume: 0.8 } }],
    },
    heavy: {
      clip: 'heavy', dur: 0.78, cancel: 0.56, turn: [0, 0.3, 10], motion: [[0.26, 0.38, 1.2]],
      hits: [L({ t: 0.32, range: 3.0, arc: 170, dmg: 36, poise: 45, knock: 4.5, hitstop: 0.12, shake: 0.45, power: 0.85, stun: 'heavy', style: 'steel', fov: 5 })],
      events: [trail(0.2, 'steel'), arc(0.28, 48, 160, -76, { r: 1.75, width: 0.8, style: 'steel', life: 0.3 }), call(0.2, (p) => p.glint())],
      sfx: [{ t: 0.28, name: 'swingHeavy' }],
    },
    // 漆之型 雫波紋擊刺
    thrust: {
      clip: 'thrust', dur: 0.62, cancel: 0.45, turn: [0, 0.04, 20], motion: [[0.0, 0.1, 4.2, 'out3']], iframes: [0, 0.12],
      hits: [L({ t: 0.06, shape: 'line', range: 5.2, width: 0.8, offset: -3.8, dmg: 62, poise: 80, knock: 7, hitstop: 0.14, shake: 0.5, power: 1, stun: 'down', style: water, impact: 0.07, radial: 0.4, fov: 8 })],
      events: [
        trail(0, water),
        call(0.02, (p) => p.thrustFx()),
        call(0.0, (p) => p.callout('水之呼吸', '漆之型', '雫波紋擊刺', 'water')),
      ],
      sfx: [{ t: 0.0, name: 'swingWater', opts: { pitch: 1.2 } }],
    },
    parry: { clip: 'parry', dur: 0.42, cancel: 0.18 },
    // ------------------------------------------------------------- forms
    waterSurface: {
      clip: 'waterSurface', dur: 0.82, cancel: 0.66, turn: [0, 0.22, 10], motion: [[0.2, 0.32, 4.6, 'out3']], iframes: [0.18, 0.34], armor: [0, 0.4],
      hits: [L({ t: 0.27, range: 3.3, arc: 220, dmg: 48, poise: 50, knock: 5, hitstop: 0.12, shake: 0.5, power: 0.95, stun: 'heavy', style: water, radial: 0.3, fov: 6 })],
      events: [
        call(0, (p) => p.callout('水之呼吸', '壹之型', '水面斬擊', 'water')),
        trail(0.15, water),
        call(0.18, (p) => p.speedBurst(0.8)),
        arc(0.24, 88, -128, 112, { r: 2.3, width: 1.1, style: water, life: 0.5, wipe: 0.08 }),
        call(0.27, (p) => p.waveCurls(3)),
      ],
      sfx: [{ t: 0.02, name: 'waterWave', opts: { volume: 0.5 } }, { t: 0.22, name: 'swingWater' }],
      cost: 30,
    },
    waterWheel: {
      clip: 'waterWheel', dur: 0.9, cancel: 0.72, turn: [0, 0.12, 10], motion: [[0.08, 0.56, 3.6, 'inOut']], iframes: [0.1, 0.5], armor: [0, 0.6],
      hits: [
        L({ t: 0.3, range: 2.8, arc: 120, dmg: 30, poise: 30, knock: 2, hitstop: 0.08, shake: 0.3, power: 0.7, style: water, height: 3 }),
        L({ t: 0.56, range: 3.2, arc: 160, dmg: 44, poise: 55, knock: 5, hitstop: 0.12, shake: 0.5, power: 1, stun: 'down', style: water, radial: 0.3, fov: 6 }),
      ],
      events: [
        call(0, (p) => p.callout('水之呼吸', '貳之型', '水車', 'water')),
        trail(0.05, water),
        call(0.12, (p) => p.wheelFx()),
        call(0.56, (p) => p.splashGround(2.4, 1.6)),
      ],
      sfx: [{ t: 0.06, name: 'swingWater' }, { t: 0.3, name: 'swingWater', opts: { pitch: 0.9 } }, { t: 0.56, name: 'waterSplash' }],
      cost: 35,
    },
    enbu: {
      clip: 'enbu', dur: 0.95, cancel: 0.78, turn: [0, 0.36, 8], motion: [[0.34, 0.46, 1.8]], armor: [0, 0.6],
      hits: [L({ t: 0.42, range: 3.6, arc: 110, dmg: 78, poise: 80, knock: 6.5, hitstop: 0.16, shake: 0.65, power: 1, stun: 'down', style: 'fire', impact: 0.1, impactA: 0x120404, impactB: 0xffd9a0, radial: 0.5, fov: 9 })],
      events: [
        call(0, (p) => p.callout('火之神神樂', '', '圓舞', 'fire')),
        call(0.05, (p) => p.fireCharge()),
        trail(0.2, 'fire'),
        arc(0.33, 6, 222, -56, { r: 2.1, width: 1.2, style: 'fire', life: 0.55, wipe: 0.1 }),
        call(0.43, (p) => p.fireBurst()),
      ],
      sfx: [{ t: 0.05, name: 'fireWhoosh', opts: { volume: 0.6 } }, { t: 0.36, name: 'swingFire' }, { t: 0.43, name: 'fireBurst' }],
      cost: 50,
    },
    whirlpool: {
      clip: 'whirlpool', dur: 1.0, cancel: 0.86, armor: [0, 0.9], iframes: [0.14, 0.7],
      multi: [{ t0: 0.16, t1: 0.8, every: 0.1, shape: 'circle', range: 3.3, dmg: 9, poise: 7, knock: -1.6, hitstop: 0.03, shake: 0.08, power: 0.35, style: water, stun: 'light' }],
      hits: [L({ t: 0.84, shape: 'circle', range: 3.6, dmg: 26, poise: 40, knock: 5, hitstop: 0.1, shake: 0.4, power: 0.9, stun: 'heavy', style: water })],
      events: [
        call(0, (p) => p.callout('水之呼吸', '陸之型', '扭轉漩渦', 'water')),
        trail(0.1, water),
        call(0.14, (p) => p.whirlFx()),
      ],
      sfx: [{ t: 0.1, name: 'waterWave' }, { t: 0.4, name: 'swingWater' }, { t: 0.82, name: 'waterSplash' }],
      cost: 35,
    },
    constantFlux: {
      clip: 'constantFlux', dur: 1.9, cancel: 1.75, turn: [0, 1.6, 3], motion: [[0.1, 1.6, 6.4, 'inOut']], armor: [0, 1.8], iframes: [0.1, 1.6],
      multi: [{ t0: 0.2, t1: 1.55, every: 0.19, range: 3.1, arc: 240, dmg: 14, poise: 14, knock: 1.2, hitstop: 0.05, shake: 0.14, power: 0.6, style: water, stun: 'light', grow: true }],
      hits: [L({ t: 1.66, range: 3.4, arc: 200, dmg: 60, poise: 80, knock: 7, hitstop: 0.15, shake: 0.6, power: 1, stun: 'down', style: water, impact: 0.08, impactA: 0x04081a, impactB: 0xdff4ff, radial: 0.45, fov: 8 })],
      events: [
        call(0, (p) => p.callout('水之呼吸', '拾之型', '生生流轉', 'water')),
        trail(0.1, water),
        call(0.12, (p) => p.fluxDragon()),
      ],
      sfx: [{ t: 0.1, name: 'waterDragon' }, { t: 0.5, name: 'swingWater' }, { t: 1.0, name: 'swingWater' }, { t: 1.62, name: 'waterSplash' }],
      cost: 50,
    },
  };
  // dodges
  for (const d of ['F', 'B', 'L', 'R']) {
    const ang = { F: 0, B: Math.PI, L: Math.PI / 2, R: -Math.PI / 2 }[d];
    M['dodge' + d] = {
      clip: 'dodge' + d, dur: 0.38, cancel: 0.26, motion: [[0, 0.26, 4.0, 'out3', ang]], iframes: [0, 0.28],
      events: [call(0, (p) => p.dodgeFx(ang))],
      sfx: [{ t: 0, name: 'dodge' }],
    };
  }
  return M;
}

export const SKILLS = {
  tanjiro: [
    { key: '1', move: 'waterSurface', form: '壹之型', name: '水面斬擊', cost: 30, cd: 1.5 },
    { key: '2', move: 'waterWheel', form: '貳之型', name: '水車', cost: 35, cd: 2.0 },
    { key: '3', move: 'enbu', form: '圓舞', name: '火之神神樂', cost: 50, cd: 3.0 },
  ],
  giyu: [
    { key: '1', move: 'waterSurface', form: '壹之型', name: '水面斬擊', cost: 30, cd: 1.5 },
    { key: '2', move: 'whirlpool', form: '陸之型', name: '扭轉漩渦', cost: 35, cd: 2.5 },
    { key: '3', move: 'constantFlux', form: '拾之型', name: '生生流轉', cost: 50, cd: 3.5 },
  ],
};

export const ULTS = {
  tanjiro: { name: '日暈之龍・頭舞', school: '火之神神樂', form: '', style: 'fire' },
  giyu: { name: '凪', school: '水之呼吸', form: '拾壹之型', style: 'calm' },
};
