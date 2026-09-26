// Runtime-generated textures (drawn once on small canvases, exposed as CSS custom properties).
// Everything is deterministic (seeded PRNG) so the look is stable across reloads.
import { rng } from './dom.js';

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

/** Draw a horizontal dry-brush stroke made of many overlapping bristles. */
function brushStroke(g, o) {
  const { x0, x1, yc, thick, seed = 1, dry = 0.3, tail = 0.12, head = 0.03, wave = 0.04, color = '#fff', bristles } = o;
  const R = rng(seed);
  const N = bristles || Math.max(14, Math.round(thick * 0.9));
  const len = x1 - x0;
  const ph = R() * 6.28;
  g.strokeStyle = color;
  g.lineCap = 'round';
  for (let b = 0; b < N; b++) {
    const off = (b + 0.5) / N - 0.5;
    const edge = Math.abs(off) * 2;
    const start = x0 + len * head * (R() * (0.4 + edge * 1.6));
    const early = edge > 0.72 || R() < dry;
    const end = x1 - len * tail * (early ? 0.25 + R() * 1.6 : R() * 0.25);
    g.lineWidth = (thick / N) * (1.5 + R() * 0.9);
    g.globalAlpha = Math.min(1, 0.78 + R() * 0.3 - edge * 0.12);
    g.beginPath();
    const jitter = (R() - 0.5) * thick * 0.04;
    for (let x = start; x <= end; x += 5) {
      const t = (x - x0) / len;
      const prof = Math.min(1, 0.55 + t / (head * 2 + 0.001) * 0.45) * (1 - Math.pow(t, 4) * 0.35);
      const y = yc + off * thick * prof + Math.sin(t * 7 + ph) * thick * wave + jitter;
      if (x === start) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // pressed head blob
  g.globalAlpha = 1;
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x0 + thick * 0.28, yc, thick * 0.3, thick * 0.47, 0, 0, Math.PI * 2);
  g.fill();
}

function washi() {
  const S = 256;
  const [c, g] = mk(S, S);
  const R = rng(7);
  const img = g.createImageData(S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const dark = R() < 0.55;
    const v = dark ? 60 : 255;
    img.data[i] = v;
    img.data[i + 1] = dark ? v - 12 : v;
    img.data[i + 2] = dark ? v - 30 : v - 8;
    img.data[i + 3] = Math.pow(R(), 3.2) * 46;
  }
  g.putImageData(img, 0, 0);
  g.lineCap = 'round';
  for (let i = 0; i < 110; i++) {
    const x = R() * S, y = R() * S, l = 10 + R() * 46, a = R() * Math.PI * 2, bend = (R() - 0.5) * 1.4;
    const light = R() < 0.55;
    g.strokeStyle = light ? `rgba(255,252,240,${0.08 + R() * 0.16})` : `rgba(70,50,25,${0.05 + R() * 0.1})`;
    g.lineWidth = 0.35 + R() * 0.9;
    for (let dx = -S; dx <= S; dx += S) {
      for (let dy = -S; dy <= S; dy += S) {
        g.beginPath();
        g.moveTo(x + dx, y + dy);
        g.quadraticCurveTo(x + dx + Math.cos(a + bend) * l * 0.5, y + dy + Math.sin(a + bend) * l * 0.5, x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l);
        g.stroke();
      }
    }
  }
  return c.toDataURL();
}

/** Horizontal brush bar mask (used by HP / boss / stat bars). */
function bar() {
  const [c, g] = mk(512, 56);
  brushStroke(g, { x0: 6, x1: 506, yc: 28, thick: 40, seed: 3, dry: 0.12, tail: 0.05, head: 0.012, wave: 0.02 });
  return c.toDataURL();
}

/** Big expressive stroke (menu highlight, banners, buttons). */
function stroke() {
  const [c, g] = mk(1024, 200);
  brushStroke(g, { x0: 20, x1: 1000, yc: 100, thick: 132, seed: 21, dry: 0.42, tail: 0.3, head: 0.02, wave: 0.05 });
  return c.toDataURL();
}

/** Thin stroke for underlines. */
function line() {
  const [c, g] = mk(1024, 48);
  brushStroke(g, { x0: 10, x1: 1010, yc: 24, thick: 18, seed: 9, dry: 0.3, tail: 0.25, head: 0.02, wave: 0.12, bristles: 22 });
  return c.toDataURL();
}

/** Screen wipe mask: 3 panels wide — opaque | ragged bristle edge | transparent. */
function wipe() {
  const W = 1536, H = 256;
  const [c, g] = mk(W, H);
  const R = rng(11);
  const seg = W / 3;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, seg * 1.15, H);
  let clump = 0;
  for (let y = 0; y < H; y++) {
    if (y % 6 === 0) clump = R();
    const len = seg * (0.15 + 0.55 * clump + 0.15 * R()) + Math.sin(y * 0.045) * seg * 0.08;
    const grad = g.createLinearGradient(seg * 1.15, 0, seg * 1.15 + len, 0);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.7, `rgba(255,255,255,${0.6 + R() * 0.4})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(seg * 1.15, y, len, 1);
  }
  return c.toDataURL();
}

/** Vertical splash behind technique callouts. */
function splash() {
  const W = 360, H = 1000;
  const [c, g] = mk(W, H);
  const R = rng(33);
  g.save();
  g.translate(W / 2, 0);
  g.rotate(Math.PI / 2);
  brushStroke(g, { x0: 40, x1: 960, yc: 0, thick: 190, seed: 34, dry: 0.45, tail: 0.32, head: 0.02, wave: 0.06 });
  g.restore();
  g.fillStyle = '#fff';
  for (let i = 0; i < 70; i++) {
    const side = R() < 0.5 ? -1 : 1;
    const x = W / 2 + side * (100 + Math.pow(R(), 1.6) * 75);
    const y = 60 + R() * (H - 200);
    const r = 0.8 + Math.pow(R(), 3) * 9;
    g.globalAlpha = 0.6 + R() * 0.4;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 5; i++) {
    const x = W / 2 + (R() - 0.5) * 150;
    const y0 = 120 + R() * 500;
    const l = 40 + R() * 140;
    const w = 3 + R() * 5;
    g.globalAlpha = 0.9;
    g.beginPath();
    g.moveTo(x - w / 2, y0);
    g.lineTo(x + w / 2, y0);
    g.lineTo(x + w * 0.2, y0 + l);
    g.lineTo(x - w * 0.2, y0 + l);
    g.fill();
    g.beginPath();
    g.arc(x, y0 + l, w * 0.55, 0, Math.PI * 2);
    g.fill();
  }
  return c.toDataURL();
}

/** Round ink splat (toasts, rank, result). */
function splat() {
  const S = 512;
  const [c, g] = mk(S, S);
  const R = rng(51);
  const cx = S / 2, cy = S / 2;
  g.fillStyle = '#fff';
  for (let i = 0; i < 90; i++) {
    const a = R() * Math.PI * 2, d = Math.pow(R(), 1.8) * 70;
    g.beginPath();
    g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 30 + R() * 60, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 28; i++) {
    const a = R() * Math.PI * 2;
    const r0 = 80, L = 40 + Math.pow(R(), 1.5) * 150, w = 8 + R() * 20;
    const ca = Math.cos(a), sa = Math.sin(a);
    g.beginPath();
    g.moveTo(cx + ca * r0 - sa * w, cy + sa * r0 + ca * w);
    g.lineTo(cx + ca * (r0 + L), cy + sa * (r0 + L));
    g.lineTo(cx + ca * r0 + sa * w, cy + sa * r0 - ca * w);
    g.fill();
    g.beginPath();
    g.arc(cx + ca * (r0 + L + 6), cy + sa * (r0 + L + 6), 2 + R() * 6, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 90; i++) {
    const a = R() * Math.PI * 2, d = 130 + Math.pow(R(), 0.7) * 110;
    g.globalAlpha = 0.5 + R() * 0.5;
    g.beginPath();
    g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.8 + Math.pow(R(), 3) * 7, 0, Math.PI * 2);
    g.fill();
  }
  return c.toDataURL();
}

/** Ink blotches concentrated on the edges (danger vignette). Centre stays clear. */
function edge() {
  const W = 640, H = 360;
  const [c, g] = mk(W, H);
  const R = rng(77);
  g.fillStyle = '#fff';
  for (let i = 0; i < 1100; i++) {
    const side = Math.floor(R() * 4);
    const t = R();
    const k = Math.pow(R(), 2.2); // 0 = at the edge, 1 = deepest
    const dx = k * W * 0.13;
    const dy = k * H * 0.17;
    let x, y;
    if (side === 0) { x = t * W; y = dy; }
    else if (side === 1) { x = t * W; y = H - dy; }
    else if (side === 2) { x = dx; y = t * H; }
    else { x = W - dx; y = t * H; }
    const r = (1 - k * 0.85) * (3 + R() * 18) + 0.8;
    g.globalAlpha = (0.45 + R() * 0.55) * (1 - k * 0.5);
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 320; i++) {
    const x = R() * W, y = R() * H;
    const ex = Math.min(x, W - x) / W, ey = Math.min(y, H - y) / H;
    if (ex > 0.16 && ey > 0.2) continue;
    g.globalAlpha = 0.75;
    g.beginPath();
    g.arc(x, y, 0.5 + Math.pow(R(), 3) * 3.5, 0, Math.PI * 2);
    g.fill();
  }
  // soft falloff towards the centre
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-out';
  const rad = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.46);
  rad.addColorStop(0, 'rgba(0,0,0,1)');
  rad.addColorStop(0.55, 'rgba(0,0,0,0.9)');
  rad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rad;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  return c.toDataURL();
}

/** Rough square seal (stamp) mask with worn specks. */
function seal() {
  const S = 256;
  const [c, g] = mk(S, S);
  const R = rng(91);
  g.fillStyle = '#fff';
  g.beginPath();
  const pts = [];
  const pad = 10, rad = 16;
  const per = (i, n, a, b) => a + ((b - a) * i) / n;
  const n = 40;
  for (let i = 0; i < n; i++) pts.push([per(i, n, pad + rad, S - pad - rad), pad]);
  for (let i = 0; i < n; i++) pts.push([S - pad, per(i, n, pad + rad, S - pad - rad)]);
  for (let i = 0; i < n; i++) pts.push([per(i, n, S - pad - rad, pad + rad), S - pad]);
  for (let i = 0; i < n; i++) pts.push([pad, per(i, n, S - pad - rad, pad + rad)]);
  pts.forEach(([x, y], i) => {
    const j = (R() - 0.5) * 4.5;
    const cxx = x + (x < S / 2 ? -j : j) * 0.6, cyy = y + (y < S / 2 ? -j : j) * 0.6;
    if (i === 0) g.moveTo(cxx, cyy);
    else g.lineTo(cxx, cyy);
  });
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 70; i++) {
    const nearEdge = R() < 0.6;
    let x = R() * S, y = R() * S;
    if (nearEdge) {
      const s = Math.floor(R() * 4);
      if (s === 0) y = pad + R() * 18;
      else if (s === 1) y = S - pad - R() * 18;
      else if (s === 2) x = pad + R() * 18;
      else x = S - pad - R() * 18;
    }
    g.globalAlpha = 0.5 + R() * 0.5;
    g.beginPath();
    g.arc(x, y, 0.8 + Math.pow(R(), 2.5) * 5, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 0.35;
  g.lineWidth = 1.2;
  g.strokeStyle = '#000';
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    const x = R() * S, y = R() * S;
    g.moveTo(x, y);
    g.lineTo(x + (R() - 0.5) * 60, y + (R() - 0.5) * 20);
    g.stroke();
  }
  return c.toDataURL();
}

/** Deckle-edged paper mask for 9-slice (-webkit-mask-box-image). */
function deckle() {
  const S = 192, B = 40;
  const [c, g] = mk(S, S);
  const R = rng(101);
  g.fillStyle = '#fff';
  g.fillRect(B, B, S - B * 2, S - B * 2);
  const edgeLine = (horizontal, fixed, dir) => {
    for (let i = 0; i <= S; i += 1) {
      const depth = 6 + R() * 10 + Math.sin(i * 0.21) * 3 + (R() < 0.08 ? R() * 12 : 0);
      g.globalAlpha = 0.85 + R() * 0.15;
      if (horizontal) g.fillRect(i, dir > 0 ? fixed : fixed - depth, 1, depth);
      else g.fillRect(dir > 0 ? fixed : fixed - depth, i, depth, 1);
    }
  };
  g.globalAlpha = 1;
  g.fillRect(0, B, S, S - 2 * B);
  g.fillRect(B, 0, S - 2 * B, S);
  g.globalCompositeOperation = 'destination-out';
  g.fillRect(0, 0, S, 22);
  g.fillRect(0, S - 22, S, 22);
  g.fillRect(0, 0, 22, S);
  g.fillRect(S - 22, 0, 22, S);
  g.globalCompositeOperation = 'source-over';
  edgeLine(true, 22, -1);
  edgeLine(true, S - 22, 1);
  edgeLine(false, 22, -1);
  edgeLine(false, S - 22, 1);
  // fill the gaps just inside the torn line
  g.globalAlpha = 1;
  g.fillRect(22, 22, S - 44, S - 44);
  for (let i = 0; i < 160; i++) {
    const s = Math.floor(R() * 4), t = R() * S;
    g.globalAlpha = 0.4 + R() * 0.5;
    const d = 8 + R() * 12;
    if (s === 0) g.fillRect(t, 22 - d, 0.8, d);
    else if (s === 1) g.fillRect(t, S - 22, 0.8, d);
    else if (s === 2) g.fillRect(22 - d, t, d, 0.8);
    else g.fillRect(S - 22, t, d, 0.8);
  }
  return c.toDataURL();
}

let cache = null;

/** Convert a data: URL into a short blob: URL so CSS custom properties stay tiny (cheap style recalc). */
function toBlobURL(dataURL) {
  try {
    const comma = dataURL.indexOf(',');
    const mime = dataURL.slice(5, dataURL.indexOf(';'));
    const bin = atob(dataURL.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch (e) {
    return dataURL;
  }
}

/** Generate all textures (once) and expose them as CSS variables on the given element. Returns build time in ms. */
export function installTextures(el) {
  if (!cache) {
    const t0 = performance.now();
    const gen = {
      '--tex-washi': washi,
      '--tex-bar': bar,
      '--tex-stroke': stroke,
      '--tex-line': line,
      '--tex-wipe': wipe,
      '--tex-splash': splash,
      '--tex-splat': splat,
      '--tex-edge': edge,
      '--tex-seal': seal,
      '--tex-deckle': deckle,
    };
    cache = {};
    for (const k in gen) cache[k] = toBlobURL(gen[k]());
    cache.__ms = performance.now() - t0;
  }
  for (const k in cache) if (k.startsWith('--')) el.style.setProperty(k, `url("${cache[k]}")`);
  return cache.__ms;
}
