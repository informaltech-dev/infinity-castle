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
      clip: 'venomFang', dur: 0.72, cancel: 0.52, turn: [0.06, 0.22, 14], iframes: [0, 0.3], armor: [0, 0.4],
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

export const SKILLS = {
  rengoku: [
    { key: '1', move: 'risingSun', form: '貳之型', name: '昇炎天', cost: 30, cd: 1.6 },
    { key: '2', move: 'flameVortex', form: '肆之型', name: '盛炎漩渦', cost: 35, cd: 2.5 },
    { key: '3', move: 'flameTiger', form: '伍之型', name: '炎虎', cost: 50, cd: 3.5 },
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
};
