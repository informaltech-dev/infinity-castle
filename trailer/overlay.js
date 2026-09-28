// Trailer overlays: title cards, narration lines, name cards, fades, flashes and the end card.
// Every property is computed from trailer time each frame (no CSS animation), so any frame can be rendered
// on its own. Brush/paper/seal textures are the game's own generated UI textures.
import { installTextures } from '../src/ui/textures.js';

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lin = (a, b, x) => clamp((x - a) / (b - a));
const outC = (x) => 1 - Math.pow(1 - clamp(x), 3);
const inC = (x) => Math.pow(clamp(x), 3);
const inOut = (x) => {
  x = clamp(x);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const outExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x)));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Piecewise-linear keys [[t, v], ...] sampled at x. */
function keys(k, x) {
  if (x <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (x <= k[i][0]) {
      const [t0, v0] = k[i - 1];
      const [t1, v1] = k[i];
      return v0 + (v1 - v0) * inOut((x - t0) / Math.max(1e-6, t1 - t0));
    }
  }
  return k[k.length - 1][1];
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/** Characters wrapped in spans for per-glyph reveals. */
function glyphSpans(text) {
  return [...text].map((c) => (c === ' ' ? '<i class="tr-sp"> </i>' : `<i>${esc(c)}</i>`)).join('');
}

// ------------------------------------------------------------------ element types
const TYPES = {
  black: {
    make: () => el('div', 'tr-black'),
    update(n, it, lt) {
      n.style.opacity = keys(it.keys, lt).toFixed(4);
    },
  },

  flash: {
    make: (it) => {
      const e = el('div', 'tr-flash');
      e.style.background = it.color || '#fff';
      return e;
    },
    update(n, it, lt) {
      const k = it.dur || 0.3;
      n.style.opacity = ((1 - lin(0, k, lt)) ** 2 * (it.amount ?? 1)).toFixed(4);
    },
  },

  bars: {
    make: () => {
      const e = el('div', 'tr-bars');
      e.append(el('div', 'tr-bar tr-bar-t'), el('div', 'tr-bar tr-bar-b'));
      return e;
    },
    update(n, it, lt) {
      const inT = it.in ?? 0.5;
      const outT = it.out ?? 0.5;
      const k = it.dur === Infinity ? outC(lt / inT) : Math.min(outC(lt / inT), 1 - inC((lt - (it.dur - outT)) / outT));
      n.style.setProperty('--k', k.toFixed(4));
    },
  },

  // narration: glyphs ink in one after another, then the line dissolves
  line: {
    make: (it) => {
      const e = el('div', `tr-line tr-at-${it.pos || 'center'}${it.small ? ' is-small' : ''}`);
      e.innerHTML = `<div class="tr-line-main">${glyphSpans(it.text)}</div>${it.sub ? `<div class="tr-line-sub">${esc(it.sub)}</div>` : ''}`;
      e._g = [...e.querySelectorAll('.tr-line-main i')];
      e._sub = e.querySelector('.tr-line-sub');
      return e;
    },
    update(n, it, lt) {
      const stag = it.stagger ?? 0.07;
      const fin = it.fadeIn ?? 0.45;
      n._g.forEach((g, i) => {
        const a = outC((lt - i * stag) / fin);
        g.style.opacity = a.toFixed(3);
        g.style.transform = `translateY(${((1 - a) * 0.35).toFixed(3)}em)`;
        g.style.filter = a < 0.999 ? `blur(${((1 - a) * 8).toFixed(2)}px)` : 'none';
      });
      if (n._sub) {
        const a = outC((lt - (it.subAt ?? n._g.length * stag + 0.2)) / 0.6);
        n._sub.style.opacity = a.toFixed(3);
        n._sub.style.transform = `translateY(${((1 - a) * 0.6).toFixed(3)}em)`;
      }
      const out = it.fadeOut ?? 0.55;
      const o = 1 - inOut((lt - (it.dur - out)) / out);
      n.style.opacity = o.toFixed(3);
      n.style.filter = o < 0.999 ? `blur(${((1 - o) * 10).toFixed(2)}px)` : 'none';
      n.style.letterSpacing = `${(0.32 + (1 - o) * 0.25).toFixed(3)}em`;
    },
  },

  // big stamped title with a brush band behind it
  title: {
    make: (it) => {
      const e = el('div', `tr-title${it.small ? ' is-small' : ''}`);
      e.style.setProperty('--c', it.color || 'var(--verm)');
      e.innerHTML = `<div class="tr-title-band"></div>${it.kicker ? `<div class="tr-title-kicker">${esc(it.kicker)}</div>` : ''}<div class="tr-title-main">${glyphSpans(it.text)}</div>${it.sub ? `<div class="tr-title-sub">${esc(it.sub)}</div>` : ''}`;
      e._band = e.querySelector('.tr-title-band');
      e._main = e.querySelector('.tr-title-main');
      e._g = [...e._main.querySelectorAll('i')];
      e._kick = e.querySelector('.tr-title-kicker');
      e._sub = e.querySelector('.tr-title-sub');
      return e;
    },
    update(n, it, lt) {
      const w = outExpo(lt / 0.42);
      n._band.style.clipPath = `inset(0 ${((1 - w) * 100).toFixed(2)}% 0 0)`;
      n._g.forEach((g, i) => {
        const a = lin(0.08 + i * 0.06, 0.2 + i * 0.06, lt);
        const s = 1.6 - 0.6 * outC(a);
        g.style.opacity = a.toFixed(3);
        g.style.transform = `scale(${s.toFixed(3)})`;
      });
      if (n._kick) n._kick.style.opacity = outC((lt - 0.25) / 0.5).toFixed(3);
      if (n._sub) {
        const a = outC((lt - 0.45) / 0.6);
        n._sub.style.opacity = a.toFixed(3);
        n._sub.style.transform = `translateY(${((1 - a) * 0.5).toFixed(3)}em)`;
      }
      const out = it.fadeOut ?? 0.35;
      const o = 1 - inC((lt - (it.dur - out)) / out);
      n.style.opacity = o.toFixed(3);
      n.style.transform = `translate(-50%, -50%) scale(${(1 + (1 - o) * 0.06 + lt * (it.drift ?? 0.012)).toFixed(4)})`;
    },
  },

  // character introduction: vertical name with a brush stroke, school and title
  name: {
    make: (it) => {
      const e = el('div', `tr-name is-${it.side || 'right'}`);
      e.style.setProperty('--c', it.color || 'var(--water)');
      e.innerHTML = `<div class="tr-name-stroke"></div>
        <div class="tr-name-col">
          <div class="tr-name-label">${esc(it.label || '')}</div>
          <div class="tr-name-main">${glyphSpans(it.name)}</div>
        </div>
        <div class="tr-name-school">${esc(it.school || '')}</div>`;
      e._stroke = e.querySelector('.tr-name-stroke');
      e._label = e.querySelector('.tr-name-label');
      e._g = [...e.querySelectorAll('.tr-name-main i')];
      e._school = e.querySelector('.tr-name-school');
      return e;
    },
    update(n, it, lt) {
      const w = outExpo(lt / 0.5);
      // the stroke is a horizontal brush rotated 90deg: its local right edge is the bottom of the screen
      n._stroke.style.clipPath = `inset(0 ${((1 - w) * 100).toFixed(2)}% 0 0)`;
      n._label.style.opacity = outC((lt - 0.2) / 0.5).toFixed(3);
      n._g.forEach((g, i) => {
        const a = outC((lt - 0.15 - i * 0.07) / 0.35);
        g.style.opacity = a.toFixed(3);
        g.style.transform = `translateY(${((1 - a) * -0.4).toFixed(3)}em)`;
        g.style.filter = a < 0.999 ? `blur(${((1 - a) * 6).toFixed(2)}px)` : 'none';
      });
      const sa = outC((lt - 0.55) / 0.6);
      n._school.style.opacity = sa.toFixed(3);
      n._school.style.transform = `translateX(${((1 - sa) * (it.side === 'left' ? -1 : 1) * 0.8).toFixed(3)}em)`;
      const out = it.fadeOut ?? 0.4;
      const o = 1 - inC((lt - (it.dur - out)) / out);
      n.style.opacity = o.toFixed(3);
    },
  },

  // a feature beat: a numbered seal stamped down, a short line inked in over a brush rule, a note beneath
  feature: {
    make: (it) => {
      const e = el('div', `tr-feat is-${it.side || 'left'}`);
      e.style.setProperty('--c', it.color || 'var(--verm)');
      e.innerHTML = `${it.no ? `<div class="tr-feat-no"><span>${esc(it.no)}</span></div>` : ''}
        <div class="tr-feat-text">
          <div class="tr-feat-main">${glyphSpans(it.text)}</div>
          <div class="tr-feat-rule"></div>
          ${it.sub ? `<div class="tr-feat-sub">${esc(it.sub)}</div>` : ''}
        </div>`;
      e._no = e.querySelector('.tr-feat-no');
      e._g = [...e.querySelectorAll('.tr-feat-main i')];
      e._rule = e.querySelector('.tr-feat-rule');
      e._sub = e.querySelector('.tr-feat-sub');
      return e;
    },
    update(n, it, lt) {
      if (n._no) {
        const a = lin(0, 0.14, lt);
        n._no.style.opacity = a.toFixed(3);
        n._no.style.transform = `rotate(-6deg) scale(${(1.9 - 0.9 * outC(a)).toFixed(3)})`;
      }
      n._g.forEach((g, i) => {
        const a = outC((lt - 0.1 - i * 0.06) / 0.3);
        g.style.opacity = a.toFixed(3);
        g.style.transform = `translateX(${((1 - a) * -0.3).toFixed(3)}em)`;
        g.style.filter = a < 0.999 ? `blur(${((1 - a) * 6).toFixed(2)}px)` : 'none';
      });
      n._rule.style.clipPath = `inset(0 ${((1 - outExpo((lt - 0.2) / 0.5)) * 100).toFixed(2)}% 0 0)`;
      if (n._sub) {
        const a = outC((lt - 0.45) / 0.5);
        n._sub.style.opacity = a.toFixed(3);
        n._sub.style.transform = `translateY(${((1 - a) * 0.5).toFixed(3)}em)`;
      }
      const out = it.fadeOut ?? 0.35;
      const o = 1 - inC((lt - (it.dur - out)) / out);
      n.style.opacity = o.toFixed(3);
    },
  },

  // end card
  logo: {
    make: (it) => {
      const e = el('div', 'tr-logo');
      e.innerHTML = `
        <div class="tr-logo-kicker">${esc(it.kicker || '')}</div>
        <div class="tr-logo-band"></div>
        <div class="tr-logo-main">${glyphSpans(it.text)}</div>
        <div class="tr-logo-seal">${esc(it.seal || '')}</div>
        <div class="tr-logo-sub">${esc(it.sub || '')}</div>
        <div class="tr-logo-url">${esc(it.url || '')}</div>
        <div class="tr-logo-note">${esc(it.note || '')}</div>`;
      e._kick = e.querySelector('.tr-logo-kicker');
      e._band = e.querySelector('.tr-logo-band');
      e._g = [...e.querySelectorAll('.tr-logo-main i')];
      e._seal = e.querySelector('.tr-logo-seal');
      e._sub = e.querySelector('.tr-logo-sub');
      e._url = e.querySelector('.tr-logo-url');
      e._note = e.querySelector('.tr-logo-note');
      return e;
    },
    update(n, it, lt) {
      const w = outExpo(lt / 0.5);
      n._band.style.clipPath = `inset(0 ${((1 - w) * 100).toFixed(2)}% 0 0)`;
      n._g.forEach((g, i) => {
        const a = lin(0.05 + i * 0.09, 0.17 + i * 0.09, lt);
        g.style.opacity = a.toFixed(3);
        g.style.transform = `scale(${(1.7 - 0.7 * outC(a)).toFixed(3)})`;
      });
      n._kick.style.opacity = outC((lt - 0.5) / 0.7).toFixed(3);
      const sa = lin(0.75, 0.9, lt);
      n._seal.style.opacity = sa.toFixed(3);
      n._seal.style.transform = `rotate(-8deg) scale(${(1.8 - 0.8 * outC(sa)).toFixed(3)})`;
      const fade = (el2, t0) => {
        const a = outC((lt - t0) / 0.7);
        el2.style.opacity = a.toFixed(3);
        el2.style.transform = `translateY(${((1 - a) * 0.6).toFixed(3)}em)`;
      };
      fade(n._sub, 1.0);
      fade(n._url, it.urlAt ?? 1.5);
      fade(n._note, (it.urlAt ?? 1.5) + 0.3);
      const out = it.fadeOut ?? 0;
      n.style.opacity = out ? (1 - inOut((lt - (it.dur - out)) / out)).toFixed(3) : '1';
      n.style.transform = `translate(-50%, -50%) scale(${(1 + lt * 0.008).toFixed(4)})`;
    },
  },
};

export class Overlay {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.items = [];
    this.nodes = new Map();
    installTextures(root);
    root.classList.add('tr-root');
  }

  setItems(items) {
    this.items = items;
  }

  glyphs() {
    return this.items.map((it) => [it.text, it.sub, it.kicker, it.label, it.name, it.school, it.seal, it.url, it.note, it.no].filter(Boolean).join('')).join('');
  }

  /** HUD mode: 'game' (full HUD), 'cine' (callouts, subtitles and cards only) or 'none'. */
  hud(mode) {
    const b = document.body.classList;
    b.remove('tr-hud-game', 'tr-hud-cine', 'tr-hud-none');
    b.add('tr-hud-' + mode);
  }

  update(t) {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const lt = t - it.at;
      const on = lt >= 0 && lt < it.dur;
      let n = this.nodes.get(it);
      if (!on) {
        if (n && n.isConnected) n.remove();
        continue;
      }
      const T = TYPES[it.type];
      if (!T) continue;
      if (!n) {
        n = T.make(it);
        n.style.zIndex = String(it.z ?? 10 + i);
        this.nodes.set(it, n);
      }
      if (!n.isConnected) this.root.append(n);
      T.update(n, it, lt);
    }
  }
}
