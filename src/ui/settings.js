// Settings: defaults, validation, persistence (localStorage key 'ic-settings').
import { device } from '../core/device.js';

export const SETTINGS_KEY = 'ic-settings';

export const DEFAULT_SETTINGS = Object.freeze({
  masterVolume: 0.8,
  sfxVolume: 0.9,
  musicVolume: 0.6,
  mouseSensitivity: 1.0,
  invertY: false,
  // phones and tablets start on automatic resolution (it adapts to the frame rate)
  renderScale: device.touch ? 'auto' : 1.0,
  animStyle: 'anime',
  cameraShake: 1.0,
  damageNumbers: true,
  difficulty: 'normal',
  touchButtonSize: 'm',
});

export const RENDER_SCALES = [0.5, 0.75, 1, 1.25, 1.5];

const NUMERIC = {
  masterVolume: [0, 1],
  sfxVolume: [0, 1],
  musicVolume: [0, 1],
  mouseSensitivity: [0.3, 2.5],
  cameraShake: [0, 1.5],
};
const ENUMS = { animStyle: ['anime', 'smooth'], difficulty: ['easy', 'normal', 'hard', 'duel'], touchButtonSize: ['s', 'm', 'l'] };
const BOOLS = ['invertY', 'damageNumbers'];

/** Merge an arbitrary object over the defaults, clamping / validating every field. */
export function sanitizeSettings(src) {
  const out = { ...DEFAULT_SETTINGS };
  if (!src || typeof src !== 'object') return out;
  for (const k in NUMERIC) {
    const v = Number(src[k]);
    if (src[k] !== undefined && src[k] !== null && Number.isFinite(v)) {
      const [a, b] = NUMERIC[k];
      out[k] = Math.round(Math.min(b, Math.max(a, v)) * 100) / 100;
    }
  }
  for (const k of BOOLS) if (typeof src[k] === 'boolean') out[k] = src[k];
  const rs = Number(src.renderScale);
  if (src.renderScale === 'auto') out.renderScale = 'auto';
  else if (src.renderScale != null && Number.isFinite(rs)) {
    out.renderScale = RENDER_SCALES.reduce((best, c) => (Math.abs(c - rs) < Math.abs(best - rs) ? c : best), 1);
  }
  for (const k in ENUMS) if (ENUMS[k].includes(src[k])) out[k] = src[k];
  return out;
}

export function loadSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // saved before touch support (no touchButtonSize yet): that version stored the old default
      // resolution with any change, so a phone moves to automatic resolution once
      if (device.touch && saved && typeof saved === 'object' && saved.touchButtonSize === undefined && Number(saved.renderScale) === 1) saved.renderScale = 'auto';
      return sanitizeSettings(saved);
    }
  } catch (e) {
    /* storage unavailable or corrupt — fall back to defaults */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    /* ignore quota / privacy-mode errors */
  }
}
