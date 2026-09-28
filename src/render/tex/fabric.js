// Character textures: tileable fabrics, skins and hair gradients.
import {
  TAU, lerp, makeRng, canvas2d, css, lighten, darken, vary, wrapped, bboxOf, pathOf, catmull, blobPts,
  ribbon, offsetPts, strokePts, fbmGrid, toneLayer, drawTiled, grain, weave, wash, fillWrapped, dryBrush,
  foldLayer,
} from './core.js';

function fabricBase(ctx, S, seed, base, dark, light, amp = 0.35) {
  ctx.fillStyle = css(base);
  ctx.fillRect(0, 0, S, S);
  drawTiled(ctx, toneLayer(32, 32, fbmGrid(32, 32, { cx: 2, cy: 2, oct: 4, seed: (seed & 0xfff) + 17 }), dark, light, amp, 1.3), S, S);
}

function folds(ctx, S, rng, opt) {
  const f = foldLayer(64, rng, opt);
  drawTiled(ctx, f, S, S, { alpha: opt.alpha ?? 1 });
}

function brushWork(ctx, S, rng, n, colors, opt = {}) {
  const { ang = 1.0, angJ = 0.4, lenMin = 30, lenMax = 110, wMin = 5, wMax = 16, aMin = 0.05, aMax = 0.14 } = opt;
  for (let i = 0; i < n; i++) {
    const x = rng.range(0, S), y = rng.range(0, S);
    const pts = strokePts(x, y, ang + rng.range(-angJ, angJ), rng.range(lenMin, lenMax), rng.range(-0.6, 0.6), 10);
    dryBrush(ctx, pts, rng.range(wMin, wMax), rng.pick(colors), rng.range(aMin, aMax), rng, { W: S, H: S, bristles: 3 });
  }
}

// ---------------------------------------------------------------------------
export function checkerTanjiro(seed) {
  const S = 256, C = 64;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  ctx.fillStyle = css('#151515');
  ctx.fillRect(0, 0, S, S);
  brushWork(ctx, S, rng, 30, ['#262626', '#0a0a0a'], { aMin: 0.2, aMax: 0.4 });
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      if ((i + j) % 2) continue;
      const x = i * C, y = j * C;
      const tone = vary('#2a7a5e', rng, 0.03, 3, 0.05);
      const corners = [[x, y], [x + C, y], [x + C, y + C], [x, y + C]].map((p) => [p[0] + rng.range(-0.8, 0.8), p[1] + rng.range(-0.8, 0.8)]);
      const pts = [];
      for (let e = 0; e < 4; e++) {
        const a = corners[e], b = corners[(e + 1) % 4];
        for (let s = 0; s < 6; s++) {
          const t = s / 6;
          const nx = -(b[1] - a[1]) / C, ny = (b[0] - a[0]) / C;
          const j2 = s === 0 ? 0 : rng.range(-1.1, 1.1);
          pts.push([lerp(a[0], b[0], t) + nx * j2, lerp(a[1], b[1], t) + ny * j2]);
        }
      }
      const p = pathOf(pts, true);
      // painterly strokes inside the cell
      const strokes = [];
      for (let k = 0; k < 7; k++) {
        const sx = x + rng.range(0, C), sy = y + rng.range(0, C);
        const sp = strokePts(sx, sy, 0.9 + rng.range(-0.3, 0.3), rng.range(20, 60), rng.range(-0.5, 0.5), 8);
        strokes.push({ rib: ribbon(sp, rng.range(4, 12), { taperA: 0.3, taperB: 0.4, wobble: 0.3, rng }), col: rng.chance(0.5) ? lighten(tone, 0.12) : darken(tone, 0.18), a: rng.range(0.25, 0.5) });
      }
      wrapped(ctx, S, S, bboxOf(pts, 2), () => {
        ctx.fillStyle = css(tone);
        ctx.fill(p);
        ctx.save();
        ctx.clip(p);
        for (const s of strokes) {
          ctx.fillStyle = css(s.col, s.a);
          ctx.fill(s.rib.path);
        }
        ctx.restore();
      });
    }
  }
  folds(ctx, S, rng, { count: 6, dark: '#000000', light: '#bff5dc', darkA: 0.4, lightA: 0.2, ang: 1.15, widthK: 0.17 });
  weave(ctx, S, S, 0.12);
  grain(ctx, S, S, 0.06);
  return c;
}

export function giyuSolid(seed) {
  const S = 256;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  fabricBase(ctx, S, seed, '#7b2331', '#521420', '#9a3444', 0.4);
  brushWork(ctx, S, rng, 34, ['#8e2c3c', '#621a27'], { ang: 1.45, angJ: 0.15, lenMin: 60, lenMax: 160, aMin: 0.08, aMax: 0.18 });
  folds(ctx, S, rng, { count: 6, dark: '#1c0409', light: '#e0808c', darkA: 0.4, lightA: 0.22, ang: 1.5, angJ: 0.2, widthK: 0.16 });
  weave(ctx, S, S, 0.1);
  grain(ctx, S, S, 0.06);
  return c;
}

export function giyuKikko(seed) {
  const S = 512, NX = 9, NY = 10;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  const w = S / NX, rs = S / NY;
  const s = rs / 1.5;
  const kx = w / 2 / (s * Math.cos(Math.PI / 6));
  const cols = ['#d9ad3c', '#6f8a3c', '#d9803a'];
  const INK = '#1e1712';
  ctx.fillStyle = css(INK);
  ctx.fillRect(0, 0, S, S);
  const hexPts = (cx, cy, k) => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      pts.push([cx + Math.cos(a) * s * kx * k, cy + Math.sin(a) * s * k]);
    }
    return pts;
  };
  for (let row = 0; row < NY; row++) {
    for (let col = 0; col < NX; col++) {
      const cx = col * w + (row & 1 ? w / 2 : 0) + w / 4;
      const cy = row * rs + rs / 2;
      const q = col - (row - (row & 1)) / 2;
      const ci = (((q - row) % 3) + 3) % 3;
      const tone = vary(cols[ci], rng, 0.035, 3, 0.05);
      const outer = hexPts(cx, cy, 1);
      const inner = hexPts(cx, cy, 0.6);
      const po = pathOf(outer, true), pi = pathOf(inner, true);
      const strokes = [];
      for (let k = 0; k < 3; k++) {
        const sp = strokePts(cx + rng.range(-s, s * 0.5), cy + rng.range(-s, s), 1.2 + rng.range(-0.3, 0.3), rng.range(14, 34), rng.range(-0.4, 0.4), 6);
        strokes.push({ rib: ribbon(sp, rng.range(3, 8), { taperA: 0.3, taperB: 0.4 }), col: rng.chance(0.5) ? lighten(tone, 0.14) : darken(tone, 0.14), a: rng.range(0.25, 0.45) });
      }
      wrapped(ctx, S, S, bboxOf(outer, 4), () => {
        const g = ctx.createLinearGradient(cx, cy - s, cx, cy + s);
        g.addColorStop(0, css(lighten(tone, 0.1)));
        g.addColorStop(1, css(darken(tone, 0.1)));
        ctx.fillStyle = g;
        ctx.fill(po);
        ctx.save();
        ctx.clip(po);
        for (const st of strokes) {
          ctx.fillStyle = css(st.col, st.a);
          ctx.fill(st.rib.path);
        }
        ctx.restore();
        ctx.fillStyle = css(lighten(tone, 0.08), 0.6);
        ctx.fill(pi);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = css(INK, 0.85);
        ctx.lineWidth = 2.2;
        ctx.stroke(pi);
        ctx.strokeStyle = css(INK);
        ctx.lineWidth = 5;
        ctx.stroke(po);
      });
    }
  }
  folds(ctx, S, rng, { count: 6, dark: '#1a0f05', light: '#fff2c8', darkA: 0.3, lightA: 0.18, ang: 1.3, widthK: 0.16 });
  weave(ctx, S, S, 0.1, 'overlay', 2);
  grain(ctx, S, S, 0.06);
  return c;
}

// Kokushibo's kimono: an irregular "stone pavement" of hexagons, purple and black, inked apart.
export function kokushiboKimono(seed) {
  const S = 512, NX = 8, NY = 10;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  const w = S / NX, rs = S / NY;
  const s = rs / 1.5;
  const kx = w / 2 / (s * Math.cos(Math.PI / 6));
  const PURPLES = ['#5c2c80', '#6a3692', '#4e2570'];
  const BLACK = '#17121e';
  const INK = '#0b0810';
  ctx.fillStyle = css(INK);
  ctx.fillRect(0, 0, S, S);
  const hexPts = (cx, cy, k) => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      pts.push([cx + Math.cos(a) * s * kx * k, cy + Math.sin(a) * s * k]);
    }
    return pts;
  };
  for (let row = 0; row < NY; row++) {
    for (let col = 0; col < NX; col++) {
      const cx = col * w + (row & 1 ? w / 2 : 0) + w / 4;
      const cy = row * rs + rs / 2;
      const dark = rng.chance(0.38);
      const tone = vary(dark ? BLACK : rng.pick(PURPLES), rng, 0.03, 3, 0.04);
      const outer = hexPts(cx, cy, 0.97);
      const po = pathOf(outer, true);
      const strokes = [];
      for (let k = 0; k < 3; k++) {
        const sp = strokePts(cx + rng.range(-s, s * 0.5), cy + rng.range(-s, s), 1.3 + rng.range(-0.3, 0.3), rng.range(14, 34), rng.range(-0.4, 0.4), 6);
        strokes.push({ rib: ribbon(sp, rng.range(3, 8), { taperA: 0.3, taperB: 0.4 }), col: lighten(tone, dark ? 0.07 : 0.12), a: rng.range(0.2, 0.4) });
      }
      wrapped(ctx, S, S, bboxOf(outer, 4), () => {
        const g = ctx.createLinearGradient(cx, cy - s, cx, cy + s);
        g.addColorStop(0, css(lighten(tone, dark ? 0.05 : 0.09)));
        g.addColorStop(1, css(darken(tone, 0.1)));
        ctx.fillStyle = g;
        ctx.fill(po);
        ctx.save();
        ctx.clip(po);
        for (const st of strokes) {
          ctx.fillStyle = css(st.col, st.a);
          ctx.fill(st.rib.path);
        }
        ctx.restore();
        ctx.lineJoin = 'round';
        ctx.strokeStyle = css(INK);
        ctx.lineWidth = 4;
        ctx.stroke(po);
      });
    }
  }
  folds(ctx, S, rng, { count: 6, dark: '#05020a', light: '#c9a6f0', darkA: 0.34, lightA: 0.16, ang: 1.3, widthK: 0.16 });
  weave(ctx, S, S, 0.1, 'overlay', 2);
  grain(ctx, S, S, 0.06);
  return c;
}

// Kokushibo's umanori hakama: black, with the pleats pressed in.
export function kokushiboHakama(seed) {
  const S = 256;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  fabricBase(ctx, S, seed, '#18161d', '#0c0b10', '#2b2833', 0.45);
  brushWork(ctx, S, rng, 26, ['#24212b', '#0e0d12'], { ang: 1.5, angJ: 0.15, lenMin: 60, lenMax: 150, aMin: 0.12, aMax: 0.24 });
  // pleat creases every quarter (seamless across)
  for (let k = 0; k < 4; k++) {
    const x = (k + 0.5) * (S / 4);
    ctx.fillStyle = css('#000000', 0.45);
    ctx.fillRect(x - 1.5, 0, 3, S);
    ctx.fillStyle = css('#4a4556', 0.4);
    ctx.fillRect(x + 1.5, 0, 2, S);
  }
  folds(ctx, S, rng, { count: 6, dark: '#000000', light: '#5c566e', darkA: 0.42, lightA: 0.26, ang: 1.5, angJ: 0.2 });
  weave(ctx, S, S, 0.1);
  grain(ctx, S, S, 0.05);
  return c;
}

export function uniformBlack(seed) {
  const S = 256;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  fabricBase(ctx, S, seed, '#1b1d26', '#0f1016', '#2a2d3a', 0.5);
  brushWork(ctx, S, rng, 26, ['#262a38', '#101119'], { ang: 1.4, angJ: 0.3, aMin: 0.15, aMax: 0.3 });
  folds(ctx, S, rng, { count: 6, dark: '#05060a', light: '#56607e', darkA: 0.5, lightA: 0.3, ang: 1.35, angJ: 0.3 });
  weave(ctx, S, S, 0.1);
  grain(ctx, S, S, 0.05);
  return c;
}

// ---------------------------------------------------------------------------
// Rengoku: white haori with flames rising from the hem. 512 x 512, seamless
// left-right only (mapped once vertically; canvas top = shoulders, bottom =
// hem). The top half is plain cream fabric -- the torso samples just that
// half -- so every flame pixel stays below y = S / 2.
// ---------------------------------------------------------------------------

// Spine of a flame tongue: rises from (x, y) in a gentle S, then hooks over
// towards dir (+1 right, -1 left) with growing curvature from curlAt onwards.
// `extra` continues the curl for a few steps past the tip (for the ink point).
function flameSpine(x, y, len, dir, o, extra = 0) {
  const { n, sway, swayPh, curl, curlAt, lean } = o;
  const pts = [[x, y]];
  const ds = len / n;
  let px = x, py = y;
  for (let i = 0; i < n + extra; i++) {
    const u = (i + 0.5) / n;
    const k = u > curlAt ? (u - curlAt) / (1 - curlAt) : 0;
    const th = -Math.PI / 2 + dir * (lean + sway * Math.cos(u * Math.PI * 1.15 + swayPh) + curl * k * k);
    px += Math.cos(th) * ds;
    py += Math.sin(th) * ds;
    pts.push([px, py]);
  }
  return pts;
}

export function rengokuHaori(seed) {
  const S = 512;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  // plain cream haori fabric; its folds carry on across the flames (same seed, flame-toned)
  const foldSeed = rng.seed();
  const FOLD = { count: 7, ang: 1.52, angJ: 0.18, widthK: 0.13 };
  fabricBase(ctx, S, seed, '#efe9dc', '#dcd4c4', '#f9f6ef', 0.35);
  brushWork(ctx, S, rng, 44, ['#f8f4ec', '#e0d8c8'], { ang: 1.5, angJ: 0.18, lenMin: 80, lenMax: 220, wMin: 8, wMax: 22, aMin: 0.08, aMax: 0.18 });
  folds(ctx, S, makeRng(foldSeed), { ...FOLD, dark: '#5a4c48', light: '#ffffff', darkA: 0.18, lightA: 0.22 });

  // flames are painted on their own layer (the painterly passes use source-atop)
  const fl = canvas2d(S, S);
  const f = fl.ctx;
  f.lineJoin = 'round';
  const INK = '#4a0906', INK2 = '#7c170c', CRIMSON = '#b3261a';
  const BODY = '#e2521c', ORANGE = '#f28a24', GOLD = '#f9c440';
  const ROOT = S * 0.955; // tongues grow out of the hem band from here
  const N = 40;
  const prof = (u) => Math.pow(Math.max(0, 1 - u), 1.1) * (1 + 0.22 * Math.sin(Math.PI * u));

  // One tongue: ink (the body dilated by LW, running out to a sharp point past
  // the tip), body, and orange + gold cores (shorter, straighter flames from the same root).
  const tongues = [];
  const LW = 10, LW2 = 3.6, EXTRA = 3;
  const tongue = (x, top, w0, dir, layers = 2) => {
    const o = { n: N, sway: rng.range(0.2, 0.32), swayPh: rng.range(-0.3, 0.3), curl: rng.range(2.5, 3.0), curlAt: rng.range(0.58, 0.66), lean: rng.range(-0.05, 0.08) };
    const bodyW = (t, i) => (i === 0 ? w0 : w0 * prof((i - 1) / N));
    const inkW = (t, i) => (i === 0 ? w0 + LW : i <= N + 1 ? w0 * prof((i - 1) / N) + LW : LW * Math.pow(1 - (i - N - 1) / EXTRA, 0.8));
    let len = ROOT - top;
    let spine, ink;
    for (let it = 0; it < 4; it++) {
      spine = [[x, S + 30], ...flameSpine(x, ROOT, len, dir, o, EXTRA)];
      ink = ribbon(spine, inkW, { taperA: 0, taperB: 0 });
      len *= (ROOT - top) / (ROOT - (ink.bbox[1] + 1));
    }
    const body = ribbon(spine.slice(0, N + 2), bodyW, { taperA: 0, taperB: 0 });
    const inner = [[0.74, 0.6, 0], [0.48, 0.36, 1]].slice(0, layers).map(([k, kw, which]) => {
      const pts = flameSpine(x, ROOT, len * k, dir, { ...o, curl: o.curl * 0.6 });
      return { path: ribbon(pts, (t, i) => w0 * kw * prof(i / N), { taperA: 0, taperB: 0 }).path, which };
    });
    const bb = ink.bbox;
    tongues.push({ ink: ink.path, path: body.path, inner, bb: [bb[0] - 2, bb[1] - 2, bb[2] + 2, bb[3] + 2] });
  };

  // back: tall main tongues (the tallest tip reaches ~55% of the canvas height)
  const tops = [0.552, 0.66, 0.585, 0.69, 0.615];
  const x0 = S * rng.range(0.26, 0.34); // keeps the tallest tongue off the wrap edge
  for (let i = 0; i < 5; i++) tongue(x0 + (i + rng.range(-0.08, 0.08)) * (S / 5), tops[i] * S, rng.range(96, 112), rng.sign());
  // middle: shorter tongues in the gaps
  for (let i = 0; i < 5; i++) tongue(x0 + (i + 0.5 + rng.range(-0.08, 0.08)) * (S / 5), S * rng.range(0.74, 0.79), rng.range(72, 84), rng.sign());
  // front: low flickers along the top of the hem band
  for (let i = 0; i < 5; i++) tongue(x0 + (i + 0.25 + rng.range(-0.1, 0.1)) * (S / 5), S * rng.range(0.85, 0.88), rng.range(50, 58), rng.sign(), 1);

  // low wavy flame mass under all tongues (periodic in x), so no valley ever opens onto the band
  const massPts = [];
  const mp1 = rng.range(0, TAU), mp2 = rng.range(0, TAU);
  for (let x = 0; x <= S; x += 8) massPts.push([x, S * 0.872 + 6 * Math.sin((x / S) * TAU * 3 + mp1) + 3 * Math.sin((x / S) * TAU * 7 + mp2)]);
  massPts.push([S, S + 4], [0, S + 4]);
  const mass = pathOf(massPts, true);

  // vertical gradients: everything melts into deep crimson towards the hem
  const vg = (stops) => {
    const g = f.createLinearGradient(0, 0, 0, S);
    for (const [t, col] of stops) g.addColorStop(t, css(col));
    return g;
  };
  const bodyG = vg([[0.86, BODY], [0.92, CRIMSON]]);
  const inkG = vg([[0.885, INK], [0.92, CRIMSON]]);
  const ink2G = vg([[0.88, INK2], [0.915, CRIMSON]]);
  const coreG = [vg([[0.87, ORANGE], [0.918, CRIMSON]]), vg([[0.855, GOLD], [0.89, ORANGE], [0.918, CRIMSON]])];
  const each = (fn) => { for (const t of tongues) wrapped(f, S, S, t.bb, () => fn(t), true, false); };
  // 1) one bold ink contour around the whole flame mass
  f.fillStyle = inkG;
  f.strokeStyle = inkG;
  f.lineWidth = LW;
  f.stroke(mass);
  each((t) => f.fill(t.ink));
  f.fillStyle = bodyG;
  f.fill(mass);
  each((t) => f.fill(t.path));
  // 2) back to front: thin contours where tongues overlap, then the orange and gold cores
  each((t) => {
    f.lineWidth = LW2;
    f.strokeStyle = inkG;
    f.stroke(t.path);
    f.fillStyle = bodyG;
    f.fill(t.path);
    f.save();
    f.clip(t.path);
    f.lineWidth = LW2 * 0.8;
    f.strokeStyle = ink2G;
    for (const L of t.inner) {
      f.stroke(L.path);
      f.fillStyle = coreG[L.which];
      f.fill(L.path);
    }
    f.restore();
  });
  // solid crimson band along the hem (bottom ~8%), its top edge laid in with ragged horizontal strokes
  f.fillStyle = css(CRIMSON);
  f.fillRect(0, S * 0.92, S, S * 0.08);
  for (let i = 0; i < 12; i++) {
    const y = S * rng.range(0.905, 0.925);
    const pts = strokePts(rng.range(0, S), y, rng.range(-0.04, 0.04), rng.range(70, 150), rng.range(-0.3, 0.3), 12);
    dryBrush(f, pts, rng.range(6, 12), CRIMSON, rng.range(0.55, 0.85), rng, { W: S, H: S, bristles: 2, bristleColor: '#c7351f' });
  }

  // hand-painted streaks, mottling and the fabric folds, only where there is paint
  f.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 70; i++) {
    const y = rng.range(S * 0.55, S * 1.05);
    const pts = strokePts(rng.range(0, S), y, -Math.PI / 2 + rng.range(-0.35, 0.35), rng.range(24, 80), rng.range(-0.6, 0.6), 10);
    const col = y > S * 0.9 ? rng.pick(['#8c1409', '#c63a24']) : rng.pick(['#ff9a4a', '#8c1409', '#ffd27a']);
    dryBrush(f, pts, rng.range(4, 12), col, rng.range(0.06, 0.15), rng, { W: S, H: S, bristles: 3 });
  }
  drawTiled(f, toneLayer(32, 32, fbmGrid(32, 32, { cx: 4, cy: 4, oct: 3, seed: (seed & 0xfff) + 31 }), '#6a0a05', '#ffb070', 0.18, 1.3), S, S, { op: 'source-atop' });
  drawTiled(f, foldLayer(64, makeRng(foldSeed), { ...FOLD, dark: '#3a0502', light: '#ffc27a', darkA: 0.3, lightA: 0.1 }), S, S, { op: 'source-atop' });
  f.globalCompositeOperation = 'source-over';
  f.clearRect(0, 0, S, S / 2 + 4); // hard guarantee: no flame pixels in the upper half
  ctx.drawImage(fl.c, 0, 0);

  weave(ctx, S, S, 0.1, 'overlay', 2);
  grain(ctx, S, S, 0.06);
  return c;
}

// ---------------------------------------------------------------------------
// Obanai: black / off-white vertical stripes (4 + 4 per tile), 256 x 256.
// ---------------------------------------------------------------------------
export function obanaiStripes(seed) {
  const S = 256, N = 8, SW = S / N;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  fabricBase(ctx, S, seed, '#e9e5dc', '#d6d0c4', '#f6f3ed', 0.35);
  brushWork(ctx, S, rng, 26, ['#f5f2eb', '#d6d0c3'], { ang: 1.55, angJ: 0.12, lenMin: 60, lenMax: 150, wMin: 4, wMax: 10, aMin: 0.1, aMax: 0.2 });
  // black stripes on their own layer; edges wobble periodically in y so the tile wraps vertically
  const bl = canvas2d(S, S);
  const b = bl.ctx;
  const edge = (x) => {
    const k1 = rng.int(1, 3), k2 = rng.int(4, 7), p1 = rng.range(0, TAU), p2 = rng.range(0, TAU);
    const a1 = rng.range(0.5, 1.0), a2 = rng.range(0.2, 0.45);
    return (y) => x + a1 * Math.sin((y / S) * TAU * k1 + p1) + a2 * Math.sin((y / S) * TAU * k2 + p2);
  };
  for (let k = 0; k < N / 2; k++) {
    // stripes are offset half a stripe, so the tile edge falls inside a white stripe
    const xa = SW * (2 * k + 0.5);
    const L = edge(xa), R = edge(xa + SW);
    const pts = [];
    for (let y = -4; y <= S + 4; y += 4) pts.push([L(y), y]);
    for (let y = S + 4; y >= -4; y -= 4) pts.push([R(y), y]);
    const p = pathOf(pts, true);
    const tone = vary('#18171d', rng, 0.012, 4, 0.03);
    b.fillStyle = css(tone);
    b.fill(p);
    b.save();
    b.clip(p);
    for (let s = 0; s < 9; s++) {
      const sp = strokePts(xa + rng.range(0, SW), rng.range(0, S), Math.PI / 2 + rng.range(-0.12, 0.12), rng.range(40, 120), rng.range(-0.4, 0.4), 8);
      const rib = ribbon(sp, rng.range(4, 11), { taperA: 0.3, taperB: 0.4, wobble: 0.3, rng });
      fillWrapped(b, rib, S, S, css(rng.chance(0.5) ? lighten(tone, 0.08) : darken(tone, 0.4), rng.range(0.3, 0.6)));
    }
    b.restore();
  }
  drawTiled(b, toneLayer(32, 32, fbmGrid(32, 32, { cx: 2, cy: 2, oct: 4, seed: (seed & 0xfff) + 5 }), '#0b0a0e', '#2e2d38', 0.45, 1.3), S, S, { op: 'source-atop' });
  ctx.drawImage(bl.c, 0, 0);
  folds(ctx, S, rng, { count: 8, dark: '#34323f', light: '#d8d5e2', darkA: 0.16, lightA: 0.2, ang: 1.54, angJ: 0.1, widthK: 0.11 });
  weave(ctx, S, S, 0.1);
  grain(ctx, S, S, 0.06);
  return c;
}

export function legWraps(seed) {
  const S = 256, SP = 32, SLOPE = 0.25;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  ctx.fillStyle = css('#eee7d6');
  ctx.fillRect(0, 0, S, S);
  const lineY = (k, x) => k * SP + x * SLOPE;
  // bands: each overlaps the next; shadow just below the overlapping edge.
  // Band k continues as band k+2 across the right edge, so tones alternate by parity.
  const tones = [vary('#efe8d8', rng, 0.015, 2, 0.02), vary('#ece4d2', rng, 0.015, 2, 0.02)];
  for (let k = -10; k < 10; k++) {
    const tone = tones[k & 1];
    const yMin = lineY(k, 0), yMax = lineY(k + 1, S);
    if (yMax < 0 || yMin > S) continue;
    ctx.save();
    ctx.transform(1, SLOPE, 0, 1, 0, 0);
    const g2 = ctx.createLinearGradient(0, k * SP, 0, (k + 1) * SP);
    g2.addColorStop(0, css(darken(tone, 0.22)));
    g2.addColorStop(0.28, css(darken(tone, 0.06)));
    g2.addColorStop(0.7, css(lighten(tone, 0.05)));
    g2.addColorStop(1, css(darken(tone, 0.04)));
    ctx.fillStyle = g2;
    ctx.fillRect(-2, k * SP, S + 4, SP);
    ctx.restore();
  }
  // thread lines along the bands
  ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const x = rng.range(0, S), k = rng.range(-8, 8);
    const y = lineY(k, x);
    const len = rng.range(20, 80);
    const pts = [[x, y], [x + len, y + len * SLOPE]];
    const col = rng.chance(0.5) ? '#c9bfa6' : '#ffffff';
    const a = rng.range(0.2, 0.45), lw = rng.range(0.5, 1);
    wrapped(ctx, S, S, bboxOf(pts, 2), () => {
      ctx.strokeStyle = css(col, a);
      ctx.lineWidth = lw;
      ctx.stroke(pathOf(pts));
    });
  }
  // ink edges of each overlapping band (periodic wobble => seamless)
  for (let k = -10; k < 10; k++) {
    const ph = (k & 1) * 1.7;
    const pts = [];
    for (let x = -8; x <= S + 8; x += 8) pts.push([x, lineY(k, x) + 0.7 * Math.sin((x / S) * TAU * 2 + ph)]);
    if (pts[pts.length - 1][1] < -4 || pts[0][1] > S + 4) continue;
    const rib = ribbon(pts, (t, i, p) => 2 + 0.6 * Math.sin((p[0] / S) * TAU * 3 + ph), { taperA: 0, taperB: 0 });
    ctx.fillStyle = css('#3b342a');
    ctx.fill(rib.path);
    ctx.fillStyle = css('#ffffff', 0.55);
    ctx.fill(ribbon(offsetPts(pts, -2.4), 1, { taperA: 0, taperB: 0 }).path);
  }
  weave(ctx, S, S, 0.12);
  grain(ctx, S, S, 0.06);
  return c;
}

export function akazaSkin(seed) {
  const S = 512;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  fabricBase(ctx, S, seed, '#f2d9cf', '#e2bfb2', '#fae9e2', 0.35);
  const INK = '#28307a';
  const ROWS = 5;
  const sp = S / ROWS;
  const bandPath = (xa, xb, yc, th, taper) => {
    // tapered horizontal band from xa to xb (may exceed canvas; drawn wrapped)
    const pts = [];
    const n = 24;
    const ph = rng.range(0, TAU);
    for (let i = 0; i <= n; i++) {
      const x = lerp(xa, xb, i / n);
      pts.push([x, yc + 1.6 * Math.sin((x / S) * TAU * 2 + ph)]);
    }
    return ribbon(pts, th, { taperA: taper, taperB: taper, pow: 0.9 });
  };
  const bands = [];
  for (let r = 0; r < ROWS; r++) {
    const yc = (r + 0.5) * sp + rng.range(-5, 5);
    const doubled = r % 2 === 1;
    const th = doubled ? rng.range(7.5, 9.5) : rng.range(16, 21);
    // two segments around the limb, overlapping with pointed ends
    const start = rng.range(0, S);
    const lenA = S * rng.range(0.55, 0.65);
    const off = (th * 0.9 + 3) * (rng.chance(0.5) ? 1 : -1);
    const segs = [
      [start, start + lenA, yc],
      [start + lenA - S * 0.12, start + S + S * 0.06, yc + off],
    ];
    for (const [xa, xb, y] of segs) {
      if (doubled) {
        bands.push(bandPath(xa, xb, y - th * 0.9, th, 0.14));
        bands.push(bandPath(xa + 10, xb - 10, y + th * 0.9, th, 0.16));
      } else {
        bands.push(bandPath(xa, xb, y, th, 0.12));
      }
    }
  }
  // tattoo ink on its own layer so it can get a little hand-applied variation
  const ink = canvas2d(S, S);
  for (const b of bands) fillWrapped(ink.ctx, b, S, S, css(INK));
  drawTiled(ink.ctx, toneLayer(32, 32, fbmGrid(32, 32, { cx: 4, cy: 4, oct: 3, seed: 5 }), '#161a50', '#3c46a4', 0.4), S, S, { op: 'source-atop' });
  ctx.drawImage(ink.c, 0, 0);
  grain(ctx, S, S, 0.05);
  return c;
}

export function akazaTop(seed) {
  const S = 256;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  fabricBase(ctx, S, seed, '#a4235e', '#7a1644', '#c43a78', 0.4);
  brushWork(ctx, S, rng, 30, ['#b83070', '#861a4c'], { ang: 1.35, angJ: 0.25, aMin: 0.08, aMax: 0.18 });
  folds(ctx, S, rng, { count: 6, dark: '#2e0416', light: '#ff9cc6', darkA: 0.4, lightA: 0.25, ang: 1.3, widthK: 0.16 });
  weave(ctx, S, S, 0.1);
  grain(ctx, S, S, 0.06);
  return c;
}

export function akazaPants(seed) {
  const S = 256;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  fabricBase(ctx, S, seed, '#ece6da', '#d2cabd', '#faf7f1', 0.4);
  brushWork(ctx, S, rng, 26, ['#fbf8f2', '#d9d0c2'], { ang: 1.5, angJ: 0.2, lenMin: 60, lenMax: 150, aMin: 0.1, aMax: 0.2 });
  folds(ctx, S, rng, { count: 7, dark: '#6b6c86', light: '#ffffff', darkA: 0.42, lightA: 0.5, ang: 1.5, angJ: 0.25 });
  weave(ctx, S, S, 0.1);
  grain(ctx, S, S, 0.06);
  return c;
}

function veins(ctx, S, rng, count, color, w0, len0) {
  const grow = (x, y, a, w, len, depth) => {
    const pts = [[x, y]];
    let cx = x, cy = y, ca = a;
    const steps = Math.max(3, Math.round(len / 6));
    for (let s = 0; s < steps; s++) {
      ca += rng.range(-0.38, 0.38);
      cx += Math.cos(ca) * 6;
      cy += Math.sin(ca) * 6;
      pts.push([cx, cy]);
    }
    const rib = ribbon(pts, w, { taperA: 0.04, taperB: 0.65, pow: 0.8 });
    fillWrapped(ctx, rib, S, S, css(color, rng.range(0.4, 0.7)));
    if (depth < 3) {
      const nb = rng.int(1, 3);
      for (let b = 0; b < nb; b++) {
        const i = Math.floor(rng.range(0.25, 0.8) * pts.length);
        const p = pts[i];
        grow(p[0], p[1], ca + rng.sign() * rng.range(0.4, 1.1), w * 0.6, len * rng.range(0.4, 0.65), depth + 1);
      }
    }
  };
  for (let i = 0; i < count; i++) grow(rng.range(0, S), rng.range(0, S), rng.range(0, TAU), w0 * rng.range(0.7, 1.2), len0 * rng.range(0.7, 1.3), 0);
}

export function demonSkin(seed) {
  const S = 256;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  fabricBase(ctx, S, seed, '#7f8c74', '#58644e', '#a4b294', 0.55);
  // blotchy mottling
  for (let i = 0; i < 26; i++) {
    const x = rng.range(0, S), y = rng.range(0, S), r = rng.range(8, 26);
    const pts = catmull(blobPts(x, y, r, rng, { n: 12, amp: 0.3 }), 3, true);
    const p = pathOf(pts, true);
    const col = rng.chance(0.6) ? '#5f6a55' : '#9aa88a';
    const a = rng.range(0.12, 0.25);
    wrapped(ctx, S, S, bboxOf(pts, 2), () => { ctx.fillStyle = css(col, a); ctx.fill(p); });
  }
  veins(ctx, S, rng, 6, '#4d5f45', 2, 45);
  veins(ctx, S, rng, 9, '#46305a', 2.8, 75);
  // pores / specks
  for (let i = 0; i < 160; i++) {
    const x = rng.range(0, S), y = rng.range(0, S), r = rng.range(0.5, 1.4);
    const col = rng.chance(0.7) ? '#3e4636' : '#c3cfb4';
    const a = rng.range(0.25, 0.55);
    wrapped(ctx, S, S, [x - r, y - r, x + r, y + r], () => {
      ctx.fillStyle = css(col, a);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    });
  }
  grain(ctx, S, S, 0.1);
  return c;
}

export function demonRags(seed) {
  const S = 256;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  fabricBase(ctx, S, seed, '#5b2b22', '#3a1a14', '#7a4a36', 0.5);
  // faded kimono stripes
  for (let i = 0; i < 4; i++) {
    const x = (i + 0.3) * (S / 4);
    const a = rng.range(0.12, 0.22);
    const wdt = rng.range(6, 14);
    ctx.fillStyle = css('#2e120e', a);
    ctx.fillRect(x, 0, wdt, S);
    ctx.fillStyle = css('#8a5a40', a * 0.8);
    ctx.fillRect(x + wdt + 3, 0, 2, S);
  }
  brushWork(ctx, S, rng, 40, ['#6e3a2a', '#3c1c15', '#7a5a40'], { ang: 1.5, angJ: 1.2, aMin: 0.1, aMax: 0.22 });
  // dirt
  for (let i = 0; i < 14; i++) {
    wash(ctx, rng.range(0, S), rng.range(0, S), rng.range(10, 40), rng.range(10, 40), '#1e140c', rng.range(0.2, 0.4), S, S, rng.range(0, TAU));
  }
  for (let i = 0; i < 200; i++) {
    const x = rng.range(0, S), y = rng.range(0, S), r = rng.range(0.4, 1.2);
    const a = rng.range(0.3, 0.6);
    wrapped(ctx, S, S, [x - r, y - r, x + r, y + r], () => { ctx.fillStyle = css('#1a100a', a); ctx.fillRect(x, y, r, r); });
  }
  weave(ctx, S, S, 0.16);
  // holes and tears: frayed dark rim, then cut out (transparent)
  const holes = [];
  for (let i = 0; i < 4; i++) {
    const x = rng.range(0, S), y = rng.range(0, S), r = rng.range(8, 17);
    holes.push({ pts: catmull(blobPts(x, y, r, rng, { n: 18, amp: 0.5, harmonics: 7, sx: rng.range(0.7, 1.3) }), 3, true), x, y, r });
  }
  for (let i = 0; i < 2; i++) {
    const x = rng.range(0, S), y = rng.range(0, S), a = rng.range(0.9, 1.4), len = rng.range(40, 70);
    const sp = strokePts(x, y, a, len, rng.range(-0.3, 0.3), 12);
    const rib = ribbon(sp, rng.range(4, 6), { taperA: 0.45, taperB: 0.45, wobble: 0.5, rng });
    holes.push({ rib, x: x + Math.cos(a) * len * 0.5, y: y + Math.sin(a) * len * 0.5, r: len * 0.5 });
  }
  for (const h of holes) {
    const path = h.rib ? h.rib.path : pathOf(h.pts, true);
    const bb = h.rib ? h.rib.bbox : bboxOf(h.pts, 2);
    // loose threads spanning the hole
    const threads = [];
    for (let k = 0; k < 3; k++) {
      const a = rng.range(0, Math.PI);
      const r = h.r * rng.range(0.9, 1.2);
      const mid = rng.range(-0.3, 0.3) * h.r;
      threads.push([
        [h.x - Math.cos(a) * r + -Math.sin(a) * mid, h.y - Math.sin(a) * r + Math.cos(a) * mid],
        [h.x + rng.range(-3, 3), h.y + rng.range(2, 6)],
        [h.x + Math.cos(a) * r + -Math.sin(a) * mid, h.y + Math.sin(a) * r + Math.cos(a) * mid],
      ]);
    }
    wrapped(ctx, S, S, [bb[0] - 12, bb[1] - 12, bb[2] + 12, bb[3] + 12], () => {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = css('#2a150c', 0.6);
      ctx.lineWidth = 9;
      ctx.stroke(path);
      ctx.strokeStyle = css('#120804');
      ctx.lineWidth = 3.4;
      ctx.stroke(path);
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill(path);
      ctx.restore();
      ctx.strokeStyle = css('#7a4a34', 0.95);
      ctx.lineWidth = 1.1;
      for (const t of threads) {
        ctx.beginPath();
        ctx.moveTo(t[0][0], t[0][1]);
        ctx.quadraticCurveTo(t[1][0], t[1][1], t[2][0], t[2][1]);
        ctx.stroke();
      }
    });
  }
  grain(ctx, S, S, 0.08);
  return c;
}

// ---------------------------------------------------------------------------
// Hair gradients (64 x 256, canvas top = root)
// ---------------------------------------------------------------------------
function hair(seed, o) {
  const W = 64, H = 256;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (const [t, col] of o.stops) g.addColorStop(t, css(col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // painted strands
  ctx.lineCap = 'round';
  for (let i = 0; i < o.strands; i++) {
    const x = rng.range(0, W);
    const y0 = rng.range(-10, 70), y1 = rng.range(150, H + 10);
    const bend = rng.range(-3, 3);
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      pts.push([x + bend * Math.sin(t * Math.PI), lerp(y0, y1, t)]);
    }
    const light = rng.chance(0.45);
    const col = light ? o.strandLight : o.strandDark;
    const rib = ribbon(pts, rng.range(1, 2.6), { taperA: 0.3, taperB: 0.5 });
    const a = rng.range(0.2, 0.5);
    wrapped(ctx, W, H, rib.bbox, () => { ctx.fillStyle = css(col, a); ctx.fill(rib.path); }, true, false);
  }
  // anime sheen band with jagged edges
  if (o.sheen) {
    const [col, y, h, a] = o.sheen;
    for (const [k, aa] of [[1.6, a * 0.35], [1, a]]) {
      const top = [], bot = [];
      const n = 16;
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * W;
        const jag = i % 2 ? 1 : -0.4;
        top.push([x, y - h * k * 0.5 + jag * h * 0.35 * k]);
        bot.push([x, y + h * k * 0.5 + (i % 2 ? -0.6 : 1) * h * 0.55 * k]);
      }
      const p = pathOf(top.concat(bot.reverse()), true);
      ctx.fillStyle = css(col, aa);
      ctx.fill(p);
    }
  }
  if (o.tipGlow) {
    const tg = ctx.createLinearGradient(0, H * 0.7, 0, H);
    tg.addColorStop(0, css(o.tipGlow, 0));
    tg.addColorStop(1, css(o.tipGlow, 0.6));
    ctx.fillStyle = tg;
    ctx.fillRect(0, H * 0.7, W, H * 0.3);
  }
  grain(ctx, W, H, 0.08);
  return c;
}

export const hairTanjiro = (seed) => hair(seed, {
  stops: [[0, '#1a0d0d'], [0.35, '#2e1010'], [0.75, '#5e1818'], [1, '#7a1e1e']],
  strands: 46, strandLight: '#8a2a24', strandDark: '#0c0505',
  sheen: ['#9a3a30', 64, 16, 0.55],
});

export const hairGiyu = (seed) => hair(seed, {
  stops: [[0, '#0e0f17'], [0.5, '#141620'], [1, '#1c2030']],
  strands: 46, strandLight: '#39456a', strandDark: '#07080c',
  sheen: ['#4a6aa8', 70, 18, 0.6],
});

export const hairAkaza = (seed) => hair(seed, {
  stops: [[0, '#b84860'], [0.25, '#e37488'], [0.6, '#f08a9c'], [1, '#ffc0cb']],
  strands: 50, strandLight: '#ffd0d8', strandDark: '#a03a52',
  sheen: ['#ffe2e8', 66, 14, 0.55],
  tipGlow: '#fff0f2',
});

// ---------------------------------------------------------------------------
// Sanemi: a plain white haori; scarred skin where his open jacket and rolled
// sleeves leave him bare; 殺 on the back of the haori.
// ---------------------------------------------------------------------------
export function sanemiHaori(seed) {
  const S = 256;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  fabricBase(ctx, S, seed, '#f1efe8', '#dedbd2', '#fbfaf6', 0.3);
  brushWork(ctx, S, rng, 24, ['#fcfbf7', '#dcd8cf'], { ang: 1.5, angJ: 0.18, aMin: 0.08, aMax: 0.18 });
  folds(ctx, S, rng, { count: 7, dark: '#8a86a2', light: '#ffffff', darkA: 0.2, lightA: 0.22, ang: 1.5, angJ: 0.15, widthK: 0.14 });
  weave(ctx, S, S, 0.08);
  grain(ctx, S, S, 0.05);
  return c;
}

/** One healed wound: a raised pink welt, pale down its middle, now and then with the stitch marks either side. */
function scar(ctx, pts, w, rng, W, H, stitches = false) {
  const outer = ribbon(pts, w, { taperA: 0.3, taperB: 0.3, pow: 0.8, wobble: 0.35, rng });
  const inner = ribbon(offsetPts(pts, w * 0.08), w * 0.36, { taperA: 0.35, taperB: 0.35, pow: 0.8 });
  const rim = ribbon(pts, w * 1.5, { taperA: 0.3, taperB: 0.3, pow: 0.8 });
  fillWrapped(ctx, rim, W, H, css('#c98a80', 0.35));
  fillWrapped(ctx, outer, W, H, css('#df9f95'));
  fillWrapped(ctx, inner, W, H, css('#f6d6cb', 0.9));
  if (!stitches) return;
  for (let i = 2; i < pts.length - 2; i += 2) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1];
    const a = Math.atan2(y2 - y, x2 - x) + Math.PI / 2 + rng.range(-0.2, 0.2);
    const l = w * rng.range(0.9, 1.3);
    const tick = ribbon([[x - Math.cos(a) * l, y - Math.sin(a) * l], [x + Math.cos(a) * l, y + Math.sin(a) * l]], w * 0.28, { taperA: 0.3, taperB: 0.3 });
    fillWrapped(ctx, tick, W, H, css('#c47c74', 0.8));
  }
}

function skinBase(ctx, S, seed, rng) {
  fabricBase(ctx, S, seed, '#efcdb8', '#e2b9a4', '#f8dccb', 0.3);
  for (let i = 0; i < 10; i++) wash(ctx, rng.range(0, S), rng.range(0, S), rng.range(20, 60), rng.range(20, 60), rng.pick(['#e8b8a6', '#f6d8c8']), 0.12, S, S);
}

/**
 * His torso, 512 x 512, seamless left-right (u = 0 is the middle of his chest). The bottom third is the
 * abdomen (the spine joint samples it), the top two thirds the chest up to the collarbones. The open jacket
 * shows only the front, so the anatomy is painted round x = 0; scars cross it every way.
 */
export function sanemiChest(seed) {
  const S = 512;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  skinBase(ctx, S, seed, rng);
  const LINE = '#c9907f';
  const line = (pts, w, a = 0.55) => fillWrapped(ctx, ribbon(pts, w, { taperA: 0.3, taperB: 0.3, pow: 0.8 }), S, S, css(LINE, a));
  // (mirrored about x = 0, drawn once at each side of the seam)
  const both = (pts, w, a) => {
    line(pts, w, a);
    line(pts.map(([x, y]) => [-x, y]), w, a);
  };
  // down the middle, the chest to the navel
  line([[0, S * 0.26], [1, S * 0.45], [0, S * 0.66], [0, S * 0.9]], 3, 0.45);
  // collarbones
  both([[S * 0.018, S * 0.05], [S * 0.07, S * 0.035], [S * 0.13, S * 0.05]], 3.2, 0.5);
  // the lower edge of each pectoral, curving up to the armpit
  both([[S * 0.006, S * 0.3], [S * 0.06, S * 0.325], [S * 0.12, S * 0.29], [S * 0.16, S * 0.2]], 5, 0.6);
  // the ribs' edge and the rows of the abdomen
  both([[S * 0.03, S * 0.44], [S * 0.07, S * 0.47], [S * 0.1, S * 0.52]], 3.5, 0.45);
  for (const y of [0.56, 0.72, 0.84]) both([[S * 0.008, S * y], [S * 0.035, S * (y + 0.008)], [S * 0.058, S * (y - 0.004)]], 3.4, 0.5);
  both([[S * 0.06, S * 0.5], [S * 0.064, S * 0.7], [S * 0.056, S * 0.92]], 3.2, 0.35);
  // scars: long cuts slanting across the chest and belly, a few short ones, a stitched one
  const cut = (x, y, ang, len, w, bend = 0.2, st = false) => scar(ctx, strokePts(x, y, ang, len, bend, 14), w, rng, S, S, st);
  cut(-S * 0.14, S * 0.12, 0.62, S * 0.36, 9, 0.25);
  cut(S * 0.13, S * 0.2, 2.45, S * 0.3, 8, -0.2, true);
  cut(-S * 0.1, S * 0.5, -0.35, S * 0.22, 7, 0.15);
  cut(S * 0.02, S * 0.62, 0.3, S * 0.16, 6.5, 0.3);
  cut(-S * 0.05, S * 0.78, -0.1, S * 0.13, 6, 0.2, true);
  cut(S * 0.09, S * 0.36, 1.9, S * 0.12, 6, 0.1);
  for (let i = 0; i < 6; i++) cut(rng.range(S * 0.2, S * 0.8), rng.range(0, S), rng.range(0, TAU), rng.range(S * 0.08, S * 0.2), rng.range(5, 8), rng.range(-0.3, 0.3), rng.chance(0.3));
  grain(ctx, S, S, 0.05);
  return c;
}

/** His forearms, 256 x 256 tileable: skin crossed by old cuts. */
export function sanemiArm(seed) {
  const S = 256;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  skinBase(ctx, S, seed, rng);
  for (let i = 0; i < 5; i++) {
    const pts = strokePts(rng.range(0, S), rng.range(0, S), rng.range(-0.6, 0.6) + (i % 2 ? Math.PI : 0), rng.range(S * 0.25, S * 0.5), rng.range(-0.3, 0.3), 12);
    scar(ctx, pts, rng.range(5, 7.5), rng, S, S, i === 1);
  }
  grain(ctx, S, S, 0.05);
  return c;
}

/**
 * 殺 in black brush ink, for the back of his haori (transparent elsewhere). The decal it lies on is wider
 * than it is tall on his back (about 0.72 : 1 once wrapped round it), so the glyph is drawn that much wider.
 */
export function sanemiKill(seed) {
  const S = 256;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  const ink = canvas2d(S, S);
  const k = ink.ctx;
  k.textAlign = 'center';
  k.textBaseline = 'middle';
  k.font = `700 ${Math.round(S * 0.8)}px "LXGW WenKai TC", "Kaiti TC", "STKaiti", "BiauKai", "DFKai-SB", "Noto Serif TC", serif`;
  k.save();
  k.translate(S / 2, S * 0.53);
  k.scale(1.3, 1);
  // a few passes a pixel or two apart: a loaded brush, heavier than the font's stroke
  for (let i = 0; i < 7; i++) {
    k.fillStyle = css('#121012', i ? 0.5 : 1);
    k.fillText('殺', rng.range(-2.5, 2.5), rng.range(-2.5, 2.5));
  }
  k.restore();
  // dry-brush breaks: streaks of bare cloth dragged through the ink along the strokes' length
  k.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 70; i++) {
    const pts = strokePts(rng.range(0, S), rng.range(0, S), rng.pick([0, Math.PI / 2, 0.8, -0.8]) + rng.range(-0.15, 0.15), rng.range(10, 40), rng.range(-0.3, 0.3), 6);
    k.fillStyle = css('#000', rng.range(0.25, 0.7));
    k.fill(ribbon(pts, rng.range(0.8, 2.2), { taperA: 0.4, taperB: 0.4 }).path);
  }
  k.globalCompositeOperation = 'source-over';
  ctx.drawImage(ink.c, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// Gyomei: an olive haori with the nembutsu, 南無阿彌陀佛, written down it in
// columns of brush ink. 512 x 512, seamless; four columns a tile.
// ---------------------------------------------------------------------------
export function gyomeiHaori(seed) {
  const S = 512;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  fabricBase(ctx, S, seed, '#6f6c3e', '#5a5830', '#83804c', 0.4);
  brushWork(ctx, S, rng, 40, ['#7c7946', '#5c5a32'], { ang: 1.5, angJ: 0.2, lenMin: 80, lenMax: 220, wMin: 8, wMax: 20, aMin: 0.1, aMax: 0.2 });
  // the sutra: each column starts at its own height and runs off the tile's foot onto the next tile's head
  const ink = canvas2d(S, S);
  const k = ink.ctx;
  const TEXT = '南無阿彌陀佛';
  const size = S / 6.4;
  k.textAlign = 'center';
  k.textBaseline = 'middle';
  k.font = `700 ${Math.round(size * 0.86)}px "LXGW WenKai TC", "Kaiti TC", "STKaiti", "BiauKai", "DFKai-SB", "Noto Serif TC", serif`;
  for (let col = 0; col < 4; col++) {
    const x = (col + 0.5) * (S / 4);
    const y0 = rng.range(0, S);
    for (let i = 0; i < 7; i++) {
      const ch = TEXT[(i + col * 2) % TEXT.length];
      const y = (y0 + i * size) % S;
      for (const oy of [0, -S]) {
        k.fillStyle = css('#1f1e0c', rng.range(0.55, 0.75));
        k.fillText(ch, x + rng.range(-3, 3), y + oy + size / 2);
      }
    }
  }
  // dry brush: the ink breaks where the weave shows through
  k.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 160; i++) {
    const pts = strokePts(rng.range(0, S), rng.range(0, S), Math.PI / 2 + rng.range(-0.2, 0.2), rng.range(12, 50), rng.range(-0.3, 0.3), 6);
    k.fillStyle = css('#000', rng.range(0.2, 0.55));
    k.fill(ribbon(pts, rng.range(1, 2.6), { taperA: 0.4, taperB: 0.4 }).path);
  }
  k.globalCompositeOperation = 'source-over';
  ctx.drawImage(ink.c, 0, 0);
  folds(ctx, S, rng, { count: 8, dark: '#2c2a16', light: '#a9a670', darkA: 0.28, lightA: 0.18, ang: 1.5, angJ: 0.15, widthK: 0.12 });
  weave(ctx, S, S, 0.1);
  grain(ctx, S, S, 0.06);
  return c;
}
