// In-game HUD. Every setter is safe to call every frame: values are cached and the DOM is only
// touched when something visibly changes (transforms / opacity where possible, pooled nodes).
import { h, clamp } from './dom.js';
import { enso, keyCap, mouseIcon, ICON, kikkoURL } from './icons.js';
import { CHAR_BY_ID, formGlyph, ultGlyph } from './data.js';
import { Callouts, Banner, Subtitle, Prompt, Toasts, LockOn, EnemyBars, DamageNumbers, BossIntro } from './hud-fx.js';

const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
const FIRE_RE = /火|日|炎|圓舞|陽/;
const q = (el, s) => el.querySelector(s);
const tx = (v01) => `translateX(${((v01 - 1) * 100).toFixed(2)}%)`;

const BOSS_END = `<svg viewBox="0 0 48 40" aria-hidden="true"><path class="be-tail" d="M2 20c8-1.6 14-1.6 20 0-6 1.6-12 1.6-20 0z"/><path class="be-dia" d="M30 3l15 17-15 17-15-17z"/><path class="be-dia2" d="M30 10.5l8.6 9.5L30 29.5 21.4 20z"/><g class="be-flake"><path d="M30 13.5v13M24.4 16.8l11.2 6.4M24.4 23.2l11.2-6.4"/></g></svg>`;

export class HUD {
  constructor(ui, parent) {
    this.ui = ui;
    this.el = h('div', { class: 'ic-hud', hidden: true, vars: { '--kikko': kikkoURL() } });
    parent.append(this.el);
    this.visible = false;

    this.dangerEl = h('div', { class: 'hd-danger', 'data-t': '0' }, h('div', { class: 'hd-danger-in' }));
    this.el.append(this.dangerEl);
    this.ebars = new EnemyBars(this.el);
    this.lock = new LockOn(this.el);
    this.dmg = new DamageNumbers(this.el);
    this.main = h('div', { class: 'hd-main' });
    this.el.append(this.main);
    this._buildPlayer();
    this._buildObjective();
    this._buildSkills();
    this._buildCombo();
    this._buildBoss();
    this.callouts = new Callouts(this.el);
    this.toasts = new Toasts(this.el);
    this.bannerC = new Banner(this.el);
    this.promptC = new Prompt(this.el);
    this.lbEl = h('div', { class: 'hd-lbox' }, h('div', { class: 'lb-top' }), h('div', { class: 'lb-bot' }));
    this.el.append(this.lbEl);
    this.sub = new Subtitle(this.el);
    this.intro = new BossIntro(this.el);

    this._objective = '';
    this._combo = 0;
    this._lb = false;
    this._dg = -1;
    this._dgT = -1;
    this._bossOn = false;
    this._resetCaches();
  }

  _resetCaches() {
    this._pc = { hp01: -1, hpI: null, mhpI: null, low: null, st01: -1, stLow: null, b01: -1, segs: -1, c01: -1, cFull: null, init: false };
    this._bc = { hp01: -1, title: null, name: null, marks: '', init: false };
    this._uc = { key: null, name: null, c01: -1, ready: null, init: false };
  }

  /* ------------------------------------------------------------------ build */
  _buildPlayer() {
    const p = h('div', { class: 'hd-player' });
    p.innerHTML = `
      <div class="hd-crest"><div class="hd-crest-pat"></div>${enso({ r: 43, w: 8, seed: 31, start: -110, sweep: 338 }, 'hd-crest-ring')}<span class="hd-crest-g ic-cal"></span></div>
      <div class="hd-pinfo">
        <div class="hd-pname"><span class="hd-pname-t ic-cal"></span><span class="hd-pname-s"></span></div>
        <div class="hd-hp"><div class="hd-hp-in"><div class="hd-hp-trail"></div><div class="hd-hp-fill"></div><div class="hd-hp-flash"></div></div><span class="hd-hp-num"><b></b><i>／</i><em></em></span></div>
        <div class="hd-stam"><div class="hd-stam-fill"></div></div>
        <div class="hd-breath"><span class="hd-blabel">${ICON.drop}<span>呼吸</span></span><div class="hd-segs"></div></div>
        <div class="hd-conc"><span class="hd-clabel">全集中</span><div class="hd-conc-bar"><div class="hd-conc-fill"></div></div></div>
      </div>`;
    this.main.append(p);
    this.player = p;
    this.pName = q(p, '.hd-pname-t');
    this.pSchool = q(p, '.hd-pname-s');
    this.crestG = q(p, '.hd-crest-g');
    this.hpFill = q(p, '.hd-hp-fill');
    this.hpTrail = q(p, '.hd-hp-trail');
    this.hpFlash = q(p, '.hd-hp-flash');
    this.hpNum = q(p, '.hd-hp-num b');
    this.hpMax = q(p, '.hd-hp-num em');
    this.stFill = q(p, '.hd-stam-fill');
    this.stBar = q(p, '.hd-stam');
    this.segsEl = q(p, '.hd-segs');
    this.concFill = q(p, '.hd-conc-fill');
    this.concEl = q(p, '.hd-conc');
    this.segs = [];
  }

  _buildObjective() {
    this.objEl = h('div', { class: 'hd-obj' });
    this.objEl.innerHTML = `<span class="ob-k">${ICON.diamond}目標</span><span class="ob-t"></span>`;
    this.objT = q(this.objEl, '.ob-t');
    this.main.append(this.objEl);
  }

  _buildSkills() {
    this.skillsEl = h('div', { class: 'hd-skills' });
    // attack stance: Q toggles whether the left mouse button attacks light or heavy
    const st = h('div', { class: 'hd-stance' });
    st.innerHTML = `
      <div class="st-disc"><div class="st-bg"></div>${enso({ r: 41, w: 7, seed: 23, start: -95, sweep: 332 }, 'st-ring')}<span class="st-g ic-cal"></span><span class="st-btn">${mouseIcon('left')}</span></div>
      <div class="st-key">${keyCap('Q', 1)}</div>
      <div class="st-name"></div>`;
    this.stanceEl = st;
    this.stanceDisc = q(st, '.st-disc');
    this.stanceG = q(st, '.st-g');
    this.stanceName = q(st, '.st-name');
    this.skillsEl.append(st);
    this.slotsEl = h('div', { class: 'hd-slots' });
    const u = h('div', { class: 'hd-ult', hidden: true });
    u.innerHTML = `
      <div class="ul-disc">
        <div class="ul-glow"></div>
        <div class="ul-fire"></div>
        <svg class="ul-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="ul-track" cx="50" cy="50" r="45"/><circle class="ul-prog" cx="50" cy="50" r="45" pathLength="1"/></svg>
        ${enso({ r: 36, w: 6, seed: 77, start: -80, sweep: 330 }, 'ul-enso')}
        <span class="ul-g ic-cal"></span>
      </div>
      <div class="ul-key"></div>
      <div class="ul-name"></div>`;
    this.ultEl = u;
    this.ultProg = q(u, '.ul-prog');
    this.ultG = q(u, '.ul-g');
    this.ultKey = q(u, '.ul-key');
    this.ultName = q(u, '.ul-name');
    this.ultDisc = q(u, '.ul-disc');
    this.skillsEl.append(this.slotsEl, u);
    this.main.append(this.skillsEl);
    this.slots = [];
  }

  _makeSlot(i) {
    const el = h('div', { class: 'hd-sk' });
    el.innerHTML = `
      <div class="sk-disc"><div class="sk-bg"></div>${enso({ r: 41, w: 7, seed: 40 + i * 3, start: -100 + i * 25, sweep: 330 }, 'sk-ring')}<span class="sk-g ic-cal"></span><div class="sk-cd"></div></div>
      <div class="sk-key"></div>
      <div class="sk-cost">${ICON.drop}<b></b></div>
      <div class="sk-name"></div>`;
    this.slotsEl.append(el);
    return { el, disc: q(el, '.sk-disc'), g: q(el, '.sk-g'), cdEl: q(el, '.sk-cd'), keyEl: q(el, '.sk-key'), costEl: q(el, '.sk-cost'), costB: q(el, '.sk-cost b'), nameEl: q(el, '.sk-name'), key: null, form: null, name: null, cost: undefined, ready: null, cd: -1, lack: null, init: false };
  }

  _buildCombo() {
    const c = h('div', { class: 'hd-combo' });
    c.innerHTML = `<div class="cb-splat"></div><div class="cb-n ic-cal"></div><div class="cb-l ic-cal">連擊</div><div class="cb-line"></div>`;
    this.comboEl = c;
    this.comboN = q(c, '.cb-n');
    this.main.append(c);
  }

  _buildBoss() {
    const b = h('div', { class: 'hd-boss' });
    b.innerHTML = `
      <div class="bs-name"><span class="bs-title"></span><span class="bs-sep">・</span><span class="bs-nm ic-cal"></span></div>
      <div class="bs-frame">
        <span class="bs-end is-l">${BOSS_END}</span>
        <div class="bs-bar"><div class="bs-in"><div class="bs-trail"></div><div class="bs-fill"></div><div class="bs-sheen"></div></div><div class="bs-marks"></div></div>
        <span class="bs-end is-r">${BOSS_END}</span>
      </div>`;
    this.bossEl = b;
    this.bsTitle = q(b, '.bs-title');
    this.bsName = q(b, '.bs-nm');
    this.bsFill = q(b, '.bs-fill');
    this.bsTrail = q(b, '.bs-trail');
    this.bsMarks = q(b, '.bs-marks');
    this.markEls = [];
    this.main.append(b);
  }

  /* ------------------------------------------------------------------ config */
  configure(charId) {
    const c = CHAR_BY_ID[charId];
    if (!c) return;
    this.player.classList.toggle('is-tanjiro', c.id === 'tanjiro');
    this.player.classList.toggle('is-giyu', c.id === 'giyu');
    this.pName.textContent = c.name;
    this.pSchool.textContent = c.school;
    this.crestG.textContent = c.crest;
    this.ultEl.classList.toggle('is-water', c.ultStyle === 'water');
    this.ultEl.classList.toggle('is-fire', c.ultStyle !== 'water');
    this.el.dataset.char = c.id;
  }

  reset() {
    this.callouts.clear();
    this.toasts.clear();
    this.bannerC.clear();
    this.sub.clear();
    this.promptC.hide();
    this.intro.clear();
    this.dmg.clear();
    this.ebars.clear();
    this.lock.set(0, 0, false);
    this.setLetterbox(false);
    this.setDanger(0);
    this.setCombo(0);
    this.setBoss(null);
    this.setObjective('');
    this._resetCaches();
  }

  /* ------------------------------------------------------------------ public API */
  setVisible(v) {
    v = !!v;
    if (v === this.visible) return;
    this.visible = v;
    this.el.hidden = !v;
    if (v) this.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' });
  }

  setPlayer(p) {
    if (!p) return;
    const c = this._pc;
    const mhp = Math.max(1, Number(p.maxHp) || 1);
    const hp = clamp(Number(p.hp) || 0, 0, mhp);
    const hp01 = hp / mhp;
    if (Math.abs(hp01 - c.hp01) > 0.0004) {
      const dec = c.init && hp01 < c.hp01;
      this.hpFill.style.transform = tx(hp01);
      this.hpTrail.style.transition = dec ? '' : 'none';
      this.hpTrail.style.transform = tx(hp01);
      if (dec) this._hurt(c.hp01 - hp01);
      c.hp01 = hp01;
      const low = hp01 < 0.3;
      if (low !== c.low) {
        c.low = low;
        this.player.classList.toggle('is-low', low);
      }
    }
    const hpI = Math.ceil(hp);
    if (hpI !== c.hpI) {
      c.hpI = hpI;
      this.hpNum.textContent = String(hpI);
    }
    const mhpI = Math.round(mhp);
    if (mhpI !== c.mhpI) {
      c.mhpI = mhpI;
      this.hpMax.textContent = String(mhpI);
    }
    // stamina
    const st01 = clamp((Number(p.stamina) || 0) / Math.max(1, Number(p.maxStamina) || 1), 0, 1);
    if (Math.abs(st01 - c.st01) > 0.002) {
      c.st01 = st01;
      this.stFill.style.transform = `scaleX(${st01.toFixed(4)})`;
      const stLow = st01 < 0.2;
      if (stLow !== c.stLow) {
        c.stLow = stLow;
        this.stBar.classList.toggle('is-low', stLow);
      }
    }
    // breath (segmented)
    const mb = Math.max(1, Number(p.maxBreath) || 1);
    const nSeg = clamp(mb % 25 === 0 ? mb / 25 : mb % 20 === 0 ? mb / 20 : 5, 2, 10);
    if (nSeg !== c.segs) {
      c.segs = nSeg;
      c.b01 = -1;
      this.segsEl.textContent = '';
      this.segsEl.style.setProperty('--n', String(nSeg));
      this.segs = [];
      for (let i = 0; i < nSeg; i++) {
        const s = h('div', { class: 'hd-seg' }, h('div', { class: 'hd-seg-f' }));
        this.segsEl.append(s);
        this.segs.push({ el: s, f: s.firstChild, v: -1, full: null });
      }
    }
    const b01 = clamp((Number(p.breath) || 0) / mb, 0, 1);
    if (Math.abs(b01 - c.b01) > 0.001) {
      c.b01 = b01;
      for (let i = 0; i < this.segs.length; i++) {
        const s = this.segs[i];
        const v = Math.round(clamp(b01 * nSeg - i, 0, 1) * 200) / 200;
        if (v !== s.v) {
          s.v = v;
          s.f.style.transform = `scaleX(${v})`;
          const full = v >= 1;
          if (full !== s.full) {
            if (full && s.full === false) s.el.animate([{ filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], { duration: 380, easing: 'ease-out' });
            s.full = full;
            s.el.classList.toggle('is-full', full);
          }
        }
      }
    }
    // concentration
    if (p.maxConc != null || p.conc != null) {
      const c01 = clamp((Number(p.conc) || 0) / Math.max(1, Number(p.maxConc) || 1), 0, 1);
      if (Math.abs(c01 - c.c01) > 0.002) {
        c.c01 = c01;
        this.concFill.style.transform = `scaleX(${c01.toFixed(4)})`;
        const full = c01 >= 0.999;
        if (full !== c.cFull) {
          c.cFull = full;
          this.concEl.classList.toggle('is-full', full);
        }
      }
    }
    c.init = true;
  }

  _hurt(amount) {
    const now = performance.now();
    if (amount < 0.006 && now - (this._hurtT || 0) < 260) return; // continuous drains: don't re-flash every frame
    this._hurtT = now;
    if (this._flashA) this._flashA.cancel();
    this._flashA = this.hpFlash.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
    if (this._shakeA) this._shakeA.cancel();
    const k = amount > 0.12 ? 2.2 : 1;
    const u = (n) => `${(n * k).toFixed(1)}px`;
    this._shakeA = this.player.animate(
      [
        { transform: 'none' },
        { transform: `translate(${u(-4)}, ${u(1.5)})` },
        { transform: `translate(${u(3.5)}, ${u(-1)})` },
        { transform: `translate(${u(-2)}, ${u(0.5)})` },
        { transform: 'none' },
      ],
      { duration: 280, easing: 'ease-out' },
    );
  }

  /** 'light' | 'heavy' — the current attack stance; stamps the badge when it changes. */
  setAttackMode(mode) {
    const heavy = mode === 'heavy';
    if (heavy === this._stHeavy) return;
    const first = this._stHeavy == null;
    this._stHeavy = heavy;
    this.stanceEl.classList.toggle('is-heavy', heavy);
    this.stanceG.textContent = heavy ? '重' : '輕';
    this.stanceName.textContent = heavy ? '重攻擊' : '輕攻擊';
    if (first) return;
    if (this._stA) this._stA.cancel();
    this._stA = this.stanceDisc.animate(
      [
        { transform: 'scale(1.3) rotate(-12deg)', filter: 'brightness(2)' },
        { transform: 'scale(0.93) rotate(3deg)', filter: 'brightness(1.2)', offset: 0.45 },
        { transform: 'none', filter: 'none' },
      ],
      { duration: 340, easing: 'ease-out' },
    );
  }

  setSkills(skills, ult) {
    if (Array.isArray(skills)) {
      const n = Math.min(skills.length, 6);
      while (this.slots.length < n) this.slots.push(this._makeSlot(this.slots.length));
      for (let i = 0; i < this.slots.length; i++) {
        const sl = this.slots[i];
        const on = i < n;
        if (sl.on !== on) {
          sl.on = on;
          sl.el.hidden = !on;
        }
        if (on) this._updSlot(sl, skills[i] || {});
      }
    }
    const hasUlt = !!ult;
    if (hasUlt !== this._hasUlt) {
      this._hasUlt = hasUlt;
      this.ultEl.hidden = !hasUlt;
    }
    if (ult) this._updUlt(ult);
    this.ui.touch?.setSkills(skills, ult);
  }

  _updSlot(sl, s) {
    const key = String(s.key ?? '');
    if (key !== sl.key) {
      sl.key = key;
      sl.keyEl.innerHTML = key ? keyCap(key, [...key].length > 1 ? 1.4 : 1) : '';
    }
    const form = String(s.form || '');
    const name = String(s.name || '');
    if (form !== sl.form || name !== sl.name) {
      sl.form = form;
      sl.name = name;
      const g = formGlyph(form, name);
      sl.g.textContent = g;
      sl.g.classList.toggle('is-2', [...g].length > 1);
      sl.nameEl.textContent = name;
      sl.el.classList.toggle('is-fire', FIRE_RE.test(form + name));
    }
    if (s.cost !== sl.cost) {
      sl.cost = s.cost;
      sl.costB.textContent = s.cost == null ? '' : String(s.cost);
      sl.costEl.hidden = s.cost == null;
    }
    const ready = !!s.ready;
    const cd = Math.round(clamp(Number(s.cooldown01) || 0, 0, 1) * 120) / 120;
    if (cd !== sl.cd) {
      sl.cd = cd;
      sl.cdEl.style.setProperty('--cd', String(cd));
      sl.el.classList.toggle('is-cd', cd > 0);
    }
    if (ready !== sl.ready) {
      if (ready && sl.init) {
        sl.disc.animate(
          [
            { transform: 'scale(1.22)', filter: 'brightness(2.4)' },
            { transform: 'scale(1)', filter: 'brightness(1)' },
          ],
          { duration: 420, easing: EASE_OUT },
        );
      }
      sl.ready = ready;
      sl.el.classList.toggle('is-ready', ready);
    }
    const lack = !ready && cd === 0;
    if (lack !== sl.lack) {
      sl.lack = lack;
      sl.el.classList.toggle('is-lack', lack);
    }
    sl.init = true;
  }

  _updUlt(u) {
    const c = this._uc;
    const key = String(u.key ?? 'R');
    if (key !== c.key) {
      c.key = key;
      this.ultKey.innerHTML = keyCap(key, [...key].length > 1 ? 1.4 : 1);
    }
    const name = String(u.name || '');
    if (name !== c.name) {
      c.name = name;
      this.ultG.textContent = ultGlyph(name);
      this.ultName.textContent = [...name].length > 8 ? name.split('・').pop().trim() : name;
    }
    const c01 = Math.round(clamp(Number(u.charge01) || 0, 0, 1) * 300) / 300;
    if (c01 !== c.c01) {
      c.c01 = c01;
      this.ultProg.style.strokeDashoffset = String(1 - c01);
    }
    const ready = !!u.ready;
    if (ready !== c.ready) {
      if (ready && c.init) {
        this.ultDisc.animate(
          [
            { transform: 'scale(1.35)', filter: 'brightness(2.6)' },
            { transform: 'scale(0.96)', filter: 'brightness(1.2)', offset: 0.5 },
            { transform: 'scale(1)', filter: 'brightness(1)' },
          ],
          { duration: 600, easing: EASE_OUT },
        );
      }
      c.ready = ready;
      this.ultEl.classList.toggle('is-ready', ready);
    }
    c.init = true;
  }

  setBoss(b) {
    if (!b) {
      if (this._bossOn) {
        this._bossOn = false;
        this.bossEl.classList.remove('is-on');
        cancelAnimationFrame(this._bossRaf);
      }
      return;
    }
    const c = this._bc;
    if (!this._bossOn) {
      this._bossOn = true;
      this.bossEl.classList.add('is-on', 'is-intro');
      c.hp01 = 0;
      c.init = false;
      this.bsFill.style.transition = 'none';
      this.bsTrail.style.transition = 'none';
      this.bsFill.style.transform = tx(0);
      this.bsTrail.style.transform = tx(0);
      clearTimeout(this._bossIntroT);
      this._bossIntroT = setTimeout(() => this.bossEl.classList.remove('is-intro'), 1400);
      cancelAnimationFrame(this._bossRaf);
      this._bossRaf = requestAnimationFrame(() => {
        this._bossRaf = requestAnimationFrame(() => {
          this.bsFill.style.transition = '';
          this.bsTrail.style.transition = '';
          c.init = true;
          c.hp01 = -1;
          if (this._bossLatest) this._applyBoss(this._bossLatest);
        });
      });
    }
    const title = String(b.title || '');
    if (title !== c.title) {
      c.title = title;
      this.bsTitle.textContent = title;
      this.bossEl.classList.toggle('no-title', !title);
    }
    const name = String(b.name || '');
    if (name !== c.name) {
      c.name = name;
      this.bsName.textContent = name;
    }
    const marks = Array.isArray(b.phaseMarks) ? b.phaseMarks.map((m) => clamp(Number(m) || 0, 0, 1)) : [];
    const mk = marks.join(',');
    if (mk !== c.marks) {
      c.marks = mk;
      this.bsMarks.textContent = '';
      this.markEls = marks.map((m) => {
        const el = h('i', { class: 'bs-mark', style: { left: `${(m * 100).toFixed(2)}%` } });
        this.bsMarks.append(el);
        return { el, m, passed: null };
      });
    }
    this._bossLatest = { hp: Number(b.hp) || 0, maxHp: Math.max(1, Number(b.maxHp) || 1) };
    if (c.init) this._applyBoss(this._bossLatest);
  }

  _applyBoss(b) {
    const c = this._bc;
    const hp01 = clamp(b.hp / b.maxHp, 0, 1);
    if (Math.abs(hp01 - c.hp01) > 0.0003) {
      const dec = c.hp01 >= 0 && hp01 < c.hp01;
      this.bsFill.style.transform = tx(hp01);
      if (c.hp01 >= 0) this.bsTrail.style.transition = dec ? '' : 'none';
      this.bsTrail.style.transform = tx(hp01);
      if (dec && c.hp01 - hp01 > 0.004) {
        if (this._bsHitA) this._bsHitA.cancel();
        this._bsHitA = this.bsFill.animate([{ filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], { duration: 200 });
      }
      c.hp01 = hp01;
      for (const m of this.markEls) {
        const passed = hp01 <= m.m + 0.0001;
        if (passed !== m.passed) {
          if (passed && m.passed === false) m.el.animate([{ transform: 'translateX(-50%) scale(2.2)', opacity: 1 }, { transform: 'translateX(-50%) scale(1)' }], { duration: 500, easing: EASE_OUT });
          m.passed = passed;
          m.el.classList.toggle('is-passed', passed);
        }
      }
    }
  }

  setCombo(count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (n === this._combo) return;
    const prev = this._combo;
    this._combo = n;
    if (n <= 0) {
      this.comboEl.classList.remove('is-on');
      return;
    }
    this.comboN.textContent = String(n);
    this.comboEl.classList.add('is-on');
    const tier = n >= 50 ? 3 : n >= 25 ? 2 : n >= 10 ? 1 : 0;
    if (tier !== this._comboTier) {
      this._comboTier = tier;
      this.comboEl.dataset.t = String(tier);
    }
    const now = performance.now();
    if (n > prev && now - (this._bumpT || 0) > 50) {
      this._bumpT = now;
      if (this._bumpA) this._bumpA.cancel();
      this._bumpA = this.comboN.animate(
        [
          { transform: 'scale(1.5) rotate(-6deg)', filter: 'brightness(2)' },
          { transform: 'scale(0.94) rotate(-3deg)', offset: 0.45 },
          { transform: 'scale(1) rotate(-4deg)', filter: 'brightness(1)' },
        ],
        { duration: 260, easing: EASE_OUT },
      );
    }
  }

  callout(o) {
    this.callouts.show(o);
  }

  banner(text, subtext, style) {
    this.bannerC.show(text, subtext, style);
  }

  subtitle(speaker, text, durationSeconds) {
    this.sub.show(speaker, text, durationSeconds);
  }

  prompt(text, keyLabel) {
    this.promptC.show(text, keyLabel);
  }

  hidePrompt() {
    this.promptC.hide();
  }

  toast(text, style) {
    this.toasts.show(text, style);
  }

  setLockOn(x, y, visible, scale) {
    this.lock.set(x, y, visible, scale);
  }

  setEnemyBars(list) {
    this.ebars.update(list);
  }

  damageNumber(x, y, value, kind) {
    if (!this.ui.settings.damageNumbers) return;
    if (!this.visible) return;
    this.dmg.spawn(x, y, value, kind);
  }

  setLetterbox(on) {
    on = !!on;
    if (on === this._lb) return;
    this._lb = on;
    this.el.classList.toggle('is-cine', on);
  }

  setDanger(x01) {
    const v = Math.round(clamp(Number(x01) || 0, 0, 1) * 50) / 50;
    if (v === this._dg) return;
    this._dg = v;
    this.dangerEl.style.opacity = String(v);
    const t = v > 0.66 ? 3 : v > 0.33 ? 2 : v > 0 ? 1 : 0;
    if (t !== this._dgT) {
      this._dgT = t;
      this.dangerEl.dataset.t = String(t);
    }
  }

  bossIntro(o) {
    this.intro.play(o);
  }

  setObjective(text) {
    const t = String(text || '');
    if (t === this._objective) return;
    this._objective = t;
    if (!t) {
      this.objEl.classList.remove('is-on');
      return;
    }
    this.objT.textContent = t;
    this.objEl.classList.add('is-on');
    this.objEl.animate(
      [
        { clipPath: 'inset(0 100% 0 0)', filter: 'brightness(2)' },
        { clipPath: 'inset(0 0% 0 0)', filter: 'brightness(1)' },
      ],
      { duration: 480, easing: 'cubic-bezier(.77,0,.18,1)' },
    );
  }
}
