// On-screen touch controls: a floating move stick on the left, camera drag on the right, and the
// action buttons in two arcs around the attack button (bottom-right), plus lock-on and pause.
// The layer only emits intents through bound callbacks; the game feeds the button states back
// (skills, ultimate charge, lock) through setSkills() / sync().
import { h, clamp } from './dom.js';
import { enso, ICON, PAUSE_PATH } from './icons.js';
import { CHAR_BY_ID, ultGlyph } from './data.js';
import { setUltStyle } from './hud.js';
import { device } from '../core/device.js';

// ring 0 = the attack button, 1 = inner arc, 2 = outer arc; a = angle in degrees (180 = left, 90 = up)
const BUTTONS = [
  { id: 'light', glyph: '斬', ring: 0, cls: 'is-atk' },
  { id: 'dodge', glyph: '閃', ring: 1, a: 180, cls: 'is-dodge' },
  { id: 'heavy', glyph: '重', ring: 1, a: 135, cls: 'is-heavy' },
  { id: 'block', glyph: '防', ring: 1, a: 90, cls: 'is-block' },
  { id: 'skill1', ring: 2, a: 176, skill: 0 },
  { id: 'skill2', ring: 2, a: 146, skill: 1 },
  { id: 'skill3', ring: 2, a: 116, skill: 2 },
  { id: 'ult', ring: 2, a: 86, ult: true },
];

export const TOUCH_SIZES = { s: 0.86, m: 1, l: 1.16 };

const DEAD = 0.14; // stick dead zone (fraction of the radius)
const SPRINT_AT = 1.25; // finger distance (in radii) that turns the run into a sprint
const TAP_MOVE = 12; // px: a look-zone touch that moves less than this …
const TAP_MS = 280; // … and lifts within this is a tap (lock onto the demon under it)

const PAUSE_SVG = `<svg class="tc-pause-i" viewBox="0 0 24 24" aria-hidden="true"><path d="${PAUSE_PATH}"/></svg>`;

const ROTATE_SVG =
  '<svg class="rt-i" viewBox="0 0 96 96" aria-hidden="true"><rect class="rt-phone" x="33" y="14" width="30" height="54" rx="5.5"/><path class="rt-arrow" d="M20 70c6 11 18 17 30 16M50 86l-6.5-5.2M50 86l-5 6.6"/><path class="rt-arrow" d="M76 26C70 15 58 9 46 10M46 10l6.5 5.2M46 10l5-6.6"/></svg>';

export class TouchControls {
  /**
   * @param {object} ui    the UI instance (for the HUD slot renderer and sounds)
   * @param {HTMLElement} layer  container inside .ic-ui
   */
  constructor(ui, layer) {
    this.ui = ui;
    this.layer = layer;
    this.cb = {};
    this.active = false;
    this.held = new Map(); // pointerId -> button record
    this.stick = { id: null, bx: 0, by: 0, x: 0, y: 0, sprint: false };
    this.look = { id: null, x: 0, y: 0, sx: 0, sy: 0, t: 0, moved: 0 };
    this._lock = null;
    this._cue = null;
    this._control = null;
    this._ult = { c01: -1, ready: null, name: null };

    this.moveZone = h('div', { class: 'tc-zone tc-zone--move' });
    this.lookZone = h('div', { class: 'tc-zone tc-zone--look' });
    this.stickEl = h('div', { class: 'tc-stick' });
    this.stickEl.innerHTML = `
      <div class="tc-stick-base">${enso({ r: 45, w: 5, seed: 61, start: -80, sweep: 340, wobble: 1 }, 'tc-stick-ring')}<i class="tc-stick-dir"></i></div>
      <div class="tc-stick-knob"><span class="ic-cal">走</span></div>`;
    this.knob = this.stickEl.querySelector('.tc-stick-knob');
    this.cluster = h('div', { class: 'tc-cluster' });
    // measures env(safe-area-inset-*) in px (notch / home indicator)
    this.safeProbe = h('i', { class: 'tc-safe' });
    this.layer.append(this.safeProbe, this.moveZone, this.lookZone, this.stickEl, this.cluster);

    this.buttons = {};
    this.slots = [];
    for (const def of BUTTONS) this._makeButton(def);
    this.lockBtn = this._makeSmall('lock', 'tc-lock', `<span class="tc-g ic-cal">鎖</span>`);
    this.pauseBtn = this._makeSmall('pause', 'tc-pause', PAUSE_SVG);

    this._bindZones();
    this._placeRest();
    // no synthetic click after a touch on the controls: when a menu opens under a finger that is still
    // down (result screen, pause), lifting it must not press whatever button is now under it
    this.layer.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

    // portrait warning (touch devices only; shown by CSS). With the phone's auto-rotate off, turning it does
    // nothing, so a tap asks for fullscreen + a landscape lock (Android); iPhone has no such API.
    const hint = device.canFullscreen ? '畫面沒有跟著轉？請開啟自動旋轉<br>或輕觸這裡改用全螢幕' : '畫面沒有跟著轉？<br>請在控制中心關閉螢幕方向鎖定';
    this.rotateEl = h('div', { class: 'ic-rotate', html: `<div class="rt-box">${ROTATE_SVG}<p class="rt-t ic-cal">請將裝置轉為橫向</p><p class="rt-s">無限城需要橫向畫面遊玩</p><p class="rt-h">${hint}</p></div>` });
    this.rotateEl.addEventListener('pointerup', () => device.requestImmersive());

    // a finger lifted outside the page, the app switching away …: never leave a button stuck
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => document.hidden && this.releaseAll());
    window.addEventListener('resize', () => {
      this._R = 0;
      this._placeRest();
    });
  }

  /** A camera-drag finger is on the screen (moving or not): the camera leaves the view alone. */
  get lookHeld() {
    return this.look.id != null;
  }

  /** callbacks: { action(id, down), stick(x, y, sprint), look(dx, dy), tap(x, y), pause(), release() } */
  bind(callbacks) {
    this.cb = callbacks || {};
  }

  /* ------------------------------------------------------------------ building */
  _disc(glyph, cls = '') {
    return `<div class="tc-disc ${cls}"><div class="tc-bg"></div>${enso({ r: 42, w: 6.5, seed: glyph.charCodeAt(0) % 97, start: -100, sweep: 332 }, 'tc-ring')}<span class="tc-g ic-cal">${glyph}</span></div>`;
  }

  _makeButton(def) {
    let el;
    if (def.skill != null) {
      el = h('div', { class: 'tc-btn tc-sk hd-sk' });
      el.innerHTML = `
        <div class="sk-disc"><div class="sk-bg"></div>${enso({ r: 41, w: 7, seed: 40 + def.skill * 3, start: -100 + def.skill * 25, sweep: 330 }, 'sk-ring')}<span class="sk-g ic-cal"></span><div class="sk-cd"></div></div>
        <div class="sk-key" hidden></div>
        <div class="sk-cost">${ICON.drop}<b></b></div>
        <div class="sk-name" hidden></div>`;
      const q = (s) => el.querySelector(s);
      this.slots[def.skill] = { el, disc: q('.sk-disc'), g: q('.sk-g'), cdEl: q('.sk-cd'), keyEl: q('.sk-key'), costEl: q('.sk-cost'), costB: q('.sk-cost b'), nameEl: q('.sk-name'), key: null, form: null, name: null, cost: undefined, ready: null, cd: -1, lack: null, init: false };
    } else if (def.ult) {
      el = h('div', { class: 'tc-btn tc-ult hd-ult is-fire' });
      el.innerHTML = `
        <div class="ul-disc">
          <div class="ul-glow"></div>
          <div class="ul-fire"></div>
          <svg class="ul-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="ul-track" cx="50" cy="50" r="45"/><circle class="ul-prog" cx="50" cy="50" r="45" pathLength="1"/></svg>
          ${enso({ r: 36, w: 6, seed: 77, start: -80, sweep: 330 }, 'ul-enso')}
          <span class="ul-g ic-cal">奧</span>
        </div>`;
      this.ultEl = el;
      this.ultProg = el.querySelector('.ul-prog');
      this.ultG = el.querySelector('.ul-g');
    } else {
      el = h('div', { class: `tc-btn ${def.cls || ''}`, html: this._disc(def.glyph) });
    }
    el.dataset.a = def.id;
    el.classList.add(`is-ring${def.ring}`);
    if (def.ring) {
      const r = (def.a * Math.PI) / 180;
      el.style.setProperty('--x', Math.cos(r).toFixed(4));
      el.style.setProperty('--y', (-Math.sin(r)).toFixed(4));
    }
    this._bindButton(el, def.id);
    this.cluster.append(el);
    this.buttons[def.id] = el;
    return el;
  }

  _makeSmall(id, cls, inner) {
    const el = h('div', { class: `tc-btn tc-small ${cls}`, html: `<div class="tc-disc"><div class="tc-bg"></div>${inner}</div>` });
    el.dataset.a = id;
    this._bindButton(el, id);
    this.layer.append(el);
    this.buttons[id] = el;
    return el;
  }

  /* ------------------------------------------------------------------ pointer handling */
  _capture(el, id) {
    try {
      el.setPointerCapture(id);
    } catch (_) { /* synthetic events in tests */ }
  }

  _bindButton(el, id) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._press(el, id, e.pointerId);
    });
    const up = (e) => {
      const rec = this.held.get(e.pointerId);
      if (!rec || rec.el !== el) return;
      this.held.delete(e.pointerId);
      el.classList.remove('is-down');
      if (id === 'pause') {
        if (e.type === 'pointerup') this.cb.pause?.();
      } else this.cb.action?.(id, false);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _press(el, id, pointerId) {
    if (!this.active || [...this.held.values()].some((b) => b.id === id)) return;
    this._capture(el, pointerId);
    this.held.set(pointerId, { id, el });
    el.classList.add('is-down');
    if (id !== 'pause') this.cb.action?.(id, true);
  }

  _moveDown(e) {
    if (!this.active || this.stick.id != null) return;
    this._capture(this.moveZone, e.pointerId);
    this._stickStart(e.pointerId, e.clientX, e.clientY);
  }

  _lookDown(e) {
    if (!this.active || this.look.id != null) return;
    this._capture(this.lookZone, e.pointerId);
    const L = this.look;
    L.id = e.pointerId;
    L.x = L.sx = e.clientX;
    L.y = L.sy = e.clientY;
    L.t = performance.now();
    L.moved = 0;
  }

  /**
   * A touch that went down while the layer was still hidden (it is the touch that switched the input mode,
   * so the browser had already sent it to the game canvas): hand it to the stick, camera zone or button now under it.
   */
  adopt(e) {
    if (!this.active || !e || e.type !== 'pointerdown' || e.pointerType === 'mouse') return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || !this.layer.contains(el)) return;
    const btn = el.closest('.tc-btn');
    if (btn) this._press(btn, btn.dataset.a, e.pointerId);
    else if (el === this.moveZone) this._moveDown(e);
    else if (el === this.lookZone) this._lookDown(e);
  }

  _bindZones() {
    const mz = this.moveZone;
    const lz = this.lookZone;
    mz.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._moveDown(e);
    });
    mz.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stick.id) this._stickMove(e.clientX, e.clientY);
    });
    const mEnd = (e) => {
      if (e.pointerId === this.stick.id) this._stickEnd();
    };
    mz.addEventListener('pointerup', mEnd);
    mz.addEventListener('pointercancel', mEnd);
    mz.addEventListener('lostpointercapture', mEnd);

    lz.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._lookDown(e);
    });
    lz.addEventListener('pointermove', (e) => {
      const L = this.look;
      if (e.pointerId !== L.id) return;
      const dx = e.clientX - L.x;
      const dy = e.clientY - L.y;
      L.x = e.clientX;
      L.y = e.clientY;
      L.moved = Math.max(L.moved, Math.hypot(L.x - L.sx, L.y - L.sy));
      if (dx || dy) this.cb.look?.(dx, dy);
    });
    const lEnd = (e) => {
      const L = this.look;
      if (e.pointerId !== L.id) return;
      L.id = null;
      if (e.type === 'pointerup' && L.moved < TAP_MOVE && performance.now() - L.t < TAP_MS) this.cb.tap?.(e.clientX, e.clientY);
    };
    lz.addEventListener('pointerup', lEnd);
    lz.addEventListener('pointercancel', lEnd);
    lz.addEventListener('lostpointercapture', lEnd);
  }

  /** Stick radius in px (measured once per size change: reading it per move would force a style recalc). */
  _radius() {
    if (!this._R) this._R = this.stickEl.offsetWidth / 2;
    return this._R || 56;
  }

  /** Resting place of the stick (bottom-left), where it sits dimmed until touched. */
  _placeRest() {
    if (this.stick.id != null || !this.active) return;
    const R = this._radius();
    const p = this.safeProbe.getBoundingClientRect();
    // far enough from the edges that a thumb put here can push past the ring (sprint) in every direction
    this.stick.bx = p.left + 30 + R;
    this.stick.by = p.top - 30 - R;
    this._drawStick(0, 0);
  }

  _stickStart(id, x, y) {
    const S = this.stick;
    S.id = id;
    // centred under the thumb even right at an edge (the ring is then partly off screen): shifting the
    // centre away from the thumb would read as a push the player never made
    S.bx = x;
    S.by = y;
    this.stickEl.classList.add('is-on');
    this._stickMove(x, y);
  }

  _stickMove(x, y) {
    const S = this.stick;
    const R = this._radius();
    let dx = x - S.bx;
    let dy = y - S.by;
    const d = Math.hypot(dx, dy);
    const sprint = d > R * SPRINT_AT;
    const k = d > R ? R / d : 1;
    dx *= k;
    dy *= k;
    let m = Math.min(1, d / R);
    m = m < DEAD ? 0 : (m - DEAD) / (1 - DEAD);
    const n = d > 0 ? m / Math.max(1e-6, Math.min(1, d / R)) : 0;
    S.x = (dx / R) * n;
    S.y = (-dy / R) * n;
    S.sprint = sprint && m > 0.5;
    this.cb.stick?.(S.x, S.y, S.sprint);
    this._drawStick(dx, dy);
  }

  _stickEnd() {
    const S = this.stick;
    S.id = null;
    S.x = S.y = 0;
    S.sprint = false;
    this.cb.stick?.(0, 0, false);
    this.stickEl.classList.remove('is-on');
    this._placeRest();
  }

  _drawStick(dx, dy) {
    const S = this.stick;
    this.stickEl.style.transform = `translate(${S.bx.toFixed(1)}px, ${S.by.toFixed(1)}px)`;
    this.knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    this.stickEl.classList.toggle('is-sprint', S.sprint);
    const d = Math.hypot(dx, dy);
    this.stickEl.style.setProperty('--dir', `${Math.atan2(dy, dx).toFixed(3)}rad`);
    this.stickEl.style.setProperty('--push', (d / this._radius()).toFixed(3));
  }

  /* ------------------------------------------------------------------ state */
  /** Shown while a run is in progress and no menu is open. */
  setActive(on) {
    on = !!on;
    if (on === this.active) return;
    this.active = on;
    this.layer.hidden = !on;
    if (!on) this.releaseAll();
    else {
      this._R = 0;
      this._placeRest();
    }
  }

  releaseAll() {
    for (const rec of this.held.values()) {
      rec.el.classList.remove('is-down');
      if (rec.id !== 'pause') this.cb.action?.(rec.id, false);
    }
    this.held.clear();
    if (this.stick.id != null) this._stickEnd();
    this.look.id = null;
    this.cb.release?.();
  }

  setSize(key) {
    this.layer.style.setProperty('--tc-scale', String(TOUCH_SIZES[key] || 1));
    this._R = 0;
    requestAnimationFrame(() => this._placeRest());
  }

  configure(charId) {
    const c = CHAR_BY_ID[charId];
    if (!c || !this.ultEl) return;
    setUltStyle(this.ultEl, c.ultStyle);
  }

  /** Mirrors the HUD skill bar onto the touch buttons (same data as HUD.setSkills). */
  setSkills(skills, ult) {
    if (!this.active) return;
    if (Array.isArray(skills)) {
      for (let i = 0; i < this.slots.length; i++) {
        const sl = this.slots[i];
        const on = i < skills.length;
        if (sl.on !== on) {
          sl.on = on;
          sl.el.hidden = !on;
        }
        if (on) this.ui.hud._updSlot(sl, skills[i] || {});
      }
    }
    if (ult && this.ultEl) {
      const u = this._ult;
      const name = String(ult.name || '');
      if (name !== u.name) {
        u.name = name;
        this.ultG.textContent = ultGlyph(name, ult.glyph);
      }
      const c01 = Math.round(clamp(Number(ult.charge01) || 0, 0, 1) * 300) / 300;
      if (c01 !== u.c01) {
        u.c01 = c01;
        this.ultProg.style.strokeDashoffset = String(1 - c01);
      }
      const ready = !!ult.ready;
      if (ready !== u.ready) {
        if (ready && u.ready === false) this.ultEl.animate([{ scale: '1.3', filter: 'brightness(2.4)' }, { scale: '1', filter: 'brightness(1)' }], { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' });
        u.ready = ready;
        this.ultEl.classList.toggle('is-ready', ready);
      }
    }
  }

  /** Per-frame state from the game: { lock, control, cue, cine } */
  sync(s) {
    const lock = !!s.lock;
    if (lock !== this._lock) {
      this._lock = lock;
      this.lockBtn.classList.toggle('is-on', lock);
    }
    const cue = !!s.cue;
    if (cue !== this._cue) {
      this._cue = cue;
      this.layer.classList.toggle('is-cue', cue);
    }
    const control = s.control !== false;
    if (control !== this._control) {
      this._control = control;
      this.layer.classList.toggle('no-control', !control);
    }
    const cine = !!s.cine;
    if (cine !== this._cine) {
      this._cine = cine;
      this.layer.classList.toggle('is-cine', cine);
      if (cine) this.releaseAll();
    }
  }
}

export default TouchControls;
