// Anime face decals (512², transparent). Drawn as seen from the front
// (viewer's perspective). Canvas u maps to a 120° longitude span and f to
// polar angle 0.55 + 1.5 f, so one canvas pixel is ~1.4x wider than tall on
// the head: every shape here is pre-compensated by working in an eye frame
// whose horizontal unit is narrower than its vertical one.
import {
  TAU, lerp, smooth, makeRng, canvas2d, css, cubic, catmull, pathOf, ribbon, offsetPts,
} from './core.js';

const S = 512;
const EW = 0.077 * S; // eye half width  (canvas px), eye ~0.154 wide
const EH = 0.066 * S; // eye half height (canvas px), eye ~0.13 tall
const P = (u, f) => [u * S, f * S];
const PP = (arr) => arr.map(([u, f]) => P(u, f));
const MIR = (pts) => pts.map(([x, y]) => [S - x, y]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];

function frame(cx, cy, ax, ay, bx, by) {
  const F = (a, b) => [cx + a * ax + b * bx, cy + a * ay + b * by];
  F.ax = [ax, ay];
  F.bx = [bx, by];
  return F;
}
/** side = -1 for the viewer-left eye (outer corner to the left), +1 for the right eye. a=+1 is the outer corner. */
const eyeFrame = (u, f, side, k = 1) => frame(u * S, f * S, side * EW * k, 0, 0, EH * k);

function fillRib(ctx, rib, col) {
  ctx.fillStyle = css(col);
  ctx.fill(rib.path);
}

/** Tapered ink line through control points (u,f pairs already converted to px). */
function inkLine(ctx, ctrl, w, col, opt = {}) {
  const { taperA = 0.3, taperB = 0.3, pow = 0.7, per = 10, widthFn = null } = opt;
  let pts;
  if (ctrl.length > 2) pts = catmull(ctrl, per);
  else {
    // densify straight strokes so the tapered ends have somewhere to taper
    pts = [];
    for (let i = 0; i <= 10; i++) pts.push([lerp(ctrl[0][0], ctrl[1][0], i / 10), lerp(ctrl[0][1], ctrl[1][1], i / 10)]);
  }
  const rib = ribbon(pts, widthFn ? (t) => w * widthFn(t) : w, { taperA, taperB, pow });
  fillRib(ctx, rib, col);
  return pts;
}

function brow(ctx, ctrl, w, col, opt = {}) {
  const { fall = 0.55, taperA = 0.1, taperB = 0.5 } = opt;
  return inkLine(ctx, ctrl, w, col, { taperA, taperB, pow: 0.75, widthFn: (t) => 1 - fall * t });
}

/** Open anime eye. */
function drawEye(ctx, F, E) {
  const L = E.lid;
  const up = cubic(F(...L.inner), F(...L.c1), F(...L.c2), F(...L.outer), 30);
  const lo = cubic(F(...L.inner), F(...E.low.c1), F(...E.low.c2), F(...L.outer), 30);
  const eye = pathOf(up.concat(lo.slice(1, -1).reverse()), true);
  const o = F(0, 0), uv = sub(F(0, -1), o), tan = sub(F(1, 0), F(-1, 0));
  const upSign = -tan[1] * uv[0] + tan[0] * uv[1] > 0 ? 1 : -1;

  if (E.halo) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = css(E.halo[0]);
    ctx.lineWidth = E.halo[1];
    ctx.stroke(eye);
    ctx.restore();
  }
  // sclera
  if (E.scleraGrad) {
    const c = F(E.iris ? E.iris.a : 0, 0.1);
    const g = ctx.createRadialGradient(c[0], c[1], 1, c[0], c[1], EW * 1.2);
    g.addColorStop(0, css(E.scleraGrad[0]));
    g.addColorStop(0.55, css(E.scleraGrad[1]));
    g.addColorStop(1, css(E.scleraGrad[2]));
    ctx.fillStyle = g;
  } else ctx.fillStyle = css(E.sclera);
  ctx.fill(eye);

  ctx.save();
  ctx.clip(eye);
  if (E.scleraShade) {
    ctx.strokeStyle = css(E.scleraShade);
    ctx.lineWidth = EH * 0.62;
    ctx.stroke(pathOf(up));
  }
  if (E.iris) drawIris(ctx, F, E.iris);
  ctx.restore();

  // upper lash line + outer wing
  const LA = E.lash;
  const wing = LA.wing || [0.12, 0.1];
  const outerPt = up[up.length - 1];
  const wingEnd = F(L.outer[0] + wing[0], L.outer[1] + wing[1]);
  const lashPts = up.slice();
  for (let k = 1; k <= 6; k++) {
    const t = k / 6;
    lashPts.push([lerp(outerPt[0], wingEnd[0], t), lerp(outerPt[1], wingEnd[1], t) + Math.sin(t * Math.PI) * (wing[2] || 0)]);
  }
  const nUp = up.length, n = lashPts.length;
  const wfn = (t, i) => {
    if (i < nUp) return lerp(LA.w0, LA.w1, smooth(0, LA.peak ?? 0.7, i / (nUp - 1)));
    return LA.w1 * Math.pow(1 - (i - nUp + 1) / (n - nUp + 1), 0.65);
  };
  const lash = ribbon(lashPts, wfn, { taperA: LA.taperIn ?? 0.07, taperB: 0, pow: 0.6, offset: (t, i) => upSign * wfn(t, i) * 0.3 });
  fillRib(ctx, lash, LA.col);
  // lash flicks at the outer corner
  if (LA.flicks) {
    for (const [a0, b0, a1, b1, w] of LA.flicks) {
      const pts = cubic(F(a0, b0), F(lerp(a0, a1, 0.5), lerp(b0, b1, 0.3)), F(lerp(a0, a1, 0.8), b1 + 0.02), F(a1, b1), 8);
      fillRib(ctx, ribbon(pts, w, { taperA: 0.05, taperB: 0.9, pow: 0.8 }), LA.col);
    }
  }
  // double-lid crease
  if (E.crease) {
    const C = E.crease;
    const seg = up.slice(Math.floor(C.from * (up.length - 1)), Math.ceil(C.to * (up.length - 1)) + 1);
    const pts = offsetPts(seg, upSign * C.off);
    fillRib(ctx, ribbon(pts, C.w, { taperA: 0.35, taperB: 0.35, pow: 0.8 }), C.col);
  }
  // lower lash line
  if (E.lower) {
    const Lw = E.lower;
    const seg = lo.slice(Math.floor(Lw.from * (lo.length - 1)), Math.ceil(Lw.to * (lo.length - 1)) + 1);
    const pts = offsetPts(seg, -upSign * Lw.w * 0.35);
    fillRib(ctx, ribbon(pts, Lw.w, { taperA: 0.5, taperB: 0.2, pow: 0.8 }), Lw.col);
  }
  return { up, lo, eye, upSign };
}

function drawIris(ctx, F, I) {
  const c0 = F(I.a, I.b);
  const ax = F.ax, bx = F.bx;
  const irx = I.rx * Math.hypot(ax[0], ax[1]);
  const iry = I.ry * Math.hypot(bx[0], bx[1]);
  ctx.save();
  ctx.transform(ax[0], ax[1], bx[0], bx[1], c0[0], c0[1]);
  const iris = new Path2D();
  iris.ellipse(0, 0, I.rx, I.ry, 0, 0, TAU);
  const g = ctx.createLinearGradient(0, -I.ry, 0, I.ry);
  g.addColorStop(0, css(I.cols[0]));
  g.addColorStop(0.42, css(I.cols[1]));
  g.addColorStop(1, css(I.cols[2]));
  ctx.fillStyle = g;
  ctx.fill(iris);
  ctx.save();
  ctx.clip(iris);
  // lower reflected light
  if (I.refl) {
    ctx.fillStyle = css(I.refl, 0.9);
    ctx.beginPath();
    ctx.ellipse(0, I.ry * 0.56, I.rx * 0.78, I.ry * 0.36, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = css(I.cols[2]);
    ctx.beginPath();
    ctx.ellipse(0, I.ry * 0.36, I.rx * 0.7, I.ry * 0.36, 0, 0, TAU);
    ctx.fill();
  }
  // fine radial streaks
  ctx.strokeStyle = css(I.cols[0], 0.55);
  ctx.lineWidth = 0.035;
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU + 0.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * I.rx * 0.32, Math.sin(a) * I.ry * 0.32);
    ctx.lineTo(Math.cos(a) * I.rx * 0.82, Math.sin(a) * I.ry * 0.82);
    ctx.stroke();
  }
  // pupil
  ctx.fillStyle = css(I.pupil);
  ctx.beginPath();
  if (I.slit) ctx.ellipse(0, 0, I.rx * I.slit, I.ry * 0.82, 0, 0, TAU);
  else ctx.ellipse(0, -I.ry * 0.04, I.rx * I.pk, I.ry * I.pk * 1.02, 0, 0, TAU);
  ctx.fill();
  // shadow under the upper lid
  ctx.fillStyle = css(I.shadow || I.cols[0], I.shadowA ?? 0.75);
  ctx.beginPath();
  ctx.ellipse(0, -I.ry * 0.88, I.rx * 1.25, I.ry * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  // limbal ring
  ctx.strokeStyle = css(I.ring);
  ctx.lineWidth = I.ringW ?? 0.085;
  ctx.stroke(iris);
  ctx.restore();

  // highlights (canvas space => same light direction on both eyes)
  for (const h of I.hl || []) {
    ctx.fillStyle = css(h.col || '#ffffff');
    ctx.beginPath();
    ctx.ellipse(c0[0] + h.x * irx, c0[1] + h.y * iry, h.rx * irx, h.ry * iry, h.rot || 0, 0, TAU);
    ctx.fill();
  }
}

/** Squeezed-shut eye: a '>' / '<' chevron pointing to the nose. */
function drawSquint(ctx, F, col, w, opt = {}) {
  const { lashes = true, wrinkle = true } = opt;
  const top = cubic(F(1.0, -0.42), F(0.45, -0.34), F(-0.25, -0.08), F(-0.82, 0.14), 20);
  const bot = cubic(F(-0.82, 0.14), F(-0.25, 0.3), F(0.4, 0.42), F(0.92, 0.52), 20);
  fillRib(ctx, ribbon(top, w, { taperA: 0.25, taperB: 0.12, pow: 0.7 }), col);
  fillRib(ctx, ribbon(bot, w * 0.8, { taperA: 0.12, taperB: 0.3, pow: 0.7 }), col);
  if (lashes) {
    fillRib(ctx, ribbon(cubic(F(0.9, -0.4), F(1.05, -0.5), F(1.15, -0.62), F(1.22, -0.75), 8), w * 0.6, { taperA: 0.05, taperB: 0.9 }), col);
    fillRib(ctx, ribbon(cubic(F(0.95, -0.38), F(1.12, -0.38), F(1.25, -0.42), F(1.35, -0.48), 8), w * 0.5, { taperA: 0.05, taperB: 0.9 }), col);
  }
  if (wrinkle) {
    fillRib(ctx, ribbon(cubic(F(-0.3, 0.72), F(0.0, 0.84), F(0.3, 0.84), F(0.55, 0.75), 10), w * 0.4, { taperA: 0.4, taperB: 0.4 }), col);
    fillRib(ctx, ribbon(cubic(F(-0.95, -0.25), F(-0.88, -0.42), F(-0.8, -0.55), F(-0.7, -0.65), 8), w * 0.38, { taperA: 0.4, taperB: 0.4 }), col);
  }
}

/** Filled shape with an ink outline (stroke-behind). */
function inked(ctx, path, fill, ink, lw) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = css(ink);
  ctx.lineWidth = lw * 2;
  ctx.stroke(path);
  ctx.fillStyle = typeof fill === 'string' || Array.isArray(fill) ? css(fill) : fill;
  ctx.fill(path);
}

function smallNose(ctx, col, w = 3.2, u = 0.5) {
  inkLine(ctx, PP([[u + 0.006, 0.703], [u + 0.001, 0.716], [u - 0.009, 0.727]]), w, col, { taperA: 0.55, taperB: 0.2 });
  // tiny nostril shadow
  inkLine(ctx, PP([[u - 0.014, 0.733], [u - 0.004, 0.735]]), w * 0.75, col, { taperA: 0.3, taperB: 0.5 });
}

function sweatDrop(ctx, u, f, s = 1) {
  const [x, y] = P(u, f);
  const p = new Path2D();
  const h = 0.05 * S * s, w = 0.017 * S * s;
  p.moveTo(x, y - h * 0.55);
  p.bezierCurveTo(x + w * 0.3, y - h * 0.2, x + w, y + h * 0.05, x + w, y + h * 0.22);
  p.bezierCurveTo(x + w, y + h * 0.48, x - w, y + h * 0.48, x - w, y + h * 0.22);
  p.bezierCurveTo(x - w, y + h * 0.05, x - w * 0.3, y - h * 0.2, x, y - h * 0.55);
  inked(ctx, p, '#e6f3ff', '#3a5a8e', 1.6);
  ctx.fillStyle = css('#ffffff');
  ctx.beginPath();
  ctx.ellipse(x - w * 0.35, y + h * 0.12, w * 0.22, h * 0.14, 0.3, 0, TAU);
  ctx.fill();
}

// Open mouth with teeth / tongue. outline: px points (closed), drawn via catmull.
function openMouth(ctx, outline, o = {}) {
  const { inside = '#4a0e12', ink = '#2a0a0a', lw = 2.6, upperTeeth = 0, lowerTeeth = 0, tongue = null, fangs = null, lowerFangs = null, teethCol = '#fbf6ee', jagged = null } = o;
  const pts = catmull(outline, 8, true);
  const path = pathOf(pts, true);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  ctx.fillStyle = css(inside);
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  if (tongue) {
    ctx.fillStyle = css(tongue);
    ctx.beginPath();
    ctx.ellipse((x0 + x1) / 2, y1 - (y1 - y0) * 0.08, (x1 - x0) * 0.34, (y1 - y0) * 0.36, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = css('#e87a80', 0.9);
    ctx.beginPath();
    ctx.ellipse((x0 + x1) / 2 - (x1 - x0) * 0.08, y1 - (y1 - y0) * 0.22, (x1 - x0) * 0.1, (y1 - y0) * 0.07, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = css(teethCol);
  if (upperTeeth) {
    ctx.beginPath();
    ctx.moveTo(x0 - 2, y0 - 2);
    ctx.lineTo(x1 + 2, y0 - 2);
    ctx.lineTo(x1 + 2, y0 + upperTeeth);
    ctx.quadraticCurveTo((x0 + x1) / 2, y0 + upperTeeth * 1.35, x0 - 2, y0 + upperTeeth);
    ctx.closePath();
    ctx.fill();
  }
  if (lowerTeeth) {
    ctx.beginPath();
    ctx.moveTo(x0 - 2, y1 + 2);
    ctx.lineTo(x1 + 2, y1 + 2);
    ctx.lineTo(x1 + 2, y1 - lowerTeeth);
    ctx.quadraticCurveTo((x0 + x1) / 2, y1 - lowerTeeth * 1.25, x0 - 2, y1 - lowerTeeth);
    ctx.closePath();
    ctx.fill();
  }
  const tri = (bx, by, w, h) => {
    ctx.beginPath();
    ctx.moveTo(bx - w / 2, by);
    ctx.lineTo(bx + w / 2, by);
    ctx.lineTo(bx, by + h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = css(ink);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  };
  if (fangs) for (const [u, w, h] of fangs) tri(u * S, y0 + upperTeeth * 0.7, w, h);
  if (lowerFangs) for (const [u, w, h] of lowerFangs) tri(u * S, y1 - lowerTeeth * 0.6, w, -h);
  if (jagged) {
    // zig-zag rows of teeth from top and bottom edges
    const { n, h } = jagged;
    const step = (x1 - x0) / n;
    ctx.fillStyle = css(teethCol);
    ctx.strokeStyle = css(ink);
    ctx.lineWidth = 1.4;
    for (let k = 0; k < n; k++) {
      const bx = x0 + step * (k + 0.5);
      const t = (bx - x0) / (x1 - x0);
      const edgeT = y0 + (y1 - y0) * 0.05 + Math.pow(Math.abs(t - 0.5) * 2, 2) * (y1 - y0) * -0.05;
      const hh = h * (0.7 + 0.5 * Math.sin(t * Math.PI));
      ctx.beginPath();
      ctx.moveTo(bx - step * 0.55, edgeT - 6);
      ctx.lineTo(bx + step * 0.55, edgeT - 6);
      ctx.lineTo(bx + step * 0.05, edgeT + hh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const bx2 = bx + step * 0.5;
      if (bx2 < x1 - step * 0.3) {
        ctx.beginPath();
        ctx.moveTo(bx2 - step * 0.55, y1 + 6);
        ctx.lineTo(bx2 + step * 0.55, y1 + 6);
        ctx.lineTo(bx2 - step * 0.05, y1 - hh * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  // tooth edge lines
  if (upperTeeth) {
    ctx.strokeStyle = css('#b8a8a0');
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + upperTeeth);
    ctx.quadraticCurveTo((x0 + x1) / 2, y0 + upperTeeth * 1.35, x1, y0 + upperTeeth);
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = css(ink);
  ctx.lineWidth = lw;
  ctx.stroke(path);
  return { x0, x1, y0, y1, path };
}

/** Clenched-teeth grimace. */
function grimace(ctx, outline, o = {}) {
  const { ink = '#2a0a0a', lw = 2.6, teeth = '#fbf6ee', gap = '#7a4a48', splits = 5 } = o;
  const pts = catmull(outline, 8, true);
  const path = pathOf(pts, true);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  ctx.fillStyle = css(teeth);
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  const my = (y0 + y1) / 2;
  ctx.strokeStyle = css(gap);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, my + 1);
  ctx.quadraticCurveTo((x0 + x1) / 2, my - 1.5, x1, my + 1);
  ctx.stroke();
  ctx.lineWidth = 1.3;
  for (let k = 1; k < splits; k++) {
    const x = lerp(x0, x1, k / splits);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + 0.5, y1);
    ctx.stroke();
  }
  // corner shadows
  ctx.fillStyle = css('#3a1414');
  ctx.beginPath(); ctx.ellipse(x0, my, (x1 - x0) * 0.08, (y1 - y0) * 0.7, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x1, my, (x1 - x0) * 0.08, (y1 - y0) * 0.7, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = css(ink);
  ctx.lineWidth = lw;
  ctx.stroke(path);
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------
const EYE_U = [0.33, 0.67];
const EYE_F = 0.6;

function bothEyes(ctx, spec) {
  const out = [];
  for (const [i, side] of [[0, -1], [1, 1]]) {
    const F = eyeFrame(EYE_U[i], EYE_F, side);
    out.push(drawEye(ctx, F, spec));
  }
  return out;
}

function bothBrows(ctx, ctrlUF, w, col, opt) {
  const left = PP(ctrlUF);
  brow(ctx, left, w, col, opt);
  brow(ctx, MIR(left), w, col, opt);
}

const TANJIRO = {
  sclera: '#fffaf6', scleraShade: '#e6d6d8',
  iris: { a: -0.05, b: 0.12, rx: 0.52, ry: 0.94, cols: ['#2e0709', '#6e1a1a', '#b5332c'], refl: '#e3704e', ring: '#210506', pupil: '#170304', pk: 0.4, shadow: '#1c0405', shadowA: 0.7,
    hl: [{ x: -0.34, y: -0.36, rx: 0.3, ry: 0.22, rot: -0.2 }, { x: 0.36, y: 0.46, rx: 0.12, ry: 0.08 }, { x: -0.5, y: 0.2, rx: 0.07, ry: 0.05, col: '#ffe8e0' }] },
  lash: { col: '#1d0e0e', w0: 3, w1: 8.5, wing: [0.14, 0.12, 0], flicks: [[0.7, -0.78, 0.9, -1.02, 4], [0.88, -0.5, 1.12, -0.66, 3.6]] },
  crease: { col: '#6a2c26', w: 2.4, off: 11, from: 0.28, to: 0.92 },
  lower: { col: '#4a1c18', w: 2.6, from: 0.48, to: 1 },
};

function tanjiroScar(ctx) {
  // flame-shaped mark above HIS left eye = viewer's right
  const p = new Path2D();
  const m = (u, f) => P(u, f);
  const q = (cu, cf, u, f) => { const [cx, cy] = m(cu, cf); const [x, y] = m(u, f); p.quadraticCurveTo(cx, cy, x, y); };
  p.moveTo(...m(0.64, 0.474));
  q(0.695, 0.484, 0.75, 0.47);
  q(0.768, 0.448, 0.758, 0.412);
  q(0.744, 0.424, 0.728, 0.432);
  q(0.73, 0.402, 0.712, 0.378);
  q(0.7, 0.402, 0.69, 0.426);
  q(0.678, 0.41, 0.662, 0.39);
  q(0.66, 0.42, 0.648, 0.432);
  q(0.63, 0.45, 0.64, 0.474);
  p.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = css('#5a0e0a');
  ctx.lineWidth = 4;
  ctx.stroke(p);
  ctx.fillStyle = css('#8e1f16');
  ctx.fill(p);
  // inner darker flame
  const p2 = new Path2D();
  const m2 = (u, f) => P(u, f);
  p2.moveTo(...m2(0.668, 0.468));
  const q2 = (cu, cf, u, f) => { const [cx, cy] = m2(cu, cf); const [x, y] = m2(u, f); p2.quadraticCurveTo(cx, cy, x, y); };
  q2(0.7, 0.474, 0.73, 0.464);
  q2(0.734, 0.446, 0.722, 0.44);
  q2(0.714, 0.42, 0.706, 0.406);
  q2(0.698, 0.43, 0.688, 0.44);
  q2(0.672, 0.448, 0.668, 0.468);
  p2.closePath();
  ctx.fillStyle = css('#6c140e');
  ctx.fill(p2);
}

function faceTanjiro(expr) {
  const { c, ctx } = canvas2d(S, S);
  tanjiroScar(ctx);
  const BROW = '#3a1512', LINE = '#3a1614';
  if (expr === 'neutral') {
    bothBrows(ctx, [[0.396, 0.5], [0.352, 0.478], [0.3, 0.474], [0.252, 0.488]], 9, BROW);
    bothEyes(ctx, {
      ...TANJIRO,
      lid: { inner: [-1, 0.14], c1: [-0.82, -0.72], c2: [0.42, -1.04], outer: [1.0, -0.02] },
      low: { c1: [-0.5, 0.92], c2: [0.62, 0.88] },
    });
    smallNose(ctx, '#9a5446');
    inkLine(ctx, PP([[0.466, 0.796], [0.484, 0.804], [0.5, 0.806], [0.516, 0.804], [0.534, 0.795]]), 3.4, LINE, { taperA: 0.25, taperB: 0.25 });
    inkLine(ctx, PP([[0.49, 0.822], [0.5, 0.824], [0.51, 0.822]]), 2.4, '#9a5448', { taperA: 0.4, taperB: 0.4 });
  } else if (expr === 'fierce') {
    bothBrows(ctx, [[0.412, 0.53], [0.366, 0.498], [0.31, 0.47], [0.25, 0.455]], 11, BROW, { fall: 0.45 });
    bothEyes(ctx, {
      ...TANJIRO,
      iris: { ...TANJIRO.iris, rx: 0.42, ry: 0.78, pk: 0.3, b: 0.12, hl: [{ x: -0.3, y: -0.3, rx: 0.24, ry: 0.18 }, { x: 0.34, y: 0.44, rx: 0.1, ry: 0.07 }] },
      lid: { inner: [-1, 0.12], c1: [-0.6, -0.3], c2: [0.4, -0.98], outer: [1.04, -0.26] },
      low: { c1: [-0.5, 0.74], c2: [0.6, 0.7] },
      lash: { ...TANJIRO.lash, w0: 4.5, w1: 9 },
      crease: { ...TANJIRO.crease, from: 0.35, off: 10 },
    });
    // anger creases between the brows
    inkLine(ctx, PP([[0.462, 0.5], [0.468, 0.52]]), 2.6, BROW, { taperA: 0.4, taperB: 0.4 });
    inkLine(ctx, PP([[0.538, 0.5], [0.532, 0.52]]), 2.6, BROW, { taperA: 0.4, taperB: 0.4 });
    smallNose(ctx, '#9a5446');
    openMouth(ctx, PP([[0.446, 0.792], [0.474, 0.778], [0.5, 0.774], [0.526, 0.778], [0.554, 0.792], [0.557, 0.822], [0.536, 0.85], [0.5, 0.856], [0.464, 0.85], [0.443, 0.822]]), { inside: '#3a0a10', upperTeeth: 6, lowerTeeth: 4, tongue: '#9a3038', lw: 3.2 });
  } else {
    // hurt
    bothBrows(ctx, [[0.402, 0.468], [0.36, 0.479], [0.31, 0.49], [0.256, 0.506]], 9, BROW, { fall: 0.5 });
    for (const [i, side] of [[0, -1], [1, 1]]) drawSquint(ctx, eyeFrame(EYE_U[i], EYE_F + 0.01, side), '#1d0e0e', 6.5);
    smallNose(ctx, '#9a5446');
    grimace(ctx, PP([[0.45, 0.79], [0.5, 0.783], [0.55, 0.79], [0.545, 0.808], [0.5, 0.815], [0.455, 0.808]]), { lw: 2.8 });
    sweatDrop(ctx, 0.8, 0.5, 1);
    // small cut on the cheek
    inkLine(ctx, PP([[0.265, 0.705], [0.3, 0.698]]), 3, '#b3322a', { taperA: 0.3, taperB: 0.5 });
  }
  return c;
}

const GIYU = {
  sclera: '#fbfbff', scleraShade: '#d6d8ea',
  iris: { a: -0.02, b: 0.2, rx: 0.52, ry: 0.94, cols: ['#081330', '#1f3c7a', '#4a74c9'], refl: '#80a4ea', ring: '#060c22', pupil: '#050918', pk: 0.38, shadow: '#040816', shadowA: 0.78,
    hl: [{ x: -0.32, y: -0.1, rx: 0.2, ry: 0.15, rot: -0.2 }, { x: 0.34, y: 0.5, rx: 0.08, ry: 0.06 }] },
  lash: { col: '#10121c', w0: 3.4, w1: 9, wing: [0.16, 0.14, 0], flicks: [[0.86, -0.34, 1.1, -0.48, 3.6]] },
  crease: { col: '#3c3646', w: 2.4, off: 8, from: 0.2, to: 0.95 },
  lower: { col: '#2e2a38', w: 2.4, from: 0.5, to: 1 },
};

function faceGiyu(expr) {
  const { c, ctx } = canvas2d(S, S);
  const BROW = '#15182a', LINE = '#2a1e22';
  if (expr === 'neutral') {
    bothBrows(ctx, [[0.396, 0.49], [0.35, 0.48], [0.3, 0.479], [0.252, 0.488]], 7.5, BROW, { fall: 0.5 });
    bothEyes(ctx, {
      ...GIYU,
      lid: { inner: [-1, 0.16], c1: [-0.78, -0.42], c2: [0.45, -0.66], outer: [1.02, 0.14] },
      low: { c1: [-0.5, 0.9], c2: [0.6, 0.88] },
    });
    smallNose(ctx, '#8e5448');
    inkLine(ctx, PP([[0.474, 0.803], [0.5, 0.801], [0.526, 0.804]]), 3.4, LINE, { taperA: 0.25, taperB: 0.25 });
  } else if (expr === 'fierce') {
    bothBrows(ctx, [[0.408, 0.516], [0.362, 0.49], [0.31, 0.47], [0.254, 0.462]], 9, BROW, { fall: 0.45 });
    bothEyes(ctx, {
      ...GIYU,
      iris: { ...GIYU.iris, b: 0.14, rx: 0.46, ry: 0.84, pk: 0.32 },
      lid: { inner: [-1, 0.14], c1: [-0.62, -0.28], c2: [0.42, -0.88], outer: [1.03, -0.14] },
      low: { c1: [-0.5, 0.78], c2: [0.6, 0.74] },
      lash: { ...GIYU.lash, w0: 4.5, w1: 9 },
    });
    inkLine(ctx, PP([[0.463, 0.498], [0.469, 0.518]]), 2.4, BROW, { taperA: 0.4, taperB: 0.4 });
    inkLine(ctx, PP([[0.537, 0.498], [0.531, 0.518]]), 2.4, BROW, { taperA: 0.4, taperB: 0.4 });
    smallNose(ctx, '#8e5448');
    openMouth(ctx, PP([[0.458, 0.796], [0.479, 0.786], [0.5, 0.783], [0.521, 0.786], [0.542, 0.796], [0.544, 0.816], [0.526, 0.834], [0.5, 0.838], [0.474, 0.834], [0.456, 0.816]]), { inside: '#360a12', upperTeeth: 5, lowerTeeth: 4, tongue: '#963038', lw: 3 });
  } else {
    bothBrows(ctx, [[0.4, 0.468], [0.36, 0.476], [0.31, 0.486], [0.256, 0.5]], 7.5, BROW, { fall: 0.5 });
    // one eye squeezed, one narrowed in pain
    drawSquint(ctx, eyeFrame(EYE_U[1], EYE_F + 0.01, 1), '#10121c', 6.2);
    drawEye(ctx, eyeFrame(EYE_U[0], EYE_F, -1), {
      ...GIYU,
      iris: { ...GIYU.iris, b: 0.2, rx: 0.46, ry: 0.84 },
      lid: { inner: [-1, 0.2], c1: [-0.7, -0.2], c2: [0.45, -0.42], outer: [1.02, 0.2] },
      low: { c1: [-0.5, 0.62], c2: [0.6, 0.58] },
      crease: { ...GIYU.crease, off: 7 },
    });
    smallNose(ctx, '#8e5448');
    grimace(ctx, PP([[0.456, 0.795], [0.5, 0.789], [0.544, 0.795], [0.538, 0.81], [0.5, 0.816], [0.462, 0.81]]), { lw: 2.6, splits: 4 });
    sweatDrop(ctx, 0.2, 0.52, 0.9);
  }
  return c;
}

const AKAZA = {
  sclera: '#d9f3fb', scleraShade: '#9ccbe0',
  iris: { a: -0.02, b: 0.1, rx: 0.44, ry: 0.8, cols: ['#8a5406', '#e6ae22', '#ffe27a'], refl: '#fff3b8', ring: '#4a2c02', pupil: '#1c1004', pk: 0.26, shadow: '#5a3a04', shadowA: 0.6,
    hl: [{ x: -0.3, y: -0.3, rx: 0.2, ry: 0.15 }, { x: 0.3, y: 0.42, rx: 0.09, ry: 0.07 }] },
  lash: { col: '#9e2e4c', w0: 2.8, w1: 7.6, wing: [0.24, -0.04, 0], flicks: [[0.74, -0.7, 0.96, -0.96, 3.8], [0.9, -0.44, 1.16, -0.58, 3.4]] },
  crease: { col: '#b24e6a', w: 2.2, off: 10, from: 0.3, to: 0.9 },
  lower: { col: '#a8405e', w: 2.4, from: 0.35, to: 1 },
};

function akazaTattoo(ctx) {
  const T = '#28307a';
  for (const [i, side] of [[0, -1], [1, 1]]) {
    const F = eyeFrame(EYE_U[i], EYE_F, side);
    // extended liner above the lid sweeping to the temple
    inkLine(ctx, [F(0.2, -1.3), F(0.75, -1.2), F(1.3, -0.95), F(1.95, -0.7)], 4.4, T, { taperA: 0.35, taperB: 0.45 });
    // line under the eye curving up to meet it near the temple
    inkLine(ctx, [F(-0.45, 1.3), F(0.25, 1.36), F(0.95, 1.06), F(1.7, 0.42)], 4.2, T, { taperA: 0.35, taperB: 0.4 });
    // cheek stripe running down and out
    inkLine(ctx, [F(0.05, 1.75), F(0.45, 2.1), F(0.85, 2.55)], 4, T, { taperA: 0.3, taperB: 0.5 });
  }
  // band across the nose bridge
  inkLine(ctx, PP([[0.438, 0.626], [0.47, 0.634], [0.5, 0.638], [0.53, 0.634], [0.562, 0.626]]), 4.4, T, { taperA: 0.25, taperB: 0.25 });
  // forehead lines descending from the hairline toward the brows
  inkLine(ctx, PP([[0.478, 0.38], [0.472, 0.42], [0.466, 0.458]]), 3.8, T, { taperA: 0.2, taperB: 0.5 });
  inkLine(ctx, PP([[0.522, 0.38], [0.528, 0.42], [0.534, 0.458]]), 3.8, T, { taperA: 0.2, taperB: 0.5 });
}

function faceAkaza(expr) {
  const { c, ctx } = canvas2d(S, S);
  akazaTattoo(ctx);
  const BROW = '#b2405e', LINE = '#4a1a24';
  if (expr === 'neutral') {
    bothBrows(ctx, [[0.398, 0.497], [0.355, 0.483], [0.305, 0.472], [0.258, 0.47]], 5.2, BROW, { fall: 0.6 });
    bothEyes(ctx, {
      ...AKAZA,
      lid: { inner: [-1, 0.18], c1: [-0.66, -0.74], c2: [0.46, -0.98], outer: [1.06, -0.24] },
      low: { c1: [-0.45, 0.84], c2: [0.55, 0.72] },
    });
    smallNose(ctx, '#8a4a50');
    // confident smirk (viewer-right corner raised)
    inkLine(ctx, PP([[0.462, 0.803], [0.49, 0.808], [0.515, 0.803], [0.54, 0.789]]), 3.4, LINE, { taperA: 0.3, taperB: 0.15 });
    inkLine(ctx, PP([[0.54, 0.782], [0.544, 0.792], [0.542, 0.8]]), 2.4, LINE, { taperA: 0.4, taperB: 0.4 });
  } else {
    bothBrows(ctx, [[0.405, 0.512], [0.36, 0.488], [0.31, 0.468], [0.255, 0.458]], 6, BROW, { fall: 0.55 });
    bothEyes(ctx, {
      ...AKAZA,
      iris: { ...AKAZA.iris, rx: 0.36, ry: 0.68, pk: 0.2, b: 0.08, hl: [{ x: -0.3, y: -0.3, rx: 0.2, ry: 0.15 }] },
      lid: { inner: [-1, 0.06], c1: [-0.66, -0.66], c2: [0.46, -1.04], outer: [1.08, -0.3] },
      low: { c1: [-0.45, 0.86], c2: [0.55, 0.78] },
      lash: { ...AKAZA.lash, w0: 4, w1: 8 },
    });
    smallNose(ctx, '#8a4a50');
    openMouth(ctx, PP([[0.4, 0.764], [0.45, 0.782], [0.5, 0.788], [0.55, 0.782], [0.6, 0.764], [0.578, 0.818], [0.5, 0.856], [0.422, 0.818]]), {
      inside: '#4a0a1c', upperTeeth: 9, lowerTeeth: 7, lw: 3.2, tongue: '#a8344a',
      fangs: [[0.446, 12, 22], [0.554, 12, 22]], lowerFangs: [[0.466, 9, 13], [0.534, 9, 13]],
    });
  }
  return c;
}

function demonVeins(ctx, rng, starts, col) {
  const grow = (x, y, a, w, len, depth) => {
    const pts = [[x, y]];
    let cx = x, cy = y, ca = a;
    const steps = Math.max(3, Math.round(len / 5));
    for (let s = 0; s < steps; s++) {
      ca += rng.range(-0.45, 0.45);
      cx += Math.cos(ca) * 5;
      cy += Math.sin(ca) * 5;
      pts.push([cx, cy]);
    }
    fillRib(ctx, ribbon(pts, w, { taperA: 0.02, taperB: 0.7, pow: 0.7 }), col);
    if (depth < 2) {
      const nb = rng.int(1, 2);
      for (let b = 0; b < nb; b++) {
        const p = pts[Math.floor(rng.range(0.3, 0.8) * pts.length)];
        grow(p[0], p[1], ca + rng.sign() * rng.range(0.5, 1.0), w * 0.62, len * 0.55, depth + 1);
      }
    }
  };
  for (const [u, f, a, w, len] of starts) grow(u * S, f * S, a, w, len, 0);
}

function faceDemonA() {
  const { c, ctx } = canvas2d(S, S);
  const rng = makeRng(911);
  const VEIN = '#3a1c40';
  const starts = [
    [0.235, 0.575, Math.PI + 0.5, 4, 55], [0.25, 0.64, Math.PI - 0.6, 3.6, 45],
    [0.765, 0.575, -0.5, 4, 55], [0.75, 0.64, 0.6, 3.6, 45],
    [0.46, 0.49, -1.9, 3.4, 45], [0.54, 0.49, -1.2, 3.4, 45],
    [0.37, 0.7, 1.9, 3, 40], [0.63, 0.7, 1.2, 3, 40],
  ];
  demonVeins(ctx, rng, starts, VEIN);
  // heavy angry brow ridges
  bothBrows(ctx, [[0.41, 0.53], [0.37, 0.505], [0.31, 0.482], [0.255, 0.47]], 8, '#1a0c14', { fall: 0.5 });
  bothEyes(ctx, {
    scleraGrad: ['#fff8b0', '#ffd23a', '#ff8a10'],
    halo: ['#ff6a14', 7],
    iris: { a: 0, b: 0.12, rx: 0.5, ry: 0.9, cols: ['#ffb020', '#ffe040', '#fff6a0'], ring: '#b04a08', ringW: 0.05, pupil: '#120404', slit: 0.1, shadow: '#b04a08', shadowA: 0.5, hl: [{ x: -0.35, y: -0.35, rx: 0.12, ry: 0.1 }] },
    lid: { inner: [-1, 0.32], c1: [-0.55, -0.25], c2: [0.45, -0.8], outer: [1.1, -0.5] },
    low: { c1: [-0.45, 0.82], c2: [0.62, 0.5] },
    lash: { col: '#140810', w0: 4, w1: 9, wing: [0.2, -0.12, 0] },
    lower: { col: '#140810', w: 3, from: 0.2, to: 1 },
  });
  // nostril slits
  inkLine(ctx, PP([[0.482, 0.718], [0.488, 0.73]]), 3, '#1a0c14', { taperA: 0.3, taperB: 0.3 });
  inkLine(ctx, PP([[0.518, 0.718], [0.512, 0.73]]), 3, '#1a0c14', { taperA: 0.3, taperB: 0.3 });
  // jagged toothy grin
  openMouth(ctx, PP([[0.365, 0.758], [0.43, 0.784], [0.5, 0.79], [0.57, 0.784], [0.635, 0.758], [0.6, 0.812], [0.5, 0.842], [0.4, 0.812]]), {
    inside: '#2a0610', lw: 3.2, jagged: { n: 8, h: 19 }, teethCol: '#efe3b8', ink: '#1a0808',
  });
  return c;
}

function faceDemonB() {
  const { c, ctx } = canvas2d(S, S);
  const rng = makeRng(1717);
  demonVeins(ctx, rng, [[0.24, 0.62, Math.PI - 0.3, 3.4, 45], [0.76, 0.62, 0.3, 3.4, 45], [0.42, 0.44, -2.3, 3, 35], [0.58, 0.44, -0.8, 3, 35]], '#402034');
  const redEye = {
    sclera: '#170606',
    iris: { a: -0.02, b: 0.08, rx: 0.5, ry: 0.86, cols: ['#8a0000', '#e01818', '#ff6a4a'], refl: '#ffb09a', ring: '#3a0000', pupil: '#060000', pk: 0.3, shadow: '#300000', shadowA: 0.5,
      hl: [{ x: -0.32, y: -0.32, rx: 0.2, ry: 0.15 }, { x: 0.3, y: 0.45, rx: 0.08, ry: 0.06 }] },
    lash: { col: '#0e0608', w0: 3.6, w1: 8, wing: [0.14, -0.05, 0] },
    lower: { col: '#0e0608', w: 2.8, from: 0.1, to: 1 },
    halo: ['#5a0a10', 5],
  };
  bothBrows(ctx, [[0.405, 0.525], [0.365, 0.5], [0.31, 0.482], [0.258, 0.475]], 7, '#1e0e14', { fall: 0.5 });
  bothEyes(ctx, {
    ...redEye,
    lid: { inner: [-1, 0.25], c1: [-0.6, -0.55], c2: [0.45, -0.95], outer: [1.06, -0.3] },
    low: { c1: [-0.45, 0.86], c2: [0.6, 0.66] },
  });
  // third eye on the forehead (vertical)
  const F3 = frame(0.5 * S, 0.452 * S, 0, 0.046 * S, 0.023 * S, 0);
  drawEye(ctx, F3, {
    ...redEye,
    iris: { ...redEye.iris, rx: 0.5, ry: 0.9, slit: 0.14, hl: [{ x: -0.3, y: -0.2, rx: 0.2, ry: 0.12 }] },
    lid: { inner: [-1, 0], c1: [-0.55, -1.0], c2: [0.55, -1.0], outer: [1, 0] },
    low: { c1: [-0.55, 1.0], c2: [0.55, 1.0] },
    lash: { col: '#0e0608', w0: 3.4, w1: 5, peak: 0.5, taperIn: 0.2, wing: [0.12, 0, 0] },
    lower: { col: '#0e0608', w: 3.4, from: 0, to: 1 },
  });
  // nostrils
  inkLine(ctx, PP([[0.484, 0.72], [0.488, 0.732]]), 3, '#1e0e14', { taperA: 0.3, taperB: 0.3 });
  inkLine(ctx, PP([[0.516, 0.72], [0.512, 0.732]]), 3, '#1e0e14', { taperA: 0.3, taperB: 0.3 });
  // stitched mouth: lips sewn shut with cross stitches
  const lips = PP([[0.425, 0.8], [0.46, 0.8], [0.5, 0.803], [0.54, 0.8], [0.575, 0.8]]);
  inkLine(ctx, lips, 11, '#4a2233', { taperA: 0.2, taperB: 0.2 });
  inkLine(ctx, lips, 3, '#12060a', { taperA: 0.12, taperB: 0.12 });
  const n = 6;
  for (let k = 0; k < n; k++) {
    const u = lerp(0.44, 0.56, k / (n - 1));
    const f = 0.8 + 0.003 * Math.sin((k / (n - 1)) * Math.PI);
    const tilt = rng.range(-0.003, 0.003);
    const a0 = P(u - 0.009 + tilt, f - 0.026), a1 = P(u + 0.009 - tilt, f + 0.026);
    const b0 = P(u + 0.009 + tilt, f - 0.026), b1 = P(u - 0.009 - tilt, f + 0.026);
    inkLine(ctx, [a0, a1], 3.6, '#1e1014', { taperA: 0.08, taperB: 0.08 });
    inkLine(ctx, [b0, b1], 3.6, '#1e1014', { taperA: 0.08, taperB: 0.08 });
    ctx.fillStyle = css('#12060a');
    for (const [x, y] of [a0, a1, b0, b1]) {
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill();
    }
  }
  // scar across the cheek
  inkLine(ctx, PP([[0.7, 0.66], [0.735, 0.7], [0.76, 0.74]]), 4, '#5a1c28', { taperA: 0.3, taperB: 0.3 });
  for (let k = 0; k < 3; k++) {
    const u = 0.708 + k * 0.02, f = 0.668 + k * 0.03;
    inkLine(ctx, PP([[u - 0.012, f + 0.004], [u + 0.012, f - 0.004]]), 2.4, '#3a1018', { taperA: 0.2, taperB: 0.2 });
  }
  return c;
}

export const FACE_MAKERS = {
  face_tanjiro_neutral: () => faceTanjiro('neutral'),
  face_tanjiro_fierce: () => faceTanjiro('fierce'),
  face_tanjiro_hurt: () => faceTanjiro('hurt'),
  face_giyu_neutral: () => faceGiyu('neutral'),
  face_giyu_fierce: () => faceGiyu('fierce'),
  face_giyu_hurt: () => faceGiyu('hurt'),
  face_akaza_neutral: () => faceAkaza('neutral'),
  face_akaza_fierce: () => faceAkaza('fierce'),
  face_demon_a: () => faceDemonA(),
  face_demon_b: () => faceDemonB(),
};
