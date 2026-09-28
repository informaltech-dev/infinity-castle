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
  // ----------------------------------------------------------- 風之呼吸 (Sanemi)
  // 壹之型・塵旋風・削斬: from the drawn-back charge, bent low and whirling twice round with the blade held out
  // as he drills forward, and a last cut across where the whirl stops
  jinsenpu: {
    dur: 0.78,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.24, -0.16], by: 0, hips: [0, -40, 0], chest: [6, -46, 0], spine: [6, -14, 0], head: [-4, 50, 0], lh: 1, sw: { tilt: 90, yaw: 0, a: 14, r: 0.08, off: -14, roll: 90 } } },
      { t: 0.05, e: 'out', p: { hp: [0, -0.38, 0.3], hips: [0, 0, 0], spine: [30, 0, 0], chest: [16, 10, 0], head: [-32, -6, 0], ...LUNGE, thighR: [-66, -6, -4], shinR: [70, 0, 0], lh: 0, upperArmL: [20, 0, 70], foreArmL: [-10, 0, 0], sw: { tilt: 86, a: 100, r: 0.62, off: 4, roll: 0 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 0.3, e: 'linear', p: { by: -720, hp: [0, -0.36, 0.34], chest: [16, 20, 0], sw: { a: 104 } } },
      { t: 0.35, e: 'out', p: { by: -720, hp: [0, -0.28, 0.36], chest: [12, 46, 0], spine: [18, 16, 0], head: [-18, -40, 0], sw: { a: -104, r: 0.64, off: 6 } } },
      { t: 0.56, e: 'inOut', p: { by: -720, sw: { a: -110 } } },
      { t: 0.78, e: 'inOut', p: { by: -720, hp: [0, -0.14, 0.2], spine: [10, 6, 0], chest: [8, 24, 0], head: [-10, -20, 0], sw: { a: -96, off: 22 } } },
    ],
  },
  // 貳之型・爪爪・科戶風: the blade raised high at the right shoulder, then one savage cut down and across
  shinato: {
    dur: 0.8,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.1, -0.04], hips: [0, -24, 0], spine: [-4, -12, 0], chest: [-10, -32, 0], head: [-6, 30, 0], ...WIDE, lh: 1, sw: { tilt: 40, yaw: 0, a: 150, r: 0.42, off: 30, roll: 0 }, pole: [-0.9, 0.3, -0.3] } },
      { t: 0.14, e: 'snap', p: { hp: [0, -0.14, -0.06], chest: [-14, -42, 0], sw: { a: 162, off: 36 } } },
      { t: 0.22, e: 'out', p: { hp: [0, -0.24, 0.26], hips: [0, 24, 0], spine: [14, 14, 0], chest: [22, 38, 0], head: [-18, -30, 0], ...LUNGE, sw: { a: -50, r: 0.64, off: 4 }, pole: [-0.4, -1, 0.1] } },
      { t: 0.5, e: 'inOut', p: { sw: { a: -58 } } },
      { t: 0.8, e: 'inOut', p: { hp: [0, -0.12, 0.12], chest: [10, 16, 0], sw: { a: -48, off: 24 } } },
    ],
  },
  // 肆之型・昇上砂塵嵐: coiled low, then two turns climbing up off the floor, the blade flung high at the top
  risingStorm: {
    dur: 0.95,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.36, 0], by: 0, hips: [0, 30, 0], chest: [14, 40, 0], spine: [16, 12, 0], head: [-18, -30, 0], thighL: [20, -10, 16], shinL: [50, 0, 0], thighR: [-24, -10, -16], shinR: [54, 0, 0], lh: 0, upperArmL: [0, 0, 70], foreArmL: [-20, 0, 0], sw: { tilt: 60, yaw: 0, a: -130, r: 0.5, off: -20, roll: 180 }, pole: [0, -0.4, 1] } },
      { t: 0.12, e: 'in', p: { chest: [16, 50, 0], sw: { a: -140 } } },
      { t: 0.5, e: 'linear', p: { by: -720, hp: [0, 0.22, 0], hips: [0, 0, 0], spine: [-6, 0, 0], chest: [-10, 0, 0], head: [10, 0, 0], thighL: [-40, 0, 10], shinL: [70, 0, 0], thighR: [-30, 0, -10], shinR: [60, 0, 0], upperArmL: [-10, 0, 80], sw: { tilt: 24, a: 60, r: 0.62, off: 10, roll: 0 }, pole: [-0.8, 0.2, -0.2] } },
      { t: 0.58, e: 'out', p: { by: -720, hp: [0, 0.3, 0], sw: { a: 96, r: 0.66, off: 0 } } },
      { t: 0.74, e: 'in', p: { by: -720, hp: [0, -0.22, 0.05], spine: [14, 0, 0], chest: [6, 0, 0], head: [-10, 0, 0], ...WIDE, sw: { a: 70 } } },
      { t: 0.95, e: 'inOut', p: { by: -720, hp: [0, -0.1, 0.02], spine: [6, -4, 0], chest: [4, -6, 0], head: [-6, 0, 0], sw: { tilt: 10, a: -40, r: 0.4, off: 60 } } },
    ],
  },
  // 伍之型・木枯颪: a crouch, a spring into the air, two turns falling with the blade out, a cut into the floor
  kogarashi: {
    dur: 1.05,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.34, -0.05], by: 0, spine: [20, 0, 0], chest: [10, -20, 0], head: [-20, 16, 0], thighL: [-50, -10, 12], shinL: [90, 0, 0], thighR: [-40, -10, -12], shinR: [86, 0, 0], lh: 1, sw: { tilt: 70, yaw: 0, a: 120, r: 0.44, off: 20, roll: 0 }, pole: [-0.9, 0.1, -0.2] } },
      { t: 0.14, e: 'in', p: { hp: [0, -0.42, -0.06], chest: [12, -26, 0] } },
      { t: 0.36, e: 'out', p: { hp: [0, 1.1, 0.4], bp: -10, spine: [-6, 0, 0], chest: [-6, 0, 0], head: [6, 0, 0], thighL: [-70, 0, 10], shinL: [110, 0, 0], thighR: [-80, 0, -10], shinR: [120, 0, 0], lh: 0, upperArmL: [20, 0, 80], foreArmL: [-10, 0, 0], sw: { tilt: 86, a: 100, r: 0.6, off: 10 } } },
      { t: 0.62, e: 'linear', p: { by: -720, hp: [0, 0.5, 0.6], bp: 10 } },
      { t: 0.7, e: 'snap', p: { by: -720, hp: [0, -0.4, 0.7], bp: 0, spine: [26, 0, 0], chest: [20, 30, 0], head: [-24, -20, 0], ...LUNGE, thighR: [-60, -6, -4], shinR: [80, 0, 0], sw: { tilt: 40, a: -70, r: 0.64, off: 4 }, pole: [-0.4, -1, 0.1] } },
      { t: 0.86, e: 'inOut', p: { by: -720, sw: { a: -76 } } },
      { t: 1.05, e: 'inOut', p: { by: -720, hp: [0, -0.14, 0.3], spine: [10, 0, 0], chest: [8, 10, 0], head: [-8, -6, 0], sw: { a: -52, off: 24 } } },
    ],
  },
  // 玖之型・韋馱天颱風: bent low with the blade drawn far back while the wind gathers; a whirling cut for each
  // turn of the storm; and the plunge that ends it
  typhoonReady: {
    dur: 0.8,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.4, -0.1], by: 0, hips: [0, -30, 0], spine: [24, -14, 0], chest: [12, -40, 0], head: [-20, 46, 0], thighL: [-36, -26, 16], shinL: [70, 0, 0], thighR: [34, -12, -16], shinR: [50, 0, 0], lh: 0, upperArmL: [-20, 0, 60], foreArmL: [-40, 0, 0], sw: { tilt: 80, yaw: 0, a: 130, r: 0.46, off: 30, roll: 0 }, pole: [-0.9, 0.1, -0.2] } },
      { t: 0.8, e: 'inOut', p: { hp: [0, -0.44, -0.12], chest: [14, -46, 0], sw: { a: 138 } } },
    ],
  },
  typhoonSpin: {
    dur: 0.26,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.2, 0.1], by: 0, spine: [20, 0, 0], chest: [14, 20, 0], head: [-20, -10, 0], ...LUNGE, lh: 0, upperArmL: [30, 0, 70], foreArmL: [-10, 0, 0], sw: { tilt: 84, yaw: 0, a: 100, r: 0.62, off: 6, roll: 0 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 0.2, e: 'linear', p: { by: -360, chest: [14, -10, 0] } },
      { t: 0.26, e: 'out', p: { by: -360, sw: { a: 92 } } },
    ],
  },
  typhoonDive: {
    dur: 1.0,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, 0.4, 0.2], bp: 20, by: 0, spine: [20, 0, 0], chest: [10, 0, 0], head: [-30, 0, 0], thighL: [-70, 0, 10], shinL: [110, 0, 0], thighR: [-80, 0, -10], shinR: [120, 0, 0], lh: 0, upperArmL: [40, 0, 80], foreArmL: [-10, 0, 0], sw: { tilt: 86, yaw: 0, a: 100, r: 0.62, off: 6, roll: 0 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 0.25, e: 'linear', p: { by: -720, hp: [0, 0.1, 0.4], bp: 10 } },
      { t: 0.32, e: 'snap', p: { by: -720, hp: [0, -0.42, 0.6], bp: 0, spine: [28, 0, 0], chest: [22, 30, 0], head: [-26, -20, 0], ...LUNGE, thighR: [-60, -6, -4], shinR: [80, 0, 0], sw: { tilt: 30, a: -80, r: 0.64, off: 2 }, pole: [-0.4, -1, 0.1] } },
      { t: 1.0, e: 'inOut', p: { by: -720, hp: [0, -0.3, 0.4], sw: { a: -84 } } },
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
// Gyomei (Stone Hashira): the hand axe in his right hand (swing-plane IK, like a sword), the chain in his left
// (free: the ball is steered by the moves' flail keys, see Flail); the arms pull and throw where the ball goes
// ---------------------------------------------------------------------------
export const FLAIL_STANCE = {
  hp: [0, -0.05, 0],
  hips: [0, 10, 0],
  spine: [4, -2, 0],
  chest: [2, -8, 0],
  neck: [0, 0, 0],
  head: [-4, 6, 0],
  thighL: [10, -8, 10],
  shinL: [16, 0, 0],
  footL: [-4, 10, 0],
  thighR: [-14, -10, -10],
  shinR: [18, 0, 0],
  footR: [0, -6, 0],
  upperArmL: [-36, 0, 22],
  foreArmL: [-46, 0, 0],
  handL: [0, 0, 0],
  lh: 0,
  sw: { w: 1, tilt: 0, yaw: -14, a: -16, r: 0.34, off: 98, roll: 0 },
  pole: [-0.6, -1, -0.2],
};

export const FLAIL_RUN = {
  hp: [0, -0.04, 0],
  hips: [0, 0, 0],
  spine: [16, 0, 0],
  chest: [8, 0, 0],
  head: [-14, 0, 0],
  upperArmL: [-16, 0, 18],
  foreArmL: [-60, 0, 0],
  thighL: [0, 0, 3],
  shinL: [10, 0, 0],
  thighR: [0, 0, -3],
  shinR: [10, 0, 0],
  lh: 0,
  sw: { w: 1, tilt: 8, yaw: -18, a: -100, r: 0.46, off: -60, roll: 0 },
  pole: [-0.6, -1, -0.2],
};

export const FLAIL_SPRINT = {
  ...FLAIL_RUN,
  spine: [26, 0, 0],
  chest: [10, 0, 0],
  head: [-24, 0, 0],
  upperArmL: [24, 0, 16],
  foreArmL: [-40, 0, 0],
  sw: { w: 1, tilt: 10, yaw: -22, a: -118, r: 0.46, off: -48, roll: 0 },
};

// the chain held taut across his front between his fists
export const FLAIL_GUARD = {
  hp: [0, -0.12, -0.02],
  spine: [8, 0, 0],
  chest: [2, 4, 0],
  head: [-8, -4, 0],
  thighL: [18, -8, 12],
  shinL: [30, 0, 0],
  thighR: [-18, -8, -12],
  shinR: [32, 0, 0],
  lh: 0,
  upperArmL: [-84, 20, 34],
  foreArmL: [-36, 0, 0],
  sw: { w: 1, tilt: 70, yaw: 0, a: 36, r: 0.42, off: -40, roll: 90 },
  pole: [-0.9, -0.4, 0.2],
};

const G_WIDE = { thighL: [12, -10, 16], shinL: [30, 0, 0], thighR: [-16, -10, -16], shinR: [32, 0, 0] };
const G_LUNGE = { thighL: [26, -6, 10], shinL: [36, 0, 0], footL: [-8, 0, 0], thighR: [-44, -8, -6], shinR: [50, 0, 0], footR: [-6, 0, 0] };

export const FLAIL_CLIPS = {
  // the ball swung round flat, from his right across to his left, the chain hauled after it
  light1: {
    dur: 0.66,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.08, 0], hips: [0, -20, 0], spine: [4, -14, 0], chest: [0, -40, 0], head: [-4, 34, 0], ...G_WIDE, lh: 0, upperArmL: [-60, -40, 0], foreArmL: [-30, 0, 0], sw: { tilt: 80, yaw: 0, a: 120, r: 0.4, off: 60, roll: 0 }, pole: [-0.9, 0, -0.2] } },
      { t: 0.14, e: 'in', p: { chest: [0, -48, 0], upperArmL: [-66, -46, 0], sw: { a: 132 } } },
      { t: 0.28, e: 'out', p: { hp: [0, -0.14, 0.12], hips: [0, 24, 0], spine: [8, 14, 0], chest: [6, 44, 0], head: [-8, -30, 0], ...G_LUNGE, upperArmL: [-40, 30, 60], foreArmL: [-10, 0, 0], sw: { a: -60, r: 0.56, off: 20 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 0.44, e: 'inOut', p: { chest: [4, 50, 0], upperArmL: [-30, 30, 70], sw: { a: -70 } } },
      { t: 0.66, e: 'inOut', p: { hp: [0, -0.08, 0.05], hips: [0, 10, 0], chest: [2, 10, 0], head: [-4, 0, 0], upperArmL: [-40, 0, 26], foreArmL: [-44, 0, 0], sw: { tilt: 20, a: -20, r: 0.36, off: 90 } } },
    ],
  },
  // ...and back again, from his left across to his right
  light2: {
    dur: 0.66,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.08, 0], hips: [0, 24, 0], spine: [4, 14, 0], chest: [2, 44, 0], head: [-4, -34, 0], ...G_WIDE, lh: 0, upperArmL: [-30, 30, 70], foreArmL: [-20, 0, 0], sw: { tilt: 80, yaw: 0, a: -70, r: 0.5, off: 10, roll: 0 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 0.14, e: 'in', p: { chest: [2, 52, 0], upperArmL: [-26, 30, 78], sw: { a: -80 } } },
      { t: 0.28, e: 'out', p: { hp: [0, -0.14, 0.12], hips: [0, -22, 0], spine: [8, -14, 0], chest: [6, -44, 0], head: [-8, 30, 0], ...G_LUNGE, upperArmL: [-70, -40, 0], foreArmL: [-20, 0, 0], sw: { a: 110, r: 0.52, off: 30 }, pole: [-0.9, 0, -0.2] } },
      { t: 0.44, e: 'inOut', p: { chest: [4, -50, 0], sw: { a: 120 } } },
      { t: 0.66, e: 'inOut', p: { hp: [0, -0.08, 0.05], hips: [0, 10, 0], chest: [2, -8, 0], head: [-4, 6, 0], upperArmL: [-36, 0, 22], foreArmL: [-46, 0, 0], sw: { tilt: 0, a: -16, r: 0.34, off: 98 } } },
    ],
  },
  // a short chop with the axe
  light3: {
    dur: 0.5,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.08, 0], chest: [-8, -30, 0], spine: [-2, -10, 0], head: [-4, 24, 0], lh: 0, upperArmL: [-30, 0, 30], foreArmL: [-50, 0, 0], sw: { tilt: 30, yaw: 0, a: 140, r: 0.4, off: 10, roll: 0 }, pole: [-0.8, -0.2, 0] } },
      { t: 0.07, e: 'snap', p: { chest: [-10, -36, 0], sw: { a: 150, off: 14 } } },
      { t: 0.15, e: 'out', p: { hp: [0, -0.16, 0.1], chest: [16, 26, 0], spine: [10, 10, 0], head: [-12, -20, 0], ...G_LUNGE, sw: { a: -50, r: 0.58, off: 4 }, pole: [-0.5, -1, -0.2] } },
      { t: 0.32, e: 'inOut', p: { sw: { a: -56 } } },
      { t: 0.5, e: 'inOut', p: { sw: { a: -40, off: 50 } } },
    ],
  },
  // the ball swung up overhead and brought down in front of him
  light4: {
    dur: 0.9,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.06, -0.04], chest: [-6, -24, 0], spine: [-4, -8, 0], head: [-2, 18, 0], ...G_WIDE, lh: 0, upperArmL: [-60, 0, 50], foreArmL: [-30, 0, 0], sw: { tilt: 20, yaw: 0, a: 120, r: 0.4, off: 40, roll: 0 }, pole: [-0.8, 0.2, -0.3] } },
      { t: 0.24, e: 'inOut', p: { hp: [0, 0.02, -0.06], spine: [-10, 0, 0], chest: [-16, -6, 0], head: [10, 0, 0], upperArmL: [-160, 0, 20], foreArmL: [-20, 0, 0], sw: { a: 150, off: 20 } } },
      { t: 0.44, e: 'snap', p: { hp: [0, -0.28, 0.2], spine: [24, 0, 0], chest: [22, 6, 0], head: [-24, 0, 0], ...G_LUNGE, upperArmL: [-40, 0, 20], foreArmL: [-10, 0, 0], sw: { a: -40, r: 0.56, off: 10 }, pole: [-0.5, -1, 0] } },
      { t: 0.64, e: 'inOut', p: { hp: [0, -0.24, 0.18] } },
      { t: 0.9, e: 'inOut', p: { hp: [0, -0.08, 0.06], spine: [6, 0, 0], chest: [2, -6, 0], head: [-4, 4, 0], upperArmL: [-36, 0, 22], foreArmL: [-46, 0, 0], sw: { a: -16, r: 0.34, off: 98 } } },
    ],
  },
  // a full turn of the ball round him, flat, at arm's length and the chain's
  heavy: {
    dur: 0.9,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.12, 0], hips: [0, -26, 0], spine: [6, -16, 0], chest: [4, -44, 0], head: [-6, 34, 0], ...G_WIDE, lh: 0, upperArmL: [-70, -40, 0], foreArmL: [-20, 0, 0], sw: { tilt: 80, yaw: 0, a: 130, r: 0.44, off: 60, roll: 0 }, pole: [-0.9, 0, -0.2] } },
      { t: 0.2, e: 'inOut', p: { hips: [0, -6, 0], chest: [4, -10, 0], head: [-6, 10, 0], upperArmL: [-80, 0, 20], sw: { a: 60 } } },
      { t: 0.36, e: 'inOut', p: { hp: [0, -0.16, 0.06], hips: [0, 24, 0], chest: [6, 46, 0], head: [-8, -30, 0], upperArmL: [-40, 30, 70], sw: { a: -80, r: 0.54, off: 20 } } },
      { t: 0.56, e: 'inOut', p: { hips: [0, 30, 0], chest: [6, 60, 0], upperArmL: [-20, 30, 80], sw: { a: -110 } } },
      { t: 0.9, e: 'inOut', p: { hp: [0, -0.08, 0.02], hips: [0, 10, 0], spine: [4, -2, 0], chest: [2, -8, 0], head: [-4, 6, 0], upperArmL: [-36, 0, 22], foreArmL: [-46, 0, 0], sw: { tilt: 0, a: -16, r: 0.34, off: 98 } } },
    ],
  },
  // winding up the charged heavy: the ball whirling over his head on its chain
  thrustCharge: {
    dur: 0.6,
    loop: false,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.1, -0.04], hips: [0, -10, 0], spine: [-4, -4, 0], chest: [-8, -10, 0], head: [-2, 8, 0], ...G_WIDE, lh: 0, upperArmL: [-170, 0, 10], foreArmL: [-10, 0, 0], sw: { tilt: 20, yaw: -10, a: -30, r: 0.34, off: 100, roll: 0 }, pole: [-0.6, -1, -0.2] } },
      { t: 0.6, e: 'inOut', p: { hp: [0, -0.12, -0.05], chest: [-10, -12, 0] } },
    ],
  },
  // 貳之型・天面碎: the ball flung high overhead, a stamp on the chain, and down it comes on the foe's head
  tenmen: {
    dur: 1.0,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.12, -0.05], hips: [0, -10, 0], spine: [-4, -4, 0], chest: [-8, -10, 0], head: [-2, 8, 0], ...G_WIDE, lh: 0, upperArmL: [-170, 0, 10], foreArmL: [-10, 0, 0], sw: { tilt: 20, yaw: -10, a: -30, r: 0.34, off: 100, roll: 0 } } },
      { t: 0.14, e: 'out', p: { hp: [0, 0.02, 0.04], spine: [-12, 0, 0], chest: [-14, 0, 0], head: [16, 0, 0], upperArmL: [-150, 0, 20], foreArmL: [-4, 0, 0], sw: { a: 100, r: 0.5, off: 0 } } },
      { t: 0.4, e: 'inOut', p: { hp: [0, -0.02, 0], thighR: [-60, -10, -10], shinR: [70, 0, 0], head: [20, 0, 0] } },
      { t: 0.47, e: 'snap', p: { hp: [0, -0.22, 0.1], spine: [18, 0, 0], chest: [14, 0, 0], head: [-6, 0, 0], thighR: [-20, -10, -14], shinR: [30, 0, 0], footR: [10, 0, 0], upperArmL: [-60, 0, 30], foreArmL: [-20, 0, 0], sw: { a: -20, r: 0.5, off: 40 } } },
      { t: 0.58, e: 'out', p: { hp: [0, -0.26, 0.12], spine: [22, 0, 0], head: [-18, 0, 0] } },
      { t: 1.0, e: 'inOut', p: { hp: [0, -0.08, 0.04], spine: [4, -2, 0], chest: [2, -8, 0], head: [-4, 6, 0], thighR: [-14, -10, -10], shinR: [18, 0, 0], footR: [0, -6, 0], upperArmL: [-36, 0, 22], foreArmL: [-46, 0, 0], sw: { tilt: 0, a: -16, r: 0.34, off: 98 } } },
    ],
  },
  // 壹之型・蛇紋岩・雙極: ball and axe let fly together, out wide either side, to meet on the foe
  dualPoles: {
    dur: 0.9,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.12, -0.04], spine: [-2, 0, 0], chest: [-8, 0, 0], head: [-2, 0, 0], ...G_WIDE, lh: 0, upperArmL: [-40, 0, 80], foreArmL: [-30, 0, 0], sw: { tilt: 86, yaw: 0, a: 110, r: 0.46, off: 40, roll: 0 }, pole: [-0.9, 0, -0.2] } },
      { t: 0.12, e: 'in', p: { chest: [-12, 0, 0], upperArmL: [-30, 0, 96], sw: { a: 124 } } },
      { t: 0.26, e: 'out', p: { hp: [0, -0.2, 0.14], spine: [14, 0, 0], chest: [12, 0, 0], head: [-14, 0, 0], ...G_LUNGE, upperArmL: [-90, 0, 30], foreArmL: [-6, 0, 0], sw: { a: 20, r: 0.64, off: 0 }, pole: [-0.5, -1, 0] } },
      { t: 0.5, e: 'inOut', p: { upperArmL: [-80, 0, 20], sw: { a: 10 } } },
      { t: 0.9, e: 'inOut', p: { hp: [0, -0.08, 0.04], spine: [4, -2, 0], chest: [2, -8, 0], head: [-4, 6, 0], upperArmL: [-36, 0, 22], foreArmL: [-46, 0, 0], sw: { tilt: 0, a: -16, r: 0.34, off: 98 } } },
    ],
  },
  // 參之型・岩軀之膚: ball and axe wheeling round him on the chain, turning with them
  stoneSkin: {
    dur: 1.2,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.16, 0], by: 0, hips: [0, 10, 0], spine: [8, 0, 0], chest: [6, 0, 0], head: [-6, 0, 0], ...G_WIDE, lh: 0, upperArmL: [-20, 0, 86], foreArmL: [-10, 0, 0], sw: { tilt: 86, yaw: 0, a: 96, r: 0.6, off: 20, roll: 0 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 1.0, e: 'linear', p: { by: -1080 } },
      { t: 1.2, e: 'out', p: { by: -1080, hp: [0, -0.08, 0.02], hips: [0, 10, 0], spine: [4, -2, 0], chest: [2, -8, 0], head: [-4, 6, 0], upperArmL: [-36, 0, 22], foreArmL: [-46, 0, 0], sw: { tilt: 0, a: -16, r: 0.34, off: 98 } } },
    ],
  },
  // 肆之型・流紋岩・速征: advancing, ball and axe hurled out and hauled back by turns
  rhyolite: {
    dur: 1.2,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.16, 0.04], spine: [14, 0, 0], chest: [8, 20, 0], head: [-10, -14, 0], ...G_LUNGE, lh: 0, upperArmL: [-90, 0, 30], foreArmL: [-20, 0, 0], sw: { tilt: 60, yaw: 0, a: 40, r: 0.4, off: 10, roll: 0 }, pole: [-0.5, -1, 0] } },
      { t: 0.14, e: 'out', p: { chest: [10, -20, 0], head: [-10, 14, 0], upperArmL: [-100, 0, 20], foreArmL: [-4, 0, 0], sw: { a: 10, r: 0.62 } } },
      { t: 0.26, e: 'out', p: { chest: [10, 24, 0], head: [-10, -16, 0], upperArmL: [-60, 0, 40], foreArmL: [-50, 0, 0], sw: { a: -10, r: 0.62 } } },
      { t: 0.38, e: 'out', p: { chest: [10, -20, 0], head: [-10, 14, 0], upperArmL: [-100, 0, 20], foreArmL: [-4, 0, 0], sw: { a: 30, r: 0.4 } } },
      { t: 0.5, e: 'out', p: { chest: [10, 24, 0], head: [-10, -16, 0], upperArmL: [-60, 0, 40], foreArmL: [-50, 0, 0], sw: { a: -10, r: 0.62 } } },
      { t: 0.62, e: 'out', p: { chest: [10, -20, 0], head: [-10, 14, 0], upperArmL: [-100, 0, 20], foreArmL: [-4, 0, 0], sw: { a: 30, r: 0.4 } } },
      { t: 0.74, e: 'out', p: { chest: [10, 24, 0], head: [-10, -16, 0], upperArmL: [-60, 0, 40], foreArmL: [-50, 0, 0], sw: { a: -10, r: 0.62 } } },
      { t: 0.88, e: 'inOut', p: { hp: [0, -0.04, 0.02], spine: [-10, 0, 0], chest: [-14, 0, 0], head: [12, 0, 0], upperArmL: [-165, 0, 12], foreArmL: [-10, 0, 0], sw: { tilt: 20, a: 120, r: 0.46, off: 30 } } },
      { t: 1.0, e: 'snap', p: { hp: [0, -0.3, 0.22], spine: [26, 0, 0], chest: [22, 0, 0], head: [-26, 0, 0], upperArmL: [-40, 0, 20], foreArmL: [-10, 0, 0], sw: { a: -40, r: 0.56, off: 10 }, pole: [-0.5, -1, 0] } },
      { t: 1.2, e: 'inOut', p: { hp: [0, -0.1, 0.1], spine: [8, 0, 0], chest: [4, -6, 0], head: [-6, 4, 0], upperArmL: [-36, 0, 22], foreArmL: [-46, 0, 0], sw: { tilt: 0, a: -16, r: 0.34, off: 98 } } },
    ],
  },
  // 伍之型・瓦輪刑部: gathered low, then up into the air, hurling the ball and the axe down by turns
  garinReady: {
    dur: 0.8,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.3, -0.06], hips: [0, 0, 0], spine: [18, 0, 0], chest: [8, 0, 0], head: [-14, 0, 0], thighL: [-30, -14, 16], shinL: [70, 0, 0], thighR: [-30, -14, -16], shinR: [70, 0, 0], lh: 0, upperArmL: [-10, 0, 60], foreArmL: [-40, 0, 0], sw: { tilt: 80, yaw: 0, a: 120, r: 0.46, off: 40, roll: 0 }, pole: [-0.9, 0, -0.2] } },
      { t: 0.8, e: 'inOut', p: { hp: [0, -0.36, -0.08], spine: [22, 0, 0] } },
    ],
  },
  garinThrowA: {
    dur: 0.24,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, 0, 0], spine: [-8, 0, 0], chest: [-10, -20, 0], head: [20, 14, 0], thighL: [-50, 0, 10], shinL: [90, 0, 0], thighR: [-30, 0, -10], shinR: [70, 0, 0], lh: 0, upperArmL: [-160, 0, 20], foreArmL: [-10, 0, 0], sw: { tilt: 20, yaw: 0, a: 120, r: 0.46, off: 30, roll: 0 }, pole: [-0.8, 0.2, -0.3] } },
      { t: 0.1, e: 'out', p: { spine: [20, 0, 0], chest: [20, 16, 0], head: [-20, -10, 0], upperArmL: [-30, 0, 30], foreArmL: [-6, 0, 0] } },
      { t: 0.24, e: 'inOut', p: { chest: [18, 20, 0] } },
    ],
  },
  garinThrowB: {
    dur: 0.24,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, 0, 0], spine: [-8, 0, 0], chest: [-10, 20, 0], head: [20, -14, 0], thighL: [-30, 0, 10], shinL: [70, 0, 0], thighR: [-50, 0, -10], shinR: [90, 0, 0], lh: 0, upperArmL: [-90, 0, 60], foreArmL: [-40, 0, 0], sw: { tilt: 20, yaw: 0, a: 160, r: 0.5, off: 10, roll: 0 }, pole: [-0.8, 0.2, -0.3] } },
      { t: 0.1, e: 'out', p: { spine: [20, 0, 0], chest: [20, -16, 0], head: [-20, 10, 0], upperArmL: [-60, 0, 40], sw: { a: -40, r: 0.62, off: 0 } } },
      { t: 0.24, e: 'inOut', p: { chest: [18, -20, 0] } },
    ],
  },
  garinLand: {
    dur: 0.9,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.46, 0.06], bp: 0, spine: [30, 0, 0], chest: [12, 0, 0], head: [-26, 0, 0], thighL: [-70, -10, 20], shinL: [110, 0, 0], thighR: [-20, -10, -30], shinR: [120, 0, 0], footR: [20, 0, 0], lh: 0, upperArmL: [-40, 0, 60], foreArmL: [-20, 0, 0], sw: { tilt: 40, yaw: 0, a: -60, r: 0.56, off: 10, roll: 0 }, pole: [-0.5, -1, 0] } },
      { t: 0.4, e: 'inOut', p: { hp: [0, -0.4, 0.06] } },
      { t: 0.9, e: 'inOut', p: { ...FLAIL_STANCE } },
    ],
  },
  // reactions and the like: the swordsmen's, ending in his own stance
  dodgeF: SWORD_CLIPS.dodgeF,
  dodgeB: SWORD_CLIPS.dodgeB,
  dodgeL: SWORD_CLIPS.dodgeL,
  dodgeR: SWORD_CLIPS.dodgeR,
  parry: SWORD_CLIPS.parry,
  hitLight: SWORD_CLIPS.hitLight,
  knockdown: SWORD_CLIPS.knockdown,
  death: SWORD_CLIPS.death,
  fall: SWORD_CLIPS.fall,
  blockHit: {
    dur: 0.3,
    keys: [
      { t: 0, e: 'snap', p: { ...FLAIL_GUARD, hp: [0, -0.16, -0.08], chest: [-12, 4, 0] } },
      { t: 0.3, e: 'inOut', p: { ...FLAIL_GUARD } },
    ],
  },
  getup: {
    dur: 0.55,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.72, -0.2], bp: -80, lh: 0, sw: { tilt: 30, a: -80, r: 0.55, off: -30 } } },
      { t: 0.25, e: 'inOut', p: { hp: [0, -0.5, 0], bp: 10, spine: [40, 0, 0], chest: [10, 0, 0], thighL: [-90, 0, 10], shinL: [120, 0, 0], thighR: [-30, 0, -20], shinR: [110, 0, 0] } },
      { t: 0.55, e: 'inOut', p: { ...FLAIL_STANCE, bp: 0 } },
    ],
  },
  landing: {
    dur: 0.6,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.48, 0], spine: [30, 0, 0], chest: [10, 0, 0], head: [-26, 0, 0], thighL: [-70, 0, 20], shinL: [110, 0, 0], thighR: [-20, 0, -30], shinR: [120, 0, 0], footR: [20, 0, 0], lh: 0, upperArmL: [0, 0, 50], foreArmL: [-10, 0, 0], sw: { tilt: 40, yaw: -20, a: -140, r: 0.55, off: -20 } } },
      { t: 0.35, e: 'inOut', p: { hp: [0, -0.46, 0] } },
      { t: 0.6, e: 'inOut', p: { ...FLAIL_STANCE } },
    ],
  },
  // standing tall and still, the axe held upright before his chest, the ball hanging from his lowered left hand
  victory: {
    dur: 1.2,
    keys: [
      { t: 0, e: 'out', p: { ...FLAIL_STANCE } },
      { t: 0.5, e: 'inOut', p: { hp: [0, -0.02, 0], hips: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [8, 0, 0], thighL: [0, 0, 6], shinL: [4, 0, 0], thighR: [0, 0, -6], shinR: [4, 0, 0], lh: 0, upperArmL: [4, 0, 12], foreArmL: [-10, 0, 0], handL: [0, 0, 0], sw: { tilt: 0, yaw: -42, a: -58, r: 0.44, off: 146, roll: -90 }, pole: [-0.6, -1, -0.2] } },
      { t: 1.2, e: 'inOut', p: { head: [12, 0, 0] } },
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
  // 腳式・流閃群光: right roundhouse, left roundhouse, then straight up -- each knee drawn up first
  kickFlurry: {
    dur: 1.15,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.1, -0.02], hips: [0, 14, 0], spine: [0, -6, 10], chest: [-4, 20, 0], head: [-4, -18, 0], thighL: [-6, 0, 10], shinL: [24, 0, 0], footL: [-4, 12, 0], thighR: [-74, 0, -52], shinR: [116, 0, 0], footR: [24, 0, 0], upperArmL: [-60, 10, 40], foreArmL: [-100, 0, 0], upperArmR: [-20, 0, -62], foreArmR: [-80, 0, 0] } },
      { t: 0.1, e: 'out', p: { hp: [0, -0.06, 0.06], hips: [0, -36, 0], spine: [-10, -10, 24], chest: [-6, -16, 0], head: [0, 22, -10], thighR: [-70, -20, -84], shinR: [4, 0, 0], footR: [-10, 0, 0], upperArmL: [-40, 0, 64], upperArmR: [14, 0, -72] } },
      { t: 0.28, e: 'out', p: { hp: [0, -0.12, 0.08], hips: [0, -14, 0], spine: [0, 6, -10], chest: [-4, -20, 0], head: [-4, 18, 0], thighR: [-8, 0, -10], shinR: [26, 0, 0], footR: [-4, -12, 0], thighL: [-74, 0, 52], shinL: [116, 0, 0], footL: [24, 0, 0], upperArmR: [-60, -10, -40], foreArmR: [-100, 0, 0], upperArmL: [-20, 0, 62], foreArmL: [-80, 0, 0] } },
      { t: 0.38, e: 'out', p: { hp: [0, -0.06, 0.14], hips: [0, 36, 0], spine: [-10, 10, -24], chest: [-6, 16, 0], head: [0, -22, 10], thighL: [-70, 20, 84], shinL: [4, 0, 0], footL: [-10, 0, 0], upperArmR: [-40, 0, -64], upperArmL: [14, 0, 72] } },
      { t: 0.56, e: 'out', p: { hp: [0, -0.18, 0.16], hips: [0, 8, 0], spine: [12, 0, 0], chest: [10, 6, 0], head: [-12, 0, 0], thighL: [-12, 0, 8], shinL: [34, 0, 0], footL: [-6, 0, 0], thighR: [-112, 0, -8], shinR: [120, 0, 0], footR: [24, 0, 0], upperArmL: [-70, 10, 12], foreArmL: [-60, 0, 0], upperArmR: [-40, 0, -30], foreArmR: [-100, 0, 0] } },
      { t: 0.68, e: 'out', p: { hp: [0, -0.02, 0.22], spine: [-20, 0, 0], chest: [-14, 0, 0], head: [12, 0, 0], thighR: [-160, 0, -6], shinR: [0, 0, 0], footR: [-24, 0, 0], thighL: [8, 0, 6], shinL: [12, 0, 0], upperArmL: [-10, 0, 52], foreArmL: [-40, 0, 0], upperArmR: [12, 0, -52], foreArmR: [-40, 0, 0] } },
      { t: 0.9, e: 'inOut', p: { thighR: [-120, 0, -8], shinR: [40, 0, 0] } },
      { t: 1.15, e: 'inOut', p: { ...AKAZA_STANCE } },
    ],
  },
  // 腳式・飛遊星千輪: down into a crouch, up into a forward somersault, heels first onto the mark
  flipKick: {
    dur: 1.2,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.48, -0.06], hips: [0, 0, 0], spine: [26, 0, 0], chest: [24, 0, 0], head: [-28, 0, 0], thighL: [-80, 0, 14], shinL: [126, 0, 0], footL: [-22, 0, 0], thighR: [-62, 0, -14], shinR: [112, 0, 0], footR: [-22, 0, 0], upperArmL: [52, 0, 26], foreArmL: [-20, 0, 0], upperArmR: [52, 0, -26], foreArmR: [-20, 0, 0] } },
      { t: 0.12, e: 'linear', p: { hp: [0, 0.9, 0.05], bp: 50, spine: [34, 0, 0], chest: [24, 0, 0], head: [-12, 0, 0], thighL: [-124, 0, 10], shinL: [134, 0, 0], thighR: [-124, 0, -10], shinR: [134, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0], upperArmL: [-64, 0, 30], foreArmL: [-96, 0, 0], upperArmR: [-64, 0, -30], foreArmR: [-96, 0, 0] } },
      { t: 0.3, e: 'linear', p: { hp: [0, 1.5, 0.1], bp: 205 } },
      { t: 0.44, e: 'in', p: { hp: [0, 0.95, 0.12], bp: 318, spine: [-12, 0, 0], chest: [-12, 0, 0], head: [22, 0, 0], thighL: [-168, 0, 12], shinL: [0, 0, 0], thighR: [-156, 0, -12], shinR: [0, 0, 0], footL: [-30, 0, 0], footR: [-30, 0, 0], upperArmL: [34, 0, 64], foreArmL: [-10, 0, 0], upperArmR: [34, 0, -64], foreArmR: [-10, 0, 0] } },
      { t: 0.52, e: 'out', p: { hp: [0, -0.38, 0.12], bp: 360, spine: [32, 0, 0], chest: [26, 0, 0], head: [-32, 0, 0], thighL: [-42, 0, 16], shinL: [72, 0, 0], thighR: [-92, 0, -14], shinR: [124, 0, 0], footL: [0, 0, 0], footR: [-20, 0, 0], upperArmL: [22, 0, 42], foreArmL: [-40, 0, 0], upperArmR: [22, 0, -42], foreArmR: [-40, 0, 0] } },
      { t: 0.9, e: 'inOut', p: { hp: [0, -0.32, 0.1] } },
      { t: 1.2, e: 'inOut', p: { ...AKAZA_STANCE, bp: 360 } },
    ],
  },
  // 破壞殺・鬼芯八重芯: both fists low at the hips, then eight blows, straight, hook and rising, left and right
  eightCore: {
    dur: 1.25,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.3, -0.06], hips: [0, 10, 0], spine: [12, 0, 0], chest: [10, -8, 0], head: [-14, 0, 0], thighL: [-40, -10, 22], shinL: [60, 0, 0], thighR: [10, -10, -24], shinR: [50, 0, 0], upperArmL: [22, 0, 30], foreArmL: [-132, 0, 0], upperArmR: [22, 0, -30], foreArmR: [-132, 0, 0] } },
      { t: 0.08, e: 'out', p: { hp: [0, -0.26, 0.06], chest: [6, 26, 0], upperArmL: [-92, 0, -6], foreArmL: [-4, 0, 0], upperArmR: [-20, 0, -30], foreArmR: [-120, 0, 0] } },
      { t: 0.16, e: 'out', p: { chest: [6, -26, 0], upperArmR: [-92, 0, 6], foreArmR: [-4, 0, 0], upperArmL: [-20, 0, 30], foreArmL: [-120, 0, 0] } },
      { t: 0.24, e: 'out', p: { chest: [6, -38, 0], upperArmL: [-90, -60, 40], foreArmL: [-90, 0, 0], upperArmR: [-30, 0, -30], foreArmR: [-120, 0, 0] } },
      { t: 0.32, e: 'out', p: { chest: [6, 38, 0], upperArmR: [-90, 60, -40], foreArmR: [-90, 0, 0], upperArmL: [-30, 0, 30], foreArmL: [-120, 0, 0] } },
      { t: 0.4, e: 'out', p: { hp: [0, -0.16, 0.12], chest: [-16, -16, 0], upperArmL: [-160, 0, 0], foreArmL: [-30, 0, 0], upperArmR: [-20, 0, -30], foreArmR: [-120, 0, 0] } },
      { t: 0.48, e: 'out', p: { hp: [0, -0.24, 0.14], chest: [6, -26, 0], upperArmR: [-92, 0, 6], foreArmR: [-4, 0, 0], upperArmL: [-20, 0, 30], foreArmL: [-120, 0, 0] } },
      { t: 0.56, e: 'out', p: { chest: [6, 26, 0], upperArmL: [-92, 0, -6], foreArmL: [-4, 0, 0], upperArmR: [-20, 0, -30], foreArmR: [-120, 0, 0] } },
      { t: 0.6, e: 'in', p: { chest: [-4, -40, 0], upperArmR: [0, 0, -30], foreArmR: [-124, 0, 0], upperArmL: [-40, 0, 20], foreArmL: [-110, 0, 0] } },
      { t: 0.66, e: 'out', p: { hp: [0, -0.32, 0.36], hips: [0, -10, 0], chest: [12, 42, 0], spine: [8, 16, 0], upperArmR: [-90, 0, 10], foreArmR: [0, 0, 0], thighR: [10, -10, -14], shinR: [20, 0, 0] } },
      { t: 0.95, e: 'inOut', p: {} },
      { t: 1.25, e: 'inOut', p: { ...AKAZA_STANCE } },
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
// Kokushibo (Moon Breathing): upright and unhurried, the blade held low in one hand. The big second-state
// forms take it in both.
// ---------------------------------------------------------------------------
export const KOKUSHIBO_STANCE = {
  hp: [0, -0.03, 0],
  hips: [0, 8, 0],
  spine: [2, -3, 0],
  chest: [0, -6, 0],
  neck: [0, 0, 0],
  head: [-3, 2, 0],
  thighL: [6, -6, 5], shinL: [8, 0, 0], footL: [-2, 8, 0],
  thighR: [-8, -8, -5], shinR: [10, 0, 0], footR: [0, -4, 0],
  upperArmL: [6, 0, 9], foreArmL: [-16, 0, 0], handL: [0, 0, 0],
  lh: 0,
  sw: { w: 1, tilt: 14, yaw: -24, a: -64, r: 0.55, off: 30, roll: 0 },
  pole: [-0.5, -1, -0.2],
};

export const KOKUSHIBO_RUN = {
  hp: [0, -0.05, 0],
  hips: [0, 0, 0],
  spine: [16, 0, 0],
  chest: [6, 0, 0],
  head: [-14, 0, 0],
  upperArmL: [-6, 0, 12],
  foreArmL: [-40, 0, 0],
  sw: { w: 1, tilt: 8, yaw: -18, a: -108, r: 0.52, off: -40, roll: 0 },
  pole: [-0.6, -1, -0.2],
};

// the second state: the grown blade trails behind him, point just off the boards
export const KOKUSHIBO_STANCE2 = {
  ...KOKUSHIBO_STANCE,
  hp: [0, -0.06, 0],
  chest: [2, -10, 0],
  sw: { w: 1, tilt: 12, yaw: -30, a: -118, r: 0.52, off: -52, roll: 0 },
  pole: [-0.6, -1, -0.1],
};

export const KOKUSHIBO_RUN2 = {
  ...KOKUSHIBO_RUN,
  sw: { w: 1, tilt: 10, yaw: -26, a: -122, r: 0.52, off: -50, roll: 0 },
};

const K_LEFT_FREE = { lh: 0, upperArmL: [20, 0, 36], foreArmL: [-30, 0, 0] };
const K_WIDE = { thighL: [12, -10, 16], shinL: [30, 0, 0], thighR: [-16, -10, -16], shinR: [32, 0, 0] };
const K_LUNGE = { thighL: [30, -6, 8], shinL: [40, 0, 0], footL: [-10, 0, 0], thighR: [-50, -8, -4], shinR: [56, 0, 0], footR: [-8, 0, 0] };

export const KOKUSHIBO_CLIPS = {
  taunt: {
    dur: 2.4,
    keys: [
      { t: 0, e: 'inOut', p: { ...KOKUSHIBO_STANCE, head: [10, 0, 0] } },
      { t: 1.4, e: 'inOut', p: { head: [2, 4, 0] } },
      { t: 2.4, e: 'inOut', p: { head: [-4, 0, 0] } },
    ],
  },
  hit: {
    dur: 0.34,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.1, -0.08], spine: [-12, 0, 6], chest: [-10, 12, 0], head: [-14, 0, 8], ...K_LEFT_FREE, sw: { tilt: 20, a: -96, r: 0.52, off: -10 } } },
      { t: 0.34, e: 'inOut', p: { ...KOKUSHIBO_STANCE } },
    ],
  },
  stagger: {
    dur: 2.2,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.16, -0.16], spine: [-18, 0, 8], chest: [-16, 18, 0], head: [-24, 0, 10], ...K_LEFT_FREE, sw: { tilt: 20, a: -120, r: 0.5, off: -30 } } },
      { t: 0.5, e: 'out', p: { hp: [0, -0.46, 0], spine: [34, 0, 0], chest: [16, 0, 0], head: [8, 0, 0], thighL: [-70, 0, 10], shinL: [90, 0, 0], thighR: [0, 0, -10], shinR: [96, 0, 0], sw: { tilt: 0, a: -90, r: 0.55, off: -8 } } },
      { t: 1.9, e: 'inOut', p: { hp: [0, -0.44, 0] } },
      { t: 2.2, e: 'inOut', p: { ...KOKUSHIBO_STANCE } },
    ],
  },
  // down on one knee, the blade planted point-first in the boards
  kneel: {
    dur: 0.8,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.2, -0.1], spine: [-10, 0, 0], chest: [-12, 0, 0], head: [-10, 0, 0], ...K_LEFT_FREE } },
      { t: 0.8, e: 'inOut', p: { hp: [0, -0.52, 0], spine: [26, 0, 0], chest: [12, 0, 0], head: [22, 0, 0], thighL: [-84, 0, 8], shinL: [86, 0, 0], footL: [0, 0, 0], thighR: [4, 0, -8], shinR: [100, 0, 0], footR: [-30, 0, 0], upperArmL: [-20, 0, 20], foreArmL: [-60, 0, 0], sw: { tilt: 0, yaw: -10, a: -20, r: 0.5, off: -64, roll: 0 } } },
    ],
  },
  // headless, the body still on its feet: slack arms, the sword hanging
  deathStand: {
    dur: 1.2,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.3, 0], spine: [10, 0, 0], chest: [6, 0, 0], ...K_LEFT_FREE, sw: { tilt: 10, yaw: -20, a: -92, r: 0.56, off: -4 } } },
      { t: 1.2, e: 'inOut', p: { hp: [0, -0.12, 0], spine: [-4, 0, 0], chest: [-8, 0, 0], upperArmL: [0, 0, 18], foreArmL: [-8, 0, 0], sw: { a: -84 } } },
    ],
  },
  // 透明的世界: reads the blow and slips half a step aside
  counterGuard: {
    dur: 0.3,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.12, -0.06], hips: [0, -30, 0], chest: [-6, -30, 0], head: [-4, 30, 0], ...K_LEFT_FREE, sw: { tilt: 80, yaw: 0, a: -120, r: 0.4, off: -20, roll: 180 }, pole: [0.2, -0.4, 0.9] } },
      { t: 0.3, e: 'inOut', p: { chest: [-4, -34, 0] } },
    ],
  },
  // a step aside, low and quick (reading a technique): to his left, and to his right
  stepL: {
    dur: 0.4,
    keys: [
      { t: 0, e: 'out', p: { hp: [0.06, -0.16, 0], spine: [4, 0, 12], chest: [0, 8, 6], head: [0, -8, -8], thighL: [-6, 0, 30], shinL: [30, 0, 0], thighR: [-10, 0, 4], shinR: [40, 0, 0], ...K_LEFT_FREE, sw: { tilt: 14, yaw: -24, a: -80, r: 0.52, off: 10 } } },
      { t: 0.4, e: 'inOut', p: { ...KOKUSHIBO_STANCE } },
    ],
  },
  stepR: {
    dur: 0.4,
    keys: [
      { t: 0, e: 'out', p: { hp: [-0.06, -0.16, 0], spine: [4, 0, -12], chest: [0, -8, -6], head: [0, 8, 8], thighR: [-6, 0, -30], shinR: [30, 0, 0], thighL: [-10, 0, -4], shinL: [40, 0, 0], ...K_LEFT_FREE, sw: { tilt: 14, yaw: -24, a: -80, r: 0.52, off: 10 } } },
      { t: 0.4, e: 'inOut', p: { ...KOKUSHIBO_STANCE } },
    ],
  },
  // chiburi: the blade flicked clean and lowered -- the opening after a string of cuts
  chiburi: {
    dur: 0.85,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.06, 0], chest: [-4, -10, 0], head: [-2, 6, 0], ...K_LEFT_FREE, sw: { tilt: 30, yaw: -30, a: 36, r: 0.5, off: 16, roll: 0 } } },
      { t: 0.14, e: 'snap', p: { chest: [4, 8, 0], sw: { a: -84, off: -8 } } },
      { t: 0.5, e: 'inOut', p: { sw: { a: -80, off: 4 } } },
      { t: 0.85, e: 'inOut', p: { ...KOKUSHIBO_STANCE } },
    ],
  },
  // a straight thrust: the blade drawn back flat along his right side, point on the target, then driven home
  thrust: {
    dur: 0.95,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.22, -0.1], hips: [0, -26, 0], chest: [4, -32, 0], spine: [4, -10, 0], head: [-6, 32, 0], ...K_WIDE, lh: 0, upperArmL: [-78, 0, 12], foreArmL: [-12, 0, 0], sw: { tilt: 90, yaw: 0, a: 118, r: 0.42, off: -118, roll: 90 }, pole: [-0.6, -1, -0.2] } },
      { t: 0.3, e: 'in', p: { chest: [6, -38, 0], sw: { a: 128, off: -128 } } },
      { t: 0.4, e: 'out', p: { hp: [0, -0.3, 0.36], hips: [0, 18, 0], chest: [14, 20, 0], spine: [10, 8, 0], head: [-14, -18, 0], ...K_LUNGE, upperArmL: [30, 0, 44], foreArmL: [-20, 0, 0], sw: { a: 4, r: 0.7, off: -4 } } },
      { t: 0.62, e: 'inOut', p: { sw: { a: 8, off: -2 } } },
      { t: 0.95, e: 'inOut', p: { hp: [0, -0.12, 0.2], sw: { a: -40, off: 20 } } },
    ],
  },
  // ----------------------------------------------------------- plain cuts (one hand)
  slashA: {
    dur: 0.56,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.08, 0], chest: [-6, -36, 0], spine: [0, -12, 0], head: [-6, 28, 0], ...K_LEFT_FREE, sw: { tilt: 40, yaw: 0, a: 124, r: 0.44, off: -6, roll: 0 }, pole: [-0.8, -0.3, 0.1] } },
      { t: 0.08, e: 'snap', p: { chest: [-8, -42, 0], sw: { a: 136, off: -12 } } },
      { t: 0.16, e: 'out', p: { hp: [0, -0.16, 0.12], chest: [16, 30, 0], spine: [10, 12, 0], head: [-12, -24, 0], ...K_LUNGE, sw: { a: -40, r: 0.62, off: 10 }, pole: [-0.5, -1, -0.2] } },
      { t: 0.34, e: 'inOut', p: { sw: { a: -48, off: 6 } } },
      { t: 0.56, e: 'inOut', p: { sw: { a: -44, off: 30 } } },
    ],
  },
  slashB: {
    dur: 0.56,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.14, 0.05], chest: [12, 30, 0], spine: [8, 12, 0], head: [-8, -26, 0], ...K_LUNGE, ...K_LEFT_FREE, sw: { tilt: 45, yaw: 0, a: -114, r: 0.46, off: -16, roll: 180 }, pole: [-0.5, -1, 0.2] } },
      { t: 0.07, e: 'snap', p: { sw: { a: -124, off: -22 } } },
      { t: 0.16, e: 'out', p: { hp: [0, -0.06, 0.12], chest: [-10, -30, 0], spine: [-4, -12, 0], head: [-2, 24, 0], sw: { a: 90, r: 0.58, off: 14 }, pole: [-0.8, -0.2, -0.3] } },
      { t: 0.34, e: 'inOut', p: { sw: { a: 98, off: 18 } } },
      { t: 0.56, e: 'inOut', p: { sw: { a: 82, off: 30 } } },
    ],
  },
  slashC: {
    dur: 0.6,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.1, 0], hips: [0, -20, 0], chest: [0, -44, 0], spine: [4, -16, 0], head: [-6, 40, 0], ...K_WIDE, ...K_LEFT_FREE, sw: { tilt: 86, yaw: 0, a: 102, r: 0.46, off: 26, roll: 0 }, pole: [-0.9, 0.1, -0.2] } },
      { t: 0.08, e: 'snap', p: { chest: [0, -50, 0], sw: { a: 114, off: 30 } } },
      { t: 0.18, e: 'out', p: { hp: [0, -0.14, 0.14], hips: [0, 24, 0], chest: [6, 44, 0], spine: [6, 18, 0], head: [-8, -40, 0], ...K_LUNGE, sw: { a: -106, r: 0.62, off: 6 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 0.36, e: 'inOut', p: { sw: { a: -114 } } },
      { t: 0.6, e: 'inOut', p: { sw: { a: -98, off: 20 } } },
    ],
  },
  // ----------------------------------------------------------- 壹之型・闇月・宵之宮: the draw
  iaiReady: {
    dur: 0.45,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.2, -0.05], hips: [0, 30, 0], chest: [8, 46, 0], spine: [8, 16, 0], head: [-10, -42, 0], ...K_WIDE, lh: 1, sw: { tilt: 88, yaw: 0, a: -126, r: 0.34, off: -24, roll: 180 }, pole: [0.2, -0.4, 0.9] } },
      { t: 0.45, e: 'inOut', p: { hp: [0, -0.24, -0.07], chest: [10, 52, 0], sw: { a: -132, off: -28 } } },
    ],
  },
  iai: {
    dur: 0.62,
    keys: [
      { t: 0, e: 'snap', p: { hp: [0, -0.24, -0.07], hips: [0, 30, 0], chest: [10, 52, 0], spine: [8, 16, 0], head: [-10, -42, 0], ...K_WIDE, lh: 1, sw: { tilt: 88, yaw: 0, a: -132, r: 0.34, off: -28, roll: 180 }, pole: [0.2, -0.4, 0.9] } },
      { t: 0.07, e: 'out', p: { hp: [0, -0.28, 0.22], hips: [0, -20, 0], chest: [14, -48, 0], spine: [10, -16, 0], head: [-16, 42, 0], ...K_LUNGE, lh: 0, upperArmL: [30, 0, 56], foreArmL: [-20, 0, 0], sw: { a: 112, r: 0.64, off: 6 }, pole: [-0.9, -0.3, -0.2] } },
      { t: 0.36, e: 'inOut', p: { sw: { a: 118 } } },
      { t: 0.62, e: 'inOut', p: { hp: [0, -0.12, 0.1], sw: { a: 100, off: 24 } } },
    ],
  },
  // 貳之型・珠華弄月: three rising cuts, one after another
  pearl: {
    dur: 1.12,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.16, 0.02], chest: [12, 30, 0], spine: [8, 12, 0], head: [-8, -26, 0], ...K_LUNGE, ...K_LEFT_FREE, sw: { tilt: 45, yaw: 0, a: -118, r: 0.46, off: -16, roll: 180 }, pole: [-0.5, -1, 0.2] } },
      { t: 0.16, e: 'snap', p: { hp: [0, -0.2, 0], sw: { a: -128 } } },
      { t: 0.26, e: 'out', p: { hp: [0, -0.08, 0.12], chest: [-10, -30, 0], head: [-2, 24, 0], sw: { a: 92, r: 0.6, off: 14 }, pole: [-0.8, -0.2, -0.3] } },
      { t: 0.36, e: 'inOut', p: { chest: [10, -24, 0], sw: { tilt: -45, a: -116, r: 0.46, off: -16 }, pole: [0.2, -1, 0.3] } },
      { t: 0.5, e: 'out', p: { hp: [0, -0.08, 0.22], chest: [-10, 30, 0], head: [-2, -24, 0], sw: { a: 92, r: 0.6, off: 14 }, pole: [-0.8, 0.2, -0.3] } },
      { t: 0.62, e: 'inOut', p: { hp: [0, -0.2, 0.2], chest: [14, 0, 0], head: [-10, 0, 0], sw: { tilt: 0, a: -128, r: 0.46, off: -10 }, pole: [-0.6, -1, 0] } },
      { t: 0.76, e: 'out', p: { hp: [0, 0.02, 0.32], spine: [-8, 0, 0], chest: [-20, 0, 0], head: [12, 0, 0], sw: { a: 104, r: 0.62, off: 10 }, pole: [-0.8, 0.2, -0.2] } },
      { t: 1.12, e: 'inOut', p: { hp: [0, -0.1, 0.2], chest: [0, 0, 0], head: [0, 0, 0], sw: { a: 70, off: 30 } } },
    ],
  },
  // 參之型・厭忌月・銷蝕: two flat sweeps, right to left and back
  loathe: {
    dur: 0.95,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.14, 0], hips: [0, -20, 0], chest: [0, -46, 0], spine: [4, -16, 0], head: [-6, 40, 0], ...K_WIDE, ...K_LEFT_FREE, sw: { tilt: 86, yaw: 0, a: 106, r: 0.46, off: 26, roll: 0 }, pole: [-0.9, 0.1, -0.2] } },
      { t: 0.18, e: 'out', p: { hp: [0, -0.18, 0.12], hips: [0, 24, 0], chest: [6, 46, 0], spine: [6, 18, 0], head: [-8, -40, 0], ...K_LUNGE, sw: { a: -112, r: 0.64, off: 4 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 0.3, e: 'inOut', p: { sw: { a: -122, off: -10, roll: 180 } } },
      { t: 0.48, e: 'out', p: { hp: [0, -0.2, 0.22], hips: [0, -24, 0], chest: [8, -46, 0], spine: [6, -16, 0], head: [-10, 40, 0], sw: { a: 114, r: 0.64, off: 6 }, pole: [-0.9, -0.3, -0.2] } },
      { t: 0.95, e: 'inOut', p: { hp: [0, -0.1, 0.16], sw: { a: 98, off: 26 } } },
    ],
  },
  // 伍之型・月魄災渦: no swing at all -- he only stands, and the moons come
  cast: {
    dur: 0.9,
    keys: [
      { t: 0, e: 'out', p: { ...KOKUSHIBO_STANCE, hp: [0, -0.06, 0], head: [6, 0, 0] } },
      { t: 0.2, e: 'out', p: { hp: [0, -0.1, 0], chest: [-4, 0, 0], head: [-6, 0, 0], sw: { a: -72, off: 26 } } },
      { t: 0.9, e: 'inOut', p: { ...KOKUSHIBO_STANCE } },
    ],
  },
  // 陸之型・常夜孤月・無間: a raised blade, then one great diagonal cut
  eternal: {
    dur: 1.05,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.1, -0.04], chest: [-12, -24, 0], spine: [-4, -10, 0], head: [4, 20, 0], ...K_WIDE, lh: 1, sw: { tilt: 22, yaw: 0, a: 150, r: 0.42, off: 22, roll: 0 }, pole: [-0.8, 0.3, -0.3] } },
      { t: 0.34, e: 'in', p: { chest: [-16, -30, 0], sw: { a: 162, off: 28 } } },
      { t: 0.44, e: 'out', p: { hp: [0, -0.28, 0.34], hips: [0, 20, 0], chest: [26, 34, 0], spine: [14, 14, 0], head: [-18, -30, 0], ...K_LUNGE, sw: { a: -70, r: 0.64, off: 4 }, pole: [-0.4, -1, 0.1] } },
      { t: 0.74, e: 'inOut', p: { sw: { a: -78 } } },
      { t: 1.05, e: 'inOut', p: { hp: [0, -0.14, 0.2], sw: { a: -64, off: 24 } } },
    ],
  },
  dash: {
    dur: 0.42,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.26, 0.05], spine: [30, 0, 0], chest: [10, 0, 0], head: [-26, 0, 0], ...K_LUNGE, lh: 0, upperArmL: [50, 0, 20], foreArmL: [-20, 0, 0], sw: { tilt: 10, yaw: -20, a: -130, r: 0.52, off: -34 } } },
      { t: 0.42, e: 'inOut', p: { hp: [0, -0.1, 0], spine: [8, 0, 0] } },
    ],
  },
  hop: {
    dur: 0.4,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, 0.12, -0.16], bp: -8, spine: [-10, 0, 0], thighL: [-36, 0, 10], shinL: [56, 0, 0], thighR: [-18, 0, -10], shinR: [46, 0, 0], ...K_LEFT_FREE, sw: { tilt: 20, yaw: -20, a: -90, r: 0.5, off: -20 } } },
      { t: 0.4, e: 'inOut', p: { ...KOKUSHIBO_STANCE, bp: 0 } },
    ],
  },
  // ----------------------------------------------------------- the second state (both hands, the long blade)
  // raised upright before his face while the blade grows
  transform: {
    dur: 1.6,
    keys: [
      { t: 0, e: 'out', p: { ...KOKUSHIBO_STANCE } },
      { t: 0.5, e: 'out', p: { hp: [0, -0.08, 0], hips: [0, 0, 0], chest: [-4, 0, 0], head: [-4, 0, 0], ...K_WIDE, lh: 1, sw: { tilt: 0, yaw: -6, a: 40, r: 0.36, off: 50, roll: 90 }, pole: [-0.8, -0.6, 0] } },
      { t: 1.6, e: 'inOut', p: { head: [-10, 0, 0], sw: { a: 46, off: 44 } } },
    ],
  },
  // 漆之型・厄鏡・月映: from low at his right up across to high on his left
  mirror: {
    dur: 0.95,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.22, -0.02], hips: [0, 20, 0], chest: [12, 36, 0], spine: [8, 12, 0], head: [-10, -30, 0], ...K_WIDE, lh: 1, sw: { tilt: -24, yaw: -10, a: -130, r: 0.46, off: -14, roll: 0 }, pole: [-0.6, -1, 0.1] } },
      { t: 0.24, e: 'in', p: { chest: [14, 44, 0], sw: { a: -138 } } },
      { t: 0.36, e: 'out', p: { hp: [0, -0.06, 0.26], hips: [0, -20, 0], chest: [-16, -34, 0], spine: [-6, -12, 0], head: [6, 30, 0], ...K_LUNGE, sw: { a: 112, r: 0.62, off: 12 }, pole: [-0.8, 0.3, -0.3] } },
      { t: 0.66, e: 'inOut', p: { sw: { a: 118 } } },
      { t: 0.95, e: 'inOut', p: { hp: [0, -0.1, 0.14], sw: { a: 96, off: 24 } } },
    ],
  },
  // 捌之型・月龍輪尾: the whole length swept flat through a half circle and more
  dragon: {
    dur: 1.05,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.24, 0], by: 0, hips: [0, -24, 0], chest: [4, -50, 0], spine: [6, -16, 0], head: [-8, 44, 0], ...K_WIDE, lh: 1, sw: { tilt: 88, yaw: 0, a: 132, r: 0.44, off: 20, roll: 0 }, pole: [-0.9, 0.1, -0.2] } },
      { t: 0.24, e: 'in', p: { chest: [4, -56, 0], sw: { a: 142 } } },
      { t: 0.5, e: 'out', p: { hp: [0, -0.3, 0.2], by: -50, hips: [0, 26, 0], chest: [8, 48, 0], spine: [8, 18, 0], head: [-10, -40, 0], ...K_LUNGE, sw: { a: -128, r: 0.64, off: 6 }, pole: [-0.2, -0.6, 0.8] } },
      { t: 0.76, e: 'inOut', p: { sw: { a: -136 } } },
      { t: 1.05, e: 'inOut', p: { hp: [0, -0.14, 0.1], by: 0, sw: { a: -110, off: 24 } } },
    ],
  },
  // 玖之型・墮月・連面: down from overhead, then straight back up
  descend: {
    dur: 1.05,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.1, -0.06], chest: [-18, 0, 0], spine: [-6, 0, 0], head: [8, 0, 0], ...K_WIDE, lh: 1, sw: { tilt: 0, yaw: -4, a: 168, r: 0.42, off: 18, roll: 0 }, pole: [-0.7, 0.3, -0.3] } },
      { t: 0.18, e: 'in', p: { chest: [-22, 0, 0], sw: { a: 176 } } },
      { t: 0.3, e: 'out', p: { hp: [0, -0.32, 0.36], chest: [30, 0, 0], spine: [16, 0, 0], head: [-26, 0, 0], ...K_LUNGE, sw: { a: -44, r: 0.64, off: 2 }, pole: [-0.5, -1, 0] } },
      { t: 0.46, e: 'inOut', p: { sw: { a: -58, off: -8 } } },
      { t: 0.6, e: 'out', p: { hp: [0, -0.02, 0.4], chest: [-18, 0, 0], spine: [-6, 0, 0], head: [10, 0, 0], sw: { a: 128, r: 0.6, off: 12 }, pole: [-0.8, 0.3, -0.3] } },
      { t: 1.05, e: 'inOut', p: { hp: [0, -0.12, 0.3], chest: [0, 0, 0], head: [0, 0, 0], sw: { a: 96, off: 26 } } },
    ],
  },
  // 拾之型・穿面斬・籮月: the blade wheeled twice around in front of him like a saw
  saw: {
    dur: 1.1,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.2, 0], chest: [10, -14, 0], spine: [8, -4, 0], head: [-10, 12, 0], ...K_WIDE, lh: 1, sw: { tilt: 8, yaw: -6, a: 200, r: 0.46, off: 22, roll: 0 }, pole: [-0.8, -0.2, -0.3] } },
      { t: 0.14, e: 'in', p: { sw: { a: 212 } } },
      { t: 0.5, e: 'linear', p: { hp: [0, -0.24, 0.2], chest: [16, 8, 0], ...K_LUNGE, sw: { a: -148, r: 0.6, off: 10 } } },
      { t: 0.86, e: 'linear', p: { hp: [0, -0.26, 0.34], chest: [20, 12, 0], sw: { a: -508 } } },
      { t: 1.1, e: 'out', p: { hp: [0, -0.16, 0.3], chest: [10, 0, 0], sw: { a: -560, off: 26 } } },
    ],
  },
  // 拾肆之型・兇變・天滿纖月: two whole turns with the long blade held out flat
  spiral: {
    dur: 1.25,
    keys: [
      { t: 0, e: 'out', p: { hp: [0, -0.26, 0], by: 0, hips: [0, 30, 0], chest: [10, 42, 0], spine: [10, 14, 0], head: [-12, -30, 0], ...K_WIDE, ...K_LEFT_FREE, upperArmL: [0, 0, 80], foreArmL: [-10, 0, 0], sw: { tilt: 82, yaw: 0, a: -120, r: 0.46, off: -20, roll: 180 }, pole: [0, -0.3, 1] } },
      { t: 0.18, e: 'in', p: { chest: [12, 54, 0], sw: { a: -130 } } },
      { t: 1.0, e: 'linear', p: { by: -720, hips: [0, -10, 0], chest: [4, -10, 0], head: [-10, 0, 0], sw: { a: -84, r: 0.64, off: 0 } } },
      { t: 1.25, e: 'out', p: { by: -720, hp: [0, -0.16, 0.05], sw: { a: -92, off: 20 } } },
    ],
  },
  // 拾陸之型・月虹・孤留月: the blade raised to the sky, held, and brought down
  sky: {
    dur: 1.35,
    keys: [
      { t: 0, e: 'out', p: { ...KOKUSHIBO_STANCE } },
      { t: 0.36, e: 'out', p: { hp: [0, -0.02, 0], chest: [-14, 0, 0], spine: [-6, 0, 0], head: [16, 0, 0], ...K_WIDE, lh: 1, sw: { tilt: 0, yaw: -4, a: 96, r: 0.5, off: 0, roll: 0 }, pole: [-0.8, 0, -0.3] } },
      { t: 0.84, e: 'inOut', p: { head: [20, 0, 0], sw: { a: 100 } } },
      { t: 1.0, e: 'out', p: { hp: [0, -0.3, 0.3], chest: [28, 0, 0], spine: [14, 0, 0], head: [-24, 0, 0], ...K_LUNGE, sw: { a: -50, r: 0.64, off: 4 }, pole: [-0.5, -1, 0] } },
      { t: 1.35, e: 'inOut', p: { hp: [0, -0.14, 0.2], sw: { a: -60, off: 24 } } },
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
