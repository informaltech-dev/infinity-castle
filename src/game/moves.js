// Player move definitions (timings in seconds of clip time at speed 1).
// Arc fx: { t, tilt, yaw, a0, a1, r, width, style, life } in body space (see Animator swing plane).

const arc = (t, tilt, a0, a1, o = {}) => ({ t, fn: (p) => p.spawnArc({ tilt, a0, a1, ...o }) });
const trail = (t, style, on = true) => ({ t, fn: (p) => p.setTrail(on ? style : null) });
const call = (t, fn) => ({ t, fn });

const L = (o) => ({ range: 2.7, arc: 150, dmg: 16, poise: 12, knock: 1.6, hitstop: 0.055, shake: 0.16, power: 0.4, stun: 'light', ...o });

// Per swordsman: the style of plain sword hits and of their crescent slashes, and the swing sound.
const LIGHT = {
  tanjiro: { hit: 'steel', arc: 'steel', heavy: 'steel', swing: 'swingLight' },
  giyu: { hit: 'water', arc: 'steel', heavy: 'steel', swing: 'swingLight' },
  rengoku: { hit: 'fire', arc: 'fire', heavy: 'fire', swing: 'swingLight' },
  obanai: { hit: 'serpent', arc: 'serpent', heavy: 'serpent', swing: 'swingSerpent' },
  sanemi: { hit: 'wind', arc: 'wind', heavy: 'wind', swing: 'swingWind' },
  gyomei: { hit: 'stone', arc: 'stone', heavy: 'stone', swing: 'swingHeavy' },
};

export function playerMoves(id) {
  const water = 'water';
  const fire = 'fire';
  const snake = 'serpent';
  const LS = LIGHT[id] || LIGHT.tanjiro;
  const lightStyle = LS.hit;
  const M = {
    light1: {
      clip: 'light1', dur: 0.46, cancel: 0.19, turn: [0, 0.1, 16], motion: [[0.04, 0.16, 0.8]],
      hits: [L({ t: 0.1, style: lightStyle })],
      events: [trail(0, 'steel'), arc(0.075, 40, 134, -38, { r: 1.45, width: 0.42, style: LS.arc, life: 0.22 })],
      sfx: [{ t: 0.06, name: LS.swing }],
    },
    light2: {
      clip: 'light2', dur: 0.44, cancel: 0.18, turn: [0, 0.09, 16], motion: [[0.03, 0.15, 0.7]],
      hits: [L({ t: 0.1, style: lightStyle })],
      events: [trail(0, 'steel'), arc(0.07, 45, -122, 88, { r: 1.45, width: 0.42, style: LS.arc, life: 0.22 })],
      sfx: [{ t: 0.06, name: LS.swing }],
    },
    light3: {
      clip: 'light3', dur: 0.5, cancel: 0.21, turn: [0, 0.1, 16], motion: [[0.05, 0.18, 1.0]],
      hits: [L({ t: 0.12, arc: 200, dmg: 19, poise: 14, knock: 2.2, style: lightStyle })],
      events: [trail(0, 'steel'), arc(0.08, 86, 112, -104, { r: 1.6, width: 0.5, style: LS.arc, life: 0.24 })],
      sfx: [{ t: 0.08, name: LS.swing, opts: { pitch: 0.92 } }],
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
      hits: [L({ t: 0.32, range: 3.0, arc: 170, dmg: 36, poise: 45, knock: 4.5, hitstop: 0.12, shake: 0.45, power: 0.85, stun: 'heavy', style: LS.heavy, fov: 5 })],
      events: [trail(0.2, 'steel'), arc(0.28, 48, 160, -76, { r: 1.75, width: 0.8, style: LS.heavy, life: 0.3 }), call(0.2, (p) => p.glint())],
      sfx: [{ t: 0.28, name: 'swingHeavy' }],
    },
    // 漆之型 雫波紋擊刺
    thrust: {
      clip: 'thrust', dur: 0.62, cancel: 0.45, turn: [0, 0.04, 20], motion: [[0.0, 0.1, 4.2, 'out3']], iframes: [0, 0.12],
      hits: [L({ t: 0.06, shape: 'line', range: 5.7, width: 0.8, offset: -3.8, dmg: 62, poise: 80, knock: 7, hitstop: 0.14, shake: 0.5, power: 1, stun: 'down', style: water, impact: 0.07, radial: 0.4, fov: 8 })],
      events: [
        trail(0, water),
        call(0.02, (p) => p.thrustFx()),
        call(0.0, (p) => p.callout('水之呼吸', '漆之型', '雫波紋擊刺', 'water')),
      ],
      sfx: [{ t: 0.0, name: 'swingWater', opts: { pitch: 1.2 } }],
    },
    parry: { clip: 'parry', dur: 0.42, cancel: 0.18 },
    // 真劍: the execution of a broken posture (its cut is dealt by the player: a share of his health)
    execute: {
      clip: 'heavy', dur: 0.8, cancel: 0.62, turn: [0, 0.3, 20], motion: [[0.04, 0.3, 1.6, 'out3']], armor: [0, 0.8], commit: true,
      events: [trail(0.2, 'steel'), call(0.2, (p) => p.glint()), arc(0.28, 48, 160, -76, { r: 2.0, width: 1.0, style: LS.heavy, life: 0.4 }), call(0.32, (p, r) => p._executeHit(r.target))],
      sfx: [{ t: 0.26, name: 'swingHeavy', opts: { pitch: 0.85 } }],
    },
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
  if (id === 'rengoku') Object.assign(M, flameMoves(L));
  else if (id === 'obanai') Object.assign(M, serpentMoves(L));
  else if (id === 'sanemi') Object.assign(M, windMoves(L));
  else if (id === 'gyomei') Object.assign(M, stoneMoves(L));
  return M;
}

// ---------------------------------------------------------------------------------------- 炎之呼吸 (Rengoku)
function flameMoves(L) {
  const fire = 'fire';
  const hot = { impactA: 0x140404, impactB: 0xffd9a0 };
  return {
    light4: {
      clip: 'light4', dur: 0.74, cancel: 0.5, turn: [0, 0.2, 12], motion: [[0.05, 0.26, 1.5]],
      hits: [L({ t: 0.23, range: 3.0, arc: 110, dmg: 34, poise: 36, knock: 5.5, hitstop: 0.11, shake: 0.42, power: 0.85, stun: 'heavy', style: fire, radial: 0.25, fov: 4 })],
      events: [trail(0, fire), arc(0.19, 0, 160, -48, { r: 1.7, width: 0.9, style: fire, life: 0.35 }), call(0.24, (p) => p.flameGround(1.3))],
      sfx: [{ t: 0.14, name: 'swingFire' }, { t: 0.24, name: 'fireBurst', opts: { volume: 0.65 } }],
    },
    // 壹之型・不知火: the charged heavy, a blazing dash that cuts through everything on the way
    thrust: {
      clip: 'shiranui', dur: 0.7, cancel: 0.5, turn: [0, 0.04, 20], motion: [[0.0, 0.12, 5.4, 'out3']], lunge: [0.75, 1.6], iframes: [0, 0.16],
      hits: [L({ t: 0.08, shape: 'line', range: 6.9, width: 0.95, offset: -5.0, dmg: 66, poise: 85, knock: 6.5, hitstop: 0.14, shake: 0.55, power: 1, stun: 'down', style: fire, impact: 0.08, ...hot, radial: 0.4, fov: 8 })],
      // (onStart runs before the first frame's root motion, so the streak starts where he stood)
      onStart: (p) => (p._dashFrom = p.pos.clone()),
      events: [
        trail(0, fire),
        call(0, (p) => p.callout('炎之呼吸', '壹之型', '不知火', 'fire')),
        call(0.02, (p) => {
          p.fireCharge(0.8);
          p.afterimage(0.45, 0.35);
        }),
        arc(0.07, 88, 104, -112, { r: 2.0, width: 0.95, style: fire, life: 0.42, wipe: 0.06 }),
        call(0.12, (p) => p.flameStreak(p._dashFrom)),
      ],
      sfx: [{ t: 0, name: 'fireWhoosh', opts: { pitch: 1.2 } }, { t: 0.07, name: 'swingFire' }],
    },
    // 貳之型・昇炎天: rising crescent that throws the enemy into the air
    risingSun: {
      clip: 'risingSun', dur: 0.82, cancel: 0.62, turn: [0, 0.14, 12], motion: [[0.06, 0.22, 1.5, 'out3']], armor: [0, 0.5],
      hits: [L({ t: 0.2, range: 3.1, arc: 130, dmg: 50, poise: 70, knock: 2.5, launch: 7.5, hitstop: 0.12, shake: 0.5, power: 0.95, stun: 'down', style: fire, radial: 0.3, fov: 6 })],
      events: [
        call(0, (p) => p.callout('炎之呼吸', '貳之型', '昇炎天', 'fire')),
        call(0.02, (p) => p.fireCharge(0.9)),
        trail(0.06, fire),
        arc(0.14, 4, -150, 102, { r: 2.2, width: 1.1, style: fire, life: 0.5, wipe: 0.09 }),
        call(0.2, (p) => p.risingFlameFx()),
      ],
      sfx: [{ t: 0.03, name: 'fireWhoosh', opts: { volume: 0.6 } }, { t: 0.15, name: 'swingFire', opts: { pitch: 0.95 } }, { t: 0.21, name: 'fireBurst', opts: { volume: 0.75 } }],
      cost: 30,
    },
    // 肆之型・盛炎漩渦: a spinning wall of fire in front that burns up whatever is thrown at him
    flameVortex: {
      clip: 'flameVortex', dur: 1.0, cancel: 0.82, turn: [0, 0.8, 6], armor: [0, 0.86], iframes: [0.08, 0.62],
      multi: [{ t0: 0.14, t1: 0.7, every: 0.11, range: 3.4, arc: 210, dmg: 11, poise: 10, knock: 1.6, hitstop: 0.035, shake: 0.1, power: 0.45, style: fire, stun: 'light' }],
      hits: [L({ t: 0.78, range: 3.8, arc: 220, dmg: 34, poise: 55, knock: 6, hitstop: 0.11, shake: 0.45, power: 0.9, stun: 'heavy', style: fire, radial: 0.25, fov: 5 })],
      events: [
        call(0, (p) => p.callout('炎之呼吸', '肆之型', '盛炎漩渦', 'fire')),
        call(0.02, (p) => p.fireCharge(1.1)),
        trail(0.08, fire),
        call(0.12, (p) => p.flameVortexFx()),
        arc(0.74, 86, 120, -120, { r: 2.4, width: 1.1, style: fire, life: 0.45, wipe: 0.08 }),
      ],
      onUpdate: (p, r) => {
        if (r.t > 0.08 && r.t < 0.82) p.burnProjectiles(4.6);
      },
      sfx: [{ t: 0.06, name: 'fireWhoosh' }, { t: 0.3, name: 'swingFire', opts: { pitch: 1.05 } }, { t: 0.52, name: 'swingFire', opts: { pitch: 0.95 } }, { t: 0.76, name: 'fireBurst' }],
      cost: 35,
    },
    // 伍之型・炎虎: a leaping overhead cut that looses a tiger of flame down the hall
    flameTiger: {
      clip: 'flameTiger', dur: 1.1, cancel: 0.9, turn: [0, 0.34, 8], motion: [[0.16, 0.44, 2.2, 'out']], armor: [0, 0.86],
      events: [
        call(0, (p) => p.callout('炎之呼吸', '伍之型', '炎虎', 'fire')),
        call(0.04, (p) => p.fireCharge(1.4)),
        trail(0.24, fire),
        arc(0.38, 4, 212, -58, { r: 2.3, width: 1.25, style: fire, life: 0.55, wipe: 0.1 }),
        call(0.44, (p) => p.flameTigerFx()),
      ],
      sfx: [{ t: 0.04, name: 'fireWhoosh', opts: { volume: 0.7, pitch: 0.9 } }, { t: 0.38, name: 'swingFire', opts: { pitch: 0.85 } }, { t: 0.44, name: 'tigerRoar' }, { t: 0.45, name: 'fireBurst' }],
      cost: 50,
    },
  };
}

// ---------------------------------------------------------------------------------------- 蛇之呼吸 (Obanai)
function serpentMoves(L) {
  const snake = 'serpent';
  const cold = { impactA: 0x0c0418, impactB: 0xf0e6ff };
  return {
    light4: {
      clip: 'light4', dur: 0.74, cancel: 0.5, turn: [0, 0.2, 12], motion: [[0.05, 0.26, 1.5]],
      hits: [L({ t: 0.23, range: 3.0, arc: 110, dmg: 32, poise: 34, knock: 5, hitstop: 0.1, shake: 0.4, power: 0.85, stun: 'heavy', style: snake, radial: 0.25, fov: 4 })],
      events: [trail(0, snake), arc(0.19, 0, 160, -48, { r: 1.7, width: 0.8, style: snake, life: 0.35 }), call(0.24, (p) => p.fangMark(1.3))],
      sfx: [{ t: 0.14, name: 'swingSerpent' }, { t: 0.22, name: 'serpentHiss', opts: { volume: 0.45 } }],
    },
    // 肆之型・頸蛇雙生: the charged heavy, a lunge whose blade splits into two striking heads
    thrust: {
      clip: 'twinFang', dur: 0.72, cancel: 0.52, turn: [0, 0.04, 20], motion: [[0.0, 0.1, 4.6, 'out3']], iframes: [0, 0.14],
      hits: [
        L({ t: 0.06, shape: 'line', range: 5.9, width: 0.8, offset: -3.9, dmg: 36, poise: 40, knock: 1.2, hitstop: 0.08, shake: 0.3, power: 0.8, stun: 'heavy', style: snake }),
        L({ t: 0.24, range: 2.9, arc: 150, dmg: 40, poise: 60, knock: 6, hitstop: 0.13, shake: 0.5, power: 1, stun: 'down', style: snake, impact: 0.07, ...cold, radial: 0.35, fov: 7 }),
      ],
      events: [
        trail(0, snake),
        call(0, (p) => p.callout('蛇之呼吸', '肆之型', '頸蛇雙生', 'serpent')),
        call(0.03, (p) => p.twinFangFx()),
        arc(0.21, 64, -96, 118, { r: 1.9, width: 0.8, style: snake, life: 0.38, wipe: 0.06 }),
      ],
      sfx: [{ t: 0, name: 'swingSerpent', opts: { pitch: 1.15 } }, { t: 0.03, name: 'serpentHiss', opts: { volume: 0.55 } }, { t: 0.2, name: 'swingSerpent', opts: { pitch: 0.95 } }],
    },
    // 壹之型・委蛇斬: a weaving dash that cuts on every turn of the curve
    windingSlash: {
      clip: 'windingSlash', dur: 0.84, cancel: 0.64, turn: [0, 0.08, 14], lunge: [0.8, 1.4],
      motion: [[0.08, 0.22, 2.1, 'inOut', 0.55], [0.22, 0.36, 2.3, 'inOut', -0.55], [0.36, 0.48, 1.5, 'inOut', 0.35]],
      iframes: [0.06, 0.44], armor: [0, 0.52],
      multi: [{ t0: 0.12, t1: 0.48, every: 0.09, shape: 'circle', range: 1.9, dmg: 14, poise: 14, knock: 1.2, hitstop: 0.045, shake: 0.14, power: 0.55, style: snake, stun: 'light' }],
      // the weave carries him past a close foe, so the closing lash sweeps all the way round
      hits: [L({ t: 0.54, shape: 'circle', range: 2.8, dmg: 30, poise: 45, knock: 4.5, hitstop: 0.1, shake: 0.4, power: 0.9, stun: 'heavy', style: snake, radial: 0.25, fov: 5 })],
      events: [
        call(0, (p) => p.callout('蛇之呼吸', '壹之型', '委蛇斬', 'serpent')),
        trail(0.06, snake),
        call(0.08, (p, r) => p.windingFx(r)),
        arc(0.12, 80, 110, -100, { r: 1.5, width: 0.5, style: snake, life: 0.26 }),
        arc(0.26, 80, -100, 104, { r: 1.5, width: 0.5, style: snake, life: 0.26 }),
        arc(0.4, 80, 104, -96, { r: 1.5, width: 0.5, style: snake, life: 0.26 }),
        arc(0.5, 84, 118, -112, { r: 2.1, width: 0.85, style: snake, life: 0.4, wipe: 0.07 }),
      ],
      sfx: [{ t: 0.05, name: 'serpentHiss', opts: { volume: 0.6 } }, { t: 0.14, name: 'swingSerpent' }, { t: 0.28, name: 'swingSerpent', opts: { pitch: 1.1 } }, { t: 0.5, name: 'swingSerpent', opts: { pitch: 0.9 } }],
      cost: 30,
    },
    // 貳之型・狹頭之毒牙: slips round behind the target and bites at the nape
    venomFang: {
      clip: 'venomFang', dur: 0.72, cancel: 0.52, turn: [0.06, 0.22, 14], iframes: [0, 0.3], duelIframes: [0.02, 0.18], armor: [0, 0.4],
      hits: [L({ t: 0.24, range: 2.6, arc: 110, dmg: 40, poise: 55, knock: 3, hitstop: 0.14, shake: 0.45, power: 0.95, stun: 'heavy', style: snake, impact: 0.06, ...cold, fov: 6 })],
      events: [
        call(0, (p) => p.callout('蛇之呼吸', '貳之型', '狹頭之毒牙', 'serpent')),
        call(0.04, (p) => p.venomBlink()),
        trail(0.14, snake),
        arc(0.2, 40, 150, -40, { r: 1.7, width: 0.7, style: snake, life: 0.34, wipe: 0.05 }),
        call(0.24, (p) => p.fangMark(1.1)),
      ],
      sfx: [{ t: 0.02, name: 'serpentHiss', opts: { volume: 0.7 } }, { t: 0.04, name: 'dodge', opts: { pitch: 1.2 } }, { t: 0.2, name: 'swingSerpent', opts: { pitch: 1.1 } }],
      cost: 35,
    },
    // 參之型・塒締: coils of blade that wind round him and draw everything inward
    coilChoke: {
      clip: 'coilChoke', dur: 1.05, cancel: 0.88, armor: [0, 0.9], iframes: [0.12, 0.72],
      multi: [{ t0: 0.14, t1: 0.78, every: 0.1, shape: 'circle', range: 3.6, dmg: 9, poise: 8, knock: -2.4, hitstop: 0.03, shake: 0.08, power: 0.35, style: snake, stun: 'light' }],
      hits: [L({ t: 0.86, shape: 'circle', range: 3.2, dmg: 40, poise: 60, knock: 4, hitstop: 0.12, shake: 0.5, power: 1, stun: 'down', style: snake, impact: 0.06, ...cold, radial: 0.3, fov: 6 })],
      events: [
        call(0, (p) => p.callout('蛇之呼吸', '參之型', '塒締', 'serpent')),
        trail(0.1, snake),
        call(0.12, (p) => p.coilFx()),
        call(0.86, (p) => p.coilBurst()),
      ],
      sfx: [{ t: 0.08, name: 'serpentHiss', opts: { volume: 0.7 } }, { t: 0.3, name: 'swingSerpent' }, { t: 0.55, name: 'swingSerpent', opts: { pitch: 1.1 } }, { t: 0.84, name: 'swingSerpent', opts: { pitch: 0.85 } }],
      cost: 50,
    },
  };
}

// ---------------------------------------------------------------------------------------- 風之呼吸 (Sanemi)
function windMoves(L) {
  const wind = 'wind';
  const gale = { impactA: 0x04140c, impactB: 0xe8fff0 };
  return {
    light4: {
      clip: 'light4', dur: 0.74, cancel: 0.5, turn: [0, 0.2, 12], motion: [[0.05, 0.26, 1.6]],
      hits: [L({ t: 0.23, range: 3.1, arc: 120, dmg: 34, poise: 36, knock: 5.5, hitstop: 0.1, shake: 0.42, power: 0.85, stun: 'heavy', style: wind, radial: 0.25, fov: 4 })],
      events: [trail(0, wind), arc(0.19, 0, 160, -48, { r: 1.75, width: 0.9, style: wind, life: 0.32 }), call(0.24, (p) => p.windGust(1.3))],
      sfx: [{ t: 0.14, name: 'swingWind' }, { t: 0.24, name: 'windGust', opts: { volume: 0.55 } }],
    },
    // 壹之型・塵旋風・削斬: the charged heavy, a whirlwind that drills straight through, scraping up the floor
    thrust: {
      clip: 'jinsenpu', dur: 0.78, cancel: 0.56, turn: [0, 0.04, 20], motion: [[0.02, 0.3, 6.2, 'out3']], lunge: [0.8, 1.5], iframes: [0, 0.18], pass: [0, 0.3],
      // (the whirl carries him through: it cuts whatever it passes, and bursts where it stops)
      multi: [{ t0: 0.06, t1: 0.3, every: 0.06, shape: 'circle', range: 2.0, dmg: 11, poise: 12, knock: 1.4, hitstop: 0.03, shake: 0.12, power: 0.5, style: wind, stun: 'light' }],
      hits: [L({ t: 0.34, shape: 'circle', range: 2.7, dmg: 42, poise: 70, knock: 6.5, hitstop: 0.13, shake: 0.5, power: 1, stun: 'down', style: wind, impact: 0.07, ...gale, radial: 0.4, fov: 8 })],
      events: [
        trail(0, wind),
        call(0, (p) => p.callout('風之呼吸', '壹之型', '塵旋風・削斬', 'wind')),
        call(0.02, (p, r) => p.dustWhirl(r)),
        call(0.33, (p) => p.windGust(1.7)),
      ],
      sfx: [{ t: 0, name: 'windGust', opts: { pitch: 1.2 } }, { t: 0.06, name: 'swingWind', opts: { pitch: 1.1 } }, { t: 0.18, name: 'swingWind', opts: { pitch: 0.95 } }, { t: 0.32, name: 'swingWind', opts: { pitch: 0.8 } }],
    },
    // 貳之型・爪爪・科戶風: the blade raised at his right shoulder, one cut down across, and four claws of wind fly off it
    shinato: {
      clip: 'shinato', dur: 0.8, cancel: 0.58, turn: [0, 0.18, 12], motion: [[0.14, 0.26, 1.1, 'out3']], armor: [0, 0.36],
      hits: [L({ t: 0.22, range: 3.0, arc: 130, dmg: 28, poise: 30, knock: 2.5, hitstop: 0.09, shake: 0.35, power: 0.8, stun: 'heavy', style: wind, fov: 5 })],
      events: [
        call(0, (p) => p.callout('風之呼吸', '貳之型', '爪爪・科戶風', 'wind')),
        trail(0.1, wind),
        arc(0.18, 40, 150, -46, { r: 2.1, width: 1.0, style: wind, life: 0.4, wipe: 0.07 }),
        call(0.22, (p) => p.windClaws()),
      ],
      sfx: [{ t: 0.04, name: 'windGust', opts: { volume: 0.45, pitch: 1.15 } }, { t: 0.18, name: 'swingWind' }, { t: 0.22, name: 'windClaw' }],
      cost: 30,
    },
    // 肆之型・昇上砂塵嵐: spinning cuts that climb, lifting everything round him up in a column of dust and wind
    risingStorm: {
      clip: 'risingStorm', dur: 0.95, cancel: 0.78, armor: [0, 0.8], iframes: [0.1, 0.5], duelIframes: [0.12, 0.22],
      multi: [{ t0: 0.14, t1: 0.52, every: 0.09, shape: 'circle', range: 3.1, dmg: 10, poise: 9, knock: -1.2, hitstop: 0.03, shake: 0.1, power: 0.4, style: wind, stun: 'light' }],
      hits: [L({ t: 0.56, shape: 'circle', range: 3.3, dmg: 36, poise: 60, knock: 2.5, launch: 8, hitstop: 0.12, shake: 0.5, power: 0.95, stun: 'down', style: wind, radial: 0.3, fov: 6 })],
      events: [
        call(0, (p) => p.callout('風之呼吸', '肆之型', '昇上砂塵嵐', 'wind')),
        trail(0.1, wind),
        call(0.12, (p) => p.risingStormFx()),
      ],
      // (the storm throws off whatever is flying at him)
      onUpdate: (p, r) => {
        if (r.t > 0.1 && r.t < 0.6) p.gustProjectiles(4.4);
      },
      sfx: [{ t: 0.06, name: 'windGust', opts: { volume: 0.6 } }, { t: 0.2, name: 'swingWind' }, { t: 0.36, name: 'swingWind', opts: { pitch: 1.1 } }, { t: 0.54, name: 'windHowl', opts: { volume: 0.7 } }],
      cost: 35,
    },
    // 伍之型・木枯颪: a leap, a spinning fall of cuts, and a gale bursting out where he lands
    kogarashi: {
      clip: 'kogarashi', dur: 1.05, cancel: 0.86, turn: [0, 0.3, 10], motion: [[0.12, 0.62, 3.2, 'inOut']], lunge: [0.3, 1.5], armor: [0, 0.9], iframes: [0.16, 0.5], duelIframes: [0.2, 0.3],
      multi: [{ t0: 0.4, t1: 0.66, every: 0.07, shape: 'circle', range: 2.4, dmg: 12, poise: 12, knock: 1, hitstop: 0.03, shake: 0.12, power: 0.5, style: wind, stun: 'light' }],
      hits: [L({ t: 0.7, shape: 'circle', range: 3.6, dmg: 62, poise: 90, knock: 7, hitstop: 0.15, shake: 0.65, power: 1, stun: 'down', style: wind, impact: 0.09, ...gale, radial: 0.45, fov: 8 })],
      events: [
        call(0, (p) => p.callout('風之呼吸', '伍之型', '木枯颪', 'wind')),
        trail(0.14, wind),
        call(0.36, (p) => p.kogarashiSpin()),
        call(0.7, (p) => p.kogarashiLand()),
      ],
      sfx: [{ t: 0.08, name: 'windGust', opts: { volume: 0.5 } }, { t: 0.38, name: 'swingWind', opts: { pitch: 1.1 } }, { t: 0.5, name: 'swingWind' }, { t: 0.62, name: 'swingWind', opts: { pitch: 0.9 } }, { t: 0.7, name: 'windHowl' }],
      cost: 50,
    },
  };
}

// ---------------------------------------------------------------------------------------- 岩之呼吸 (Gyomei)
/**
 * Keys for the ball (or the axe) wheeling round him: `turns` times from t0 to t1 at radius R and height y,
 * starting `phase` radians round from straight ahead (toward his right, the way his flail turns).
 */
function orbit(t0, t1, turns, R, y, phase = 0, n = 10) {
  const out = [];
  const steps = Math.round(turns * n);
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const a = phase - k * turns * Math.PI * 2;
    out.push([t0 + (t1 - t0) * k, Math.sin(a) * R, y, Math.cos(a) * R]);
  }
  return out;
}

function stoneMoves(L) {
  const stone = 'stone';
  // (the ball is a blunt blow: no clean cut, a crushing one; the axe cuts)
  const B = (o) => L({ style: stone, blunt: true, sfx: 'stoneHit', ...o });
  const quake = { impactA: 0x100c08, impactB: 0xf4ead4 };
  return {
    // the ball swung round flat, right to left, then back
    light1: {
      clip: 'light1', dur: 0.66, cancel: 0.4, turn: [0, 0.14, 12], motion: [[0.12, 0.28, 0.6]], armor: [0, 0.66],
      hits: [B({ t: 0.27, range: 3.9, arc: 170, dmg: 21, poise: 18, knock: 3, hitstop: 0.07, shake: 0.22, power: 0.55 })],
      flail: { ball: [[0.1, -1.4, 1.3, -0.5], [0.2, -2.8, 1.15, 1.4], [0.27, 0, 1.05, 3.4], [0.34, 2.7, 1.05, 1.5], [0.46, 1.6, 0.95, -0.2], [0.66, 'hang']] },
      events: [trail(0.14, stone), trail(0.44, stone, false)],
      sfx: [{ t: 0.1, name: 'flailWhirl', opts: { pitch: 1.1 } }, { t: 0.14, name: 'chainRattle', opts: { volume: 0.5 } }],
    },
    light2: {
      clip: 'light2', dur: 0.66, cancel: 0.4, turn: [0, 0.14, 12], motion: [[0.12, 0.28, 0.6]], armor: [0, 0.66],
      hits: [B({ t: 0.27, range: 3.9, arc: 170, dmg: 21, poise: 18, knock: 3, hitstop: 0.07, shake: 0.22, power: 0.55 })],
      flail: { ball: [[0.1, 1.4, 1.3, -0.5], [0.2, 2.8, 1.15, 1.4], [0.27, 0, 1.05, 3.4], [0.34, -2.7, 1.05, 1.5], [0.46, -1.6, 0.95, -0.2], [0.66, 'hang']] },
      events: [trail(0.14, stone), trail(0.44, stone, false)],
      sfx: [{ t: 0.1, name: 'flailWhirl', opts: { pitch: 1.05 } }, { t: 0.14, name: 'chainRattle', opts: { volume: 0.5 } }],
    },
    // a quick chop of the axe
    light3: {
      clip: 'light3', dur: 0.5, cancel: 0.24, turn: [0, 0.1, 16], motion: [[0.05, 0.16, 0.8]], armor: [0, 0.5],
      hits: [L({ t: 0.14, range: 2.7, arc: 130, dmg: 23, poise: 18, knock: 2.2, style: stone })],
      events: [trail(0, 'steel'), arc(0.1, 30, 140, -50, { r: 1.45, width: 0.5, style: stone, life: 0.24 })],
      sfx: [{ t: 0.07, name: 'swingHeavy', opts: { pitch: 1.2 } }],
    },
    // the ball over his head and down on the floor in front of him
    light4: {
      clip: 'light4', dur: 0.9, cancel: 0.62, turn: [0, 0.3, 10], motion: [[0.2, 0.4, 0.9]], armor: [0, 0.9],
      hits: [B({ t: 0.44, shape: 'circle', offset: 3.1, range: 2.0, dmg: 38, poise: 44, knock: 5, hitstop: 0.12, shake: 0.5, power: 0.9, stun: 'heavy', sfx: 'stoneSmash', radial: 0.25, fov: 5 })],
      flail: { ball: [[0.12, -0.9, 1.8, -0.8], [0.26, -0.3, 3.3, 0.3], [0.36, 0, 2.8, 2.3], [0.44, 0, 0.18, 3.1], [0.62, 0, 0.18, 3.0], [0.9, 'hang']] },
      events: [trail(0.2, stone), trail(0.46, stone, false), call(0.44, (p) => p.ballImpact(1.4))],
      sfx: [{ t: 0.12, name: 'flailWhirl', opts: { pitch: 0.9 } }, { t: 0.3, name: 'chainRattle', opts: { volume: 0.6 } }],
    },
    // a whole turn of the ball round him
    heavy: {
      clip: 'heavy', dur: 0.9, cancel: 0.62, turn: [0, 0.2, 10], armor: [0, 0.9],
      hits: [B({ t: 0.36, shape: 'circle', range: 3.9, dmg: 36, poise: 46, knock: 4.5, hitstop: 0.11, shake: 0.45, power: 0.85, stun: 'heavy', fov: 5 })],
      flail: { ball: [[0.1, -1.6, 1.3, -1.2], ...orbit(0.16, 0.6, 1, 3.3, 1.1, -2.2, 12), [0.74, -1.8, 1.0, 0.4], [0.9, 'hang']] },
      events: [trail(0.14, stone), trail(0.62, stone, false)],
      sfx: [{ t: 0.12, name: 'flailWhirl', opts: { pitch: 0.85 } }, { t: 0.34, name: 'flailWhirl', opts: { pitch: 0.95 } }],
    },
    // 貳之型・天面碎: the charged heavy -- the ball flung high, a stamp on the chain, and down it comes on the foe
    thrust: {
      clip: 'tenmen', dur: 1.0, cancel: 0.74, turn: [0, 0.34, 14], armor: [0, 1.0], lunge: [0, 0],
      hits: [B({ t: 0.56, shape: 'circle', offset: 4.2, range: 2.5, dmg: 74, poise: 95, knock: 6.5, hitstop: 0.15, shake: 0.7, power: 1, stun: 'down', sfx: 'stoneSmash', impact: 0.09, ...quake, radial: 0.5, fov: 9, unparryable: true })],
      flail: { ball: [[0.1, -0.5, 1.8, 0.6], [0.22, 0, 4.0, 2.4], [0.36, 0, 5.8, 3.6], [0.46, 0, 5.2, 4.0], [0.56, 0, 0.18, 4.2], [0.8, 0, 0.18, 4.1], [1.0, 'hang']] },
      events: [
        call(0, (p) => p.callout('岩之呼吸', '貳之型', '天面碎', 'stone')),
        trail(0.08, stone),
        call(0.46, (p) => p.stompFx()),
        call(0.56, (p) => p.ballImpact(2.8, true)),
        trail(0.6, stone, false),
      ],
      sfx: [{ t: 0.06, name: 'flailWhirl', opts: { pitch: 0.8 } }, { t: 0.1, name: 'chainRattle' }, { t: 0.46, name: 'groundSlam', opts: { volume: 0.5 } }],
    },
    // 真劍's execution: the ball brought down on the broken foe
    execute: {
      clip: 'light4', dur: 0.9, cancel: 0.7, turn: [0, 0.3, 20], motion: [[0.04, 0.3, 1.2, 'out3']], armor: [0, 0.9], commit: true,
      flail: { ball: [[0.12, -0.9, 1.8, -0.8], [0.26, -0.3, 3.3, 0.3], [0.36, 0, 2.8, 1.9], [0.42, 0, 0.3, 2.3], [0.62, 0, 0.18, 2.2], [0.9, 'hang']] },
      events: [trail(0.2, stone), call(0.42, (p, r) => p._executeHit(r.target)), call(0.42, (p) => p.ballImpact(1.8)), trail(0.46, stone, false)],
      sfx: [{ t: 0.12, name: 'flailWhirl', opts: { pitch: 0.8 } }],
    },
    // ------------------------------------------------------------- forms
    // 壹之型・蛇紋岩・雙極: the ball and the axe let fly together, out wide on either side, to meet on the foe
    dualPoles: {
      clip: 'dualPoles', dur: 0.9, cancel: 0.66, turn: [0, 0.22, 12], armor: [0, 0.9],
      hits: [
        B({ t: 0.22, range: 3.6, arc: 220, dmg: 14, poise: 12, knock: 1.5, hitstop: 0.05, shake: 0.15, power: 0.5 }),
        B({ t: 0.34, shape: 'circle', offset: 4.0, range: 2.0, dmg: 34, poise: 40, knock: 3, hitstop: 0.1, shake: 0.4, power: 0.85, stun: 'heavy' }),
        L({ t: 0.37, shape: 'circle', offset: 4.0, range: 2.0, dmg: 32, poise: 40, knock: 4.5, hitstop: 0.1, shake: 0.45, power: 0.9, stun: 'heavy', style: stone, radial: 0.3, fov: 6 }),
      ],
      flail: {
        ball: [[0.1, 1.2, 1.4, -0.4], [0.22, 3.1, 1.3, 2.0], [0.34, 0.5, 1.1, 4.0], [0.5, -1.0, 1.0, 3.0], [0.72, -0.6, 0.9, 1.2], [0.9, 'hang']],
        axe: [[0.1, -1.0, 1.7, -0.3], [0.22, -3.1, 1.3, 2.0], [0.37, -0.5, 1.2, 4.1], [0.52, 1.0, 1.1, 2.8], [0.72, 0.6, 1.2, 1.2], [0.86, 'hand']],
        spin: 18,
      },
      events: [
        call(0, (p) => p.callout('岩之呼吸', '壹之型', '蛇紋岩・雙極', 'stone')),
        trail(0.08, stone),
        call(0.35, (p) => p.pincerFx()),
        trail(0.6, stone, false),
      ],
      sfx: [{ t: 0.06, name: 'flailWhirl' }, { t: 0.1, name: 'chainRattle' }, { t: 0.34, name: 'stoneSmash', opts: { volume: 0.7 } }],
      cost: 30,
    },
    // 參之型・岩軀之膚: the ball and the axe wheeling round him, beating off blows and whatever is thrown at him
    stoneSkin: {
      clip: 'stoneSkin', dur: 1.2, cancel: 1.08, armor: [0, 1.2], duelIframes: [0.12, 0.2],
      multi: [{ t0: 0.16, t1: 1.0, every: 0.12, shape: 'circle', range: 3.4, dmg: 10, poise: 10, knock: 2.2, hitstop: 0.03, shake: 0.1, power: 0.45, style: stone, stun: 'light', blunt: true, sfx: 'stoneHit' }],
      hits: [B({ t: 1.04, shape: 'circle', range: 3.6, dmg: 30, poise: 50, knock: 5.5, hitstop: 0.11, shake: 0.45, power: 0.9, stun: 'heavy', radial: 0.25, fov: 5 })],
      flail: {
        ball: [...orbit(0.12, 1.0, 3, 2.8, 1.0, 0.6, 10), [1.2, 'hang']],
        axe: [...orbit(0.12, 1.0, 3, 2.1, 1.45, 0.6 + Math.PI, 10), [1.14, 'hand']],
        spin: 24,
      },
      events: [
        call(0, (p) => p.callout('岩之呼吸', '參之型', '岩軀之膚', 'stone')),
        trail(0.12, stone),
        call(0.14, (p) => p.stoneSkinFx()),
        trail(1.0, stone, false),
      ],
      onUpdate: (p, r) => {
        if (r.t > 0.12 && r.t < 1.02) p.shatterProjectiles(4.2);
      },
      sfx: [{ t: 0.1, name: 'flailWhirl', opts: { pitch: 0.9 } }, { t: 0.4, name: 'flailWhirl' }, { t: 0.7, name: 'flailWhirl', opts: { pitch: 1.1 } }, { t: 0.2, name: 'chainRattle' }, { t: 1.02, name: 'stoneSmash', opts: { volume: 0.6 } }],
      cost: 35,
    },
    // 肆之型・流紋岩・速征: striding in, the ball and the axe hurled out and hauled back by turns, then the ball comes down
    rhyolite: {
      clip: 'rhyolite', dur: 1.2, cancel: 1.04, turn: [0, 0.9, 6], motion: [[0.08, 0.9, 3.4, 'inOut']], lunge: [0.5, 1.2], armor: [0, 1.2],
      multi: [{ t0: 0.14, t1: 0.86, every: 0.12, range: 3.8, arc: 130, dmg: 14, poise: 14, knock: 1.6, hitstop: 0.04, shake: 0.14, power: 0.55, style: stone, stun: 'light', blunt: true, sfx: 'stoneHit' }],
      hits: [B({ t: 1.0, shape: 'circle', offset: 2.8, range: 2.4, dmg: 56, poise: 80, knock: 6, hitstop: 0.14, shake: 0.6, power: 1, stun: 'down', sfx: 'stoneSmash', impact: 0.08, ...quake, radial: 0.4, fov: 7 })],
      flail: {
        ball: [[0.14, -0.4, 1.2, 3.2], [0.26, -0.6, 1.0, 0.9], [0.38, 0.3, 1.3, 3.4], [0.5, 0.5, 1.0, 0.9], [0.62, -0.3, 1.2, 3.4], [0.74, -0.5, 1.0, 0.9], [0.88, 0, 3.2, 1.2], [1.0, 0, 0.18, 2.8], [1.2, 'hang']],
        axe: [[0.2, 0.4, 1.4, 3.0], [0.32, 0.5, 1.2, 0.8], [0.44, -0.4, 1.4, 3.2], [0.56, -0.5, 1.2, 0.8], [0.68, 0.4, 1.4, 3.2], [0.8, 0.3, 1.2, 0.8], [0.9, 'hand']],
        spin: 20,
      },
      events: [
        call(0, (p) => p.callout('岩之呼吸', '肆之型', '流紋岩・速征', 'stone')),
        trail(0.1, stone),
        call(1.0, (p) => p.ballImpact(2.4, true)),
        trail(1.04, stone, false),
      ],
      sfx: [{ t: 0.12, name: 'chainRattle' }, { t: 0.14, name: 'flailWhirl', opts: { pitch: 1.2 } }, { t: 0.38, name: 'flailWhirl', opts: { pitch: 1.1 } }, { t: 0.62, name: 'flailWhirl', opts: { pitch: 1.2 } }, { t: 0.86, name: 'flailWhirl', opts: { pitch: 0.85 } }],
      cost: 50,
    },
  };
}

export const SKILLS = {
  rengoku: [
    { key: '1', move: 'risingSun', form: '貳之型', name: '昇炎天', cost: 30, cd: 1.6 },
    { key: '2', move: 'flameVortex', form: '肆之型', name: '盛炎漩渦', cost: 35, cd: 2.5 },
    { key: '3', move: 'flameTiger', form: '伍之型', name: '炎虎', cost: 50, cd: 3.5 },
  ],
  gyomei: [
    { key: '1', move: 'dualPoles', form: '壹之型', name: '蛇紋岩・雙極', cost: 30, cd: 1.8 },
    { key: '2', move: 'stoneSkin', form: '參之型', name: '岩軀之膚', cost: 35, cd: 2.8 },
    { key: '3', move: 'rhyolite', form: '肆之型', name: '流紋岩・速征', cost: 50, cd: 3.6 },
  ],
  sanemi: [
    { key: '1', move: 'shinato', form: '貳之型', name: '爪爪・科戶風', cost: 30, cd: 1.6 },
    { key: '2', move: 'risingStorm', form: '肆之型', name: '昇上砂塵嵐', cost: 35, cd: 2.4 },
    { key: '3', move: 'kogarashi', form: '伍之型', name: '木枯颪', cost: 50, cd: 3.4 },
  ],
  obanai: [
    { key: '1', move: 'windingSlash', form: '壹之型', name: '委蛇斬', cost: 30, cd: 1.5 },
    { key: '2', move: 'venomFang', form: '貳之型', name: '狹頭之毒牙', cost: 35, cd: 2.2 },
    { key: '3', move: 'coilChoke', form: '參之型', name: '塒締', cost: 50, cd: 3.2 },
  ],
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
  rengoku: { name: '煉獄', school: '炎之呼吸', form: '玖之型', style: 'fire' },
  obanai: { name: '蜿蜒長蛇', school: '蛇之呼吸', form: '伍之型', style: 'serpent', glyph: '蛇' },
  sanemi: { name: '韋馱天颱風', school: '風之呼吸', form: '玖之型', style: 'wind', glyph: '風' },
  gyomei: { name: '瓦輪刑部', school: '岩之呼吸', form: '伍之型', style: 'stone', glyph: '岩' },
};

/**
 * How each swordsman looks in motion: `style` colours their finishing blows and afterimages,
 * `after`/`dodge` are afterimage tints, `flash` the screen flash of their ultimate, `glow` the resting blade glow.
 */
export const CHAR_FX = {
  tanjiro: { style: 'fire', after: 0xff8a2a, dodge: 0x7fd4a8, flash: 0xffd0a0, charge: 'water' },
  giyu: { style: 'water', after: 0x4fb3e8, dodge: 0x4fb3e8, flash: 0xdff4ff, charge: 'water' },
  rengoku: { style: 'fire', after: 0xff7a1a, dodge: 0xffa040, flash: 0xffd0a0, charge: 'fire' },
  obanai: { style: 'serpent', after: 0xb48cff, dodge: 0xc6b0ff, flash: 0xefe6ff, charge: 'serpent' },
  sanemi: { style: 'wind', after: 0x5fd89c, dodge: 0xa8f0cc, flash: 0xe0fff0, charge: 'wind' },
  gyomei: { style: 'stone', after: 0xc4a46a, dodge: 0xd8c49a, flash: 0xf4ead4, charge: 'stone' },
};
