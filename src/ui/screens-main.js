// Loading · Title · Main menu · Pause · Result screens.
import { h, esc, clamp, rng, fmtTime, fmtInt } from './dom.js';
import { enso, ensoPath, sealHTML, ICON } from './icons.js';
import { Screen, makeHints, Confirm } from './screen-base.js';
import { MENU_ITEMS, PAUSE_ITEMS, LOADING_TIPS, LOADING_TIPS_TOUCH, RANK_GLYPH, RANK_WORD, CHAR_BY_ID } from './data.js';

function motes(container, count, seed, colors) {
  const R = rng(seed);
  for (let i = 0; i < count; i++) {
    const s = 1.5 + R() * 4;
    container.append(
      h('i', {
        class: 'ic-mote',
        vars: {
          '--s': `${s.toFixed(1)}px`,
          '--t': `${(7 + R() * 9).toFixed(1)}s`,
          '--delay': `${(-R() * 16).toFixed(1)}s`,
          '--dx': `${((R() - 0.5) * 12).toFixed(1)}vw`,
          '--o': (0.25 + R() * 0.55).toFixed(2),
          '--c': colors[Math.floor(R() * colors.length)],
        },
        style: { left: `${(R() * 100).toFixed(1)}%`, top: `${(55 + R() * 50).toFixed(1)}%` },
      }),
    );
  }
}

/* -------------------------------------------------------------------------- Loading */
export class LoadingScreen extends Screen {
  constructor(ui) {
    super(ui, 'loading', 'ic-loading');
    this.outMs = 620;
    this.el.innerHTML = `
      <div class="ld-center">
        <div class="ld-ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path class="ld-enso" d="${ensoPath({ r: 46, w: 5, seed: 4, sweep: 340 })}"/>
            <circle class="ld-track" cx="50" cy="50" r="38"/>
            <circle class="ld-prog" cx="50" cy="50" r="38" pathLength="1"/>
          </svg>
          <div class="ld-title ic-cal ic-vert">無限城</div>
        </div>
        <div class="ld-text"></div>
        <div class="ld-pct"></div>
      </div>
      <div class="ld-tip"><span class="ld-tip-k">提示</span><span class="ld-tip-t"></span></div>
      <div class="ic-grain"></div>`;
    this.prog = this.el.querySelector('.ld-prog');
    this.textEl = this.el.querySelector('.ld-text');
    this.pctEl = this.el.querySelector('.ld-pct');
    this.tipEl = this.el.querySelector('.ld-tip-t');
    this._p = -1;
    this._text = null;
    this._tip = Math.floor(Math.random() * LOADING_TIPS.length);
  }
  onShow() {
    const tips = this.ui.touchMode ? LOADING_TIPS_TOUCH : LOADING_TIPS;
    this._tip = (this._tip + 1) % tips.length;
    this.tipEl.textContent = tips[this._tip];
  }
  set(p, text) {
    p = clamp(Number(p) || 0, 0, 1);
    if (Math.abs(p - this._p) > 0.0005) {
      this._p = p;
      this.prog.style.strokeDashoffset = String(1 - p);
      this.pctEl.textContent = `${Math.round(p * 100)}%`;
    }
    const t = text || '載入中';
    if (t !== this._text) {
      this._text = t;
      this.textEl.textContent = t;
    }
  }
}

/* -------------------------------------------------------------------------- Title */
export class TitleScreen extends Screen {
  constructor(ui) {
    super(ui, 'title', 'ic-title');
    this.el.innerHTML = `
      <div class="tt-bg"></div>
      <div class="tt-enso">${enso({ r: 42, w: 7.5, seed: 17, start: -70, sweep: 332, wobble: 1.4 }, '')}</div>
      <div class="ic-motes"></div>
      <div class="ic-frame"></div>
      <div class="tt-logo">
        <h1 class="tt-main ic-cal"><span>無</span><span>限</span><span>城</span></h1>
        <div class="tt-side"><div class="tt-sub ic-vert">鬼滅之刃 同人動作演示</div>${sealHTML('鬼滅', 'tt-seal')}</div>
      </div>
      <div class="tt-press"><i></i><span>按任意鍵開始</span><i></i></div>
      <div class="tt-foot">非營利同人作品，角色與世界觀版權歸原作者所有</div>
      <div class="ic-grain"></div>`;
    motes(this.el.querySelector('.ic-motes'), 26, 5, ['rgba(255,140,90,.8)', 'rgba(239,230,210,.7)', 'rgba(224,41,74,.7)']);
    this.pressEl = this.el.querySelector('.tt-press > span');
    this.el.addEventListener('click', () => ui._titleAdvance());
  }
  onTouchMode(on) {
    this.pressEl.textContent = on ? '輕觸畫面開始' : '按任意鍵開始';
  }
  nav() {
    return true;
  }
}

/* -------------------------------------------------------------------------- Main menu */
export class MenuScreen extends Screen {
  constructor(ui) {
    super(ui, 'menu', 'ic-menu');
    this.el.innerHTML = `
      <div class="mn-bg"></div>
      <div class="mn-wash"></div>
      <div class="mn-logo"><div class="mn-logo-t ic-cal ic-wipe" style="--d:.05s">無限城</div>${sealHTML('無限')}<div class="mn-logo-s">鬼滅之刃 同人動作演示</div></div>
      <nav class="mn-list"></nav>
      <div class="mn-side ic-vert">大正・無限城</div>
      <div class="ic-grain"></div>`;
    const list = this.el.querySelector('.mn-list');
    const items = MENU_ITEMS.map((m, i) => {
      const el = h('div', {
        class: 'ic-mi',
        vars: { '--i': i },
        html: `${ICON.blade}<span class="mi-num">${m.num}</span><span class="mi-label ic-cal">${esc(m.label)}</span><span class="mi-sub">${esc(m.sub)}</span>`,
      });
      list.append(el);
      return { el, act: () => ui._menuSelect(m.id) };
    });
    this.subs = MENU_ITEMS.map((m, i) => ({ m, el: items[i].el.querySelector('.mi-sub') }));
    this.bindItems(items);
    this.el.append(
      makeHints(
        [
          { keys: ['up', 'down'], label: '選擇' },
          { keys: [{ k: 'Enter', w: 1.8 }], label: '確認', act: () => this.activate() },
          { keys: [{ k: 'Esc', w: 1.4 }], label: '返回', act: () => this.nav('back') },
        ],
        'mn-hints',
      ),
    );
  }
  onShow() {
    this.items.forEach((it) => it.el.classList.remove('is-focus'));
    this.focus(this.index, false);
  }
  onTouchMode(on) {
    for (const { m, el } of this.subs) el.textContent = on && m.touchSub ? m.touchSub : m.sub;
  }
  back() {
    this.ui._sound('uiBack');
    this.ui.showTitle();
  }
}

/* -------------------------------------------------------------------------- Pause */
export class PauseScreen extends Screen {
  constructor(ui) {
    super(ui, 'pause', 'ic-pause');
    this.el.innerHTML = `
      <div class="ps-wash"></div>
      <div class="ps-head"><h2 class="ps-title ic-cal"><span>暫</span><span>停</span></h2>${sealHTML('小憩')}</div>
      <nav class="ps-list"></nav>
      <div class="ps-info"></div>`;
    const list = this.el.querySelector('.ps-list');
    this.infoEl = this.el.querySelector('.ps-info');
    const items = PAUSE_ITEMS.map((p, i) => {
      const el = h('div', {
        class: 'ic-mi',
        vars: { '--i': i },
        html: `${ICON.blade}<span class="mi-num">${'壹貳參肆伍'[i]}</span><span class="mi-label ic-cal">${esc(p.label)}</span>`,
      });
      list.append(el);
      const act = p.confirm
        ? () => this.dialog.ask(p.label, p.confirm, () => ui._pauseSelect(p.id))
        : () => ui._pauseSelect(p.id);
      return { el, act };
    });
    this.bindItems(items);
    this.el.append(
      makeHints(
        [
          { keys: ['up', 'down'], label: '選擇' },
          { keys: [{ k: 'Enter', w: 1.8 }], label: '確認', act: () => this.activate() },
          { keys: [{ k: 'Esc', w: 1.4 }], label: '繼續', act: () => this.nav('back') },
        ],
        'ps-hints',
      ),
    );
    this.dialog = new Confirm(ui, this);
  }
  onShow(keepFocus) {
    this.dialog.close();
    if (!keepFocus) this.index = 0;
    this.items.forEach((it) => it.el.classList.remove('is-focus'));
    this.focus(this.index, false);
    const c = CHAR_BY_ID[this.ui._hudChar];
    const obj = this.ui.hud ? this.ui.hud._objective : '';
    this.infoEl.innerHTML = c
      ? `<b>${esc(c.name)}</b>${esc(c.school)}${obj ? `<br>當前目標：${esc(obj)}` : ''}`
      : obj
        ? `當前目標：${esc(obj)}`
        : '';
  }
  nav(a) {
    if (this.dialog.open) return this.dialog.nav(a);
    return super.nav(a);
  }
  back() {
    this.ui._resumeFromPause();
  }
}

/* -------------------------------------------------------------------------- Result */
export class ResultScreen extends Screen {
  constructor(ui) {
    super(ui, 'result', 'ic-result');
    this.el.innerHTML = `
      <div class="rs-rays"></div>
      <div class="rs-splash"></div>
      <h2 class="rs-title ic-cal"><span></span><span></span></h2>
      <div class="rs-char"></div>
      <div class="rs-right">
        <div class="rs-panel ic-washi is-light">
          <div class="rs-head">戰績</div>
          <dl class="rs-stats"></dl>
          <div class="rs-rank"><span class="rs-rank-l">評價</span><span class="rs-rank-r"><span class="rs-rank-w"></span>${sealHTML('', 'rs-seal')}</span></div>
        </div>
        <div class="rs-btns"></div>
      </div>
      <div class="ic-grain"></div>`;
    this.titleSpans = this.el.querySelectorAll('.rs-title > span');
    this.charEl = this.el.querySelector('.rs-char');
    this.statsEl = this.el.querySelector('.rs-stats');
    this.rankEl = this.el.querySelector('.rs-rank');
    this.rankWord = this.el.querySelector('.rs-rank-w');
    this.sealText = this.el.querySelector('.rs-seal > span');
    const btns = this.el.querySelector('.rs-btns');
    const mk = (label, act) => {
      const el = h('div', { class: 'ic-btn', text: label });
      btns.append(el);
      return { el, act };
    };
    this.bindItems([mk('再戰一次', () => ui._resultAction('restart')), mk('回到標題', () => ui._resultAction('quit'))]);
    this._raf = 0;
    this._timers = [];
  }

  onShow(data) {
    const d = data || {};
    const v = !!d.victory;
    const st = d.stats || {};
    this.el.classList.toggle('is-victory', v);
    this.el.classList.toggle('is-defeat', !v);
    const word = v ? '勝利' : '敗北';
    this.titleSpans[0].textContent = word[0];
    this.titleSpans[1].textContent = word[1];
    const c = CHAR_BY_ID[d.character];
    this.charEl.textContent = c ? `${c.title}・${c.name}` : '';
    const t = fmtTime(st.time);
    const rows = [
      { k: '通關時間', v: Number(st.time) || 0, f: () => `${t.m}<small>分</small>${t.s}<small>秒</small>`, time: true },
      { k: '最高連擊', v: Number(st.maxCombo) || 0, unit: '連擊' },
      { k: '擊殺數', v: Number(st.kills) || 0 },
      { k: '承受傷害', v: Number(st.damageTaken) || 0 },
    ];
    this.statsEl.innerHTML = rows
      .map((r, i) => `<div class="rs-row" style="--i:${i}"><dt>${r.k}</dt><dd data-i="${i}">0</dd></div>`)
      .join('');
    const dds = this.statsEl.querySelectorAll('dd');
    const rank = ['S', 'A', 'B', 'C'].includes(st.rank) ? st.rank : 'B';
    this.rankEl.className = `rs-rank is-${rank}`;
    this.sealText.textContent = RANK_GLYPH[rank];
    this.rankWord.textContent = RANK_WORD[rank];
    // count-up
    cancelAnimationFrame(this._raf);
    this._timers.forEach(clearTimeout);
    this._timers = [];
    const t0 = performance.now() + 650;
    const dur = 900;
    const render = (r, k) => {
      if (r.time) {
        const tt = fmtTime(r.v * k);
        return `${tt.m}<small>分</small>${tt.s}<small>秒</small>`;
      }
      return `${fmtInt(r.v * k)}${r.unit ? `<small>${r.unit}</small>` : ''}`;
    };
    const tick = (now) => {
      const k = clamp((now - t0) / dur, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      rows.forEach((r, i) => {
        dds[i].innerHTML = render(r, e);
      });
      if (k < 1 && this.visible) this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
    this._timers.push(
      setTimeout(() => {
        if (!this.visible) return;
        this.rankEl.classList.add('is-on');
        this.ui._sound('uiConfirm');
      }, 1750),
    );
    this.items.forEach((it) => it.el.classList.remove('is-focus'));
    this.index = 0;
    this.focus(0, false);
  }

  onHide() {
    cancelAnimationFrame(this._raf);
    this._timers.forEach(clearTimeout);
    this._timers = [];
  }

  nav(a) {
    if (a === 'left' || a === 'up') {
      this.move(-1);
      return true;
    }
    if (a === 'right' || a === 'down') {
      this.move(1);
      return true;
    }
    if (a === 'confirm') {
      this.activate();
      return true;
    }
    return a === 'back';
  }
}
