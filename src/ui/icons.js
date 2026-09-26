// Inline SVG glyphs: brush-drawn key caps, mouse, gamepad, ensō circles, seals and patterns.
import { rng, esc } from './dom.js';

const f1 = (n) => n.toFixed(1);
const toD = (pts) => 'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L') + 'Z';

/** Variable-width ensō (brush circle) outline path. */
export function ensoPath({ cx = 50, cy = 50, r = 40, w = 8, start = -100, sweep = 330, seed = 1, wobble = 1.2 } = {}) {
  const R = rng(seed);
  const n = 72;
  const outer = [];
  const inner = [];
  const p1 = R() * 6.28, p2 = R() * 6.28;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = ((start + sweep * t) * Math.PI) / 180;
    const rr = r + Math.sin(t * 5 + p1) * wobble + Math.sin(t * 13 + p2) * wobble * 0.35;
    const ww = w * (0.5 + 0.5 * Math.min(1, t / 0.05)) * (1 - 0.88 * Math.pow(t, 2.6)) * (0.92 + 0.08 * Math.sin(t * 19 + p1));
    outer.push([cx + Math.cos(a) * (rr + ww / 2), cy + Math.sin(a) * (rr + ww / 2)]);
    inner.push([cx + Math.cos(a) * (rr - ww / 2), cy + Math.sin(a) * (rr - ww / 2)]);
  }
  return toD(outer.concat(inner.reverse()));
}

const ensoCache = new Map();
export function enso(opts = {}, cls = 'ic-enso') {
  const key = JSON.stringify(opts);
  if (!ensoCache.has(key)) ensoCache.set(key, ensoPath(opts));
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><path d="${ensoCache.get(key)}"/></svg>`;
}

function rrPts(x, y, w, h, r, R, jit, step = 3) {
  const pts = [];
  const push = (px, py) => pts.push([px + (R() - 0.5) * jit, py + (R() - 0.5) * jit]);
  const arc = (cx, cy, a0) => {
    for (let k = 0; k <= 4; k++) {
      const a = a0 + (k / 4) * (Math.PI / 2);
      push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  };
  for (let s = x + r; s < x + w - r; s += step) push(s, y);
  arc(x + w - r, y + r, -Math.PI / 2);
  for (let s = y + r; s < y + h - r; s += step) push(x + w, s);
  arc(x + w - r, y + h - r, 0);
  for (let s = x + w - r; s > x + r; s -= step) push(s, y + h);
  arc(x + r, y + h - r, Math.PI / 2);
  for (let s = y + h - r; s > y + r; s -= step) push(x, s);
  arc(x + r, y + r, Math.PI);
  return pts;
}

const frameCache = new Map();
/** Hand-drawn rounded frame: returns {edge, fill} paths for a W×H box. Heavier at the bottom like brush pressure. */
export function brushFrame(W, H, seed = 5) {
  const k = W + 'x' + H + ':' + seed;
  if (frameCache.has(k)) return frameCache.get(k);
  const R = rng(seed + Math.round(W));
  const outer = rrPts(1.3, 1.2, W - 2.6, H - 2.3, 8, R, 0.9);
  const inner = rrPts(3.5, 3.1, W - 7.0, H - 7.9, 5.5, R, 0.6);
  const res = { edge: toD(outer) + toD(inner), fill: toD(inner) };
  frameCache.set(k, res);
  return res;
}

const ARROW_D = 'M10 2.6l6.6 7.6h-4.1l.3 7.2H7.2l.3-7.2H3.4z';
const ARROW_ROT = { up: 0, right: 90, down: 180, left: 270 };

/** Keyboard key cap. label: text or 'up'|'down'|'left'|'right' for arrows. w: width multiplier. */
export function keyCap(label, w = 1, extra = '') {
  const W = Math.round(40 * w), H = 40;
  const fr = brushFrame(W, H, 7);
  const isArrow = label in ARROW_ROT;
  const inner = isArrow
    ? `<svg class="k-arrow" viewBox="0 0 20 20" style="transform:rotate(${ARROW_ROT[label]}deg)"><path d="${ARROW_D}"/></svg>`
    : `<span class="k-l${String(label).length > 2 ? ' is-long' : ''}">${esc(label)}</span>`;
  return `<span class="ic-key ${extra}" style="--kw:${w}"><svg class="k-bg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="k-fill" d="${fr.fill}"/><path class="k-edge" fill-rule="evenodd" d="${fr.edge}"/></svg>${inner}</span>`;
}

/** Mouse glyph. btn: 'left' | 'right' | 'middle' | 'move' | 'none' */
export function mouseIcon(btn = 'none') {
  const move = btn === 'move';
  const vb = move ? '-12 -9 58 64' : '0 0 34 46';
  const arrows = move
    ? `<g class="m-arr"><path d="M-9.5 23l5-4.2v8.4z"/><path d="M43.5 23l-5-4.2v8.4z"/><path d="M17 -7.5l4.2 5h-8.4z"/><path d="M17 53.5l4.2-5h-8.4z"/></g>`
    : '';
  return `<svg class="ic-mouse is-${btn}" viewBox="${vb}" aria-hidden="true">${arrows}<path class="m-l" d="M16.2 4.4C9.7 4.9 5.6 9.3 5.2 16.6c3.7.4 7.3.5 11 .5z"/><path class="m-r" d="M17.8 4.4c6.5.5 10.6 4.9 11 12.2-3.7.4-7.3.5-11 .5z"/><path class="m-body" d="M17 2.6c8 0 13.6 5.4 13.8 13.8l.2 13c.1 8.7-5.8 14-14 14S2.9 38.2 3 29.5l.2-13.2C3.4 8 9 2.6 17 2.6z"/><path class="m-div" d="M17 3.4v13.4M3.6 16.9c9 .7 18.2.7 27.1-.2"/><rect class="m-w" x="15.1" y="7.6" width="3.8" height="6.4" rx="1.9"/></svg>`;
}

const PS_SHAPES = {
  square: '<rect x="12.5" y="12.5" width="15" height="15" rx="1.2"/>',
  triangle: '<path d="M20 11.2l8.6 15.6H11.4z"/>',
  cross: '<path d="M12.6 12.6l14.8 14.8M27.4 12.6L12.6 27.4"/>',
  circle: '<circle cx="20" cy="20" r="8"/>',
};

/** Gamepad glyph. */
export function padIcon(name, press = false) {
  if (['X', 'Y', 'A', 'B'].includes(name)) {
    return `<span class="ic-pad is-face is-${name}">${enso({ r: 40, w: 9, seed: name.charCodeAt(0), start: -120, sweep: 335 }, 'p-ring')}<b>${name}</b></span>`;
  }
  if (PS_SHAPES[name]) {
    return `<span class="ic-pad is-face is-ps is-${name}">${enso({ r: 40, w: 9, seed: name.length * 7, start: -120, sweep: 335 }, 'p-ring')}<svg class="p-sym" viewBox="0 0 40 40">${PS_SHAPES[name]}</svg></span>`;
  }
  if (name === 'stickL' || name === 'stickR') {
    const L = name === 'stickL' ? 'L' : 'R';
    return `<span class="ic-pad is-stick${press ? ' is-press' : ''}"><svg viewBox="0 0 48 48" aria-hidden="true"><path class="p-ring2" d="${ensoPath({ cx: 24, cy: 24, r: 20, w: 3.6, seed: 12, start: -90, sweep: 340 })}"/><circle class="p-cap" cx="24" cy="24" r="11.5"/><g class="p-arr"><path d="M24 1.6l3 3.4h-6z"/><path d="M24 46.4l3-3.4h-6z"/><path d="M1.6 24l3.4-3v6z"/><path d="M46.4 24l-3.4-3v6z"/></g><text x="24" y="28.6" text-anchor="middle">${L}</text></svg></span>`;
  }
  if (name === 'LB' || name === 'RB' || name === 'LT' || name === 'RT') {
    return keyCap(name, 1.45, 'is-pad ' + (name.endsWith('T') ? 'is-trigger' : 'is-bumper'));
  }
  if (name === 'Start') return keyCap('Start', 1.7, 'is-pad');
  return keyCap(name, 1);
}

/** Two brush strokes: the pause glyph of the touch controls. */
export const PAUSE_PATH = 'M7.4 4.6c1.3-.5 2.5-.3 3 .4.2 4.4.3 9.4-.1 14.2-.8.7-2.2.8-3.2.2-.4-4.9-.3-9.9.3-14.8zM14.2 4.8c1.1-.6 2.4-.5 3 .2.3 4.6.2 9.4-.2 14-.9.8-2.3.8-3.2.1-.3-4.8-.2-9.6.4-14.3z';

/**
 * Touch-screen glyphs. kind: 'btn' (an on-screen button, with its calligraphy glyph),
 * 'stick' (the move stick), 'drag' (swipe on the right side), 'tap' (tap the screen), 'pause'.
 */
export function touchIcon(kind, glyph = '') {
  if (kind === 'btn') {
    return `<span class="ic-pad is-face is-touch">${enso({ r: 40, w: 9, seed: glyph.charCodeAt(0) % 89, start: -120, sweep: 335 }, 'p-ring')}<b>${esc(glyph)}</b></span>`;
  }
  if (kind === 'pause') {
    return `<span class="ic-pad is-face is-touch">${enso({ r: 40, w: 9, seed: 5, start: -120, sweep: 335 }, 'p-ring')}<svg class="p-sym is-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="${PAUSE_PATH}"/></svg></span>`;
  }
  const arrows = '<g class="p-arr"><path d="M24 1.6l3 3.4h-6z"/><path d="M24 46.4l3-3.4h-6z"/><path d="M1.6 24l3.4-3v6z"/><path d="M46.4 24l-3.4-3v6z"/></g>';
  if (kind === 'stick') {
    return `<span class="ic-pad is-stick"><svg viewBox="0 0 48 48" aria-hidden="true"><path class="p-ring2" d="${ensoPath({ cx: 24, cy: 24, r: 20, w: 3.6, seed: 12, start: -90, sweep: 340 })}"/><circle class="p-cap" cx="29" cy="21" r="9.5"/>${arrows}</svg></span>`;
  }
  if (kind === 'drag') {
    return `<span class="ic-pad is-stick"><svg viewBox="0 0 48 48" aria-hidden="true"><circle class="p-cap" cx="24" cy="24" r="6.5"/><path class="p-ring2" d="M9 24h30" stroke="currentColor" stroke-width="2" stroke-dasharray="2.6 3.2"/>${arrows}</svg></span>`;
  }
  return `<span class="ic-pad is-stick"><svg viewBox="0 0 48 48" aria-hidden="true"><circle class="p-cap" cx="24" cy="24" r="6"/><circle cx="24" cy="24" r="12.5" fill="none" stroke="currentColor" stroke-width="1.8" opacity=".75"/><circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".4"/></svg></span>`;
}

export const ICON = {
  drop: '<svg class="ic-i" viewBox="0 0 12 16" aria-hidden="true"><path d="M6 .8C4.6 3.6 1.4 7 1.4 10.4a4.6 4.6 0 0 0 9.2 0C10.6 7 7.4 3.6 6 .8z"/></svg>',
  diamond: '<svg class="ic-i" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 .3 9.7 5 5 9.7.3 5z"/></svg>',
  chevL: '<svg class="ic-i" viewBox="0 0 16 24" aria-hidden="true"><path d="M12.6 1.6 2.9 11.3c-.4.4-.4 1 0 1.4l9.9 9.7 1.6-2.1-7.6-8.2 7.5-8.4z"/></svg>',
  chevR: '<svg class="ic-i" viewBox="0 0 16 24" aria-hidden="true"><path d="M3.4 1.6l9.7 9.7c.4.4.4 1 0 1.4l-9.9 9.7-1.6-2.1 7.6-8.2L1.7 3.7z"/></svg>',
  blade:
    '<svg class="ic-blade" viewBox="0 0 120 16" aria-hidden="true"><path class="b-edge" d="M45 6.1C70 5.4 95 4.2 118.5 2c-7.4 3.9-21.6 6.7-46.2 7.5L45 9.9z"/><path class="b-shine" d="M47 6.9c24-.5 46-1.5 66-3.6-8 2.2-20 3.8-38 4.4z"/><rect class="b-hab" x="40.6" y="5.4" width="4.6" height="5.2" rx=".8"/><ellipse class="b-tsuba" cx="38.6" cy="8" rx="2.6" ry="7.2"/><path class="b-tsuka" d="M1.5 5.8h34.4v4.6H1.5c-.8 0-1.2-.4-1.2-1.2V7c0-.8.4-1.2 1.2-1.2z"/><path class="b-wrap" d="M4 6l3 4.2L10 6l3 4.2L16 6l3 4.2L22 6l3 4.2L28 6l3 4.2L34 6"/></svg>',
  flame:
    '<svg class="ic-i" viewBox="0 0 20 28" aria-hidden="true"><path d="M10.4 1c1.2 5.2 7.6 8.4 7.6 15.2A8 8 0 0 1 2 16.8c0-3.6 2-6.2 3.8-8 .1 2.6 1.1 4.3 2.7 5-1-4.6.2-9.4 1.9-12.8z"/></svg>',
  wave:
    '<svg class="ic-i" viewBox="0 0 28 20" aria-hidden="true"><path d="M1 13.6c3.6-6.4 9-8.6 13.4-6.6 3.1 1.4 3.4 5.4.6 6.2-1.8.5-3.1-.8-2.6-2.2-3 .6-4.6 3.6-3.2 6 2 3.4 8.8 2.6 12.2-1.6 2.8-3.4 3-8.2.8-12.4 3.4 3 4.6 7.6 3.2 11.8-2.2 6.4-10 9-16 7.4C6 21.1 2.6 18.4 1 13.6z"/></svg>',
};

/** Akaza's compass needle (破壞殺・羅針) — snowflake compass, stroke = currentColor. */
export function compassSVG(cls = 'ic-compass') {
  let d = '';
  const P = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const [x0, y0] = P(46, a), [x1, y1] = P(i % 3 === 0 ? 186 : 168, a);
    d += `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}`;
    for (const [r, l] of [[92, 20], [128, 16], [156, 10]]) {
      const [bx, by] = P(r, a);
      for (const s of [-1, 1]) {
        const [ex, ey] = [bx + Math.cos(a + s * 0.75) * l, by + Math.sin(a + s * 0.75) * l];
        d += `M${f1(bx)} ${f1(by)}L${f1(ex)} ${f1(ey)}`;
      }
    }
    const [tx, ty] = P(i % 3 === 0 ? 192 : 174, a);
    d += `M${f1(tx + Math.cos(a) * 6)} ${f1(ty + Math.sin(a) * 6)}L${f1(tx + Math.cos(a + 1.57) * 4)} ${f1(ty + Math.sin(a + 1.57) * 4)}L${f1(tx - Math.cos(a) * 6)} ${f1(ty - Math.sin(a) * 6)}L${f1(tx - Math.cos(a + 1.57) * 4)} ${f1(ty - Math.sin(a + 1.57) * 4)}Z`;
  }
  let star = '';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const [x, y] = P(i % 2 ? 26 : 58, a);
    star += (i ? 'L' : 'M') + f1(x) + ' ' + f1(y);
  }
  star += 'Z';
  return `<svg class="${cls}" viewBox="-200 -200 400 400" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle r="178" stroke-width="1.4"/><circle r="164" stroke-width="0.8" stroke-dasharray="2 6"/><circle r="112" stroke-width="0.8" opacity=".6"/><circle r="46" stroke-width="1.6"/><path d="${d}" stroke-width="2"/><path d="${star}" stroke-width="1.6"/><circle r="10" stroke-width="2"/></g></svg>`;
}

const url = (svg) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;

/** Tortoiseshell (kikkō) hexagon pattern for Giyu's haori half. Returns a CSS url(). */
export function kikkoURL(size = 10, colors = ['#c9a03a', '#4f6d35', '#b4592b'], line = '#1b140f') {
  const s = size, hx = 1.5 * s, hy = Math.sqrt(3) * s;
  const W = 6 * hx, H = 3 * hy;
  let body = '';
  const hex = (cx, cy) => {
    let d = '';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      d += (k ? 'L' : 'M') + f1(cx + Math.cos(a) * s * 0.93) + ' ' + f1(cy + Math.sin(a) * s * 0.93);
    }
    return d + 'Z';
  };
  for (let c = -1; c <= 6; c++) {
    for (let r = -1; r <= 3; r++) {
      const cx = s + c * hx, cy = hy / 2 + r * hy + (c & 1 ? hy / 2 : 0);
      const ci = ((((c % 6) + 6) % 6) + 2 * (((r % 3) + 3) % 3)) % 3;
      body += `<path d="${hex(cx, cy)}" fill="${colors[ci]}"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${f1(W)}" height="${f1(H)}" viewBox="0 0 ${f1(W)} ${f1(H)}"><rect width="100%" height="100%" fill="${line}"/>${body}</svg>`;
  return url(svg);
}

/** Seigaiha (blue ocean waves) pattern. Returns a CSS url(). */
export function seigaihaURL(stroke = '#9fd6f5', bg = '#1d2a4a', R = 20) {
  const ring = (cx, cy) =>
    `<circle cx="${cx}" cy="${cy}" r="${R - 0.5}" fill="${bg}"/>` +
    [0.95, 0.74, 0.53, 0.32].map((k) => `<circle cx="${cx}" cy="${cy}" r="${f1(R * k)}" fill="none" stroke="${stroke}" stroke-width="1.1"/>`).join('');
  const order = [[R, -R / 2], [0, 0], [2 * R, 0], [R, R / 2], [0, R], [2 * R, R], [R, 1.5 * R]];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${2 * R}" height="${R}" viewBox="0 0 ${2 * R} ${R}">${order.map(([x, y]) => ring(x, y)).join('')}</svg>`;
  return url(svg);
}

/** Seal (hanko) element HTML. */
export function sealHTML(text, cls = '') {
  return `<span class="ic-seal ${cls}"><span>${esc(text)}</span></span>`;
}

/** Hidden SVG filter definitions shared by the whole UI (brush roughening / ink bleed). */
export const SVG_DEFS = `<svg class="ic-defs" width="0" height="0" aria-hidden="true" focusable="false">
<filter id="ic-rough" x="-4%" y="-4%" width="108%" height="108%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="ic-rough-lg" x="-6%" y="-6%" width="112%" height="112%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>
</svg>`;
