// Data textures: washi paper grain overlay and the RGBA shader-noise texture.
import { TAU, canvas2d, css, fbmGrid, makeRng, strokePts, pathOf, worleyGrid, wrapped, bboxOf, clamp } from './core.js';

/** 512² tileable grayscale washi grain with fibres (values mostly 0.85..1.0). */
export function paper(seed) {
  const W = 512, H = 512;
  const rng = makeRng(seed);
  const cloud = fbmGrid(W, H, { cx: 4, cy: 4, oct: 5, gain: 0.55, seed: (seed & 0xffff) + 1 });
  const fine = fbmGrid(W, H, { cx: 64, cy: 64, oct: 2, gain: 0.5, seed: ((seed >>> 8) & 0xffff) + 2 });
  const { c, ctx } = canvas2d(W, H);
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let i = 0; i < W * H; i++) {
    // cloudy formation typical of hand-made washi + fine tooth
    let v = 0.952 + (cloud[i] - 0.5) * 0.075 + (fine[i] - 0.5) * 0.04 + (rng.next() - 0.5) * 0.022;
    v = clamp(v, 0.86, 1) * 255;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  ctx.lineCap = 'round';
  const fiber = (len, lwMin, lwMax, dark, aMin, aMax) => {
    const x = rng.range(0, W), y = rng.range(0, H);
    const ang = rng.range(0, TAU);
    const pts = strokePts(x, y, ang, len, rng.range(-1.6, 1.6), Math.max(4, Math.round(len / 6)));
    const p = pathOf(pts);
    const a = rng.range(aMin, aMax);
    ctx.strokeStyle = dark ? css([214, 214, 214], a) : css([255, 255, 255], a);
    ctx.lineWidth = rng.range(lwMin, lwMax);
    wrapped(ctx, W, H, bboxOf(pts, 2), () => ctx.stroke(p));
  };
  // short fine fibres
  for (let i = 0; i < 900; i++) fiber(rng.range(8, 36), 0.4, 1.1, rng.chance(0.55), 0.18, 0.5);
  // long kozo fibres
  for (let i = 0; i < 90; i++) fiber(rng.range(50, 140), 0.5, 1.4, rng.chance(0.6), 0.2, 0.45);
  // occasional bark specks
  for (let i = 0; i < 60; i++) {
    const x = rng.range(0, W), y = rng.range(0, H), r = rng.range(0.6, 1.6);
    const ry = r * rng.range(0.5, 1), rot = rng.range(0, TAU);
    ctx.fillStyle = css([205, 205, 205], rng.range(0.4, 0.8));
    wrapped(ctx, W, H, [x - r, y - r, x + r, y + r], () => {
      ctx.beginPath();
      ctx.ellipse(x, y, r, ry, rot, 0, TAU);
      ctx.fill();
    });
  }
  return c;
}

function equalize(a, bins = 4096) {
  const hist = new Uint32Array(bins);
  for (let i = 0; i < a.length; i++) hist[Math.min(bins - 1, (a[i] * bins) | 0)]++;
  const cdf = new Float32Array(bins);
  let acc = 0;
  for (let i = 0; i < bins; i++) {
    acc += hist[i];
    cdf[i] = acc;
  }
  const lo = cdf[0], k = 1 / Math.max(1, a.length - lo);
  for (let i = 0; i < a.length; i++) {
    const f = a[i] * bins;
    const b = Math.min(bins - 1, f | 0);
    const prev = b > 0 ? cdf[b - 1] : 0;
    const within = f - b;
    a[i] = clamp((prev + (cdf[b] - prev) * within - lo) * k);
  }
  return a;
}

/**
 * 256² tileable RGBA noise. R fine value noise, G medium fBm, B coarse fBm,
 * A Worley F1. Returns { canvas, mipmaps } where mipmaps is an exact
 * (un-premultiplied) ImageData chain used for the GPU upload, because a 2D
 * canvas stores premultiplied alpha and would destroy RGB where A is small.
 */
export function noise(seed) {
  const N = 256;
  const s = seed & 0xffff;
  const R = fbmGrid(N, N, { cx: 32, cy: 32, oct: 1, seed: s + 11 });
  const G = equalize(fbmGrid(N, N, { cx: 8, cy: 8, oct: 4, gain: 0.5, seed: s + 23 }));
  const B = equalize(fbmGrid(N, N, { cx: 2, cy: 2, oct: 5, gain: 0.55, seed: s + 37 }));
  const A = worleyGrid(N, N, 8, s + 51);
  const level0 = new ImageData(N, N);
  const d = level0.data;
  for (let i = 0; i < N * N; i++) {
    d[i * 4] = Math.round(R[i] * 255);
    d[i * 4 + 1] = Math.round(G[i] * 255);
    d[i * 4 + 2] = Math.round(B[i] * 255);
    d[i * 4 + 3] = Math.round(A[i] * 255);
  }
  const mipmaps = [level0];
  let prev = level0;
  while (prev.width > 1) {
    const w = prev.width >> 1;
    const lvl = new ImageData(w, w);
    const pd = prev.data, ld = lvl.data, pw = prev.width;
    for (let y = 0; y < w; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const a = ((y * 2) * pw + x * 2) * 4, b = a + 4, c2 = a + pw * 4, e = c2 + 4;
        for (let k = 0; k < 4; k++) ld[o + k] = (pd[a + k] + pd[b + k] + pd[c2 + k] + pd[e + k] + 2) >> 2;
      }
    }
    mipmaps.push(lvl);
    prev = lvl;
  }
  const { c, ctx } = canvas2d(N, N);
  ctx.putImageData(level0, 0, 0);
  return { canvas: c, mipmaps };
}
