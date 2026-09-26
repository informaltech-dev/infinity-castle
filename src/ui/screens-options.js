// Character select · Controls · Settings screens.
import { h, esc, clamp } from './dom.js';
import { keyCap, mouseIcon, padIcon, touchIcon, sealHTML, kikkoURL, enso, ICON } from './icons.js';

const MARK = `<div class="op-mark">${enso({ r: 42, w: 9, seed: 23, start: -60, sweep: 320, wobble: 1.6 }, '')}</div>`;
import { Screen, makeHints } from './screen-base.js';
import { device } from '../core/device.js';
import { CHARACTERS, COMMON_MOVES, COMMON_MOVES_TOUCH, MODES, CONTROLS_KB, CONTROLS_PAD, CONTROLS_TOUCH, SETTINGS_GROUPS, formGlyph, ultGlyph } from './data.js';

/* -------------------------------------------------------------------------- Character select */
export class SelectScreen extends Screen {
  constructor(ui) {
    super(ui, 'select', 'ic-select');
    this.mode = 'story';
    this.sel = 0;
    this._shownId = null;
    this.el.innerHTML = `
      <header class="sl-head">
        <div class="sl-title ic-cal ic-wipe" style="--d:.05s">選擇劍士</div>
        <div class="sl-mode"><span class="sl-mode-k">模式</span><b></b><small></small></div>
      </header>
      <div class="sl-cards"></div>
      <aside class="sl-detail ic-washi is-light"><div class="sd-body"></div></aside>
      <div class="sl-go-wrap"></div>`;
    this.modeB = this.el.querySelector('.sl-mode b');
    this.modeS = this.el.querySelector('.sl-mode small');
    this.detail = this.el.querySelector('.sl-detail');
    this.body = this.el.querySelector('.sd-body');
    const cardsEl = this.el.querySelector('.sl-cards');
    const kikko = kikkoURL();
    this.cards = CHARACTERS.map((c, i) => {
      const el = h('div', {
        class: `sl-card is-${c.id}`,
        role: 'button',
        vars: { '--i': i, '--kikko': kikko },
        html: `<div class="sl-card-pat"></div><div class="sl-card-name ic-cal ic-vert">${esc(c.name)}</div><div class="sl-card-title ic-vert">${esc(c.title)}</div>${sealHTML(c.crest)}<div class="sl-card-acc"></div>`,
      });
      el.addEventListener('pointerenter', () => {
        if (!this.visible) return;
        el.classList.add('is-hover');
        if (i !== this.sel) ui._sound('uiHover');
      });
      el.addEventListener('pointerleave', () => el.classList.remove('is-hover'));
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.visible) return;
        if (i === this.sel) ui._sound('uiSelect');
        else this.select(i, 'uiSelect');
      });
      cardsEl.append(el);
      return el;
    });
    const wrap = this.el.querySelector('.sl-go-wrap');
    this.goBtn = h('div', { class: 'ic-btn is-primary is-focus sl-go', role: 'button', text: '出陣' });
    this.backBtn = h('div', { class: 'ic-btn sl-back', role: 'button', text: '返回' });
    this.goBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.visible) this.nav('confirm');
    });
    this.goBtn.addEventListener('pointerenter', () => this.visible && ui._sound('uiHover'));
    this.backBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.visible) this.nav('back');
    });
    this.backBtn.addEventListener('pointerenter', () => {
      if (!this.visible) return;
      this.backBtn.classList.add('is-focus');
      ui._sound('uiHover');
    });
    this.backBtn.addEventListener('pointerleave', () => this.backBtn.classList.remove('is-focus'));
    wrap.append(this.backBtn, this.goBtn);
    this.el.append(
      makeHints(
        [
          { keys: ['left', 'right'], label: '選擇劍士' },
          { keys: [{ k: 'Enter', w: 1.8 }], label: '出陣', act: () => this.nav('confirm') },
          { keys: [{ k: 'Esc', w: 1.4 }], label: '返回', act: () => this.nav('back') },
        ],
        'sl-hints',
      ),
    );
  }

  onShow(mode) {
    this.mode = mode === 'boss' ? 'boss' : 'story';
    const m = MODES[this.mode];
    this.modeB.textContent = m.label;
    this.modeS.textContent = m.sub;
    this.backBtn.classList.remove('is-focus');
    this._shownId = null;
    this.select(this.sel, null);
  }

  select(i, sound) {
    const n = CHARACTERS.length;
    i = ((i % n) + n) % n;
    const changed = i !== this.sel || this._shownId === null;
    this.sel = i;
    const c = CHARACTERS[i];
    this.cards.forEach((el, k) => el.classList.toggle('is-sel', k === i));
    if (changed) {
      this.renderDetail(c, this._shownId !== null);
      this._shownId = c.id;
      this.ui._preview(c.id);
    }
    if (sound) this.ui._sound(sound);
  }

  renderDetail(c, animate) {
    this.detail.classList.toggle('is-giyu', c.id === 'giyu');
    this.detail.classList.toggle('is-tanjiro', c.id === 'tanjiro');
    const stats = c.stats
      .map(([l, v]) => `<div class="sd-stat"><span>${l}</span><span class="sd-pips">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= v ? 'on' : ''}"></i>`).join('')}</span></div>`)
      .join('');
    const touch = this.ui.touchMode;
    const tech = c.techniques
      .map((t) => {
        const full = t.form ? `${t.form}・${t.name}` : t.school ? `${t.school}・${t.name}` : t.name;
        const sch = t.form && t.school ? `<span class="t-sch">${esc(t.school)}</span>` : '';
        // on a touch screen the legend is the glyph printed on the matching button
        const glyph = t.ult ? ultGlyph(t.name.replace(/\s+/g, '・')) : formGlyph(t.form, t.name);
        const cap = touch ? touchIcon('btn', glyph) : keyCap(t.key, 1);
        return `<li class="${t.style === 'fire' ? 'is-fire' : ''} ${t.ult ? 'is-ult' : ''}">${cap}<span>${sch}<span class="t-name">${esc(full)}</span></span></li>`;
      })
      .join('');
    const common = touch
      ? COMMON_MOVES_TOUCH.map((m) => `<li class="is-common">${touchIcon('btn', m.btn)}<span>${esc(m.text)}</span></li>`).join('')
      : COMMON_MOVES.map(
          (m) => `<li class="is-common">${m.mouse ? mouseIcon(m.mouse) : keyCap(m.k, 1)}<span><span class="t-sch">${m.key}</span>${esc(m.text)}</span></li>`,
        ).join('');
    this.body.innerHTML = `
      <div class="sd-top"><span class="sd-title">${esc(c.title)}</span><h3 class="sd-name ic-cal">${esc(c.name)}</h3><div class="sd-school">${esc(c.school)}</div></div>
      <p class="sd-blurb">${esc(c.blurb)}</p>
      <div class="sd-stats">${stats}</div>
      <div class="sd-sec">招式</div>
      <ul class="sd-tech">${tech}${common}</ul>
      <div class="sd-trait">${sealHTML('特性')}<p>${esc(c.trait)}</p></div>`;
    if (animate) {
      this.body.classList.remove('is-swap');
      void this.body.offsetWidth;
      this.body.classList.add('is-swap');
    }
  }

  onTouchMode() {
    if (this._shownId) this.renderDetail(CHARACTERS[this.sel], false);
  }

  nav(a) {
    switch (a) {
      case 'left':
      case 'up':
        this.select(this.sel - 1, 'uiHover');
        return true;
      case 'right':
      case 'down':
        this.select(this.sel + 1, 'uiHover');
        return true;
      case 'confirm':
        this.ui._guarded(() => this.ui._startGame(this.mode, CHARACTERS[this.sel].id));
        return true;
      case 'back':
        this.ui._guarded(() => {
          this.ui._sound('uiBack');
          this.ui.showMenu();
        });
        return true;
      default:
        return false;
    }
  }
}

/* -------------------------------------------------------------------------- Controls */
function tokensHTML(keys) {
  return keys
    .map((t) => {
      if (t.k) return keyCap(t.k, t.w || 1);
      if (t.btn) return touchIcon('btn', t.btn);
      if (t.touch) return touchIcon(t.touch) + (t.text ? `<span class="ct-kt">${esc(t.text)}</span>` : '');
      if (t.mouse) return mouseIcon(t.mouse) + (t.text ? `<span class="ct-kt">${esc(t.text)}</span>` : '');
      if (t.pad) return padIcon(t.pad, t.press) + (t.text ? `<span class="ct-kt">${esc(t.text)}</span>` : '');
      if (t.sep) return `<span class="ct-sep">${esc(t.sep)}</span>`;
      if (t.tag) return `<span class="ct-tag">${esc(t.tag)}</span>`;
      return '';
    })
    .join('');
}

function rowsHTML(rows) {
  return rows
    .map(
      (r, i) =>
        `<li class="ct-row" style="--i:${i}"><div class="ct-keys">${tokensHTML(r.keys)}</div><div class="ct-desc"><b>${esc(r.label)}</b>${r.note ? `<small>${esc(r.note)}</small>` : ''}</div></li>`,
    )
    .join('');
}

export class ControlsScreen extends Screen {
  constructor(ui) {
    super(ui, 'controls', 'ic-controls');
    const wrap = h('div', { class: 'op-wrap ic-shadow' });
    const panel = h('div', { class: 'op-panel ic-washi is-light' });
    panel.innerHTML = `${MARK}
      <div class="op-head"><h2 class="ic-cal">操作說明</h2>${sealHTML('指南')}</div>
      <div class="ct-cols">
        <section class="ct-col is-touch"><h3>${ICON.diamond}觸控</h3><ul class="ct-list">${rowsHTML(CONTROLS_TOUCH)}</ul></section>
        <section class="ct-col is-kb"><h3>${ICON.diamond}鍵盤與滑鼠</h3><ul class="ct-list">${rowsHTML(CONTROLS_KB)}</ul></section>
        <section class="ct-col is-pad"><h3>${ICON.diamond}手把</h3><ul class="ct-list">${rowsHTML(CONTROLS_PAD)}</ul></section>
      </div>`;
    const foot = h('div', { class: 'op-foot' });
    foot.append(
      makeHints([
        { keys: [{ k: 'Esc', w: 1.4 }], label: '返回', act: () => this.nav('back') },
        { keys: [{ k: 'Enter', w: 1.8 }], label: '確認', act: () => this.nav('confirm') },
      ]),
    );
    const btns = h('div', { class: 'op-btns' });
    const back = h('div', { class: 'ic-btn', text: '返回' });
    btns.append(back);
    foot.append(btns);
    panel.append(foot);
    wrap.append(panel);
    this.el.append(wrap);
    this.bindItems([{ el: back, act: () => this.back() }]);
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.nav('back');
    });
  }
  onShow() {
    this.index = -1;
    this.focus(0, false);
  }
  back() {
    this.ui._sound('uiBack');
    this.ui._closeSub();
  }
  nav(a) {
    if (a === 'back' || a === 'confirm') {
      this.ui._guarded(() => this.back());
      return true;
    }
    return ['up', 'down', 'left', 'right'].includes(a);
  }
}

/* -------------------------------------------------------------------------- Settings */
export class SettingsScreen extends Screen {
  constructor(ui) {
    super(ui, 'settings', 'ic-settings');
    const wrap = h('div', { class: 'op-wrap ic-shadow' });
    const panel = h('div', { class: 'op-panel st-panel ic-washi is-light' });
    panel.innerHTML = `${MARK}<div class="op-head"><h2 class="ic-cal">設定</h2>${sealHTML('調律')}</div>`;
    const cols = h('div', { class: 'st-cols' });
    const colA = h('div', { class: 'st-col' });
    const colB = h('div', { class: 'st-col' });
    cols.append(colA, colB);
    this.rows = [];
    let idx = 0;
    SETTINGS_GROUPS.forEach((g, gi) => {
      const group = h('div', { class: 'st-group' }, h('div', { class: 'st-gt', html: `${ICON.diamond}${esc(g.title)}` }));
      g.rows.forEach((def) => {
        const row = this.buildRow(def, idx++);
        group.append(row.el);
        this.rows.push(row);
      });
      (gi < 2 ? colA : colB).append(group);
    });
    this.descEl = h('div', { class: 'st-desc' });
    panel.append(cols, this.descEl);
    const foot = h('div', { class: 'op-foot' });
    foot.append(
      makeHints([
        { keys: ['up', 'down'], label: '選擇' },
        { keys: ['left', 'right'], label: '調整' },
        { keys: [{ k: 'Esc', w: 1.4 }], label: '返回', act: () => this.nav('back') },
      ]),
    );
    const btns = h('div', { class: 'op-btns' });
    const reset = h('div', { class: 'ic-btn is-mini', text: '恢復預設' });
    const back = h('div', { class: 'ic-btn is-mini', text: '返回' });
    btns.append(reset, back);
    foot.append(btns);
    panel.append(foot);
    wrap.append(panel);
    this.el.append(wrap);
    const items = this.rows.map((r) => ({ el: r.el, act: () => this.activateRow(r) }));
    items.push({ el: reset, act: () => this.reset() });
    items.push({ el: back, act: () => this.back() });
    this.bindItems(items);
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.nav('back');
    });
  }

  buildRow(def, i) {
    const el = h('div', { class: 'st-row', vars: { '--i': i } });
    const labelEl = h('div', { class: 'st-label', text: def.label });
    el.append(labelEl);
    const ctrl = h('div', { class: 'st-ctrl' });
    el.append(ctrl);
    const row = { def, el, ctrl, labelEl, sync: null };
    // listed on any touch screen, in both input modes: a row appearing when the mode flips on a tap would
    // shift the panel under that tap
    if (def.touchOnly) el.hidden = !device.touchCapable && !this.ui.touchMode;
    if (def.type === 'slider') {
      const slider = h('div', { class: 'st-slider' }, h('div', { class: 'st-track' }, h('div', { class: 'st-fill' })), h('div', { class: 'st-knob' }));
      const val = h('div', { class: 'st-val' });
      ctrl.append(slider, val);
      let dragging = false;
      const setFromX = (x) => {
        const r = slider.getBoundingClientRect();
        const p = clamp((x - r.left) / Math.max(1, r.width), 0, 1);
        const raw = def.min + p * (def.max - def.min);
        const v = Math.round(raw / def.step) * def.step;
        this.setValue(def, v, true);
      };
      slider.addEventListener('pointerdown', (e) => {
        if (!this.visible) return;
        dragging = true;
        slider.setPointerCapture(e.pointerId);
        this.focus(i, false);
        setFromX(e.clientX);
      });
      slider.addEventListener('pointermove', (e) => dragging && setFromX(e.clientX));
      const end = () => (dragging = false);
      slider.addEventListener('pointerup', end);
      slider.addEventListener('pointercancel', end);
      slider.addEventListener('click', (e) => e.stopPropagation());
      row.sync = (v) => {
        const p = (v - def.min) / (def.max - def.min);
        slider.style.setProperty('--p', p.toFixed(4));
        val.textContent = def.fmt(v);
      };
    } else if (def.type === 'toggle') {
      const seg = h('div', { class: 'st-seg' });
      const off = h('div', { class: 'st-opt', text: '關閉' });
      const on = h('div', { class: 'st-opt', text: '開啟' });
      seg.append(off, on);
      ctrl.append(seg);
      off.addEventListener('click', (e) => {
        e.stopPropagation();
        this.focus(i, false);
        this.setValue(def, false, true);
      });
      on.addEventListener('click', (e) => {
        e.stopPropagation();
        this.focus(i, false);
        this.setValue(def, true, true);
      });
      row.sync = (v) => {
        off.classList.toggle('is-on', !v);
        on.classList.toggle('is-on', !!v);
      };
    } else {
      const left = h('div', { class: 'st-arrow', html: ICON.chevL });
      const right = h('div', { class: 'st-arrow', html: ICON.chevR });
      const mid = h('div', {});
      const v = h('div', { class: 'st-choice-v' });
      const dots = h('div', { class: 'st-dots', html: def.options.map(() => '<i></i>').join('') });
      mid.append(v, dots);
      ctrl.append(h('div', { class: 'st-choice' }, left, mid, right));
      left.addEventListener('click', (e) => {
        e.stopPropagation();
        this.focus(i, false);
        this.step(row, -1);
      });
      right.addEventListener('click', (e) => {
        e.stopPropagation();
        this.focus(i, false);
        this.step(row, 1);
      });
      row.sync = (val) => {
        let k = def.options.findIndex((o) => o.v === val);
        if (k < 0) k = 0;
        v.textContent = def.options[k].t;
        dots.querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j === k));
      };
    }
    return row;
  }

  setValue(def, v, sound) {
    const s = this.ui.settings;
    if (def.type === 'slider') v = Math.round(clamp(v, def.min, def.max) * 100) / 100;
    if (s[def.key] === v) return;
    this.ui._setSetting(def.key, v);
    const row = this.rows.find((r) => r.def === def);
    if (row) row.sync(v);
    if (sound) {
      const now = performance.now();
      if (now - (this._lastTick || 0) > 45) {
        this._lastTick = now;
        this.ui._sound('uiSelect');
      }
    }
  }

  step(row, dir) {
    const def = row.def;
    const cur = this.ui.settings[def.key];
    if (def.type === 'slider') this.setValue(def, cur + def.step * dir, true);
    else if (def.type === 'toggle') this.setValue(def, dir > 0, true);
    else {
      let k = def.options.findIndex((o) => o.v === cur);
      if (k < 0) k = 0;
      const n = def.options.length;
      const nk = def.key === 'renderScale' ? clamp(k + dir, 0, n - 1) : (k + dir + n) % n;
      if (nk === k) return;
      this.setValue(def, def.options[nk].v, true);
    }
  }

  activateRow(row) {
    const def = row.def;
    if (def.type === 'toggle') this.setValue(def, !this.ui.settings[def.key], true);
    else if (def.type === 'choice') {
      const n = def.options.length;
      let k = def.options.findIndex((o) => o.v === this.ui.settings[def.key]);
      this.setValue(def, def.options[(k + 1 + n) % n].v, true);
    }
  }

  reset() {
    this.ui._resetSettings();
    this.syncAll();
    this.ui._sound('uiConfirm');
  }

  syncAll() {
    for (const r of this.rows) r.sync(this.ui.settings[r.def.key]);
  }

  onShow() {
    this.syncAll();
    this.index = -1;
    this.focus(0, false);
  }

  onTouchMode(on) {
    for (const r of this.rows) {
      const d = r.def;
      if (d.touchOnly) r.el.hidden = !device.touchCapable && !on;
      r.labelEl.textContent = on && d.touchLabel ? d.touchLabel : d.label;
    }
    // never leave the focus (and the arrow keys) on a row that just disappeared
    if (this.items?.[this.index]?.el.hidden) this.move(-1);
    else if (this.visible) this.onFocus(this.index);
  }

  onFocus(i) {
    const r = this.rows[i];
    const touch = this.ui.touchMode;
    if (r) this.descEl.innerHTML = `<b>${esc(touch && r.def.touchLabel ? r.def.touchLabel : r.def.label)}</b><span>${esc(touch && r.def.touchDesc ? r.def.touchDesc : r.def.desc)}</span>`;
    else if (i === this.rows.length) this.descEl.innerHTML = `<b>恢復預設</b><span>將所有設定還原為初始數值。</span>`;
    else this.descEl.innerHTML = `<b>返回</b><span>設定會自動儲存。</span>`;
  }

  back() {
    this.ui._sound('uiBack');
    this.ui._closeSub();
  }

  nav(a) {
    const r = this.rows[this.index];
    if ((a === 'left' || a === 'right') && r) {
      this.step(r, a === 'left' ? -1 : 1);
      return true;
    }
    if (a === 'left' || a === 'right') {
      // on the footer buttons: move between them
      if (this.index >= this.rows.length) this.focus(a === 'left' ? this.rows.length : this.rows.length + 1, true);
      return true;
    }
    return super.nav(a);
  }
}
