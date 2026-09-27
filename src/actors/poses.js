// Pose & clip library. Angles in degrees. Character faces +Z, its left is +X.
// Sword poses use the swing-plane model (see Animator._swordIK):
//   sw: { tilt, yaw, a, r, off, roll } — tilt 0 = vertical (sagittal) plane, 90 = horizontal plane;
//   a = hand angle in that plane (0 forward, +90 up / to the right), r = grip distance from the chest pivot,
//   off = blade angle relative to the hand direction, roll = blade roll.

// ---------------------------------------------------------------------------
// Swordsman (Tanjiro / Giyu / Rengoku / Obanai)
// ---------------------------------------------------------------------------
export const SWORD_STANCE = {
  hp: [0, -0.06, 0],
  hips: [0, 12, 0],
  spine: [6, -4, 0],
  chest: [4, -6, 0],
  neck: [0, 0, 0],
  head: [-6, 0, 0],
  thighL: [14, -8, 6],
  shinL: [22, 0, 0],
  footL: [-8, 10, 0],
  thighR: [-24, -10, -6],
  shinR: [26, 0, 0],
  footR: [0, 0, 0],
  upperArmL: [-40, 0, 20],
  foreArmL: [-60, 0, 0],
  handL: [0, 0, 0],
  lh: 1,
  sw: { w: 1, tilt: 0, yaw: -4, a: -52, r: 0.34, off: 86, roll: 0 },
  pole: [-0.4, -1, -0.1],
};

export const SWORD_RUN = {
  hp: [0, -0.04, 0],
  hips: [0, 0, 0],
  spine: [18, 0, 0],
  chest: [8, 0, 0],
  head: [-16, 0, 0],
  upperArmL: [-10, 0, 12],
  foreArmL: [-70, 0, 0],
  thighL: [0, 0, 3],
  shinL: [10, 0, 0],
  thighR: [0, 0, -3],
  shinR: [10, 0, 0],
  lh: 0,
  sw: { w: 1, tilt: 8, yaw: -18, a: -105, r: 0.5, off: -55, roll: 0 },
  pole: [-0.6, -1, -0.2],
};

export const SWORD_SPRINT = {
  ...SWORD_RUN,
  spine: [30, 0, 0],
  chest: [12, 0, 0],
  head: [-28, 0, 0],
  upperArmL: [30, 0, 15],
  foreArmL: [-40, 0, 0],
  sw: { w: 1, tilt: 10, yaw: -22, a: -125, r: 0.5, off: -40, roll: 0 },
};

export const SWORD_GUARD = {
  hp: [0, -0.12, -0.02],
  spine: [8, 10, 0],
  chest: [2, 12, 0],
  head: [-8, -12, 0],
  thighL: [18, -8, 12],
  shinL: [30, 0, 0],
  thighR: [-18, -8, -12],
  shinR: [32, 0, 0],
  lh: 1,
  sw: { w: 1, tilt: 82, yaw: 0, a: -8, r: 0.36, off: -80, roll: 90 },
  pole: [-0.9, -0.4, 0.2],
};

// Legs helpers
const LUNGE = {
  thighL: [30, -6, 8], shinL: [40, 0, 0], footL: [-10, 0, 0],
  thighR: [-52, -8, -4], shinR: [58, 0, 0], footR: [-8, 0, 0],
};
const WIDE = {
  thighL: [10, -10, 14], shinL: [28, 0, 0],
  thighR: [-14, -10, -14], shinR: [30, 0, 0],
};

export const SWORD_CLIPS = {
  // ----------------------------------------------------------- light combo
  light1: {
    dur: 0.52,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.08, 0], chest: [-6, -34, 0], spine: [0, -12, 0], head: [-6, 26, 0], lh: 1, sw: { tilt: 40, yaw: 0, a: 122, r: 0.42, off: -6, roll: 0 }, pole: [-0.8, -0.3, 0.1] } },
      { t: 0.07, e: 'snap', p: { chest: [-8, -40, 0], sw: { a: 134, off: -12 } } },
      { t: 0.15, e: 'out', p: { hp: [0, -0.16, 0.1], chest: [16, 30, 0], spine: [10, 12, 0], head: [-12, -24, 0], ...LUNGE, lh: 1, sw: { a: -38, r: 0.6, off: 10 }, pole: [-0.5, -1, -0.2] } },
      { t: 0.32, e: 'inOut', p: { sw: { a: -46, off: 6 }, chest: [18, 34, 0] } },
      { t: 0.52, e: 'inOut', p: { sw: { a: -40, off: 30 } } },
    ],
  },
  light2: {
    dur: 0.5,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.14, 0.05], chest: [12, 30, 0], spine: [8, 12, 0], head: [-8, -26, 0], ...LUNGE, lh: 0, upperArmL: [20, 0, 30], foreArmL: [-40, 0, 0], sw: { tilt: 45, yaw: 0, a: -112, r: 0.46, off: -16, roll: 180 }, pole: [-0.5, -1, 0.2] } },
      { t: 0.06, e: 'snap', p: { sw: { a: -122, off: -22 } } },
      { t: 0.15, e: 'out', p: { hp: [0, -0.06, 0.12], chest: [-10, -30, 0], spine: [-4, -12, 0], head: [-2, 24, 0], upperArmL: [30, 0, 50], foreArmL: [-20, 0, 0], sw: { a: 88, r: 0.56, off: 14 }, pole: [-0.8, -0.2, -0.3] } },
      { t: 0.3, e: 'inOut', p: { sw: { a: 96, off: 18 } } },
      { t: 0.5, e: 'inOut', p: { sw: { a: 80, off: 30 } } },
    ],
  },
  light3: {
    dur: 0.55,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.1, 0], hips: [0, -20, 0], chest: [0, -42, 0], spine: [4, -16, 0], head: [-6, 40, 0], ...WIDE, lh: 0, upperArmL: [-60, 0, 60], foreArmL: [-50, 0, 0], sw: { tilt: 86, yaw: 0, a: 100, r: 0.44, off: 26, roll: 0 }, pole: [-0.9, 0.1, -0.2] } },
      { t: 0.07, e: 'snap', p: { chest: [0, -48, 0], sw: { a: 112, off: 30 } } },
      { t: 0.17, e: 'out', p: { hp: [0, -0.14, 0.14], hips: [0, 24, 0], chest: [6, 44, 0], spine: [6, 18, 0], head: [-8, -40, 0], ...LUNGE, upperArmL: [20, 0, 70], foreArmL: [-10, 0, 0], sw: { a: -104, r: 0.6, off: 6 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 0.34, e: 'inOut', p: { sw: { a: -112 } } },
      { t: 0.55, e: 'inOut', p: { sw: { a: -96, off: 20 } } },
    ],
  },
  light4: {
    dur: 0.78,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.1, 0], chest: [-16, 0, 0], spine: [-6, 0, 0], head: [8, 0, 0], lh: 1, sw: { tilt: 0, yaw: 0, a: 140, r: 0.42, off: 22, roll: 0 }, pole: [-0.7, 0.2, -0.3] } },
      { t: 0.12, e: 'out', p: { hp: [0, 0.35, 0.25], bp: -8, chest: [-22, 0, 0], thighL: [-40, 0, 10], shinL: [80, 0, 0], thighR: [-60, 0, -10], shinR: [90, 0, 0], sw: { a: 160, off: 26 } } },
      { t: 0.24, e: 'snap', p: { hp: [0, -0.3, 0.55], bp: 8, chest: [30, 0, 0], spine: [16, 0, 0], head: [-26, 0, 0], ...LUNGE, sw: { a: -48, r: 0.6, off: 4 }, pole: [-0.5, -1, 0] } },
      { t: 0.52, e: 'inOut', p: { sw: { a: -52 } } },
      { t: 0.78, e: 'inOut', p: { hp: [0, -0.16, 0.3], bp: 0, sw: { a: -50, off: 24 } } },
    ],
  },
  // ----------------------------------------------------------- heavy
  heavy: {
    dur: 0.8,
    keys: [
      { t: 0, e: 'inOut', p: { hp: [0, -0.1, -0.05], hips: [0, -30, 0], chest: [-10, -40, 0], spine: [-4, -14, 0], head: [-6, 44, 0], ...WIDE, lh: 1, sw: { tilt: 48, yaw: 0, a: 150, r: 0.38, off: 34, roll: 0 }, pole: [-0.9, 0.2, -0.3] } },
      { t: 0.24, e: 'snap', p: { chest: [-14, -50, 0], sw: { a: 160, off: 40 } } },
      { t: 0.34, e: 'out', p: { hp: [0, -0.22, 0.3], hips: [0, 24, 0], chest: [26, 40, 0], spine: [14, 16, 0], head: [-18, -36, 0], ...LUNGE, sw: { a: -76, r: 0.62, off: 4 }, pole: [-0.4, -1, 0.1] } },
      { t: 0.6, e: 'inOut', p: { sw: { a: -84 } } },
      { t: 0.8, e: 'inOut', p: { sw: { a: -70, off: 22 } } },
    ],
  },
  // 漆之型 雫波紋擊刺 — charged thrust
  thrustCharge: {
    dur: 0.6,
    loop: false,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.2, -0.12], hips: [0, -40, 0], chest: [4, -40, 0], spine: [6, -14, 0], head: [-4, 50, 0], thighL: [-30, -30, 12], shinL: [50, 0, 0], thighR: [30, -10, -14], shinR: [40, 0, 0], lh: 1, sw: { tilt: 90, yaw: 0, a: 14, r: 0.12, off: -14, roll: 90 }, pole: [-0.9, -0.2, -0.3] } },
      { t: 0.6, e: 'inOut', p: { hp: [0, -0.24, -0.16], chest: [6, -46, 0], sw: { r: 0.08 } } },
    ],
  },
  thrust: {
    dur: 0.62,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.24, -0.16], hips: [0, -40, 0], chest: [6, -46, 0], spine: [6, -14, 0], head: [-4, 50, 0], lh: 1, sw: { tilt: 90, yaw: 0, a: 14, r: 0.08, off: -14, roll: 90 } } },
      { t: 0.08, e: 'out', p: { hp: [0, -0.3, 0.45], hips: [0, 10, 0], chest: [14, 8, 0], spine: [16, 4, 0], head: [-26, -6, 0], ...LUNGE, thighR: [-70, -6, -4], shinR: [70, 0, 0], sw: { a: 2, r: 0.7, off: -2 }, pole: [-0.6, -0.8, -0.1] } },
      { t: 0.4, e: 'inOut', p: { sw: { a: 0 } } },
      { t: 0.62, e: 'inOut', p: { hp: [0, -0.14, 0.2], sw: { r: 0.5, off: 30 } } },
    ],
  },
  // ----------------------------------------------------------- movement
  dodgeF: {
    dur: 0.42,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.34, 0.1], spine: [36, 0, 0], chest: [16, 0, 0], head: [-34, 0, 0], ...LUNGE, lh: 0, upperArmL: [50, 0, 20], foreArmL: [-20, 0, 0], sw: { tilt: 10, yaw: -20, a: -140, r: 0.5, off: -30 } } },
      { t: 0.3, e: 'inOut', p: { hp: [0, -0.3, 0.1] } },
      { t: 0.42, e: 'inOut', p: { hp: [0, -0.1, 0] } },
    ],
  },
  dodgeB: {
    dur: 0.42,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.3, -0.1], spine: [-6, 0, 0], chest: [-8, 0, 0], head: [6, 0, 0], thighL: [-40, 0, 8], shinL: [70, 0, 0], thighR: [-10, 0, -8], shinR: [60, 0, 0], lh: 1, sw: { tilt: 0, a: -30, r: 0.34, off: 70 } } },
      { t: 0.42, e: 'inOut', p: { hp: [0, -0.1, 0] } },
    ],
  },
  dodgeL: {
    dur: 0.42,
    keys: [
      { t: 0, e: 'out', p: { hp: [0.05, -0.32, 0], br: 16, spine: [12, 0, 10], chest: [6, 0, 8], head: [-10, 0, -14], thighL: [-30, 0, 34], shinL: [60, 0, 0], thighR: [0, 0, -4], shinR: [20, 0, 0], lh: 0, upperArmL: [0, 0, 60], sw: { tilt: 20, yaw: -30, a: -120, r: 0.5, off: -30 } } },
      { t: 0.42, e: 'inOut', p: { br: 0, hp: [0, -0.1, 0] } },
    ],
  },
  dodgeR: {
    dur: 0.42,
    keys: [
      { t: 0, e: 'out', p: { hp: [-0.05, -0.32, 0], br: -16, spine: [12, 0, -10], chest: [6, 0, -8], head: [-10, 0, 14], thighR: [-30, 0, -34], shinR: [60, 0, 0], thighL: [0, 0, 4], shinL: [20, 0, 0], lh: 0, upperArmL: [20, 0, 20], sw: { tilt: 60, yaw: -10, a: -80, r: 0.55, off: -20 } } },
      { t: 0.42, e: 'inOut', p: { br: 0, hp: [0, -0.1, 0] } },
    ],
  },
  parry: {
    dur: 0.45,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.1, -0.06], chest: [-6, 16, 0], spine: [0, 8, 0], lh: 1, sw: { tilt: 40, yaw: 0, a: 40, r: 0.42, off: 60, roll: 0 }, pole: [-0.9, -0.2, 0] } },
      { t: 0.06, e: 'out', p: { chest: [-10, -20, 0], sw: { a: 70, off: 70 } } },
      { t: 0.45, e: 'inOut', p: { chest: [0, 0, 0], sw: { a: 20, off: 70 } } },
    ],
  },
  blockHit: {
    dur: 0.3,
    keys: [
      { t: 0, e: 'snap', p: { ...SWORD_GUARD, hp: [0, -0.16, -0.08], chest: [-14, 12, 0] } },
      { t: 0.3, e: 'inOut', p: { ...SWORD_GUARD } },
    ],
  },
  // ----------------------------------------------------------- reactions
  hitLight: {
    dur: 0.36,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.08, -0.06], spine: [-14, 0, 6], chest: [-12, 10, 0], head: [-16, 0, 10], lh: 0, upperArmL: [30, 0, 40], foreArmL: [-30, 0, 0], sw: { tilt: 20, a: -100, r: 0.5, off: -20 } } },
      { t: 0.36, e: 'inOut', p: { spine: [4, 0, 0], chest: [0, 0, 0], head: [0, 0, 0] } },
    ],
  },
  knockdown: {
    dur: 1.25,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, 0.1, -0.1], bp: -30, spine: [-20, 0, 0], chest: [-20, 0, 0], head: [-10, 0, 0], thighL: [-40, 0, 10], shinL: [40, 0, 0], thighR: [-20, 0, -10], shinR: [30, 0, 0], lh: 0, upperArmL: [60, 0, 60], sw: { tilt: 30, a: -80, r: 0.55, off: -30 } } },
      { t: 0.35, e: 'in', p: { hp: [0, -0.75, -0.2], bp: -82, spine: [-6, 0, 0], chest: [-4, 0, 0], head: [20, 0, 0], thighL: [-20, 0, 12], shinL: [20, 0, 0], thighR: [-10, 0, -12], shinR: [10, 0, 0] } },
      { t: 0.45, e: 'out', p: { hp: [0, -0.7, -0.2], bp: -76 } },
      { t: 1.25, e: 'inOut', p: { hp: [0, -0.72, -0.2], bp: -80 } },
    ],
  },
  getup: {
    dur: 0.55,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.72, -0.2], bp: -80, lh: 0, sw: { tilt: 30, a: -80, r: 0.55, off: -30 } } },
      { t: 0.25, e: 'inOut', p: { hp: [0, -0.5, 0], bp: 10, spine: [40, 0, 0], chest: [10, 0, 0], thighL: [-90, 0, 10], shinL: [120, 0, 0], thighR: [-30, 0, -20], shinR: [110, 0, 0] } },
      { t: 0.55, e: 'inOut', p: { ...SWORD_STANCE, bp: 0 } },
    ],
  },
  death: {
    dur: 1.6,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.1, 0], spine: [-10, 0, 0], chest: [-16, 0, 0], head: [-20, 0, 0], lh: 0, sw: { tilt: 20, a: -100, r: 0.5, off: -40 } } },
      { t: 0.5, e: 'in', p: { hp: [0, -0.55, 0.1], bp: 12, spine: [30, 0, 0], chest: [20, 0, 0], head: [20, 0, 0], thighL: [-90, 0, 10], shinL: [110, 0, 0], thighR: [-80, 0, -10], shinR: [120, 0, 0], upperArmL: [-20, 0, 10] } },
      { t: 1.0, e: 'in', p: { hp: [0, -0.8, 0.3], bp: 70, head: [10, 0, 20] } },
      { t: 1.6, e: 'inOut', p: { hp: [0, -0.84, 0.35], bp: 84 } },
    ],
  },
  // ----------------------------------------------------------- forms
  // 壹之型・水面斬擊: crossed-arms windup, dash, wide horizontal cut left -> right
  waterSurface: {
    dur: 0.85,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.18, -0.05], hips: [0, 30, 0], chest: [8, 48, 0], spine: [8, 16, 0], head: [-10, -44, 0], ...WIDE, lh: 1, sw: { tilt: 88, yaw: 0, a: -118, r: 0.34, off: -24, roll: 180 }, pole: [0.2, -0.4, 0.9] } },
      { t: 0.18, e: 'snap', p: { chest: [10, 56, 0], sw: { a: -128, off: -30 } } },
      { t: 0.3, e: 'out', p: { hp: [0, -0.26, 0.2], hips: [0, -20, 0], chest: [14, -46, 0], spine: [10, -16, 0], head: [-16, 40, 0], ...LUNGE, sw: { a: 104, r: 0.62, off: 6 }, pole: [-0.9, -0.3, -0.2] } },
      { t: 0.6, e: 'inOut', p: { sw: { a: 112 } } },
      { t: 0.85, e: 'inOut', p: { hp: [0, -0.12, 0.1], sw: { a: 96, off: 24 } } },
    ],
  },
  // 貳之型・水車: forward flip, sword extended as a wheel
  waterWheel: {
    dur: 0.9,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.3, 0], chest: [20, 0, 0], spine: [20, 0, 0], head: [-20, 0, 0], thighL: [-50, 0, 8], shinL: [90, 0, 0], thighR: [-50, 0, -8], shinR: [90, 0, 0], lh: 1, sw: { tilt: 0, yaw: 0, a: 150, r: 0.5, off: 10, roll: 0 }, pole: [-0.8, 0.4, 0] } },
      { t: 0.12, e: 'linear', p: { hp: [0, 0.5, 0.3], bp: 30, thighL: [-80, 0, 8], shinL: [120, 0, 0], thighR: [-80, 0, -8], shinR: [120, 0, 0], sw: { a: 110 } } },
      { t: 0.3, e: 'linear', p: { hp: [0, 0.9, 0.6], bp: 180, sw: { a: 90, r: 0.6, off: 0 } } },
      { t: 0.48, e: 'out', p: { hp: [0, 0.4, 0.9], bp: 330, sw: { a: 70 } } },
      { t: 0.56, e: 'out', p: { hp: [0, -0.28, 1.0], bp: 360, chest: [34, 0, 0], spine: [18, 0, 0], head: [-26, 0, 0], ...LUNGE, sw: { a: -50, r: 0.6, off: 4 } } },
      { t: 0.9, e: 'inOut', p: { hp: [0, -0.16, 0.6], bp: 360, sw: { a: -48, off: 26 } } },
    ],
  },
  // 火之神神樂・圓舞: one full vertical circle of fire, ending in a crushing downward cut
  enbu: {
    dur: 0.95,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.2, -0.05], chest: [10, -20, 0], spine: [10, -6, 0], head: [-10, 20, 0], ...WIDE, lh: 1, sw: { tilt: 6, yaw: -6, a: 214, r: 0.46, off: 24, roll: 0 }, pole: [-0.8, -0.2, -0.3] } },
      { t: 0.2, e: 'in', p: { chest: [4, -24, 0], sw: { a: 222 } } },
      { t: 0.34, e: 'linear', p: { hp: [0, 0.05, 0.1], chest: [-24, 0, 0], spine: [-8, 0, 0], head: [10, 0, 0], sw: { a: 100, r: 0.55, off: 14 } } },
      { t: 0.44, e: 'out', p: { hp: [0, -0.3, 0.45], chest: [34, 10, 0], spine: [18, 4, 0], head: [-28, 0, 0], ...LUNGE, sw: { a: -56, r: 0.62, off: 2 } } },
      { t: 0.7, e: 'inOut', p: { sw: { a: -60 } } },
      { t: 0.95, e: 'inOut', p: { hp: [0, -0.16, 0.25], sw: { a: -50, off: 24 } } },
    ],
  },
  // 陸之型・扭轉漩渦: twisting double spin
  whirlpool: {
    dur: 1.0,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.26, 0], by: 0, hips: [0, 30, 0], chest: [10, 40, 0], spine: [10, 14, 0], head: [-12, -30, 0], ...WIDE, lh: 0, upperArmL: [0, 0, 80], foreArmL: [-10, 0, 0], sw: { tilt: 80, yaw: 0, a: -120, r: 0.46, off: -20, roll: 180 }, pole: [0, -0.3, 1] } },
      { t: 0.14, e: 'in', p: { chest: [12, 52, 0], sw: { a: -130 } } },
      { t: 0.8, e: 'linear', p: { by: -720, hips: [0, -10, 0], chest: [4, -10, 0], head: [-10, 0, 0], sw: { a: -80, r: 0.62, off: 0 } } },
      { t: 1.0, e: 'out', p: { by: -720, hp: [0, -0.18, 0.05], sw: { a: -90, off: 20 } } },
    ],
  },
  // 拾之型・生生流轉: repeated advancing spins with a growing dragon
  constantFlux: {
    dur: 1.9,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.2, 0], by: 0, chest: [10, 30, 0], spine: [8, 10, 0], head: [-10, -20, 0], ...LUNGE, lh: 0, upperArmL: [10, 0, 70], foreArmL: [-10, 0, 0], sw: { tilt: 60, yaw: 0, a: -120, r: 0.5, off: -10, roll: 180 }, pole: [0, -0.5, 1] } },
      { t: 0.12, e: 'in', p: { sw: { a: -128 } } },
      { t: 1.6, e: 'linear', p: { by: -1440, hp: [0, -0.24, 0.1], sw: { a: -70, r: 0.62, off: 0 } } },
      { t: 1.9, e: 'out', p: { by: -1440, chest: [20, -30, 0], sw: { a: -60, off: 20 } } },
    ],
  },
  // 拾壹之型・凪: stillness
  calmStance: {
    dur: 0.5,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.1, 0], spine: [2, 0, 0], chest: [0, 0, 0], head: [8, 0, 0], thighL: [4, 0, 6], shinL: [8, 0, 0], thighR: [-4, 0, -6], shinR: [8, 0, 0], lh: 0, upperArmL: [0, 0, 8], foreArmL: [-10, 0, 0], sw: { tilt: 20, yaw: -20, a: -100, r: 0.5, off: -20, roll: 0 } } },
      { t: 0.5, e: 'inOut', p: { head: [10, 0, 0] } },
    ],
  },
  calmSlashA: {
    dur: 0.14,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.14, 0.05], chest: [10, 30, 0], lh: 0, sw: { tilt: 30, a: -80, r: 0.6, off: 0 } } },
      { t: 0.14, e: 'inOut', p: { chest: [12, 34, 0] } },
    ],
  },
  calmSlashB: {
    dur: 0.14,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.14, 0.05], chest: [10, -30, 0], lh: 0, sw: { tilt: -30, a: 90, r: 0.6, off: 0 } } },
      { t: 0.14, e: 'inOut', p: { chest: [12, -34, 0] } },
    ],
  },
  // Sun halo dragon head dance: flowing slashes, looped by the player code
  dragonDanceA: {
    dur: 0.26,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.2, 0.1], by: 0, chest: [14, -40, 0], spine: [10, -14, 0], head: [-14, 30, 0], ...LUNGE, lh: 0, upperArmL: [30, 0, 60], sw: { tilt: 70, a: 110, r: 0.5, off: 20 } } },
      { t: 0.12, e: 'out', p: { chest: [14, 40, 0], sw: { a: -110, r: 0.62, off: 4 } } },
      { t: 0.26, e: 'inOut', p: { sw: { a: -118 } } },
    ],
  },
  dragonDanceB: {
    dur: 0.26,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.2, 0.1], chest: [14, 40, 0], spine: [10, 14, 0], head: [-14, -30, 0], ...LUNGE, lh: 0, upperArmL: [30, 0, 60], sw: { tilt: 110, a: -110, r: 0.5, off: -10, roll: 180 } } },
      { t: 0.12, e: 'out', p: { chest: [14, -40, 0], sw: { a: 110, r: 0.62, off: 8 } } },
      { t: 0.26, e: 'inOut', p: { sw: { a: 118 } } },
    ],
  },
  ultReady: {
    dur: 0.9,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.22, -0.05], hips: [0, 30, 0], chest: [6, 40, 0], spine: [6, 14, 0], head: [-8, -40, 0], ...WIDE, lh: 1, sw: { tilt: 86, yaw: 0, a: -140, r: 0.34, off: -10, roll: 180 }, pole: [0.3, -0.4, 0.9] } },
      { t: 0.9, e: 'inOut', p: { hp: [0, -0.26, -0.08], chest: [8, 46, 0], sw: { a: -146 } } },
    ],
  },
  // ----------------------------------------------------------- 炎之呼吸 (Rengoku)
  // 壹之型・不知火: from the drawn-back charge, a flat right-to-left cut at the end of a blazing dash
  shiranui: {
    dur: 0.7,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.26, -0.1], hips: [0, -36, 0], chest: [4, -50, 0], spine: [8, -16, 0], head: [-6, 50, 0], thighL: [-30, -30, 12], shinL: [50, 0, 0], thighR: [30, -10, -14], shinR: [40, 0, 0], lh: 0, upperArmL: [-50, 0, 50], foreArmL: [-40, 0, 0], sw: { tilt: 86, yaw: 0, a: 116, r: 0.4, off: 28, roll: 0 }, pole: [-0.9, 0.1, -0.2] } },
      { t: 0.06, e: 'out', p: { hp: [0, -0.36, 0.35], spine: [26, -14, 0], chest: [16, -48, 0], head: [-24, 44, 0], ...LUNGE, thighR: [-70, -6, -4], shinR: [70, 0, 0], sw: { a: 122, off: 30 } } },
      { t: 0.11, e: 'out', p: { hp: [0, -0.3, 0.5], hips: [0, 26, 0], chest: [14, 46, 0], spine: [14, 18, 0], head: [-16, -42, 0], upperArmL: [20, 0, 70], foreArmL: [-10, 0, 0], sw: { a: -112, r: 0.64, off: 6 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 0.42, e: 'inOut', p: { sw: { a: -118 } } },
      { t: 0.7, e: 'inOut', p: { hp: [0, -0.14, 0.2], hips: [0, 10, 0], chest: [8, 24, 0], sw: { a: -98, off: 22 } } },
    ],
  },
  // 貳之型・昇炎天: coiled low with the blade behind, then one rising crescent
  risingSun: {
    dur: 0.82,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.3, 0], hips: [0, -10, 0], spine: [22, -6, 0], chest: [14, -16, 0], head: [-24, 14, 0], thighL: [16, -10, 14], shinL: [44, 0, 0], thighR: [-40, -10, -14], shinR: [58, 0, 0], lh: 1, sw: { tilt: 6, yaw: -6, a: -150, r: 0.46, off: -10, roll: 0 }, pole: [-0.8, -0.4, -0.2] } },
      { t: 0.12, e: 'in', p: { hp: [0, -0.36, 0.05], sw: { a: -160 } } },
      { t: 0.22, e: 'out', p: { hp: [0, 0.06, 0.3], hips: [0, 6, 0], spine: [-8, 0, 0], chest: [-22, 6, 0], head: [16, 0, 0], thighL: [30, -6, 8], shinL: [30, 0, 0], footL: [30, 0, 0], thighR: [-20, -6, -4], shinR: [10, 0, 0], sw: { a: 100, r: 0.6, off: 10 }, pole: [-0.8, 0.2, -0.2] } },
      { t: 0.52, e: 'inOut', p: { hp: [0, 0.02, 0.3], sw: { a: 108 } } },
      { t: 0.82, e: 'inOut', p: { hp: [0, -0.1, 0.2], spine: [4, 0, 0], chest: [0, 0, 0], head: [-4, 0, 0], footL: [0, 0, 0], sw: { a: 70, off: 30 } } },
    ],
  },
  // 肆之型・盛炎漩渦: the blade wheels in front of him, then a flat cut sweeps the flames outward
  flameVortex: {
    dur: 1.0,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.2, 0], hips: [0, 10, 0], spine: [10, 0, 0], chest: [4, 0, 0], head: [-10, 0, 0], ...WIDE, lh: 1, sw: { tilt: 16, yaw: 0, a: -80, r: 0.5, off: 0, roll: 0 }, pole: [-0.8, -0.3, -0.2] } },
      { t: 0.1, e: 'in', p: { sw: { a: -100 } } },
      { t: 0.42, e: 'linear', p: { chest: [8, 10, 0], sw: { a: 200, r: 0.56 } } },
      { t: 0.68, e: 'linear', p: { chest: [6, -30, 0], head: [-8, 26, 0], sw: { tilt: 60, a: 480 } } },
      { t: 0.78, e: 'out', p: { hp: [0, -0.24, 0.2], hips: [0, 24, 0], chest: [10, 44, 0], spine: [8, 16, 0], head: [-10, -40, 0], ...LUNGE, sw: { tilt: 86, a: 250, r: 0.62, off: 6 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 1.0, e: 'inOut', p: { hp: [0, -0.14, 0.15], sw: { a: 256, off: 20 } } },
    ],
  },
  // 伍之型・炎虎: crouch, spring up with the blade high behind the head, crash down
  flameTiger: {
    dur: 1.1,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.3, -0.05], hips: [0, -10, 0], spine: [-6, -4, 0], chest: [-18, -10, 0], head: [14, 6, 0], thighL: [20, -10, 14], shinL: [46, 0, 0], thighR: [-36, -10, -14], shinR: [56, 0, 0], lh: 1, sw: { tilt: 6, yaw: -6, a: 206, r: 0.44, off: 26, roll: 0 }, pole: [-0.8, 0.3, -0.3] } },
      { t: 0.16, e: 'in', p: { hp: [0, -0.38, -0.08], chest: [-22, -12, 0], sw: { a: 216 } } },
      { t: 0.32, e: 'linear', p: { hp: [0, 0.5, 0.35], bp: -8, spine: [-10, 0, 0], chest: [-24, 0, 0], head: [14, 0, 0], thighL: [-50, 0, 10], shinL: [100, 0, 0], thighR: [-70, 0, -10], shinR: [110, 0, 0], sw: { a: 150, r: 0.5, off: 30 } } },
      { t: 0.44, e: 'snap', p: { hp: [0, -0.34, 0.6], bp: 10, spine: [18, 0, 0], chest: [34, 6, 0], head: [-30, 0, 0], ...LUNGE, sw: { a: -62, r: 0.64, off: 2 }, pole: [-0.5, -1, 0] } },
      { t: 0.8, e: 'inOut', p: { sw: { a: -66 } } },
      { t: 1.1, e: 'inOut', p: { hp: [0, -0.16, 0.3], bp: 0, chest: [14, 4, 0], sw: { a: -52, off: 26 } } },
    ],
  },
  // 玖之型・煉獄: the low stance before the charge, and the charge itself
  rengokuReady: {
    dur: 1.0,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.36, -0.08], hips: [0, -34, 0], spine: [14, -18, 0], chest: [8, -40, 0], head: [-14, 56, 0], thighL: [-40, -30, 16], shinL: [70, 0, 0], footL: [-10, 20, 0], thighR: [36, -12, -16], shinR: [50, 0, 0], lh: 1, sw: { tilt: 70, yaw: 0, a: 150, r: 0.4, off: 30, roll: 0 }, pole: [-0.9, 0.2, -0.3] } },
      { t: 1.0, e: 'inOut', p: { hp: [0, -0.4, -0.1], chest: [10, -46, 0], sw: { a: 158 } } },
    ],
  },
  rengokuDash: {
    dur: 0.5,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.3, 0.4], hips: [0, 20, 0], spine: [30, 10, 0], chest: [22, 30, 0], head: [-36, -26, 0], ...LUNGE, thighR: [-76, -6, -4], shinR: [70, 0, 0], lh: 0, upperArmL: [40, 0, 50], foreArmL: [-10, 0, 0], sw: { tilt: 80, yaw: 0, a: -100, r: 0.66, off: 4, roll: 0 }, pole: [-0.3, -0.6, 0.8] } },
      { t: 0.5, e: 'inOut', p: { sw: { a: -110 } } },
    ],
  },
  // ----------------------------------------------------------- 蛇之呼吸 (Obanai)
  // 肆之型・頸蛇雙生: lunge (first head), recoil, rising flick (second head)
  twinFang: {
    dur: 0.72,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.24, -0.16], hips: [0, -40, 0], chest: [6, -46, 0], spine: [6, -14, 0], head: [-4, 50, 0], lh: 1, sw: { tilt: 90, yaw: 0, a: 14, r: 0.08, off: -14, roll: 90 } } },
      { t: 0.07, e: 'out', p: { hp: [0, -0.32, 0.45], hips: [0, 10, 0], chest: [14, 8, 0], spine: [16, 4, 0], head: [-26, -6, 0], ...LUNGE, thighR: [-70, -6, -4], shinR: [70, 0, 0], sw: { a: 2, r: 0.7, off: -2 }, pole: [-0.6, -0.8, -0.1] } },
      { t: 0.16, e: 'inOut', p: { chest: [10, -16, 0], lh: 0, upperArmL: [10, 0, 50], foreArmL: [-30, 0, 0], sw: { tilt: 64, a: -40, r: 0.5, off: -20, roll: 0 } } },
      { t: 0.23, e: 'out', p: { hp: [0, -0.24, 0.55], chest: [4, 24, 0], head: [-10, -20, 0], sw: { a: 112, r: 0.62, off: 8 } } },
      { t: 0.5, e: 'inOut', p: { sw: { a: 118 } } },
      { t: 0.72, e: 'inOut', p: { hp: [0, -0.14, 0.3], sw: { a: 84, off: 30 } } },
    ],
  },
  // 壹之型・委蛇斬: bent low, leaning into each turn, cutting on every one
  windingSlash: {
    dur: 0.84,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.3, 0.05], spine: [30, 0, 0], chest: [10, -30, 0], head: [-30, 26, 0], thighL: [20, -6, 8], shinL: [40, 0, 0], thighR: [-40, -6, -4], shinR: [50, 0, 0], lh: 0, upperArmL: [20, 0, 40], foreArmL: [-30, 0, 0], sw: { tilt: 80, yaw: 0, a: 110, r: 0.5, off: 20, roll: 0 }, pole: [-0.9, 0.1, -0.2] } },
      { t: 0.14, e: 'out', p: { br: 12, chest: [12, 34, 0], head: [-28, -24, 0], sw: { a: -100, r: 0.62, off: 6 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 0.28, e: 'out', p: { br: -12, chest: [12, -34, 0], head: [-28, 26, 0], sw: { a: 104 }, pole: [-0.9, 0.1, -0.2] } },
      { t: 0.42, e: 'out', p: { br: 10, chest: [12, 30, 0], head: [-28, -22, 0], sw: { a: -96 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 0.49, e: 'in', p: { br: 0, chest: [8, -40, 0], head: [-20, 34, 0], sw: { a: 118, r: 0.5, off: 24 }, pole: [-0.9, 0.1, -0.2] } },
      { t: 0.55, e: 'out', p: { hp: [0, -0.2, 0.2], chest: [12, 46, 0], spine: [16, 16, 0], head: [-14, -40, 0], ...LUNGE, sw: { a: -112, r: 0.64, off: 6 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 0.84, e: 'inOut', p: { hp: [0, -0.12, 0.1], spine: [10, 6, 0], sw: { a: -100, off: 22 } } },
    ],
  },
  // 貳之型・狹頭之毒牙: coiled back (he is already slipping behind the target), then a biting downward cut
  venomFang: {
    dur: 0.72,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.34, -0.1], spine: [20, 0, 0], chest: [10, -30, 0], head: [-20, 30, 0], thighL: [20, -10, 14], shinL: [50, 0, 0], thighR: [-40, -10, -14], shinR: [60, 0, 0], lh: 0, upperArmL: [10, 0, 50], foreArmL: [-40, 0, 0], sw: { tilt: 40, yaw: 0, a: 150, r: 0.44, off: 24, roll: 0 }, pole: [-0.8, 0.3, -0.2] } },
      { t: 0.12, e: 'in', p: { hp: [0, -0.4, -0.1], sw: { a: 160 } } },
      { t: 0.22, e: 'out', p: { hp: [0, -0.28, 0.35], spine: [24, 0, 0], chest: [20, 30, 0], head: [-26, -24, 0], ...LUNGE, sw: { a: -40, r: 0.64, off: 4 }, pole: [-0.5, -1, 0] } },
      { t: 0.48, e: 'inOut', p: { sw: { a: -46 } } },
      { t: 0.72, e: 'inOut', p: { hp: [0, -0.14, 0.2], chest: [10, 10, 0], sw: { a: -30, off: 26 } } },
    ],
  },
  // 參之型・塒締: three low turns with the blade held out, closing on a squeeze
  coilChoke: {
    dur: 1.05,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.32, 0], by: 0, hips: [0, 30, 0], chest: [14, 40, 0], spine: [14, 14, 0], head: [-16, -30, 0], thighL: [10, -10, 16], shinL: [36, 0, 0], thighR: [-16, -10, -16], shinR: [40, 0, 0], lh: 0, upperArmL: [0, 0, 80], foreArmL: [-10, 0, 0], sw: { tilt: 80, yaw: 0, a: -120, r: 0.5, off: -20, roll: 180 }, pole: [0, -0.3, 1] } },
      { t: 0.12, e: 'in', p: { chest: [16, 52, 0], sw: { a: -130 } } },
      { t: 0.84, e: 'linear', p: { by: -1080, hp: [0, -0.36, 0.05], hips: [0, -10, 0], chest: [8, -10, 0], head: [-12, 0, 0], sw: { a: -86, r: 0.66, off: 0 } } },
      { t: 0.9, e: 'out', p: { by: -1080, chest: [18, -34, 0], sw: { tilt: 60, a: -56, r: 0.46, off: 12 } } },
      { t: 1.05, e: 'inOut', p: { by: -1080, hp: [0, -0.16, 0.05], sw: { a: -64, off: 26 } } },
    ],
  },
  // 伍之型・蜿蜒長蛇: coiled like a snake about to strike
  serpentReady: {
    dur: 0.7,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.38, -0.05], hips: [0, -20, 0], spine: [30, -10, 0], chest: [14, -20, 0], head: [-34, 24, 0], thighL: [-50, -20, 16], shinL: [90, 0, 0], thighR: [30, -10, -16], shinR: [60, 0, 0], lh: 0, upperArmL: [-60, 0, 30], foreArmL: [-30, 0, 0], sw: { tilt: 70, yaw: 0, a: 30, r: 0.5, off: -40, roll: 0 }, pole: [-0.8, -0.2, -0.3] } },
      { t: 0.7, e: 'inOut', p: { hp: [0, -0.42, -0.08], chest: [16, -24, 0] } },
    ],
  },
  fall: {
    dur: 0.6,
    keys: [
      { t: 0, e: 'inOut', p: { hp: [0, 0, 0], spine: [-10, 0, 0], chest: [-8, 0, 0], head: [16, 0, 0], thighL: [-30, 0, 16], shinL: [50, 0, 0], thighR: [-10, 0, -12], shinR: [30, 0, 0], footL: [20, 0, 0], footR: [20, 0, 0], lh: 0, upperArmL: [-40, 0, 70], foreArmL: [-30, 0, 0], sw: { tilt: 60, yaw: -30, a: -60, r: 0.55, off: -40 } } },
      { t: 0.6, e: 'inOut', p: { upperArmL: [-50, 0, 80], thighL: [-40, 0, 18], shinL: [60, 0, 0] } },
    ],
  },
  landing: {
    dur: 0.6,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.48, 0], spine: [30, 0, 0], chest: [10, 0, 0], head: [-26, 0, 0], thighL: [-70, 0, 20], shinL: [110, 0, 0], thighR: [-20, 0, -30], shinR: [120, 0, 0], footR: [20, 0, 0], lh: 0, upperArmL: [0, 0, 50], foreArmL: [-10, 0, 0], sw: { tilt: 40, yaw: -20, a: -140, r: 0.55, off: -20 } } },
      { t: 0.35, e: 'inOut', p: { hp: [0, -0.46, 0] } },
      { t: 0.6, e: 'inOut', p: { ...SWORD_STANCE } },
    ],
  },
  victory: {
    dur: 1.2,
    keys: [
      { t: 0, e: 'out', p: { ...SWORD_STANCE } },
      { t: 0.5, e: 'inOut', p: { hp: [0, -0.02, 0], hips: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [6, 0, 0], thighL: [0, 0, 5], shinL: [4, 0, 0], thighR: [0, 0, -5], shinR: [4, 0, 0], lh: 0, upperArmL: [0, 0, 8], foreArmL: [-10, 0, 0], sw: { tilt: 0, yaw: -20, a: -95, r: 0.52, off: -8, roll: 0 } } },
      { t: 1.2, e: 'inOut', p: { head: [10, 0, 0] } },
    ],
  },
};

// ---------------------------------------------------------------------------
// Akaza (Destructive Death)
// ---------------------------------------------------------------------------
export const AKAZA_STANCE = {
  hp: [0, -0.14, 0],
  hips: [0, 28, 0],
  spine: [6, -8, 0],
  chest: [2, -14, 0],
  neck: [0, 0, 0],
  head: [-4, -8, 0],
  thighL: [-20, -20, 20],
  shinL: [30, 0, 0],
  footL: [-6, 18, 0],
  thighR: [18, -24, -20],
  shinR: [30, 0, 0],
  footR: [-10, -10, 0],
  upperArmL: [-70, 10, 12],
  foreArmL: [-40, 0, 0],
  handL: [0, 0, 0],
  upperArmR: [-20, 0, -26],
  foreArmR: [-110, 0, 0],
  handR: [0, 0, 0],
};
export const AKAZA_RUN = {
  hp: [0, -0.06, 0],
  hips: [0, 0, 0],
  spine: [26, 0, 0],
  chest: [8, 0, 0],
  head: [-24, 0, 0],
  thighL: [0, 0, 4],
  shinL: [10, 0, 0],
  footL: [0, 0, 0],
  thighR: [0, 0, -4],
  shinR: [10, 0, 0],
  footR: [0, 0, 0],
  upperArmL: [40, 0, 14],
  foreArmL: [-20, 0, 0],
  upperArmR: [40, 0, -14],
  foreArmR: [-20, 0, 0],
};
export const AKAZA_CLIPS = {
  jab: {
    dur: 0.36,
    keys: [
      { t: 0, e: 'out', p: { chest: [0, -24, 0], upperArmL: [-60, 10, 20], foreArmL: [-90, 0, 0] } },
      { t: 0.07, e: 'snap', p: { hp: [0, -0.16, 0.12], chest: [4, 20, 0], spine: [4, 8, 0], upperArmL: [-90, 0, -8], foreArmL: [-4, 0, 0] } },
      { t: 0.2, e: 'inOut', p: {} },
      { t: 0.36, e: 'inOut', p: { ...AKAZA_STANCE } },
    ],
  },
  cross: {
    dur: 0.42,
    keys: [
      { t: 0, e: 'out', p: { chest: [-4, -30, 0], upperArmR: [-10, 0, -30], foreArmR: [-120, 0, 0] } },
      { t: 0.08, e: 'snap', p: { hp: [0, -0.2, 0.22], hips: [0, -10, 0], chest: [8, 34, 0], spine: [6, 14, 0], upperArmR: [-92, 0, 10], foreArmR: [-4, 0, 0], upperArmL: [-40, 0, 20], foreArmL: [-120, 0, 0], ...{ thighR: [0, -10, -16], shinR: [20, 0, 0] } } },
      { t: 0.24, e: 'inOut', p: {} },
      { t: 0.42, e: 'inOut', p: { ...AKAZA_STANCE } },
    ],
  },
  hook: {
    dur: 0.5,
    keys: [
      { t: 0, e: 'out', p: { chest: [0, 30, 0], upperArmL: [-40, 0, 70], foreArmL: [-80, 0, 0] } },
      { t: 0.1, e: 'snap', p: { hp: [0, -0.18, 0.1], chest: [6, -40, 0], spine: [4, -14, 0], upperArmL: [-90, -60, 40], foreArmL: [-90, 0, 0] } },
      { t: 0.28, e: 'inOut', p: {} },
      { t: 0.5, e: 'inOut', p: { ...AKAZA_STANCE } },
    ],
  },
  uppercut: {
    dur: 0.6,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.34, 0], chest: [20, -20, 0], spine: [16, -6, 0], upperArmR: [20, 0, -20], foreArmR: [-100, 0, 0] } },
      { t: 0.1, e: 'snap', p: { hp: [0, 0.05, 0.2], chest: [-20, 20, 0], spine: [-10, 8, 0], head: [-20, 0, 0], upperArmR: [-170, 0, 0], foreArmR: [-20, 0, 0], thighR: [-30, 0, -10], shinR: [20, 0, 0] } },
      { t: 0.35, e: 'inOut', p: {} },
      { t: 0.6, e: 'inOut', p: { ...AKAZA_STANCE } },
    ],
  },
  // 腳式・流閃群光: spinning heel sweep
  spinKick: {
    dur: 0.8,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.3, 0], by: 0, chest: [10, 30, 0], thighL: [-30, 0, 20], shinL: [60, 0, 0] } },
      { t: 0.1, e: 'in', p: { by: 20 } },
      { t: 0.42, e: 'linear', p: { by: -360, hp: [0, -0.1, 0], chest: [-6, 0, 0], spine: [-20, 0, 30], thighR: [-10, 0, -95], shinR: [0, 0, 0], footR: [0, 0, 0], thighL: [0, 0, 10], shinL: [20, 0, 0], upperArmL: [0, 0, 80], upperArmR: [0, 0, -60] } },
      { t: 0.6, e: 'out', p: { by: -360, ...AKAZA_STANCE } },
      { t: 0.8, e: 'inOut', p: { by: -360 } },
    ],
  },
  // 腳式・冠先割: leaping axe kick
  axeKick: {
    dur: 1.1,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.4, 0], chest: [20, 0, 0], spine: [16, 0, 0], thighL: [-50, 0, 10], shinL: [90, 0, 0], thighR: [-50, 0, -10], shinR: [90, 0, 0], upperArmL: [30, 0, 30], upperArmR: [30, 0, -30] } },
      { t: 0.18, e: 'out', p: { hp: [0, 2.6, 0.5], chest: [-20, 0, 0], spine: [-10, 0, 0], head: [20, 0, 0], thighR: [-170, 0, -10], shinR: [0, 0, 0], thighL: [20, 0, 10], shinL: [30, 0, 0], upperArmL: [-60, 0, 60], upperArmR: [-60, 0, -60] } },
      { t: 0.46, e: 'in', p: { hp: [0, 2.8, 0.8] } },
      { t: 0.58, e: 'snap', p: { hp: [0, -0.3, 1.0], chest: [30, 0, 0], spine: [20, 0, 0], head: [-30, 0, 0], thighR: [-20, 0, -10], shinR: [40, 0, 0], thighL: [30, 0, 10], shinL: [80, 0, 0], upperArmL: [40, 0, 40], upperArmR: [40, 0, -40] } },
      { t: 0.9, e: 'inOut', p: {} },
      { t: 1.1, e: 'inOut', p: { ...AKAZA_STANCE, hp: [0, -0.14, 1.0] } },
    ],
  },
  // 破壞殺・空式: rapid air punches that launch shockwaves
  airType: {
    dur: 1.15,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.2, 0], chest: [0, -30, 0], upperArmR: [-10, 0, -30], foreArmR: [-120, 0, 0] } },
      { t: 0.25, e: 'in', p: { hp: [0, -0.24, -0.05], chest: [2, -40, 0], upperArmR: [0, 0, -34] } },
      { t: 0.37, e: 'snap', p: { chest: [6, 30, 0], upperArmR: [-94, 0, 8], foreArmR: [0, 0, 0], upperArmL: [-40, 0, 20], foreArmL: [-120, 0, 0] } },
      { t: 0.51, e: 'snap', p: { chest: [6, -30, 0], upperArmL: [-94, 0, -8], foreArmL: [0, 0, 0], upperArmR: [-40, 0, -20], foreArmR: [-120, 0, 0] } },
      { t: 0.65, e: 'snap', p: { chest: [6, 30, 0], upperArmR: [-94, 0, 8], foreArmR: [0, 0, 0], upperArmL: [-40, 0, 20], foreArmL: [-120, 0, 0] } },
      { t: 0.9, e: 'inOut', p: {} },
      { t: 1.15, e: 'inOut', p: { ...AKAZA_STANCE } },
    ],
  },
  // 破壞殺・亂式: close-range barrage (looped)
  barrageA: {
    dur: 0.12,
    loop: true,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.24, 0.1], chest: [8, 26, 0], upperArmR: [-88, 8, 6], foreArmR: [0, 0, 0], upperArmL: [-50, 0, 30], foreArmL: [-110, 0, 0] } },
      { t: 0.06, e: 'snap', p: { chest: [8, -26, 0], upperArmL: [-88, -8, -6], foreArmL: [0, 0, 0], upperArmR: [-50, 0, -30], foreArmR: [-110, 0, 0] } },
    ],
  },
  barrageEnd: {
    dur: 0.6,
    keys: [
      { t: 0, e: 'out', p: { chest: [-4, -40, 0], upperArmR: [0, 0, -30], foreArmR: [-120, 0, 0] } },
      { t: 0.12, e: 'snap', p: { hp: [0, -0.3, 0.35], chest: [12, 40, 0], spine: [8, 16, 0], upperArmR: [-90, 0, 10], foreArmR: [0, 0, 0], thighR: [10, -10, -14], shinR: [20, 0, 0] } },
      { t: 0.4, e: 'inOut', p: {} },
      { t: 0.6, e: 'inOut', p: { ...AKAZA_STANCE } },
    ],
  },
  // 碎式・萬葉閃柳: leap + ground punch
  groundSlam: {
    dur: 1.2,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.4, 0], chest: [20, 0, 0], spine: [20, 0, 0], upperArmR: [-150, 0, -20], foreArmR: [-40, 0, 0] } },
      { t: 0.2, e: 'out', p: { hp: [0, 1.8, 0.3], bp: -10, chest: [-20, 0, 0], upperArmR: [-180, 0, -10], foreArmR: [-10, 0, 0], thighL: [-60, 0, 10], shinL: [100, 0, 0], thighR: [-40, 0, -10], shinR: [100, 0, 0] } },
      { t: 0.45, e: 'in', p: { hp: [0, 1.9, 0.5] } },
      { t: 0.56, e: 'snap', p: { hp: [0, -0.6, 0.7], bp: 20, chest: [40, 0, 0], spine: [30, 0, 0], head: [-30, 0, 0], upperArmR: [-40, 0, -10], foreArmR: [0, 0, 0], thighL: [-80, 0, 20], shinL: [120, 0, 0], thighR: [0, 0, -30], shinR: [90, 0, 0] } },
      { t: 0.95, e: 'inOut', p: {} },
      { t: 1.2, e: 'inOut', p: { ...AKAZA_STANCE, bp: 0, hp: [0, -0.14, 0.7] } },
    ],
  },
  // 破壞殺・滅式: charge
  annihilationCharge: {
    dur: 1.0,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.34, -0.1], hips: [0, 50, 0], chest: [10, -60, 0], spine: [10, -20, 0], head: [-10, 60, 0], thighL: [-40, -30, 30], shinL: [60, 0, 0], thighR: [30, -30, -30], shinR: [40, 0, 0], upperArmR: [30, 0, -40], foreArmR: [-130, 0, 0], upperArmL: [-90, 0, 0], foreArmL: [-10, 0, 0] } },
      { t: 1.0, e: 'inOut', p: { hp: [0, -0.4, -0.14], chest: [12, -66, 0] } },
    ],
  },
  annihilation: {
    dur: 0.7,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.4, 0.5], hips: [0, -10, 0], chest: [14, 40, 0], spine: [14, 16, 0], head: [-20, -30, 0], thighL: [30, 0, 10], shinL: [30, 0, 0], thighR: [-70, 0, -10], shinR: [70, 0, 0], upperArmR: [-92, 0, 6], foreArmR: [0, 0, 0], upperArmL: [30, 0, 30], foreArmL: [-60, 0, 0] } },
      { t: 0.45, e: 'inOut', p: {} },
      { t: 0.7, e: 'inOut', p: { ...AKAZA_STANCE } },
    ],
  },
  // 終式・青銀亂殘光: 360 degree barrage stance
  finalType: {
    dur: 0.3,
    loop: true,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.3, 0], by: 0, chest: [0, 30, 0], upperArmR: [-90, 0, -40], foreArmR: [0, 0, 0], upperArmL: [-90, 0, 40], foreArmL: [0, 0, 0], thighL: [-10, 0, 30], shinL: [40, 0, 0], thighR: [-10, 0, -30], shinR: [40, 0, 0] } },
      { t: 0.1, e: 'snap', p: { by: 120, chest: [0, -30, 0], upperArmR: [-60, 0, -70], upperArmL: [-120, 0, 70] } },
      { t: 0.2, e: 'snap', p: { by: 240, chest: [0, 30, 0], upperArmR: [-120, 0, -70], upperArmL: [-60, 0, 70] } },
    ],
  },
  techniqueDev: {
    dur: 1.6,
    keys: [
      { t: 0, e: 'out', p: { ...AKAZA_STANCE } },
      { t: 0.5, e: 'out', p: { hp: [0, -0.3, 0], hips: [0, 0, 0], chest: [0, 0, 0], spine: [0, 0, 0], head: [-8, 0, 0], thighL: [-10, 0, 34], shinL: [40, 0, 0], thighR: [-10, 0, -34], shinR: [40, 0, 0], upperArmL: [-90, 0, 50], foreArmL: [-100, 0, 0], upperArmR: [-90, 0, -50], foreArmR: [-100, 0, 0] } },
      { t: 1.6, e: 'inOut', p: { hp: [0, -0.34, 0] } },
    ],
  },
  taunt: {
    dur: 2.0,
    keys: [
      { t: 0, e: 'inOut', p: { hp: [0, -0.02, 0], hips: [0, 0, 0], spine: [0, 0, 0], chest: [-4, 0, 0], head: [-6, 0, 0], thighL: [0, 0, 8], shinL: [4, 0, 0], thighR: [0, 0, -8], shinR: [4, 0, 0], footL: [0, 10, 0], footR: [0, -10, 0], upperArmL: [0, 0, 10], foreArmL: [-20, 0, 0], upperArmR: [-10, 0, -10], foreArmR: [-100, 0, 0] } },
      { t: 1.0, e: 'inOut', p: { head: [-10, 10, 0] } },
      { t: 2.0, e: 'inOut', p: { head: [-6, 0, 0] } },
    ],
  },
  hit: {
    dur: 0.32,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.16, -0.08], spine: [-14, 0, 8], chest: [-14, 16, 0], head: [-20, 0, 12], upperArmL: [-30, 0, 40], upperArmR: [-20, 0, -40] } },
      { t: 0.32, e: 'inOut', p: { ...AKAZA_STANCE } },
    ],
  },
  stagger: {
    dur: 2.2,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.2, -0.2], bp: -8, spine: [-20, 0, 10], chest: [-20, 20, 0], head: [-30, 0, 10], upperArmL: [20, 0, 40], foreArmL: [-20, 0, 0], upperArmR: [30, 0, -50], foreArmR: [-10, 0, 0] } },
      { t: 0.5, e: 'out', p: { hp: [0, -0.5, 0], bp: 10, spine: [30, 0, 0], chest: [20, 0, 0], head: [10, 0, 0], thighL: [-70, 0, 10], shinL: [90, 0, 0], thighR: [0, 0, -10], shinR: [100, 0, 0], upperArmL: [-40, 0, 20], foreArmL: [-50, 0, 0], upperArmR: [0, 0, -20], foreArmR: [-20, 0, 0] } },
      { t: 1.9, e: 'inOut', p: { hp: [0, -0.46, 0] } },
      { t: 2.2, e: 'inOut', p: { ...AKAZA_STANCE, bp: 0 } },
    ],
  },
  death: {
    dur: 2.5,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.2, 0], spine: [-10, 0, 0], chest: [-10, 0, 0], head: [-20, 0, 0], upperArmL: [0, 0, 20], foreArmL: [-10, 0, 0], upperArmR: [0, 0, -20], foreArmR: [-10, 0, 0] } },
      { t: 1.2, e: 'inOut', p: { hp: [0, -0.62, 0.1], spine: [16, 0, 0], chest: [6, 0, 0], head: [16, 0, 0], thighL: [-90, 0, 10], shinL: [120, 0, 0], thighR: [-80, 0, -10], shinR: [125, 0, 0], footL: [30, 0, 0], footR: [30, 0, 0] } },
      { t: 2.5, e: 'inOut', p: { head: [20, 0, 0] } },
    ],
  },
  dash: {
    dur: 0.3,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.3, 0], spine: [36, 0, 0], chest: [10, 0, 0], head: [-30, 0, 0], thighL: [-60, 0, 10], shinL: [80, 0, 0], thighR: [20, 0, -10], shinR: [60, 0, 0], upperArmL: [60, 0, 20], upperArmR: [60, 0, -20] } },
      { t: 0.3, e: 'inOut', p: {} },
    ],
  },
  backstep: {
    dur: 0.4,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, 0.2, -0.2], bp: -10, spine: [-10, 0, 0], thighL: [-40, 0, 10], shinL: [60, 0, 0], thighR: [-20, 0, -10], shinR: [50, 0, 0] } },
      { t: 0.4, e: 'inOut', p: { ...AKAZA_STANCE, bp: 0 } },
    ],
  },
  counterGuard: {
    dur: 0.3,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.2, -0.05], chest: [-6, 10, 0], upperArmL: [-110, 0, -20], foreArmL: [-60, 0, 0], upperArmR: [-40, 0, -20], foreArmR: [-120, 0, 0] } },
      { t: 0.3, e: 'inOut', p: {} },
    ],
  },
};

// ---------------------------------------------------------------------------
// Lesser demons
// ---------------------------------------------------------------------------
export const DEMON_STANCE = {
  hp: [0, -0.12, 0],
  spine: [24, 0, 0],
  chest: [16, 0, 0],
  neck: [-10, 0, 0],
  head: [-24, 0, 0],
  thighL: [-16, -8, 12],
  shinL: [30, 0, 0],
  footL: [-10, 0, 0],
  thighR: [-6, 8, -12],
  shinR: [26, 0, 0],
  footR: [-10, 0, 0],
  upperArmL: [-26, 0, 22],
  foreArmL: [-40, 0, 0],
  handL: [20, 0, 0],
  upperArmR: [-26, 0, -22],
  foreArmR: [-40, 0, 0],
  handR: [20, 0, 0],
};
export const DEMON_RUN = {
  hp: [0, -0.1, 0],
  spine: [40, 0, 0],
  chest: [14, 0, 0],
  neck: [-16, 0, 0],
  head: [-30, 0, 0],
  upperArmL: [40, 0, 26],
  foreArmL: [-30, 0, 0],
  upperArmR: [40, 0, -26],
  foreArmR: [-30, 0, 0],
};
export const DEMON_CLIPS = {
  swipe: {
    dur: 0.95,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.06, -0.05], spine: [4, -20, 0], chest: [-6, -30, 0], head: [-16, 20, 0], upperArmR: [-150, 0, -60], foreArmR: [-50, 0, 0], upperArmL: [-40, 0, 40] } },
      { t: 0.45, e: 'in', p: { chest: [-10, -36, 0], upperArmR: [-160, 0, -70] } },
      { t: 0.55, e: 'snap', p: { hp: [0, -0.2, 0.25], spine: [34, 20, 0], chest: [20, 36, 0], head: [-30, -16, 0], upperArmR: [-20, 0, 30], foreArmR: [-10, 0, 0], thighR: [-40, 0, -10], shinR: [40, 0, 0] } },
      { t: 0.75, e: 'inOut', p: {} },
      { t: 0.95, e: 'inOut', p: { ...DEMON_STANCE } },
    ],
  },
  swipe2: {
    dur: 0.8,
    keys: [
      { t: 0, e: 'out', p: { spine: [20, 20, 0], chest: [10, 30, 0], upperArmL: [-150, 0, 60], foreArmL: [-50, 0, 0] } },
      { t: 0.32, e: 'in', p: { upperArmL: [-160, 0, 70] } },
      { t: 0.42, e: 'snap', p: { hp: [0, -0.2, 0.25], spine: [34, -20, 0], chest: [20, -36, 0], upperArmL: [-20, 0, -30], foreArmL: [-10, 0, 0], thighL: [-40, 0, 10], shinL: [40, 0, 0] } },
      { t: 0.8, e: 'inOut', p: { ...DEMON_STANCE } },
    ],
  },
  lungeWind: {
    dur: 0.7,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.4, -0.1], spine: [50, 0, 0], chest: [20, 0, 0], head: [-40, 0, 0], thighL: [-70, 0, 20], shinL: [120, 0, 0], thighR: [-60, 0, -20], shinR: [120, 0, 0], upperArmL: [30, 0, 40], upperArmR: [30, 0, -40] } },
      { t: 0.7, e: 'inOut', p: { hp: [0, -0.44, -0.12] } },
    ],
  },
  lunge: {
    dur: 0.7,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, 0.4, 0.2], bp: 20, spine: [20, 0, 0], chest: [0, 0, 0], head: [-30, 0, 0], thighL: [20, 0, 10], shinL: [40, 0, 0], thighR: [30, 0, -10], shinR: [50, 0, 0], upperArmL: [-150, 0, 20], foreArmL: [-10, 0, 0], upperArmR: [-150, 0, -20], foreArmR: [-10, 0, 0] } },
      { t: 0.3, e: 'in', p: { hp: [0, -0.3, 0.3], bp: 10, upperArmL: [-60, 0, 20], upperArmR: [-60, 0, -20] } },
      { t: 0.7, e: 'inOut', p: { ...DEMON_STANCE, bp: 0 } },
    ],
  },
  smash: {
    dur: 1.5,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, 0, -0.1], spine: [-10, 0, 0], chest: [-20, 0, 0], head: [0, 0, 0], upperArmL: [-170, 0, 20], foreArmL: [-30, 0, 0], upperArmR: [-170, 0, -20], foreArmR: [-30, 0, 0] } },
      { t: 0.8, e: 'in', p: { chest: [-24, 0, 0], upperArmL: [-185, 0, 10], upperArmR: [-185, 0, -10] } },
      { t: 0.92, e: 'snap', p: { hp: [0, -0.4, 0.3], spine: [50, 0, 0], chest: [30, 0, 0], head: [-40, 0, 0], upperArmL: [-40, 0, 10], foreArmL: [0, 0, 0], upperArmR: [-40, 0, -10], foreArmR: [0, 0, 0], thighL: [-50, 0, 20], shinL: [70, 0, 0], thighR: [-20, 0, -20], shinR: [60, 0, 0] } },
      { t: 1.25, e: 'inOut', p: {} },
      { t: 1.5, e: 'inOut', p: { ...DEMON_STANCE } },
    ],
  },
  hit: {
    dur: 0.4,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.1, -0.1], spine: [-10, 0, 10], chest: [-20, 20, 0], head: [-30, 0, 16], upperArmL: [-40, 0, 60], upperArmR: [-30, 0, -50] } },
      { t: 0.4, e: 'inOut', p: { ...DEMON_STANCE } },
    ],
  },
  knockdown: {
    dur: 1.4,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, 0.1, -0.2], bp: -30, spine: [-20, 0, 0], chest: [-20, 0, 0], head: [-20, 0, 0], thighL: [-40, 0, 10], shinL: [40, 0, 0], thighR: [-20, 0, -10], shinR: [30, 0, 0], upperArmL: [-120, 0, 40], upperArmR: [-120, 0, -40] } },
      { t: 0.35, e: 'in', p: { hp: [0, -0.72, -0.2], bp: -84, spine: [0, 0, 0], chest: [0, 0, 0], head: [16, 0, 0], thighL: [-20, 0, 14], shinL: [30, 0, 0], thighR: [-10, 0, -14], shinR: [20, 0, 0], upperArmL: [-160, 0, 40], upperArmR: [-160, 0, -40] } },
      { t: 0.45, e: 'out', p: { hp: [0, -0.66, -0.2], bp: -78 } },
      { t: 1.0, e: 'inOut', p: { hp: [0, -0.7, -0.2], bp: -82 } },
      { t: 1.4, e: 'inOut', p: { ...DEMON_STANCE, bp: 0 } },
    ],
  },
  death: {
    dur: 1.3,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.06, -0.05], spine: [-14, 0, 0], chest: [-16, 0, 0], head: [-20, 0, 0], upperArmL: [-40, 0, 50], upperArmR: [-40, 0, -50] } },
      { t: 0.45, e: 'in', p: { hp: [0, -0.52, 0.05], spine: [30, 0, 0], chest: [20, 0, 0], thighL: [-90, 0, 10], shinL: [120, 0, 0], thighR: [-86, 0, -10], shinR: [124, 0, 0], upperArmL: [10, 0, 20], foreArmL: [-10, 0, 0], upperArmR: [10, 0, -20], foreArmR: [-10, 0, 0] } },
      { t: 0.9, e: 'in', p: { hp: [0, -0.75, 0.3], bp: 60 } },
      { t: 1.3, e: 'inOut', p: { hp: [0, -0.8, 0.4], bp: 80 } },
    ],
  },
  spawn: {
    dur: 0.8,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.5, 0], spine: [60, 0, 0], chest: [20, 0, 0], head: [-50, 0, 0], thighL: [-80, 0, 20], shinL: [130, 0, 0], thighR: [-80, 0, -20], shinR: [130, 0, 0], upperArmL: [-40, 0, 40], upperArmR: [-40, 0, -40] } },
      { t: 0.5, e: 'out', p: { hp: [0, -0.1, 0], spine: [-10, 0, 0], chest: [-20, 0, 0], head: [10, 0, 0], thighL: [-10, 0, 10], shinL: [10, 0, 0], thighR: [-10, 0, -10], shinR: [10, 0, 0], upperArmL: [-60, 0, 80], foreArmL: [-60, 0, 0], upperArmR: [-60, 0, -80], foreArmR: [-60, 0, 0] } },
      { t: 0.8, e: 'inOut', p: { ...DEMON_STANCE } },
    ],
  },
};
