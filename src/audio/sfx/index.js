// Sound registry: merges all recipe groups and fills in defaults.

import combat from './combat.js';
import elements from './elements.js';
import boss from './boss.js';
import misc from './misc.js';

const DEFAULTS = {
  path: 'world', // 'world' (ducked + slow-mo muffled), 'hero' (always clear), 'ui'
  gain: 0.6,
  send: 0.2,
  jitter: 0.03,
  minInterval: 0.025,
  maxVoices: 0,
  maxDur: 3,
  priority: 1,
};

export const SOUND_GROUPS = {
  'Sword & movement': ['swingLight', 'swingHeavy', 'swingWater', 'swingFire', 'hitSlash', 'hitCrit', 'hitBlunt',
    'clang', 'block', 'guardBreak', 'dodge', 'perfectDodge', 'step', 'land'],
  'Water / fire': ['waterSplash', 'waterWave', 'waterDragon', 'calm', 'fireBurst', 'fireWhoosh', 'fireDragon'],
  'Akaza': ['punchWhoosh', 'punchHit', 'shockwave', 'groundSlam', 'crack', 'barrage', 'compass', 'bossCharge', 'bossRoar'],
  'Demons & misc': ['demonGrowl', 'demonHurt', 'demonDeath', 'decap', 'spawn', 'playerHurt', 'playerDeath',
    'biwa', 'biwaShift', 'taiko', 'doorSlide'],
  'UI & stingers': ['uiHover', 'uiSelect', 'uiConfirm', 'uiBack', 'gaugeFull', 'ultimate', 'impactFrame', 'finisher',
    'heartbeat', 'waveStart', 'victory'],
};

export const SOUNDS = Object.create(null);
for (const group of [combat, elements, boss, misc]) {
  for (const [name, def] of Object.entries(group)) SOUNDS[name] = { ...DEFAULTS, ...def };
}

export const SOUND_NAMES = Object.values(SOUND_GROUPS).flat();
