// Shared helpers for the procedural, hand-painted texture library.
// Everything here is deterministic (seeded) and draws with Canvas 2D only.

export const TAU = Math.PI * 2;

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32)
// ---------------------------------------------------------------------------
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor((b - a + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
    // approximately normal, std 1
    gauss: () => (next() + next() + next() + next() - 2) * 1.7320508,
    seed: () => Math.floor(next() * 4294967296) >>> 0,
  };
}

// ---------------------------------------------------------------------------
// Colour helpers. Colours are '#rrggbb' strings or [r, g, b] arrays (0..255).
// ---------------------------------------------------------------------------
const hexCache = new Map();
export function rgb(c) {
  if (typeof c !== 'string') return c;
  let v = hexCache.get(c);
  if (!v) {
    const n = parseInt(c.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    hexCache.set(c, v);
  }
  return v;
}

export function css(c, a = 1) {
  const [r, g, b] = rgb(c);
  const R = Math.round(clamp(r, 0, 255));
  const G = Math.round(clamp(g, 0, 255));
  const B = Math.round(clamp(b, 0, 255));
  return a >= 1 ? `rgb(${R},${G},${B})` : `rgba(${R},${G},${B},${Math.max(0, a).toFixed(4)})`;
}

export function mix(a, b, t) {
  const A = rgb(a);
  const B = rgb(b);
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
}

export const lighten = (c, t) => mix(c, [255, 255, 255], t);
export const darken = (c, t) => mix(c, [0, 0, 0], t);

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let h = 0;
  let s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
}

/** Shift hue (degrees) and add to saturation / lightness (−1..1). */
export function adjust(c, dh = 0, ds = 0, dl = 0) {
  const [h, s, l] = rgbToHsl(rgb(c));
  return hslToRgb([(((h + dh / 360) % 1) + 1) % 1, clamp(s + ds), clamp(l + dl)]);
}

/** Small painterly variation of a colour. */
export function vary(c, rng, dl = 0.04, dh = 3, ds = 0.04) {
  return adjust(c, rng.range(-dh, dh), rng.range(-ds, ds), rng.range(-dl, dl));
}

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------
let cpuCanvases = true;
/** true: CPU-backed canvases (no GPU shader-compile stalls, predictable cost). */
export function setCpuCanvases(on) {
  cpuCanvases = !!on;
}

export function canvas2d(w, h, opts) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: cpuCanvases, ...opts });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { c, ctx };
}

/**
 * Calls fn() once for every wrap offset at which a shape with bounding box
 * [x0, y0, x1, y1] intersects the W x H canvas. Makes drawing tileable.
 */
export function wrapped(ctx, W, H, bbox, fn, wrapX = true, wrapY = true) {
  const [x0, y0, x1, y1] = bbox;
  const xs = wrapX ? [0, -W, W] : [0];
  const ys = wrapY ? [0, -H, H] : [0];
  for (const ox of xs) {
    if (x1 + ox < 0 || x0 + ox > W) continue;
    for (const oy of ys) {
      if (y1 + oy < 0 || y0 + oy > H) continue;
      if (ox === 0 && oy === 0) {
        fn(0, 0);
      } else {
        ctx.save();
        ctx.translate(ox, oy);
        fn(ox, oy);
        ctx.restore();
      }
    }
  }
}

export function bboxOf(pts, pad = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

export function pathOf(pts, closed = false) {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  if (closed) p.closePath();
  return p;
}

// ---------------------------------------------------------------------------
// Curves
// ---------------------------------------------------------------------------
export function cubic(p0, p1, p2, p3, n = 16, out = [], skipFirst = false) {
  for (let i = skipFirst ? 1 : 0; i <= n; i++) {
    const t = i / n;
    const m = 1 - t;
    const a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
    out.push([
      a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    ]);
  }
  return out;
}

/** Chain of cubic segments: [p0, c1, c2, p1, c3, c4, p2, ...] */
export function bezierChain(ctrl, n = 16) {
  const out = [];
  for (let i = 0; i + 3 < ctrl.length; i += 3) {
    cubic(ctrl[i], ctrl[i + 1], ctrl[i + 2], ctrl[i + 3], n, out, i > 0);
  }
  return out;
}

/** Uniform Catmull-Rom spline through the control points. */
export function catmull(ctrl, perSeg = 8, closed = false) {
  const out = [];
  const n = ctrl.length;
  const get = (i) => {
    if (closed) return ctrl[((i % n) + n) % n];
    return ctrl[clamp(i, 0, n - 1)];
  };
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(ctrl[n - 1].slice());
  return out;
}

/** Irregular closed blob outline (painterly circle). */
export function blobPts(cx, cy, r, rng, opt = {}) {
  const { n = 28, amp = 0.18, sx = 1, sy = 1, rot = 0, harmonics = 4 } = opt;
  const hs = [];
  for (let k = 1; k <= harmonics; k++) hs.push([k + 1, rng.range(0, TAU), (amp * rng.range(0.5, 1)) / k]);
  const pts = [];
  const cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    let rr = 1;
    for (const [f, ph, am] of hs) rr += am * Math.sin(a * f + ph);
    const x = Math.cos(a) * r * rr * sx;
    const y = Math.sin(a) * r * rr * sy;
    pts.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return pts;
}

/**
 * Tapered ribbon (brush / ink stroke) along a polyline. Returns { path, bbox }.
 * width: number or fn(t, i, p) -> width. Ends taper to a point unless taper = 0.
 */
export function ribbon(pts, width, opt = {}) {
  const { taperA = 0.15, taperB = 0.15, pow = 0.7, wobble = 0, rng = null, minW = 0, offset = null } = opt;
  const n = pts.length;
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const L = cum[n - 1] || 1;
  let f1 = 2, f2 = 5, p1 = 0, p2 = 0;
  if (wobble && rng) {
    f1 = rng.range(1.2, 3.2); f2 = rng.range(4, 9); p1 = rng.range(0, TAU); p2 = rng.range(0, TAU);
  }
  const L0 = [], R0 = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const t = cum[i] / L;
    const p = pts[i];
    const a = pts[i > 0 ? i - 1 : 0];
    const b = pts[i < n - 1 ? i + 1 : n - 1];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    let w = typeof width === 'function' ? width(t, i, p) : width;
    if (taperA > 0 && t < taperA) w *= Math.pow(t / taperA, pow);
    if (taperB > 0 && t > 1 - taperB) w *= Math.pow(Math.max(0, 1 - t) / taperB, pow);
    if (wobble) w *= 1 + wobble * (0.6 * Math.sin(t * f1 * TAU + p1) + 0.4 * Math.sin(t * f2 * TAU + p2));
    w = Math.max(minW, w) * 0.5;
    let px = p[0], py = p[1];
    if (offset) {
      const o = typeof offset === 'function' ? offset(t, i) : offset;
      px += -ty * o; py += tx * o;
    }
    const lx = px - ty * w, ly = py + tx * w, rx = px + ty * w, ry = py - tx * w;
    L0.push(lx, ly); R0.push(rx, ry);
    x0 = Math.min(x0, lx, rx); x1 = Math.max(x1, lx, rx);
    y0 = Math.min(y0, ly, ry); y1 = Math.max(y1, ly, ry);
  }
  const path = new Path2D();
  path.moveTo(L0[0], L0[1]);
  for (let i = 2; i < L0.length; i += 2) path.lineTo(L0[i], L0[i + 1]);
  for (let i = R0.length - 2; i >= 0; i -= 2) path.lineTo(R0[i], R0[i + 1]);
  path.closePath();
  return { path, bbox: [x0 - 1, y0 - 1, x1 + 1, y1 + 1] };
}

/** Offsets a polyline along its normal by d(t) (positive = to the left of travel in canvas coords). */
export function offsetPts(pts, d) {
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i > 0 ? i - 1 : 0];
    const b = pts[i < n - 1 ? i + 1 : n - 1];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const o = typeof d === 'function' ? d(i / (n - 1), i) : d;
    out.push([pts[i][0] - ty * o, pts[i][1] + tx * o]);
  }
  return out;
}

/** Adds smooth random wobble perpendicular to a polyline. */
export function wobblePts(pts, rng, amp = 1.5, cycles = 3) {
  const f1 = rng.range(0.6, 1.4) * cycles, f2 = rng.range(2, 3.5) * cycles;
  const p1 = rng.range(0, TAU), p2 = rng.range(0, TAU);
  return offsetPts(pts, (t) => amp * (0.7 * Math.sin(t * f1 * TAU + p1) + 0.3 * Math.sin(t * f2 * TAU + p2)));
}

// ---------------------------------------------------------------------------
// Tileable noise
// ---------------------------------------------------------------------------
function hash2i(x, y, s) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Tileable value-noise fBm sampled on a w x h grid. The lattice has cx x cy
 * cells at the base octave (integers => seamless). Returns Float32Array (0..1).
 */
export function fbmGrid(w, h, opt = {}) {
  const { cx = 4, cy = 4, oct = 4, gain = 0.5, seed = 1, normalize = true, ridge = false } = opt;
  const out = new Float32Array(w * h);
  let amp = 1;
  const x0s = new Int32Array(w), x1s = new Int32Array(w), fxs = new Float32Array(w);
  for (let o = 0; o < oct; o++) {
    const px = cx << o, py = cy << o;
    const lat = new Float32Array(px * py);
    for (let j = 0; j < py; j++) for (let i = 0; i < px; i++) lat[j * px + i] = hash2i(i, j, seed * 131 + o * 7919);
    for (let x = 0; x < w; x++) {
      const f = ((x + 0.5) / w) * px;
      const xi = Math.floor(f);
      const t = f - xi;
      x0s[x] = xi % px; x1s[x] = (xi + 1) % px; fxs[x] = t * t * (3 - 2 * t);
    }
    for (let y = 0; y < h; y++) {
      const f = ((y + 0.5) / h) * py;
      const yi = Math.floor(f);
      const t = f - yi;
      const v = t * t * (3 - 2 * t);
      const r0 = (yi % py) * px, r1 = ((yi + 1) % py) * px;
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i0 = x0s[x], i1 = x1s[x], u = fxs[x];
        const a = lat[r0 + i0], b = lat[r0 + i1], c = lat[r1 + i0], d = lat[r1 + i1];
        const top = a + (b - a) * u;
        let val = top + (c + (d - c) * u - top) * v;
        if (ridge) val = 1 - Math.abs(val * 2 - 1);
        out[row + x] += val * amp;
      }
    }
    amp *= gain;
  }
  if (normalize) normalizeArr(out);
  return out;
}

/** Tileable Worley F1 (one feature point per square cell). Returns Float32Array (0..1). */
export function worleyGrid(w, h, cells, seed = 1, normalize = true) {
  const pts = new Float32Array(cells * cells * 2);
  const r = makeRng(seed);
  for (let i = 0; i < cells * cells; i++) {
    pts[i * 2] = r.range(0.08, 0.92);
    pts[i * 2 + 1] = r.range(0.08, 0.92);
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const gy = ((y + 0.5) / h) * cells;
    const iy = Math.floor(gy);
    for (let x = 0; x < w; x++) {
      const gx = ((x + 0.5) / w) * cells;
      const ix = Math.floor(gx);
      let best = 1e9;
      for (let dy = -1; dy <= 1; dy++) {
        const cyI = iy + dy;
        const wy = ((cyI % cells) + cells) % cells;
        for (let dx = -1; dx <= 1; dx++) {
          const cxI = ix + dx;
          const wx = ((cxI % cells) + cells) % cells;
          const k = (wy * cells + wx) * 2;
          const fx = cxI + pts[k] - gx;
          const fy = cyI + pts[k + 1] - gy;
          const d = fx * fx + fy * fy;
          if (d < best) best = d;
        }
      }
      out[y * w + x] = Math.sqrt(best);
    }
  }
  if (normalize) normalizeArr(out);
  return out;
}

export function normalizeArr(a) {
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < a.length; i++) {
    if (a[i] < mn) mn = a[i];
    if (a[i] > mx) mx = a[i];
  }
  const k = mx > mn ? 1 / (mx - mn) : 0;
  for (let i = 0; i < a.length; i++) a[i] = (a[i] - mn) * k;
  return a;
}

/** Builds a canvas from a value array. fn(v, data, offset, index) writes RGBA. */
export function valueCanvas(w, h, vals, fn) {
  const { c, ctx } = canvas2d(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0, n = w * h; i < n; i++) fn(vals[i], d, i * 4, i);
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Two-sided tone layer: values below 0.5 tint towards `dark`, above towards
 * `light`; alpha grows with distance from 0.5. Meant to be drawn scaled up.
 */
export function toneLayer(w, h, vals, dark, light, amp = 0.3, contrast = 1.4) {
  const D = rgb(dark), L = rgb(light);
  return valueCanvas(w, h, vals, (v, d, o) => {
    const t = clamp((v - 0.5) * 2 * contrast, -1, 1);
    const C = t < 0 ? D : L;
    d[o] = C[0]; d[o + 1] = C[1]; d[o + 2] = C[2];
    d[o + 3] = Math.min(255, Math.abs(t) * amp * 255);
  });
}

/** Fill the whole canvas with a repeating pattern of src scaled to (sx, sy). Tileable when src tiles. */
export function drawTiled(ctx, src, W, H, opt = {}) {
  const { op = 'source-over', alpha = 1, sx = W / src.width, sy = H / src.height, ox = 0, oy = 0 } = opt;
  const pat = ctx.createPattern(src, 'repeat');
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(ox, oy);
  ctx.scale(sx, sy);
  ctx.fillStyle = pat;
  ctx.fillRect(-ox / sx - src.width, -oy / sy - src.height, W / sx + src.width * 2, H / sy + src.height * 2);
  ctx.restore();
}

/** Draws into a small (downscaled) canvas that is later stretched: cheap soft painterly layers. */
export function softLayer(w, h, draw) {
  const { c, ctx } = canvas2d(w, h);
  draw(ctx, w, h);
  return c;
}

// ---------------------------------------------------------------------------
// Shared overlay tiles (grain, fabric weave)
// ---------------------------------------------------------------------------
let _grain = null;
let _weave = null;

export function grainTile() {
  if (_grain) return _grain;
  const N = 256;
  const f = fbmGrid(N, N, { cx: 32, cy: 32, oct: 3, seed: 91 });
  const r = makeRng(4242);
  _grain = valueCanvas(N, N, f, (v, d, o) => {
    const g = 128 + ((0.6 * v + 0.4 * r.next()) - 0.5) * 230;
    d[o] = d[o + 1] = d[o + 2] = clamp(g, 0, 255);
    d[o + 3] = 255;
  });
  return _grain;
}

export function weaveTile() {
  if (_weave) return _weave;
  const N = 64, P = 4;
  const r = makeRng(777);
  const jit = new Float32Array(N);
  for (let i = 0; i < N; i++) jit[i] = r.range(-18, 18);
  const vals = new Float32Array(N * N);
  _weave = valueCanvas(N, N, vals, (v, d, o, i) => {
    const x = i % N, y = (i / N) | 0;
    const bx = Math.floor(x / P), by = Math.floor(y / P);
    const warp = (bx + by) % 2 === 0;
    const k = warp ? (x % P) + 0.5 : (y % P) + 0.5;
    let g = 128 + Math.sin((k / P) * Math.PI) * 52 - 26;
    g += warp ? jit[bx] : jit[(by + 17) % N];
    d[o] = d[o + 1] = d[o + 2] = clamp(g, 0, 255);
    d[o + 3] = 255;
  });
  return _weave;
}

/** Fine painterly grain via overlay. Keeps tileability when W,H are multiples of 256 (or scaled to fit). */
export function grain(ctx, W, H, alpha = 0.1, op = 'overlay') {
  const g = grainTile();
  const sx = W < 256 ? W / 256 : 1;
  const sy = H < 256 ? H / 256 : 1;
  drawTiled(ctx, g, W, H, { op, alpha, sx, sy });
}

export function weave(ctx, W, H, alpha = 0.1, op = 'overlay', scale = 1) {
  drawTiled(ctx, weaveTile(), W, H, { op, alpha, sx: scale, sy: scale });
}

// ---------------------------------------------------------------------------
// Painterly primitives
// ---------------------------------------------------------------------------

/** Soft elliptical wash (radial gradient), optionally tile-wrapped. */
export function wash(ctx, x, y, rx, ry, color, alpha, W = 0, H = 0, rot = 0) {
  const draw = () => {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(rx / ry, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
    g.addColorStop(0, css(color, alpha));
    g.addColorStop(0.55, css(color, alpha * 0.55));
    g.addColorStop(1, css(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-ry, -ry, ry * 2, ry * 2);
    ctx.restore();
  };
  if (W) {
    const r = Math.max(rx, ry);
    wrapped(ctx, W, H, [x - r, y - r, x + r, y + r], draw);
  } else draw();
}

/** Fills a Path2D (with bbox) honouring tile wrap. */
export function fillWrapped(ctx, rib, W, H, style) {
  if (style) ctx.fillStyle = style;
  wrapped(ctx, W, H, rib.bbox, () => ctx.fill(rib.path));
}

/**
 * Dry-brush stroke: a translucent ribbon plus a few bristle lines that run out
 * at different points. pts is a polyline.
 */
export function dryBrush(ctx, pts, w, color, alpha, rng, opt = {}) {
  const { bristles = 4, bristleColor = color, bristleAlpha = alpha * 1.2, W = 0, H = 0, taper = 0.25 } = opt;
  const rib = ribbon(pts, w, { taperA: taper, taperB: taper * 1.4, wobble: 0.25, rng });
  const lines = [];
  for (let b = 0; b < bristles; b++) {
    const off = rng.range(-0.42, 0.42) * w;
    const s = rng.range(0, 0.25), e = rng.range(0.6, 1);
    const sub = offsetPts(pts, off).slice(Math.floor(s * (pts.length - 1)), Math.max(2, Math.ceil(e * (pts.length - 1))));
    if (sub.length > 1) lines.push({ p: pathOf(sub), lw: rng.range(0.6, 1.6), a: bristleAlpha * rng.range(0.4, 1) });
  }
  const draw = () => {
    ctx.fillStyle = css(color, alpha);
    ctx.fill(rib.path);
    ctx.strokeStyle = css(bristleColor, 1);
    for (const l of lines) {
      ctx.globalAlpha = Math.min(1, l.a);
      ctx.lineWidth = l.lw;
      ctx.stroke(l.p);
    }
    ctx.globalAlpha = 1;
  };
  if (W) wrapped(ctx, W, H, rib.bbox, draw);
  else draw();
}

/** Straight-ish stroke polyline from (x,y) along angle with gentle bend. */
export function strokePts(x, y, ang, len, bend, n = 12) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = ang + bend * (t - 0.5);
    pts.push([x + Math.cos(ang) * len * t + Math.cos(a + Math.PI / 2) * bend * len * 0.15 * Math.sin(t * Math.PI), y + Math.sin(ang) * len * t + Math.sin(a + Math.PI / 2) * bend * len * 0.15 * Math.sin(t * Math.PI)]);
  }
  return pts;
}

/**
 * Soft fold shading for fabrics: long lens-shaped darker / lighter strokes
 * painted on a small canvas and stretched (automatically soft, tileable).
 */
export function foldLayer(size, rng, opt = {}) {
  const { count = 5, dark = '#000000', light = '#ffffff', darkA = 0.5, lightA = 0.35, ang = 1.1, angJ = 0.35, widthK = 0.12 } = opt;
  return softLayer(size, size, (ctx, w, h) => {
    for (let i = 0; i < count; i++) {
      const a = ang + rng.range(-angJ, angJ);
      const len = rng.range(0.6, 1.2) * w;
      const x = rng.range(0, w), y = rng.range(0, h);
      const pts = strokePts(x - Math.cos(a) * len * 0.5, y - Math.sin(a) * len * 0.5, a, len, rng.range(-0.6, 0.6), 16);
      const wd = rng.range(0.5, 1.2) * widthK * w;
      const rib = ribbon(pts, wd, { taperA: 0.45, taperB: 0.45, pow: 1.2 });
      fillWrapped(ctx, rib, w, h, css(dark, darkA * rng.range(0.6, 1)));
      // highlight ridge next to it
      const hp = offsetPts(pts, wd * rng.range(0.7, 1.1));
      const hr = ribbon(hp, wd * 0.45, { taperA: 0.5, taperB: 0.5, pow: 1.2 });
      fillWrapped(ctx, hr, w, h, css(light, lightA * rng.range(0.5, 1)));
    }
  });
}

/** Shuffle (Fisher-Yates) with rng. */
export function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
