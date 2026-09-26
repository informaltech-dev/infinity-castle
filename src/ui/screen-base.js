// Base class for interactive screens + shared widgets (hint bar, confirm dialog).
import { h, esc } from './dom.js';
import { keyCap } from './icons.js';

export class Screen {
  constructor(ui, name, cls) {
    this.ui = ui;
    this.name = name;
    this.el = h('section', { class: `ic-screen ${cls}`, 'data-screen': name, hidden: true });
    this.items = [];
    this.index = 0;
    this.visible = false;
    this.outMs = 320;
    this._hideT = 0;
  }

  show(arg) {
    clearTimeout(this._hideT);
    const el = this.el;
    el.hidden = false;
    el.classList.remove('is-out', 'is-in');
    void el.offsetWidth; // restart entrance animations (rare event)
    el.classList.add('is-in');
    this.visible = true;
    this.onShow(arg);
  }

  hide(instant = false) {
    if (!this.visible) {
      if (instant) {
        clearTimeout(this._hideT);
        this.el.hidden = true;
        this.el.classList.remove('is-out', 'is-in');
      }
      return;
    }
    this.visible = false;
    this.onHide();
    const el = this.el;
    el.classList.remove('is-in');
    clearTimeout(this._hideT);
    if (instant) {
      el.hidden = true;
      el.classList.remove('is-out');
      return;
    }
    el.classList.add('is-out');
    this._hideT = setTimeout(() => {
      if (!this.visible) {
        el.hidden = true;
        el.classList.remove('is-out');
      }
    }, this.outMs);
  }

  onShow() {}
  onHide() {}

  /** items: [{ el, act }] — wires hover focus + click activation. */
  bindItems(items) {
    this.items = items;
    items.forEach((it, i) => {
      it.el.setAttribute('role', 'button');
      it.el.addEventListener('pointerenter', () => {
        if (this.visible && !this.modal) this.focus(i, true);
      });
      it.el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.visible || this.modal) return;
        this.focus(i, false);
        this.activate(i);
      });
    });
  }

  focus(i, sound = false) {
    const n = this.items.length;
    if (!n || i < 0 || i >= n) return;
    const prev = this.items[this.index];
    if (i === this.index && prev && prev.el.classList.contains('is-focus')) return;
    if (prev) prev.el.classList.remove('is-focus');
    this.index = i;
    this.items[i].el.classList.add('is-focus');
    if (sound) this.ui._sound('uiHover');
    this.onFocus(i);
  }

  onFocus() {}

  move(d) {
    const n = this.items.length;
    if (!n) return;
    let i = this.index;
    // skip rows that are hidden (e.g. touch-only settings on a desktop)
    for (let k = 0; k < n; k++) {
      i = (i + d + n) % n;
      if (!this.items[i].el.hidden) break;
    }
    this.focus(i, true);
  }

  activate(i = this.index) {
    const it = this.items[i];
    if (it && it.act) this.ui._guarded(it.act);
  }

  back() {}

  /** Default vertical-list navigation. Returns true when the action was consumed. */
  nav(a) {
    switch (a) {
      case 'up':
        this.move(-1);
        return true;
      case 'down':
        this.move(1);
        return true;
      case 'left':
      case 'right':
        return true;
      case 'confirm':
        this.activate(this.index);
        return true;
      case 'back':
        this.ui._guarded(() => this.back());
        return true;
      default:
        return false;
    }
  }
}

/** Hint bar. items: [{ keys: ['up','down'] | [{k,w}], label, act? }] */
export function makeHints(items, cls = '') {
  const wrap = h('div', { class: `ic-hints ${cls}` });
  for (const it of items) {
    const keys = it.keys
      .map((k) => (typeof k === 'string' ? keyCap(k, 1) : keyCap(k.k, k.w || 1)))
      .join('');
    const el = h('div', { class: `ic-hint${it.act ? ' is-act' : ''}`, html: `<span class="ic-hint-sep">${keys}</span><span>${esc(it.label)}</span>` });
    if (it.act) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        it.act();
      });
    } else {
      el.style.cursor = 'default';
    }
    wrap.append(el);
  }
  return wrap;
}

/** Two-button confirm dialog living inside a screen. */
export class Confirm {
  constructor(ui, screen) {
    this.ui = ui;
    this.screen = screen;
    this.open = false;
    this.index = 1;
    this.onYes = null;
    this.el = h('div', { class: 'ic-confirm', hidden: true });
    const box = h('div', { class: 'ic-confirm-box ic-washi is-light' });
    this.titleEl = h('div', { class: 'ic-confirm-title', text: '確認' });
    this.msgEl = h('div', { class: 'ic-confirm-msg' });
    const btns = h('div', { class: 'ic-confirm-btns' });
    this.btns = [h('div', { class: 'ic-btn', role: 'button', text: '確定' }), h('div', { class: 'ic-btn', role: 'button', text: '取消' })];
    this.btns.forEach((b, i) => {
      b.addEventListener('pointerenter', () => this.focus(i, true));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.focus(i, false);
        this.choose();
      });
      btns.append(b);
    });
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.cancel();
    });
    box.append(this.titleEl, this.msgEl, btns);
    this.el.append(box);
    screen.el.append(this.el);
  }

  ask(title, msg, onYes) {
    this.titleEl.textContent = title;
    this.msgEl.textContent = msg;
    this.onYes = onYes;
    this.open = true;
    this.screen.modal = true;
    this.el.hidden = false;
    this.index = -1;
    this.focus(1, false);
    this.ui._sound('uiSelect');
  }

  focus(i, sound) {
    if (i === this.index) return;
    this.index = i;
    this.btns.forEach((b, k) => b.classList.toggle('is-focus', k === i));
    if (sound) this.ui._sound('uiHover');
  }

  choose() {
    if (this.index === 0) {
      const fn = this.onYes;
      this.close();
      this.ui._sound('uiConfirm');
      if (fn) this.ui._guarded(fn);
    } else this.cancel();
  }

  cancel() {
    this.close();
    this.ui._sound('uiBack');
  }

  close() {
    this.open = false;
    this.screen.modal = false;
    this.el.hidden = true;
  }

  nav(a) {
    if (a === 'left' || a === 'up') this.focus(0, true);
    else if (a === 'right' || a === 'down') this.focus(1, true);
    else if (a === 'confirm') this.choose();
    else if (a === 'back') this.cancel();
    return true;
  }
}
