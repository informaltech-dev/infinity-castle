// HUD transient elements: callouts, banners, subtitles, prompts, toasts, lock-on, enemy bars,
// damage numbers and the boss title card. All pooled; per-frame setters only touch the DOM on change.
import { h, clamp, restartClass } from './dom.js';
import { keyCap, mouseIcon, touchIcon, compassSVG } from './icons.js';

const EASE_BRUSH = 'cubic-bezier(.77,0,.18,1)';
const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';

function fadeOut(node, dur, done, extra = {}) {
  const token = ++node.token;
  if (node.out) node.out.cancel();
  node.out = node.el.animate({ opacity: 0, ...extra }, { duration: dur, easing: 'ease-in', fill: 'forwards' });
  node.out.onfinish = () => {
    if (token !== node.token) return;
    node.el.hidden = true;
    for (const a of node.anims) a.cancel();
    node.anims = [];
    if (node.out) node.out.cancel();
    node.out = null;
    if (done) done();
  };
}

function resetNode(node) {
  node.token++;
  clearTimeout(node.t);
  if (node.out) node.out.cancel();
  node.out = null;
  for (const a of node.anims) a.cancel();
  node.anims = [];
}

/* -------------------------------------------------------------------------- Technique callouts */
export class Callouts {
  constructor(parent) {
    this.layer = h('div', { class: 'hd-callouts' });
    parent.append(this.layer);
    this.nodes = [this._make(), this._make()];
    this.cur = -1;
  }
  _make() {
    const el = h('div', { class: 'hd-co', hidden: true });
    el.innerHTML = `<div class="co-splash"></div><div class="co-flecks"></div><div class="co-text"><div class="co-school"></div><div class="co-form"></div><div class="co-name"></div></div>`;
    this.layer.append(el);
    const q = (s) => el.querySelector(s);
    return { el, splash: q('.co-splash'), flecks: q('.co-flecks'), school: q('.co-school'), form: q('.co-form'), name: q('.co-name'), anims: [], out: null, token: 0, t: 0 };
  }
  show(o = {}) {
    const { school = '', form = '', name = '', style = 'water', side = 'right' } = o || {};
    if (this.cur >= 0) {
      const prev = this.nodes[this.cur];
      if (!prev.el.hidden) {
        clearTimeout(prev.t);
        fadeOut(prev, 160, null, { transform: 'translateY(-3%)' });
      }
    }
    this.cur = (this.cur + 1) % this.nodes.length;
    const n = this.nodes[this.cur];
    resetNode(n);
    const st = ['water', 'fire', 'demon', 'calm'].includes(style) ? style : 'water';
    n.el.className = `hd-co is-${st} is-${side === 'left' ? 'left' : 'right'}`;
    n.school.textContent = school;
    n.form.textContent = form;
    n.name.textContent = name;
    n.school.hidden = !school;
    n.form.hidden = !form;
    n.el.style.setProperty('--len', String(Math.max(2, [...String(name)].length)));
    n.el.hidden = false;
    const calm = st === 'calm';
    const inDur = calm ? 560 : 250;
    const hold = calm ? 1650 : 1400;
    const A = n.anims;
    A.push(n.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: calm ? 420 : 80, fill: 'both' }));
    A.push(
      n.splash.animate(
        [
          { clipPath: 'inset(0 0 100% 0)', transform: 'scale(1.18, 0.92)' },
          { clipPath: 'inset(0 0 0% 0)', transform: 'scale(1, 1)' },
        ],
        { duration: inDur, easing: EASE_BRUSH, fill: 'both' },
      ),
    );
    A.push(n.flecks.animate([{ opacity: 0, transform: 'translateY(-6%) scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: inDur + 220, delay: 60, easing: EASE_OUT, fill: 'both' }));
    [n.school, n.form, n.name].forEach((el, i) => {
      A.push(
        el.animate(
          [
            { clipPath: 'inset(0 0 100% 0)', transform: 'translateY(-10%)', opacity: 0.4 },
            { clipPath: 'inset(0 0 0% 0)', transform: 'none', opacity: 1 },
          ],
          { duration: inDur, delay: 30 + i * 70, easing: EASE_BRUSH, fill: 'both' },
        ),
      );
    });
    n.t = setTimeout(() => fadeOut(n, calm ? 520 : 380, null, { transform: 'translateY(2%)', filter: 'blur(3px)' }), inDur + hold);
  }
  clear() {
    for (const n of this.nodes) {
      resetNode(n);
      n.el.hidden = true;
    }
  }
}

/* -------------------------------------------------------------------------- Banner */
export class Banner {
  constructor(parent) {
    this.el = h('div', { class: 'hd-banner', hidden: true });
    this.el.innerHTML = `<div class="bn-stroke"></div><div class="bn-text ic-cal"></div><div class="bn-sub"></div>`;
    parent.append(this.el);
    this.node = { el: this.el, anims: [], out: null, token: 0, t: 0 };
    this.stroke = this.el.querySelector('.bn-stroke');
    this.text = this.el.querySelector('.bn-text');
    this.sub = this.el.querySelector('.bn-sub');
  }
  show(text, subtext = '', style = 'normal') {
    const n = this.node;
    resetNode(n);
    const st = ['normal', 'danger', 'victory'].includes(style) ? style : 'normal';
    this.el.className = `hd-banner is-${st}`;
    this.text.textContent = text || '';
    this.sub.textContent = subtext || '';
    this.sub.hidden = !subtext;
    this.el.hidden = false;
    const A = n.anims;
    A.push(this.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: 'both' }));
    A.push(this.stroke.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], { duration: 320, easing: EASE_BRUSH, fill: 'both' }));
    A.push(
      this.text.animate(
        [
          { opacity: 0, transform: 'scale(1.5)', letterSpacing: '0.6em' },
          { opacity: 1, transform: 'scale(1)', letterSpacing: '0.28em' },
        ],
        { duration: 380, delay: 90, easing: EASE_OUT, fill: 'both' },
      ),
    );
    A.push(this.sub.animate([{ opacity: 0, transform: 'translateY(40%)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 320, easing: EASE_OUT, fill: 'both' }));
    if (st === 'danger') {
      A.push(
        this.el.animate(
          [{ transform: 'translate(-50%,-50%)' }, { transform: 'translate(calc(-50% - 6px),-50%)' }, { transform: 'translate(calc(-50% + 5px),-50%)' }, { transform: 'translate(-50%,-50%)' }],
          { duration: 240, delay: 120, iterations: 2 },
        ),
      );
    }
    n.t = setTimeout(() => fadeOut(n, 320, null, { transform: 'translate(-50%,-50%) scale(1.04)' }), 1900);
  }
  clear() {
    resetNode(this.node);
    this.el.hidden = true;
  }
}

/* -------------------------------------------------------------------------- Subtitle */
export class Subtitle {
  constructor(parent) {
    this.el = h('div', { class: 'hd-sub', hidden: true });
    this.el.innerHTML = `<span class="sb-spk"></span><span class="sb-txt"></span>`;
    parent.append(this.el);
    this.node = { el: this.el, anims: [], out: null, token: 0, t: 0 };
    this.spk = this.el.querySelector('.sb-spk');
    this.txt = this.el.querySelector('.sb-txt');
  }
  show(speaker, text, dur) {
    const n = this.node;
    resetNode(n);
    this.spk.textContent = speaker || '';
    this.spk.hidden = !speaker;
    this.txt.textContent = text || '';
    this.el.hidden = !text && !speaker;
    if (this.el.hidden) return;
    n.anims.push(this.el.animate([{ opacity: 0, transform: 'translate(-50%, 30%)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 260, easing: EASE_OUT, fill: 'both' }));
    const secs = Number(dur) > 0 ? Number(dur) : Math.max(2.2, [...String(text || '')].length * 0.2);
    n.t = setTimeout(() => fadeOut(n, 300), secs * 1000);
  }
  clear() {
    resetNode(this.node);
    this.el.hidden = true;
  }
}

/* -------------------------------------------------------------------------- Prompt */
function keyGlyph(label) {
  const l = String(label || '');
  if (l.startsWith('touch:')) return touchIcon('btn', l.slice(6));
  if (l === '左鍵') return mouseIcon('left');
  if (l === '右鍵') return mouseIcon('right');
  if (l === '中鍵' || l === '滑鼠中鍵') return mouseIcon('middle');
  if (!l) return '';
  const len = [...l].length;
  return keyCap(l, len <= 1 ? 1 : len <= 3 ? 0.55 + len * 0.42 : 0.5 + len * 0.36);
}

export class Prompt {
  constructor(parent) {
    this.el = h('div', { class: 'hd-prompt' });
    this.el.innerHTML = `<span class="pr-ring"></span><span class="pr-key"></span><span class="pr-label"></span><span class="pr-txt ic-cal"></span>`;
    parent.append(this.el);
    this.keyEl = this.el.querySelector('.pr-key');
    this.labelEl = this.el.querySelector('.pr-label');
    this.txtEl = this.el.querySelector('.pr-txt');
    this.on = false;
    this.text = null;
    this.key = null;
  }
  show(text, keyLabel) {
    const t = String(text || '');
    const k = String(keyLabel || '');
    if (k !== this.key) {
      this.key = k;
      this.keyEl.innerHTML = keyGlyph(k);
      const isMouse = k === '左鍵' || k === '右鍵' || k === '中鍵' || k === '滑鼠中鍵';
      this.labelEl.textContent = isMouse ? k : '';
      this.labelEl.hidden = !isMouse;
      this.el.classList.toggle('is-touch', k.startsWith('touch:'));
    }
    if (t !== this.text) {
      this.text = t;
      this.txtEl.textContent = t;
    }
    if (!this.on) {
      this.on = true;
      this.el.classList.add('is-on');
    }
  }
  hide() {
    if (!this.on) return;
    this.on = false;
    this.el.classList.remove('is-on');
  }
}

/* -------------------------------------------------------------------------- Toasts */
export class Toasts {
  constructor(parent) {
    this.layer = h('div', { class: 'hd-toasts' });
    parent.append(this.layer);
    this.nodes = [0, 1, 2].map(() => {
      const el = h('div', { class: 'hd-toast', hidden: true });
      el.innerHTML = `<div class="ts-splat"></div><div class="ts-slash"></div><span class="ts-t ic-cal"></span>`;
      this.layer.append(el);
      return { el, t: 0, anims: [], out: null, token: 0, txt: el.querySelector('.ts-t'), splat: el.querySelector('.ts-splat'), slash: el.querySelector('.ts-slash') };
    });
    this.i = 0;
  }
  show(text, style = 'info') {
    // push older visible toasts down
    for (const n of this.nodes) {
      if (!n.el.hidden && !n.out) {
        clearTimeout(n.t);
        fadeOut(n, 220, null, { transform: 'translate(-50%, 70%) scale(.8)' });
      }
    }
    const n = this.nodes[this.i];
    this.i = (this.i + 1) % this.nodes.length;
    resetNode(n);
    const st = ['perfect', 'counter', 'break', 'info'].includes(style) ? style : 'info';
    n.el.className = `hd-toast is-${st}`;
    n.txt.textContent = text || '';
    n.el.hidden = false;
    n.anims.push(
      n.el.animate(
        [
          { opacity: 0, transform: 'translate(-50%,0) scale(.55)' },
          { opacity: 1, transform: 'translate(-50%,0) scale(1.14)', offset: 0.55 },
          { opacity: 1, transform: 'translate(-50%,0) scale(1)' },
        ],
        { duration: 230, easing: EASE_OUT, fill: 'both' },
      ),
    );
    n.anims.push(n.splat.animate([{ transform: 'translate(-50%,-50%) scale(.3) rotate(-30deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 }], { duration: 260, easing: EASE_OUT, fill: 'both' }));
    n.anims.push(n.slash.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], { duration: 200, delay: 60, easing: EASE_BRUSH, fill: 'both' }));
    n.t = setTimeout(() => fadeOut(n, 320, null, { transform: 'translate(-50%,-40%) scale(1.05)' }), 950);
  }
  clear() {
    for (const n of this.nodes) {
      resetNode(n);
      n.el.hidden = true;
    }
  }
}

/* -------------------------------------------------------------------------- Lock-on reticle */
export class LockOn {
  constructor(parent) {
    this.el = h('div', { class: 'hd-lock' });
    this.el.innerHTML = `<div class="lk-in"><svg class="lk-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" pathLength="100"/></svg><i class="lk-t is-n"></i><i class="lk-t is-e"></i><i class="lk-t is-s"></i><i class="lk-t is-w"></i><i class="lk-dot"></i></div>`;
    parent.append(this.el);
    this.v = false;
    this.x = NaN;
    this.y = NaN;
    this.s = NaN;
  }
  set(x, y, visible, scale = 1) {
    const v = !!visible;
    if (v !== this.v) {
      this.v = v;
      this.el.classList.toggle('is-on', v);
    }
    if (!v) return;
    const nx = Math.round((Number(x) || 0) * 2) / 2;
    const ny = Math.round((Number(y) || 0) * 2) / 2;
    const ns = Math.round(clamp(Number(scale) || 1, 0.2, 4) * 100) / 100;
    if (nx !== this.x || ny !== this.y || ns !== this.s) {
      this.x = nx;
      this.y = ny;
      this.s = ns;
      this.el.style.transform = `translate3d(${nx}px, ${ny}px, 0) scale(${ns})`;
    }
  }
}

/* -------------------------------------------------------------------------- Enemy bars */
export class EnemyBars {
  constructor(parent) {
    this.layer = h('div', { class: 'hd-ebars' });
    parent.append(this.layer);
    this.map = new Map();
    this.free = [];
    this.seen = new Set();
  }
  _make() {
    const el = h('div', { class: 'hd-eb' });
    el.innerHTML = `<div class="eb-in"><div class="eb-trail"></div><div class="eb-fill"></div></div>`;
    this.layer.append(el);
    return { el, fill: el.querySelector('.eb-fill'), trail: el.querySelector('.eb-trail'), hp: -1, x: NaN, y: NaN, fresh: true, low: false };
  }
  update(list) {
    const seen = this.seen;
    seen.clear();
    if (Array.isArray(list)) {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e || !e.visible) continue;
        let n = this.map.get(e.id);
        if (!n) {
          n = this.free.pop() || this._make();
          n.fresh = true;
          n.hp = -1;
          n.x = NaN;
          this.map.set(e.id, n);
          n.el.classList.add('is-on');
        }
        seen.add(e.id);
        const x = Math.round((Number(e.x) || 0) * 2) / 2;
        const y = Math.round((Number(e.y) || 0) * 2) / 2;
        if (x !== n.x || y !== n.y) {
          n.x = x;
          n.y = y;
          n.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        }
        const hp = clamp(Number(e.hp01) || 0, 0, 1);
        if (n.fresh) {
          n.fill.style.transition = 'none';
          n.trail.style.transition = 'none';
          n.fill.style.transform = `scaleX(${hp})`;
          n.trail.style.transform = `scaleX(${hp})`;
          n.hp = hp;
          n.fresh = false;
          n.restore = true;
        } else if (Math.abs(hp - n.hp) > 0.0015) {
          if (n.restore) {
            n.fill.style.transition = '';
            n.restore = false;
          }
          const dec = hp < n.hp;
          n.trail.style.transition = dec ? '' : 'none';
          n.fill.style.transform = `scaleX(${hp})`;
          n.trail.style.transform = `scaleX(${hp})`;
          n.hp = hp;
          if (dec) n.el.classList.add('is-hit'), (n.hitT = performance.now());
        }
        if (n.hitT && performance.now() - n.hitT > 160) {
          n.el.classList.remove('is-hit');
          n.hitT = 0;
        }
        const low = hp < 0.3;
        if (low !== n.low) {
          n.low = low;
          n.el.classList.toggle('is-low', low);
        }
      }
    }
    for (const [id, n] of this.map) {
      if (!seen.has(id)) {
        n.el.classList.remove('is-on', 'is-hit');
        this.map.delete(id);
        this.free.push(n);
      }
    }
  }
  clear() {
    this.update([]);
  }
}

/* -------------------------------------------------------------------------- Damage numbers */
export class DamageNumbers {
  constructor(parent, size = 48) {
    this.layer = h('div', { class: 'hd-dmg' });
    parent.append(this.layer);
    this.pool = [];
    for (let i = 0; i < size; i++) {
      const el = h('div', { class: 'hd-dn' });
      const span = h('span');
      el.append(span);
      this.layer.append(el);
      this.pool.push({ el, span, anim: null });
    }
    this.i = 0;
  }
  spawn(x, y, value, kind = 'normal') {
    const n = this.pool[this.i];
    this.i = (this.i + 1) % this.pool.length;
    if (n.anim) n.anim.cancel();
    const k = kind === 'crit' || kind === 'player' ? kind : 'normal';
    const v = Math.max(0, Math.round(Math.abs(Number(value) || 0)));
    n.el.className = `hd-dn is-${k}`;
    n.span.textContent = k === 'player' ? `-${v}` : String(v);
    const jx = (Math.random() - 0.5) * 40;
    n.el.style.transform = `translate3d(${Math.round((Number(x) || 0) + jx)}px, ${Math.round(Number(y) || 0)}px, 0)`;
    const dx = Math.round((Math.random() - 0.5) * 50);
    let frames, dur;
    if (k === 'crit') {
      dur = 1150;
      frames = [
        { transform: 'translate(-50%,-50%) scale(2.4) rotate(-8deg)', opacity: 0 },
        { transform: 'translate(-50%,-60%) scale(0.92) rotate(-4deg)', opacity: 1, offset: 0.12 },
        { transform: 'translate(-50%,-70%) scale(1.05) rotate(-4deg)', opacity: 1, offset: 0.22 },
        { transform: 'translate(-50%,-110%) scale(1) rotate(-4deg)', opacity: 1, offset: 0.7 },
        { transform: `translate(calc(-50% + ${dx}px), -260%) scale(0.9) rotate(-4deg)`, opacity: 0 },
      ];
    } else if (k === 'player') {
      dur = 900;
      frames = [
        { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 },
        { transform: 'translate(-50%,-60%) scale(1)', opacity: 1, offset: 0.15 },
        { transform: `translate(calc(-50% + ${dx}px), 120%) scale(0.85)`, opacity: 0 },
      ];
    } else {
      dur = 820;
      frames = [
        { transform: 'translate(-50%,-50%) scale(0.5)', opacity: 0 },
        { transform: 'translate(-50%,-90%) scale(1.18)', opacity: 1, offset: 0.14 },
        { transform: 'translate(-50%,-120%) scale(1)', opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), -230%) scale(0.85)`, opacity: 0 },
      ];
    }
    n.anim = n.span.animate(frames, { duration: dur, easing: 'cubic-bezier(.2,.75,.3,1)', fill: 'forwards' });
  }
  clear() {
    for (const n of this.pool) if (n.anim) n.anim.cancel();
  }
}

/* -------------------------------------------------------------------------- Boss title card */
export class BossIntro {
  constructor(parent) {
    this.el = h('div', { class: 'hd-bi', hidden: true });
    this.el.innerHTML = `
      <div class="bi-dim"></div>
      <div class="bi-band"></div>
      <div class="bi-slash"></div>
      <div class="bi-compass">${compassSVG()}</div>
      <div class="bi-card">
        <div class="bi-title"><i></i><span></span><i></i></div>
        <div class="bi-name ic-cal"></div>
        <div class="bi-subtitle"></div>
      </div>`;
    parent.append(this.el);
    this.titleEl = this.el.querySelector('.bi-title span');
    this.nameEl = this.el.querySelector('.bi-name');
    this.subEl = this.el.querySelector('.bi-subtitle');
    this.hudRoot = parent;
    this.t = 0;
  }
  play(o = {}) {
    const { title = '', name = '', subtitle = '' } = o || {};
    if (this.hudRoot) this.hudRoot.classList.add('is-intro');
    this.titleEl.textContent = title;
    this.nameEl.textContent = name;
    this.subEl.textContent = subtitle;
    this.subEl.hidden = !subtitle;
    this.el.hidden = false;
    restartClass(this.el, 'is-play');
    clearTimeout(this.t);
    this.t = setTimeout(() => this.clear(), 3250);
  }
  clear() {
    clearTimeout(this.t);
    this.el.classList.remove('is-play');
    this.el.hidden = true;
    if (this.hudRoot) this.hudRoot.classList.remove('is-intro');
  }
}
