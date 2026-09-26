// Environment textures, painted like anime background art: flat colour
// regions, loose brush variation, deliberate ink lines.
import {
  TAU, lerp, makeRng, canvas2d, css, mix, lighten, darken, vary, wrapped, bboxOf, pathOf, cubic, catmull,
  blobPts, ribbon, offsetPts, fbmGrid, toneLayer, drawTiled, softLayer, grain, wash, fillWrapped, dryBrush,
  strokePts, shuffle,
} from './core.js';

// ---------------------------------------------------------------------------
// Wood floor: 6 planks along y, staggered butt joints, grain, knots
// ---------------------------------------------------------------------------
export function woodFloor(seed) {
  const W = 1024, H = 1024, N = 6, PW = W / N;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(W, H);
  const X0 = Math.round(PW * 0.21);
  const INK = '#2a1a10';
  const tones = shuffle(['#6b4226', '#8a5a34', '#74492a', '#83542f', '#6f4527', '#7d4f2e'], rng);

  ctx.fillStyle = css('#5a371f');
  ctx.fillRect(0, 0, W, H);

  const planks = [];
  for (let k = 0; k < N; k++) {
    const x = X0 + k * PW;
    const j0 = ((((k * 0.382 + 0.07 + rng.range(-0.05, 0.05)) % 1) + 1) % 1) * H;
    const joints = [j0];
    if (rng.chance(0.5)) joints.push((j0 + H * rng.range(0.42, 0.58)) % H);
    joints.sort((a, b) => a - b);
    const segs = joints.map((y0, i) => ({ y0, y1: i + 1 < joints.length ? joints[i + 1] : joints[0] + H }));
    planks.push({ x, segs, tone: tones[k] });
  }

  const paintSegment = (pl, sg) => {
    const x = pl.x, y0 = sg.y0, y1 = sg.y1, h = y1 - y0;
    const base = vary(pl.tone, rng, 0.03, 3, 0.05);
    const grainDark = mix(darken(base, 0.45), '#2a140a', 0.3);
    const grainLight = lighten(base, 0.28);
    const ops = [];

    // knots first so the grain can flow around them
    const knots = [];
    if (h > 220 && rng.chance(0.45)) {
      knots.push({ x: x + rng.range(0.3, 0.7) * PW, y: y0 + rng.range(0.22, 0.78) * h, rx: rng.range(6, 10), ry: rng.range(13, 21) });
    }
    const deflect = (gx, y) => {
      let dx = 0;
      for (const k of knots) {
        const d = gx - k.x;
        const reach = k.rx * 3.4;
        if (Math.abs(d) < reach) {
          const fy = Math.exp(-(((y - k.y) / (k.ry * 2.4)) ** 2));
          dx += (d >= 0 ? 1 : -1) * (reach - Math.abs(d)) * 0.78 * fy;
        }
      }
      return dx;
    };

    // tonal washes along the plank
    for (let i = 0; i < 6; i++) {
      const bx = x + rng.range(0.1, 0.9) * PW, by = y0 + rng.range(0, 1) * h;
      const rx = rng.range(14, 40), ry = rng.range(90, 280);
      const col = rng.chance(0.5) ? lighten(base, 0.16) : darken(base, 0.22);
      const a = rng.range(0.18, 0.4);
      ops.push(() => wash(ctx, bx, by, rx, ry, col, a));
    }

    const lines = [];
    const addLine = (pts, dark) => {
      lines.push({ p: pathOf(pts), lw: dark ? rng.range(1.1, 2.6) : rng.range(0.8, 1.7), col: dark ? grainDark : grainLight, a: dark ? rng.range(0.34, 0.7) : rng.range(0.2, 0.4) });
    };
    const dashed = (fx, dark) => {
      let yy = y0 - 8;
      while (yy < y1 + 8) {
        const ye = Math.min(y1 + 8, yy + rng.range(70, 360));
        const pts = [];
        for (let y = yy; y <= ye; y += 7) pts.push([fx(y), y]);
        pts.push([fx(ye), ye]);
        if (pts.length > 1) addLine(pts, dark);
        yy = ye + rng.range(3, 24);
      }
    };

    const cathedral = rng.chance(0.55) && h > 260;
    let cx = 0, hw0 = 0;
    if (cathedral) {
      cx = x + rng.range(0.38, 0.62) * PW;
      hw0 = rng.range(0.26, 0.36) * PW;
      const dirY = rng.sign();
      let ay = y0 + rng.range(0.25, 0.75) * h;
      const levels = rng.int(4, 6);
      for (let j = 0; j < levels; j++) {
        const hw = hw0 * (1 - j / (levels + 0.4));
        const Lc = 40 + hw * 2.2;
        const endY = dirY > 0 ? y1 + 10 : y0 - 10;
        const steps = Math.max(2, Math.ceil(Math.abs(endY - ay) / 7));
        const ph = rng.range(0, TAU);
        const spread = rng.range(0.02, 0.08);
        const leg = (s, side) => {
          const y = ay + ((endY - ay) * s) / steps;
          const dd = Math.abs(y - ay);
          const q = Math.min(1, dd / Lc);
          const gx = cx + side * hw * (Math.sqrt(q) + spread * Math.max(0, dd - Lc) / 100);
          return [gx + 1.4 * Math.sin(y / 60 + ph) + deflect(gx, y), y];
        };
        const pts = [];
        for (let s = steps; s >= 0; s--) pts.push(leg(s, -1));
        for (let s = 1; s <= steps; s++) pts.push(leg(s, 1));
        addLine(pts, true);
        if (rng.chance(0.4)) addLine(offsetPts(pts, rng.range(2.5, 4)), false);
        ay += dirY * rng.range(16, 30);
      }
    }
    const nL = rng.int(9, 14);
    for (let i = 0; i < nL; i++) {
      const gx = x + ((i + 0.5 + rng.range(-0.3, 0.3)) / nL) * PW;
      if (cathedral && Math.abs(gx - cx) < hw0 + 5) continue;
      const amp = rng.range(0.8, 3), lam = rng.range(160, 420), ph = rng.range(0, TAU);
      const amp2 = rng.range(0.3, 1.1), lam2 = rng.range(45, 110), ph2 = rng.range(0, TAU);
      const drift = rng.range(-6, 6);
      const dark = rng.chance(0.78);
      dashed((y) => gx + amp * Math.sin((y / lam) * TAU + ph) + amp2 * Math.sin((y / lam2) * TAU + ph2) + (drift * (y - y0)) / h + deflect(gx, y), dark);
    }

    const knotOps = knots.map((k) => {
      const rings = rng.int(2, 3);
      const crackLen = rng.range(6, 14) * rng.sign();
      return () => {
        ctx.save();
        ctx.translate(k.x, k.y);
        ctx.fillStyle = css(darken(base, 0.35), 0.5);
        ctx.beginPath(); ctx.ellipse(0, 0, k.rx * 1.9, k.ry * 1.55, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = css(grainDark, 0.7);
        for (let r = 0; r < rings; r++) {
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.ellipse(0, 0, k.rx * (1.35 + r * 0.38), k.ry * (1.22 + r * 0.3), 0, 0, TAU); ctx.stroke();
        }
        ctx.fillStyle = css(mix(base, '#24140a', 0.72));
        ctx.beginPath(); ctx.ellipse(0, 0, k.rx, k.ry, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = css(mix(base, '#b07442', 0.25));
        ctx.beginPath(); ctx.ellipse(-k.rx * 0.15, -k.ry * 0.1, k.rx * 0.55, k.ry * 0.58, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = css('#24140a');
        ctx.beginPath(); ctx.ellipse(0, 0, k.rx * 0.22, k.ry * 0.25, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = css(INK, 0.9);
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.ellipse(0, 0, k.rx, k.ry, 0, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, k.ry); ctx.lineTo(crackLen * 0.2, k.ry + Math.abs(crackLen)); ctx.stroke();
        ctx.restore();
      };
    });

    const hiCol = lighten(base, 0.32), shCol = darken(base, 0.55);
    wrapped(ctx, W, H, [x, y0, x + PW, y1], () => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y0, PW, h);
      ctx.clip();
      ctx.fillStyle = css(base);
      ctx.fillRect(x, y0, PW, h);
      for (const op of ops) op();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const l of lines) {
        ctx.strokeStyle = css(l.col, l.a);
        ctx.lineWidth = l.lw;
        ctx.stroke(l.p);
      }
      for (const op of knotOps) op();
      // bevel light / shadow along plank edges
      ctx.fillStyle = css(hiCol, 0.5);
      ctx.fillRect(x + 1.5, y0, 2.2, h);
      const gr = ctx.createLinearGradient(x + PW - 14, 0, x + PW, 0);
      gr.addColorStop(0, css(shCol, 0));
      gr.addColorStop(1, css(shCol, 0.42));
      ctx.fillStyle = gr;
      ctx.fillRect(x + PW - 14, y0, 14, h);
      ctx.fillStyle = css(hiCol, 0.4);
      ctx.fillRect(x, y0 + 1.5, PW, 2);
      const gb = ctx.createLinearGradient(0, y1 - 12, 0, y1);
      gb.addColorStop(0, css(shCol, 0));
      gb.addColorStop(1, css(shCol, 0.35));
      ctx.fillStyle = gb;
      ctx.fillRect(x, y1 - 12, PW, 12);
      ctx.restore();
    });
  };
  for (const pl of planks) for (const sg of pl.segs) paintSegment(pl, sg);

  // large-scale tone drift across the floor
  const tone = toneLayer(64, 64, fbmGrid(64, 64, { cx: 2, cy: 2, oct: 4, seed: seed & 0xfff }), '#2a160a', '#c08450', 0.28, 1.5);
  drawTiled(ctx, tone, W, H);

  // soft painted highlights (polish reflections), painted small and stretched
  const hl = softLayer(256, 256, (g, w, h) => {
    for (let i = 0; i < 9; i++) {
      const x = rng.range(0, w), y = rng.range(0, h), len = rng.range(0.35, 0.8) * h;
      const pts = strokePts(x, y, Math.PI / 2 + rng.range(-0.04, 0.04), len, rng.range(-0.2, 0.2), 12);
      const rib = ribbon(pts, rng.range(4, 12), { taperA: 0.4, taperB: 0.4, pow: 1 });
      fillWrapped(g, rib, w, h, css('#ffd9a0', rng.range(0.35, 0.8)));
    }
  });
  drawTiled(ctx, hl, W, H, { op: 'screen', alpha: 0.22 });

  // ink seams between planks (periodic wobble => seamless)
  for (let k = 0; k < N; k++) {
    const sx = X0 + k * PW;
    const ph = rng.range(0, TAU), ph2 = rng.range(0, TAU), m = rng.int(1, 3);
    const pts = [];
    for (let y = -8; y <= H + 8; y += 8) pts.push([sx + 0.7 * Math.sin((y / H) * TAU * m + ph), y]);
    const rib = ribbon(pts, (t, i, p) => 3.6 + 0.9 * Math.sin((p[1] / H) * TAU * 3 + ph2), { taperA: 0, taperB: 0 });
    fillWrapped(ctx, rib, W, H, css(INK));
  }
  // butt joints
  for (const pl of planks) {
    for (const sg of pl.segs) {
      const pts = [];
      for (let x = pl.x - 2; x <= pl.x + PW + 2; x += 8) pts.push([x, sg.y0 + rng.range(-0.5, 0.5)]);
      const rib = ribbon(pts, 3.2, { taperA: 0, taperB: 0, wobble: 0.25, rng });
      fillWrapped(ctx, rib, W, H, css(INK));
    }
  }
  grain(ctx, W, H, 0.09);
  return c;
}

// ---------------------------------------------------------------------------
// Dark lacquered wood (beams, frames, railings, stairs)
// ---------------------------------------------------------------------------
export function woodDark(seed) {
  const W = 512, H = 512;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(W, H);
  ctx.fillStyle = css('#33201a');
  ctx.fillRect(0, 0, W, H);
  const t1 = toneLayer(64, 64, fbmGrid(64, 64, { cx: 8, cy: 1, oct: 3, seed: (seed & 0xfff) + 3 }), '#1c100b', '#4a2e21', 0.7, 1.4);
  drawTiled(ctx, t1, W, H);
  const t2 = toneLayer(64, 64, fbmGrid(64, 64, { cx: 2, cy: 2, oct: 3, seed: (seed & 0xfff) + 9 }), '#1e120c', '#3f271b', 0.5, 1.3);
  drawTiled(ctx, t2, W, H);

  // long vertical grain, periodic so it tiles in y
  ctx.lineCap = 'round';
  for (let i = 0; i < 150; i++) {
    const gx = rng.range(0, W);
    const amp = rng.range(0.5, 2.5), m = rng.int(1, 3), ph = rng.range(0, TAU);
    const dark = rng.chance(0.62);
    const col = dark ? '#150b07' : '#5c3b2a';
    const lw = dark ? rng.range(0.8, 2) : rng.range(0.6, 1.3);
    let yy = rng.range(0, H);
    const end = yy + H;
    while (yy < end) {
      const ye = Math.min(end, yy + rng.range(40, 260));
      const pts = [];
      for (let y = yy; y <= ye; y += 8) pts.push([gx + amp * Math.sin((y / H) * TAU * m + ph), y]);
      pts.push([gx + amp * Math.sin((ye / H) * TAU * m + ph), ye]);
      if (pts.length > 1) {
        const p = pathOf(pts);
        const a = dark ? rng.range(0.25, 0.55) : rng.range(0.12, 0.3);
        wrapped(ctx, W, H, bboxOf(pts, 2), () => {
          ctx.strokeStyle = css(col, a);
          ctx.lineWidth = lw;
          ctx.stroke(p);
        });
      }
      yy = ye + rng.range(6, 60);
    }
  }
  // faint lacquer sheen streaks
  const sheen = softLayer(128, 128, (g, w, h) => {
    for (let i = 0; i < 6; i++) {
      const x = rng.range(0, w), y = rng.range(0, h);
      const pts = strokePts(x, y, Math.PI / 2, rng.range(0.4, 0.9) * h, rng.range(-0.1, 0.1), 10);
      fillWrapped(g, ribbon(pts, rng.range(2, 6), { taperA: 0.45, taperB: 0.45, pow: 1 }), w, h, css('#c89a7c', rng.range(0.4, 0.9)));
    }
  });
  drawTiled(ctx, sheen, W, H, { op: 'screen', alpha: 0.16 });
  // crisp gloss glints
  for (let i = 0; i < 10; i++) {
    const x = rng.range(0, W), y = rng.range(0, H);
    const pts = strokePts(x, y, Math.PI / 2, rng.range(20, 90), 0, 6);
    fillWrapped(ctx, ribbon(pts, rng.range(0.8, 1.6), { taperA: 0.5, taperB: 0.5 }), W, H, css('#a97f63', rng.range(0.2, 0.4)));
  }
  grain(ctx, W, H, 0.08);
  return c;
}

// ---------------------------------------------------------------------------
// Vermilion lacquer pillar
// ---------------------------------------------------------------------------
export function pillarRed(seed) {
  const W = 512, H = 512;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(W, H);
  ctx.fillStyle = css('#a3271c');
  ctx.fillRect(0, 0, W, H);
  drawTiled(ctx, toneLayer(64, 64, fbmGrid(64, 64, { cx: 4, cy: 2, oct: 4, seed: (seed & 0xfff) + 5 }), '#6e150f', '#c9432a', 0.42, 1.4), W, H);
  drawTiled(ctx, toneLayer(128, 32, fbmGrid(128, 32, { cx: 16, cy: 1, oct: 3, seed: (seed & 0xfff) + 7 }), '#7c1a12', '#c23a25', 0.35, 1.3), W, H);

  // vertical painterly brush strokes
  for (let i = 0; i < 90; i++) {
    const x = rng.range(0, W), y = rng.range(0, H), len = rng.range(60, 300);
    const pts = strokePts(x, y, Math.PI / 2 + rng.range(-0.03, 0.03), len, rng.range(-0.15, 0.15), 12);
    const light = rng.chance(0.5);
    dryBrush(ctx, pts, rng.range(4, 16), light ? '#c63c26' : '#861c14', rng.range(0.06, 0.16), rng, { W, H, bristles: 3, bristleAlpha: 0.12 });
  }
  // long thin lacquer streaks
  ctx.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const x = rng.range(0, W), y = rng.range(0, H), len = rng.range(80, 400);
    const pts = strokePts(x, y, Math.PI / 2, len, rng.range(-0.05, 0.05), 10);
    const p = pathOf(pts);
    const col = rng.chance(0.6) ? '#6a130d' : '#d65a3c';
    const a = rng.range(0.15, 0.35), lw = rng.range(0.6, 1.5);
    wrapped(ctx, W, H, bboxOf(pts, 2), () => { ctx.strokeStyle = css(col, a); ctx.lineWidth = lw; ctx.stroke(p); });
  }
  // worn patches showing the black undercoat (chipped lacquer)
  for (let i = 0; i < 5; i++) {
    const x = rng.range(0, W), y = rng.range(0, H);
    const size = rng.range(0.6, 1.4);
    const halo = catmull(blobPts(x, y, 16 * size, rng, { n: 12, amp: 0.3, sx: rng.range(0.9, 1.5), sy: rng.range(0.8, 1.6), harmonics: 4 }), 3, true);
    const bits = [];
    const nb = rng.int(2, 4);
    for (let b = 0; b < nb; b++) {
      const bx = x + rng.range(-9, 9) * size, by = y + rng.range(-12, 12) * size;
      bits.push(catmull(blobPts(bx, by, rng.range(2.5, 7) * size, rng, { n: 9, amp: 0.45, sx: rng.range(0.8, 1.8), sy: rng.range(0.6, 1.3), harmonics: 5 }), 3, true));
    }
    const specks = [];
    for (let k = 0; k < 7; k++) specks.push([x + rng.range(-22, 22) * size, y + rng.range(-26, 26) * size, rng.range(0.8, 2)]);
    const all = halo.concat(...bits);
    const pHalo = pathOf(halo, true);
    const pBits = bits.map((b) => pathOf(b, true));
    const hiA = rng.range(0.4, 0.6);
    wrapped(ctx, W, H, bboxOf(all, 30), () => {
      ctx.fillStyle = css('#6e170f', 0.32);
      ctx.fill(pHalo);
      ctx.lineJoin = 'round';
      for (const pb of pBits) {
        ctx.strokeStyle = css('#e57b5c', hiA);
        ctx.lineWidth = 2.2;
        ctx.stroke(pb);
      }
      ctx.fillStyle = css('#1c1311');
      for (const pb of pBits) ctx.fill(pb);
      for (const [sx, sy, sr] of specks) {
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, TAU);
        ctx.fill();
      }
    });
  }
  // tiny scratches
  for (let i = 0; i < 25; i++) {
    const x = rng.range(0, W), y = rng.range(0, H);
    const pts = strokePts(x, y, rng.range(0, TAU), rng.range(4, 14), rng.range(-0.5, 0.5), 4);
    const p = pathOf(pts);
    wrapped(ctx, W, H, bboxOf(pts, 2), () => { ctx.strokeStyle = css('#2a0d0a', 0.5); ctx.lineWidth = 0.9; ctx.stroke(p); });
  }
  grain(ctx, W, H, 0.1);
  return c;
}

// ---------------------------------------------------------------------------
// Shoji panel (single panel, backlit)
// ---------------------------------------------------------------------------
export function shoji(seed) {
  const W = 512, H = 512;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(W, H);
  const B = Math.round(W * 0.06);
  const IW = W - B * 2, IH = H - B * 2;

  // frame wood
  ctx.fillStyle = css('#2e1d14');
  ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const vert = rng.chance(0.5);
    const x = vert ? rng.chance(0.5) ? rng.range(2, B - 2) : rng.range(W - B + 2, W - 2) : rng.range(0, W);
    const y = vert ? rng.range(0, H) : rng.chance(0.5) ? rng.range(2, B - 2) : rng.range(H - B + 2, H - 2);
    const len = rng.range(40, 200);
    ctx.strokeStyle = css(rng.chance(0.6) ? '#1a0f09' : '#4a3122', rng.range(0.3, 0.6));
    ctx.lineWidth = rng.range(0.7, 1.4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (vert) ctx.lineTo(x + rng.range(-1, 1), y + len);
    else ctx.lineTo(x + len, y + rng.range(-1, 1));
    ctx.stroke();
  }

  // paper, lit from behind
  ctx.save();
  ctx.beginPath();
  ctx.rect(B, B, IW, IH);
  ctx.clip();
  const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.62);
  g.addColorStop(0, css('#fff6dc'));
  g.addColorStop(0.55, css('#f3e2b8'));
  g.addColorStop(1, css('#dcc28c'));
  ctx.fillStyle = g;
  ctx.fillRect(B, B, IW, IH);
  drawTiled(ctx, toneLayer(64, 64, fbmGrid(64, 64, { cx: 4, cy: 4, oct: 4, seed: seed & 0xfff }), '#c9ad76', '#fffaf0', 0.28, 1.3), W, H);
  // per-cell variation and one patched cell
  const cw = IW / 3, ch = IH / 6;
  const patched = rng.int(0, 17);
  for (let j = 0; j < 6; j++) {
    for (let i = 0; i < 3; i++) {
      const x = B + i * cw, y = B + j * ch;
      const k = j * 3 + i;
      if (k === patched) {
        ctx.fillStyle = css('#fffbea', 0.45);
        ctx.fillRect(x + 3, y + 3, cw - 6, ch - 6);
        ctx.strokeStyle = css('#c7ab78', 0.5);
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 5.5, y + 5.5, cw - 11, ch - 11);
      } else {
        ctx.fillStyle = rng.chance(0.5) ? css('#fff3d0', rng.range(0.05, 0.16)) : css('#caa56a', rng.range(0.04, 0.1));
        ctx.fillRect(x, y, cw, ch);
      }
    }
  }
  // paper fibres
  for (let i = 0; i < 260; i++) {
    const x = rng.range(B, W - B), y = rng.range(B, H - B);
    ctx.strokeStyle = css(rng.chance(0.5) ? '#ffffff' : '#c9ae7c', rng.range(0.15, 0.35));
    ctx.lineWidth = rng.range(0.4, 0.9);
    ctx.stroke(pathOf(strokePts(x, y, rng.range(0, TAU), rng.range(6, 26), rng.range(-1.5, 1.5), 5)));
  }
  // faint stains with drying rings
  for (let i = 0; i < 3; i++) {
    const x = rng.range(B + 30, W - B - 30), y = rng.range(B + 30, H - B - 30), r = rng.range(14, 34);
    const pts = catmull(blobPts(x, y, r, rng, { n: 12, amp: 0.22 }), 4, true);
    const p = pathOf(pts, true);
    ctx.fillStyle = css('#b8914f', rng.range(0.06, 0.1));
    ctx.fill(p);
    ctx.strokeStyle = css('#a07838', 0.16);
    ctx.lineWidth = 1.4;
    ctx.stroke(p);
  }
  // kumiko shadows (soft) then bars
  const bw = 7;
  const bars = [];
  for (let i = 1; i < 3; i++) bars.push([B + i * cw - bw / 2, B, bw, IH]);
  for (let j = 1; j < 6; j++) bars.push([B, B + j * ch - bw / 2, IW, bw]);
  ctx.fillStyle = css('#8c6a3c', 0.18);
  for (const [x, y, w, h] of bars) ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  for (const [x, y, w, h] of bars) {
    ctx.fillStyle = css('#3a2618');
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = css('#6a4a32', 0.8);
    if (w < h) ctx.fillRect(x + 1, y, 1.3, h);
    else ctx.fillRect(x, y + 1, w, 1.3);
    ctx.strokeStyle = css('#1a0f09', 0.9);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x + 0.6, y + 0.6, w - 1.2, h - 1.2);
  }
  // cross-lap joints: small darker squares where bars meet
  for (let i = 1; i < 3; i++) {
    for (let j = 1; j < 6; j++) {
      ctx.fillStyle = css('#24160e', 0.9);
      ctx.fillRect(B + i * cw - bw / 2, B + j * ch - bw / 2, bw, bw);
    }
  }
  ctx.restore();

  // frame inner shadow and bevel lines
  ctx.strokeStyle = css('#120a06');
  ctx.lineWidth = 3;
  ctx.strokeRect(B - 1.5, B - 1.5, IW + 3, IH + 3);
  ctx.strokeStyle = css('#6e4c34', 0.7);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(B - 4.5, B - 4.5, IW + 9, IH + 9);
  ctx.strokeStyle = css('#120a06', 0.9);
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.strokeStyle = css('#5a3d2a', 0.6);
  ctx.lineWidth = 1;
  ctx.strokeRect(3.5, 3.5, W - 7, H - 7);
  grain(ctx, W, H, 0.07);
  return c;
}

// ---------------------------------------------------------------------------
// Fusuma sliding doors
// ---------------------------------------------------------------------------
function goldLeaf(ctx, x0, y0, w, h, rng, sq = 64) {
  ctx.fillStyle = css('#d0a441');
  ctx.fillRect(x0, y0, w, h);
  const cols = Math.ceil(w / sq) + 1, rows = Math.ceil(h / sq) + 1;
  for (let j = 0; j < rows; j++) {
    const rowOff = rng.range(-3, 3);
    for (let i = 0; i < cols; i++) {
      const x = x0 + i * sq + rowOff + rng.range(-1.5, 1.5), y = y0 + j * sq + rng.range(-1.5, 1.5);
      const tone = vary('#d6ad4a', rng, 0.028, 2, 0.04);
      const gr = ctx.createLinearGradient(x, y, x + sq, y + sq);
      gr.addColorStop(0, css(lighten(tone, 0.08)));
      gr.addColorStop(0.5, css(tone));
      gr.addColorStop(1, css(darken(tone, 0.05)));
      ctx.fillStyle = gr;
      ctx.fillRect(x, y, sq + 2, sq + 2);
      ctx.strokeStyle = css('#9c7626', 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, y + sq + 2);
      ctx.lineTo(x + 0.5, y + 0.5);
      ctx.lineTo(x + sq + 2, y + 0.5);
      ctx.stroke();
      // wrinkles in the leaf
      for (let k = 0; k < 3; k++) {
        const wx = x + rng.range(4, sq - 4), wy = y + rng.range(4, sq - 4);
        ctx.strokeStyle = css(rng.chance(0.5) ? '#a88430' : '#f7dc8a', rng.range(0.25, 0.5));
        ctx.lineWidth = 0.8;
        ctx.stroke(pathOf(strokePts(wx, wy, rng.range(0, TAU), rng.range(4, 12), rng.range(-1, 1), 4)));
      }
    }
  }
  // aged tarnish
  for (let i = 0; i < 10; i++) {
    wash(ctx, x0 + rng.range(0, w), y0 + rng.range(0, h), rng.range(30, 90), rng.range(30, 90), '#7a5a1c', rng.range(0.08, 0.18));
  }
  for (let i = 0; i < 6; i++) {
    wash(ctx, x0 + rng.range(0, w), y0 + rng.range(0, h), rng.range(40, 100), rng.range(40, 100), '#fff0b0', rng.range(0.08, 0.16));
  }
}

function fusumaFrame(ctx, W, H, rng, hikiteRight = true) {
  const B = 26;
  // frame (black lacquer) drawn as 4 rails
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(B, B, W - 2 * B, H - 2 * B);
  ctx.clip('evenodd');
  ctx.fillStyle = css('#141012');
  ctx.fillRect(0, 0, W, H);
  // lacquer sheen streaks
  const sheen = (x, y, w, h, vertical) => {
    const g = vertical ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, css('#3b3238', 0));
    g.addColorStop(0.35, css('#4a4048', 0.8));
    g.addColorStop(0.5, css('#6a5e66', 0.55));
    g.addColorStop(0.7, css('#3b3238', 0));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  };
  sheen(0, 0, B, H, true);
  sheen(W - B, 0, B, H, true);
  sheen(0, 0, W, B, false);
  sheen(0, H - B, W, B, false);
  for (let i = 0; i < 30; i++) {
    const v = rng.chance(0.5);
    const x = v ? (rng.chance(0.5) ? rng.range(3, B - 3) : rng.range(W - B + 3, W - 3)) : rng.range(0, W);
    const y = v ? rng.range(0, H) : (rng.chance(0.5) ? rng.range(3, B - 3) : rng.range(H - B + 3, H - 3));
    ctx.strokeStyle = css('#8a7c84', rng.range(0.1, 0.25));
    ctx.lineWidth = rng.range(0.6, 1.2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    const len = rng.range(30, 160);
    if (v) ctx.lineTo(x, y + len); else ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  // mitred corners
  ctx.strokeStyle = css('#000000', 0.8);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(B, B);
  ctx.moveTo(W, 0); ctx.lineTo(W - B, B);
  ctx.moveTo(0, H); ctx.lineTo(B, H - B);
  ctx.moveTo(W, H); ctx.lineTo(W - B, H - B);
  ctx.stroke();
  ctx.restore();
  // edge lines
  ctx.strokeStyle = css('#050304');
  ctx.lineWidth = 2.5;
  ctx.strokeRect(B - 1, B - 1, W - 2 * B + 2, H - 2 * B + 2);
  ctx.strokeStyle = css('#b8963e', 0.55);
  ctx.lineWidth = 1;
  ctx.strokeRect(B - 3.5, B - 3.5, W - 2 * B + 7, H - 2 * B + 7);
  ctx.strokeStyle = css('#000000');
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  // hikite (recessed round handle) at mid height near one edge
  const hx = hikiteRight ? W - B - 44 : B + 44, hy = H / 2, R = 23;
  ctx.save();
  ctx.translate(hx, hy);
  const ringG = ctx.createLinearGradient(-R, -R, R, R);
  ringG.addColorStop(0, css('#e8c870'));
  ringG.addColorStop(0.5, css('#a8822e'));
  ringG.addColorStop(1, css('#5e4414'));
  ctx.fillStyle = ringG;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  const inG = ctx.createRadialGradient(4, 5, 2, 0, 0, R * 0.78);
  inG.addColorStop(0, css('#4a3418'));
  inG.addColorStop(0.7, css('#1c130a'));
  inG.addColorStop(1, css('#0c0805'));
  ctx.fillStyle = inG;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.74, 0, TAU); ctx.fill();
  // inner flower-shaped plate
  ctx.strokeStyle = css('#8a6a2a', 0.8);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * TAU;
    const rr = R * 0.5 * (1 + 0.1 * Math.cos(a * 5));
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.stroke();
  // highlight arc on lower-right of the recess (light falls in)
  ctx.strokeStyle = css('#f2d88c', 0.6);
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.66, 0.1, 1.5); ctx.stroke();
  ctx.strokeStyle = css('#fff3c4', 0.7);
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(0, 0, R - 1.5, 3.4, 4.6); ctx.stroke();
  ctx.strokeStyle = css('#120b04');
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.74, 0, TAU); ctx.stroke();
  ctx.restore();
}

/** Union-outlined shape: draws all paths as thick ink stroke, then fills on top. */
function unionInk(ctx, paths, fill, ink, lw) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = css(ink);
  ctx.lineWidth = lw * 2;
  for (const p of paths) ctx.stroke(p);
  ctx.fillStyle = typeof fill === 'string' || Array.isArray(fill) ? css(fill) : fill;
  for (const p of paths) ctx.fill(p);
}

function spiral(cx, cy, r0, turns, dir, startAng, n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = startAng + dir * t * turns * TAU;
    const r = r0 * (1 - t * 0.92);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function swirlCloud(ctx, cx, cy, s, rng, flip) {
  const ink = '#26346a', fill = '#f6efdc', shade = '#c9d2ea';
  const lobes = [];
  const nl = rng.int(3, 4);
  for (let i = 0; i < nl; i++) {
    const t = nl === 1 ? 0.5 : i / (nl - 1);
    const r = s * (i === 1 ? 0.62 : rng.range(0.42, 0.52));
    lobes.push({ x: cx + (t - 0.5) * s * 1.9 * flip, y: cy - Math.sin(t * Math.PI) * s * 0.42 + rng.range(-0.05, 0.05) * s, r });
  }
  // tail: tapered band trailing away, ending with a small curl
  const dir = flip;
  const tx0 = cx - dir * s * 0.7, ty0 = cy + s * 0.32;
  const tailPts = cubic([tx0, ty0], [tx0 - dir * s * 1.2, ty0 + s * 0.35], [tx0 - dir * s * 2.2, ty0 - s * 0.1], [tx0 - dir * s * 3.1, ty0 + s * 0.12], 30);
  const tail = ribbon(tailPts, (t) => s * 0.62 * (1 - t * 0.85), { taperA: 0, taperB: 0.12, pow: 0.8 });
  const paths = [tail.path];
  for (const l of lobes) {
    const p = new Path2D();
    p.arc(l.x, l.y, l.r, 0, TAU);
    paths.push(p);
  }
  // base body connecting lobes
  const body = new Path2D();
  body.ellipse(cx, cy + s * 0.12, s * 1.15, s * 0.42, 0, 0, TAU);
  paths.push(body);

  // white halo outside the indigo outline
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = css('#fffaf0');
  ctx.lineWidth = 11;
  for (const p of paths) ctx.stroke(p);
  ctx.restore();
  unionInk(ctx, paths, fill, ink, 2.6);
  // soft blue shading under each lobe, clipped to the union
  ctx.save();
  const clip = new Path2D();
  for (const p of paths) clip.addPath(p);
  ctx.clip(clip);
  for (const l of lobes) {
    ctx.fillStyle = css(shade, 0.8);
    ctx.beginPath();
    ctx.ellipse(l.x + dir * l.r * 0.15, l.y + l.r * 0.72, l.r * 0.95, l.r * 0.45, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = css(shade, 0.7);
  ctx.fill(ribbon(offsetPts(tailPts, s * 0.14), (t) => s * 0.28 * (1 - t), { taperA: 0.1, taperB: 0.2 }).path);
  ctx.restore();
  // lobe edge re-ink (inner overlaps) and spirals
  ctx.strokeStyle = css(ink);
  ctx.fillStyle = css(ink);
  ctx.lineCap = 'round';
  for (let i = 0; i < lobes.length; i++) {
    const l = lobes[i];
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, Math.PI * 0.95, Math.PI * 2.05);
    ctx.stroke();
    const sp = spiral(l.x + dir * l.r * 0.05, l.y + l.r * 0.08, l.r * 0.74, 1.35, (i % 2 ? 1 : -1) * dir, Math.PI * (dir > 0 ? 1.05 : -0.05) + rng.range(-0.3, 0.3));
    ctx.fill(ribbon(sp, (t) => 4 * (1 - t * 0.55), { taperA: 0.04, taperB: 0.2 }).path);
  }
  // tail curl
  const end = tailPts[tailPts.length - 1];
  const tc = spiral(end[0] + dir * s * 0.12, end[1] - s * 0.05, s * 0.2, 1.1, dir, Math.PI * 0.5);
  ctx.fillStyle = css(ink);
  ctx.fill(ribbon(tc, 2.6, { taperA: 0.05, taperB: 0.3 }).path);
  // flow lines inside the tail
  for (let k = 0; k < 2; k++) {
    const lp = offsetPts(tailPts.slice(3, 24), (k - 0.5) * s * 0.22);
    ctx.fill(ribbon(lp, 1.8, { taperA: 0.3, taperB: 0.4 }).path);
  }
}

export function fusuma1(seed) {
  const W = 512, H = 1024;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(W, H);
  goldLeaf(ctx, 0, 0, W, H, rng);
  ctx.save();
  ctx.beginPath(); ctx.rect(26, 26, W - 52, H - 52); ctx.clip();
  const clouds = [
    [150, 170, 62, 1], [380, 360, 70, -1], [170, 590, 58, 1], [400, 820, 64, -1], [120, 930, 44, 1],
  ];
  for (const [x, y, s, f] of clouds) swirlCloud(ctx, x + rng.range(-10, 10), y + rng.range(-10, 10), s, rng, f);
  // scattered gold dust over everything
  for (let i = 0; i < 500; i++) {
    const x = rng.range(26, W - 26), y = rng.range(26, H - 26), r = rng.range(0.6, 1.8);
    ctx.fillStyle = css(rng.chance(0.7) ? '#f5da86' : '#9a7424', rng.range(0.4, 0.9));
    ctx.fillRect(x, y, r, r);
  }
  ctx.restore();
  grain(ctx, W, H, 0.08);
  fusumaFrame(ctx, W, H, rng, true);
  return c;
}

export function fusuma2(seed) {
  const W = 512, H = 1024, B = 26;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(W, H);
  ctx.fillStyle = css('#1b2548');
  ctx.fillRect(0, 0, W, H);
  drawTiled(ctx, toneLayer(32, 64, fbmGrid(32, 64, { cx: 2, cy: 4, oct: 4, seed: (seed & 0xfff) + 1 }), '#0e1530', '#2d3d6e', 0.45, 1.3), W, H);
  // brush texture in the indigo ground
  for (let i = 0; i < 60; i++) {
    const x = rng.range(0, W), y = rng.range(0, H);
    dryBrush(ctx, strokePts(x, y, rng.range(-0.2, 0.2), rng.range(60, 200), rng.range(-0.3, 0.3), 10), rng.range(8, 24), rng.chance(0.5) ? '#26356a' : '#111a3a', rng.range(0.08, 0.18), rng, { bristles: 3 });
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(B, B, W - 2 * B, H - 2 * B); ctx.clip();
  const bands = [[110, 330], [470, 650], [790, 960]];
  for (const [ya, yb] of bands) {
    // band shape with cloud-like stepped edges (suyari-gasumi)
    const top = [], bot = [];
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
      const x = B - 10 + ((W - 2 * B + 20) * i) / steps;
      top.push([x, ya + Math.sin(i * 1.7 + ya) * 14 + (i % 3 === 0 ? -8 : 4)]);
      bot.push([x, yb + Math.sin(i * 1.3 + yb) * 14 + (i % 3 === 1 ? 8 : -4)]);
    }
    const tp = catmull(top, 8), bp = catmull(bot, 8).reverse();
    const shape = pathOf(tp.concat(bp), true);
    ctx.save();
    ctx.clip(shape);
    ctx.fillStyle = css('#1f2d5c');
    ctx.fillRect(0, ya - 40, W, yb - ya + 80);
    // seigaiha: concentric arcs, rows drawn top to bottom so each overlaps the one above
    const R = 30;
    let row = 0;
    for (let y = ya - 40; y < yb + 60; y += R / 2, row++) {
      for (let x = -R + (row % 2) * R; x < W + R; x += R * 2) {
        ctx.fillStyle = css(row % 2 ? '#22306a' : '#1d2a5e');
        ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
        for (let k = 0; k < 4; k++) {
          ctx.strokeStyle = css('#f3efe4', k === 0 ? 0.95 : 0.85);
          ctx.lineWidth = k === 0 ? 2.6 : 2;
          ctx.beginPath(); ctx.arc(x, y, R * (0.94 - k * 0.235), Math.PI, TAU); ctx.stroke();
        }
      }
    }
    ctx.restore();
    // gold outline of the band
    ctx.lineJoin = 'round';
    ctx.strokeStyle = css('#0a0f22', 0.9);
    ctx.lineWidth = 5;
    ctx.stroke(shape);
    ctx.strokeStyle = css('#d8b04e');
    ctx.lineWidth = 2.4;
    ctx.stroke(shape);
  }
  // sunago gold dust, denser near the bands
  for (let i = 0; i < 3200; i++) {
    const x = rng.range(B, W - B);
    let y = rng.range(B, H - B);
    const band = rng.pick(bands);
    if (rng.chance(0.55)) y = (rng.chance(0.5) ? band[0] : band[1]) + rng.gauss() * 38;
    const r = rng.chance(0.93) ? rng.range(0.6, 1.8) : rng.range(2.5, 5.5);
    ctx.fillStyle = css(rng.chance(0.8) ? '#e6c264' : '#fff0b0', rng.range(0.45, 0.95));
    if (r > 2.4) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rng.range(0, TAU)); ctx.fillRect(-r / 2, -r / 2, r, r * rng.range(0.5, 1)); ctx.restore();
    } else ctx.fillRect(x, y, r, r);
  }
  ctx.restore();
  grain(ctx, W, H, 0.08);
  fusumaFrame(ctx, W, H, rng, false);
  return c;
}

function pinePad(ctx, x, y, w, h, rng) {
  // a flat layered cluster of needle fans
  const fans = [];
  const n = Math.max(3, Math.round(w / 34));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const fx = x + (t - 0.5) * w * 0.92 + rng.range(-5, 5);
    const fy = y + Math.pow(Math.abs(t - 0.5) * 2, 2) * h * 0.45 + rng.range(-3, 3);
    const r = h * rng.range(0.62, 0.85) * (1 - Math.abs(t - 0.5) * 0.5);
    fans.push([fx, fy, r]);
  }
  const paths = fans.map(([fx, fy, r]) => {
    const p = new Path2D();
    p.moveTo(fx - r, fy);
    p.arc(fx, fy, r, Math.PI, TAU);
    p.closePath();
    return p;
  });
  ctx.lineJoin = 'round';
  ctx.strokeStyle = css('#101a0f');
  ctx.lineWidth = 5;
  for (const p of paths) ctx.stroke(p);
  for (const p of paths) {
    ctx.fillStyle = css('#2c4a2b');
    ctx.fill(p);
  }
  // lighter top band + needles
  ctx.save();
  const clip = new Path2D();
  for (const p of paths) clip.addPath(p);
  ctx.clip(clip);
  for (const [fx, fy, r] of fans) {
    ctx.fillStyle = css('#4f7040', 0.85);
    ctx.beginPath(); ctx.ellipse(fx, fy - r * 0.55, r * 0.8, r * 0.38, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.lineCap = 'round';
  for (const [fx, fy, r] of fans) {
    const cnt = Math.round(r / 2.2);
    for (let k = 0; k <= cnt; k++) {
      const a = Math.PI + (k / cnt) * Math.PI;
      const rr = r * rng.range(0.82, 1.02);
      ctx.strokeStyle = css(k % 3 === 0 ? '#8fb070' : '#0e170d', k % 3 === 0 ? 0.6 : 0.85);
      ctx.lineWidth = k % 3 === 0 ? 1 : 1.3;
      ctx.beginPath();
      ctx.moveTo(fx + Math.cos(a) * r * 0.12, fy + Math.sin(a) * r * 0.12);
      ctx.lineTo(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr);
      ctx.stroke();
    }
    ctx.fillStyle = css('#0e170d');
    ctx.beginPath(); ctx.arc(fx, fy, 2.2, 0, TAU); ctx.fill();
  }
}

export function fusuma3(seed) {
  const W = 512, H = 1024, B = 26;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(W, H);
  goldLeaf(ctx, 0, 0, W, H, rng);
  ctx.save();
  ctx.beginPath(); ctx.rect(B, B, W - 2 * B, H - 2 * B); ctx.clip();

  // distant gold cloud bands (slightly raised gold with outline)
  const cloudBand = (y, x0, x1, hh) => {
    const pts = [];
    const n = 8;
    for (let i = 0; i <= n; i++) pts.push([lerp(x0, x1, i / n), y - hh * (0.6 + 0.4 * Math.sin(i * 2.1)) * (i === 0 || i === n ? 0.3 : 1)]);
    for (let i = n; i >= 0; i--) pts.push([lerp(x0, x1, i / n) + 10, y + hh * (0.5 + 0.3 * Math.cos(i * 1.7)) * (i === 0 || i === n ? 0.3 : 1)]);
    const p = pathOf(catmull(pts, 6, true), true);
    ctx.fillStyle = css('#e2bd5c');
    ctx.fill(p);
    ctx.strokeStyle = css('#9a7426', 0.8);
    ctx.lineWidth = 2;
    ctx.stroke(p);
  };
  cloudBand(210, 260, 560, 34);
  cloudBand(900, -40, 330, 40);

  // gnarled trunk
  const trunkCtrl = [[120, 1060], [150, 900], [60, 820], [150, 700], [240, 590], [120, 520], [200, 430], [270, 350], [380, 330], [500, 300]];
  const trunkPts = catmull(trunkCtrl, 10);
  const trunk = ribbon(trunkPts, (t) => lerp(74, 20, Math.pow(t, 0.8)) * (1 + 0.12 * Math.sin(t * 23)), { taperA: 0, taperB: 0.06, pow: 0.6 });
  const branches = [
    { ctrl: [[150, 700], [90, 640], [40, 610], [-10, 600]], w: 24 },
    { ctrl: [[200, 440], [230, 330], [210, 240], [260, 150], [330, 120]], w: 19 },
    { ctrl: [[380, 330], [420, 400], [470, 430], [530, 440]], w: 15 },
    { ctrl: [[100, 830], [60, 780], [10, 770]], w: 18 },
    { ctrl: [[260, 360], [300, 270], [360, 230], [420, 205]], w: 12 },
  ].map((b) => ({ pts: catmull(b.ctrl, 10), w: b.w }));
  const bRibs = branches.map((b) => ribbon(b.pts, (t) => b.w * (1 - t * 0.7), { taperA: 0, taperB: 0.1 }));
  const woodPaths = [trunk.path, ...bRibs.map((r) => r.path)];
  unionInk(ctx, woodPaths, '#5a412e', '#170f09', 2.8);
  // bark: lighter left side, scale marks
  ctx.save();
  const wclip = new Path2D();
  for (const p of woodPaths) wclip.addPath(p);
  ctx.clip(wclip);
  const lightSide = offsetPts(trunkPts, (t) => -lerp(19, 5, t));
  ctx.fillStyle = css('#8a6a4c', 0.75);
  ctx.fill(ribbon(lightSide, (t) => lerp(23, 6, t), { taperA: 0.05, taperB: 0.1 }).path);
  for (const b of branches) {
    ctx.fill(ribbon(offsetPts(b.pts, -b.w * 0.25), b.w * 0.35, { taperA: 0.1, taperB: 0.3 }).path);
  }
  const shadowSide = offsetPts(trunkPts, (t) => lerp(23, 6, t));
  ctx.fillStyle = css('#2c1d12', 0.7);
  ctx.fill(ribbon(shadowSide, (t) => lerp(21, 6, t), { taperA: 0.05, taperB: 0.1 }).path);
  ctx.strokeStyle = css('#1a110a', 0.85);
  ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const t = rng.range(0, 0.95);
    const idx = Math.floor(t * (trunkPts.length - 1));
    const p = trunkPts[idx];
    const q = trunkPts[Math.min(trunkPts.length - 1, idx + 1)];
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const wd = lerp(74, 20, Math.pow(t, 0.8)) * 0.42;
    const off = rng.range(-wd, wd);
    const sx = p[0] - Math.sin(ang) * off, sy = p[1] + Math.cos(ang) * off;
    ctx.lineWidth = rng.range(1.2, 2.4);
    ctx.beginPath();
    ctx.ellipse(sx, sy, rng.range(5, 11), rng.range(2, 4), ang + rng.range(-0.3, 0.3), rng.range(0, 1), rng.range(2.5, 4.5));
    ctx.stroke();
  }
  ctx.restore();

  // needle pads
  const pads = [
    [440, 292, 190, 56], [310, 108, 170, 52], [470, 418, 150, 46], [70, 585, 160, 50], [240, 250, 130, 42],
    [150, 515, 120, 38], [40, 752, 130, 42], [410, 196, 130, 40], [360, 58, 110, 34], [480, 150, 90, 30], [110, 440, 90, 30],
  ];
  for (const [x, y, w, h] of pads) pinePad(ctx, x, y, w, h, rng);
  ctx.restore();
  grain(ctx, W, H, 0.08);
  fusumaFrame(ctx, W, H, rng, true);
  return c;
}

// ---------------------------------------------------------------------------
// Kawara roof tiles
// ---------------------------------------------------------------------------
export function roofTiles(seed) {
  const W = 512, H = 512, P = 64, ROWS = 8, COLS = 8;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(W, H);
  const INK = '#14161d';
  ctx.fillStyle = css('#3b4150');
  ctx.fillRect(0, 0, W, H);
  const RW = 13; // round tile half-width
  // pass 1: tile bodies
  for (let r = 0; r < ROWS; r++) {
    for (let k = 0; k < COLS; k++) {
      const y = r * P, xc = k * P;
      const tone = vary('#3b4150', rng, 0.035, 4, 0.03);
      // pan tile between round tiles at xc and xc+P
      const x0 = xc + RW, x1 = xc + P - RW;
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, css(darken(tone, 0.42)));
      g.addColorStop(0.28, css(darken(tone, 0.12)));
      g.addColorStop(0.3, css(tone));
      g.addColorStop(0.78, css(lighten(tone, 0.08)));
      g.addColorStop(1, css(lighten(tone, 0.14)));
      ctx.fillStyle = g;
      ctx.fillRect(x0, y, x1 - x0, P);
      // painterly light strokes down the channel
      for (let b = 0; b < 2; b++) {
        const bx = lerp(x0, x1, rng.range(0.45, 0.85));
        const pts = strokePts(bx, y + rng.range(2, 14), Math.PI / 2, rng.range(26, 46), rng.range(-0.2, 0.2), 6);
        ctx.fillStyle = css(lighten(tone, 0.22), rng.range(0.12, 0.25));
        ctx.fill(ribbon(pts, rng.range(3, 7), { taperA: 0.4, taperB: 0.5 }).path);
      }
      // round tile at xc (cylinder: lit left, shadow right), wrapped in x
      const rt = vary('#454c5d', rng, 0.03, 3, 0.03);
      wrapped(ctx, W, H, [xc - RW, y, xc + RW, y + P], () => {
        const rg = ctx.createLinearGradient(xc - RW, 0, xc + RW, 0);
        rg.addColorStop(0, css(darken(rt, 0.1)));
        rg.addColorStop(0.18, css(lighten(rt, 0.12)));
        rg.addColorStop(0.4, css(lighten(rt, 0.2)));
        rg.addColorStop(0.42, css(rt));
        rg.addColorStop(0.62, css(darken(rt, 0.2)));
        rg.addColorStop(0.64, css(darken(rt, 0.38)));
        rg.addColorStop(1, css(darken(rt, 0.5)));
        ctx.fillStyle = rg;
        ctx.fillRect(xc - RW, y, RW * 2, P);
      }, true, false);
    }
  }
  // weathering tone
  drawTiled(ctx, toneLayer(64, 64, fbmGrid(64, 64, { cx: 4, cy: 4, oct: 4, seed: (seed & 0xfff) + 2 }), '#1f232d', '#5d6678', 0.3, 1.4), W, H);
  // crest highlight and seam lines of round tiles
  for (let k = 0; k < COLS; k++) {
    const xc = k * P;
    wrapped(ctx, W, H, [xc - RW - 2, 0, xc + RW + 2, H], () => {
      ctx.fillStyle = css('#8f9aad', 0.55);
      ctx.fillRect(xc - RW * 0.35, 0, 1.8, H);
      ctx.fillStyle = css(INK, 0.95);
      ctx.fillRect(xc - RW - 1, 0, 2, H);
      ctx.fillRect(xc + RW - 1, 0, 2, H);
    }, true, false);
  }
  // pass 2: overlapping lower edges (upper tile end over the lower tile), cast shadows
  for (let r = 0; r < ROWS; r++) {
    const ye = (r + 1) * P - 6;
    for (let k = 0; k < COLS; k++) {
      const xc = k * P;
      const x0 = xc + RW, x1 = xc + P - RW;
      const sag = 3.2;
      const edge = new Path2D();
      edge.moveTo(x0, ye - 1);
      edge.quadraticCurveTo((x0 + x1) / 2, ye + sag * 2 - 1, x1, ye - 1);
      wrapped(ctx, W, H, [x0, ye - 6, x1, ye + 16], () => {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x0, ye - 1);
        ctx.quadraticCurveTo((x0 + x1) / 2, ye + sag * 2 - 1, x1, ye - 1);
        ctx.lineTo(x1, ye + 14);
        ctx.lineTo(x0, ye + 14);
        ctx.closePath();
        ctx.clip();
        const sg = ctx.createLinearGradient(0, ye, 0, ye + 13);
        sg.addColorStop(0, css('#10131a', 0.62));
        sg.addColorStop(1, css('#10131a', 0));
        ctx.fillStyle = sg;
        ctx.fillRect(x0, ye - 2, x1 - x0, 16);
        ctx.restore();
        ctx.save();
        ctx.translate(0, -2.6);
        ctx.strokeStyle = css('#7d889e', 0.8);
        ctx.lineWidth = 1.8;
        ctx.stroke(edge);
        ctx.restore();
        ctx.strokeStyle = css(INK);
        ctx.lineWidth = 2.4;
        ctx.stroke(edge);
      }, false, true);
      // round tile cap
      const capY = ye + 1;
      wrapped(ctx, W, H, [xc - RW - 2, capY - 8, xc + RW + 2, capY + 20], () => {
        const sg = ctx.createRadialGradient(xc + 3, capY + 6, 2, xc + 3, capY + 6, RW + 6);
        sg.addColorStop(0, css('#0c0e13', 0.55));
        sg.addColorStop(1, css('#0c0e13', 0));
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.ellipse(xc + 3, capY + 5, RW + 6, 11, 0, 0, TAU); ctx.fill();
        const cg = ctx.createLinearGradient(xc - RW, 0, xc + RW, 0);
        cg.addColorStop(0, css('#56607a'));
        cg.addColorStop(0.45, css('#6a758c'));
        cg.addColorStop(0.5, css('#454d60'));
        cg.addColorStop(1, css('#262b37'));
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.moveTo(xc - RW, capY - 6);
        ctx.lineTo(xc - RW, capY);
        ctx.ellipse(xc, capY, RW, 7, 0, Math.PI, 0, true);
        ctx.lineTo(xc + RW, capY - 6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = css(INK);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(xc - RW, capY - 4);
        ctx.lineTo(xc - RW, capY);
        ctx.ellipse(xc, capY, RW, 7, 0, Math.PI, 0, true);
        ctx.lineTo(xc + RW, capY - 4);
        ctx.stroke();
        ctx.strokeStyle = css('#a8b2c4', 0.7);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(xc, capY - 1, RW - 3, 4.5, 0, Math.PI * 0.95, Math.PI * 0.55, true);
        ctx.stroke();
      });
    }
  }
  // small specular glints and lichen specks
  for (let i = 0; i < 30; i++) {
    const k = rng.int(0, COLS - 1), r = rng.int(0, ROWS - 1);
    const x = k * P - RW * 0.35 + rng.range(-1, 2), y = r * P + rng.range(4, P - 10);
    const len = rng.range(2, 7), a = rng.range(0.5, 0.9);
    wrapped(ctx, W, H, [x - 2, y - 2, x + 3, y + len + 2], () => {
      ctx.fillStyle = css('#dfe6f2', a);
      ctx.fillRect(x, y, 1.6, len);
    });
  }
  for (let i = 0; i < 50; i++) {
    const x = rng.range(0, W), y = rng.range(0, H), r = rng.range(0.8, 2.2);
    wrapped(ctx, W, H, [x - r, y - r, x + r, y + r], () => {
      ctx.fillStyle = css('#6c7a66', 0.35);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    });
  }
  grain(ctx, W, H, 0.09);
  return c;
}

// ---------------------------------------------------------------------------
// Plaster wall
// ---------------------------------------------------------------------------
export function plaster(seed) {
  const W = 512, H = 512;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(W, H);
  ctx.fillStyle = css('#ebe1cd');
  ctx.fillRect(0, 0, W, H);
  drawTiled(ctx, toneLayer(64, 64, fbmGrid(64, 64, { cx: 3, cy: 3, oct: 5, seed: (seed & 0xfff) + 1 }), '#cdbd9d', '#faf5ea', 0.5, 1.3), W, H);
  // broad soft trowel / brush sweeps
  for (let i = 0; i < 170; i++) {
    const x = rng.range(0, W), y = rng.range(0, H);
    const ang = rng.range(-0.6, 0.6) + (rng.chance(0.5) ? 0 : Math.PI / 2 * 0.3);
    const pts = strokePts(x, y, ang, rng.range(50, 150), rng.range(-1.2, 1.2), 12);
    const light = rng.chance(0.55);
    dryBrush(ctx, pts, rng.range(14, 40), light ? '#fbf7ee' : '#d6c7a8', rng.range(0.05, 0.12), rng, { W, H, bristles: 4, bristleColor: light ? '#ffffff' : '#c7b690', bristleAlpha: 0.14 });
  }
  // faint water stains: soft wash plus a barely-there drying edge
  for (let i = 0; i < 3; i++) {
    const x = rng.range(0, W), y = rng.range(0, H), r = rng.range(26, 60);
    const pts = catmull(blobPts(x, y, r, rng, { n: 14, amp: 0.3, sy: rng.range(0.9, 1.5) }), 4, true);
    const p = pathOf(pts, true);
    const a = rng.range(0.025, 0.045);
    wash(ctx, x, y, r * 1.1, r * 1.3, '#b59a6c', 0.12, W, H);
    wrapped(ctx, W, H, bboxOf(pts, 4), () => {
      ctx.fillStyle = css('#b59a6c', a);
      ctx.fill(p);
      ctx.strokeStyle = css('#a88a58', a * 1.3);
      ctx.lineWidth = 3;
      ctx.stroke(p);
    });
  }
  // drip streaks
  for (let i = 0; i < 4; i++) {
    const x = rng.range(0, W), y = rng.range(0, H);
    const pts = strokePts(x, y, Math.PI / 2 + rng.range(-0.05, 0.05), rng.range(60, 180), rng.range(-0.1, 0.1), 10);
    const rib = ribbon(pts, rng.range(4, 9), { taperA: 0.1, taperB: 0.6 });
    fillWrapped(ctx, rib, W, H, css('#a6906a', rng.range(0.035, 0.06)));
  }
  // hairline cracks
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    let x = rng.range(0, W), y = rng.range(0, H), a = rng.range(0, TAU);
    const pts = [[x, y]];
    for (let s = 0; s < 8; s++) {
      a += rng.range(-0.7, 0.7);
      x += Math.cos(a) * rng.range(5, 12);
      y += Math.sin(a) * rng.range(5, 12);
      pts.push([x, y]);
    }
    const p = pathOf(pts);
    wrapped(ctx, W, H, bboxOf(pts, 2), () => { ctx.strokeStyle = css('#8a7658', 0.35); ctx.lineWidth = 0.9; ctx.stroke(p); });
  }
  grain(ctx, W, H, 0.12);
  return c;
}

// ---------------------------------------------------------------------------
// Tatami mat (one mat, 512 x 1024)
// ---------------------------------------------------------------------------
export function tatami(seed) {
  const W = 512, H = 1024;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(W, H);
  const HB = 36; // heri (border) width
  const base = '#b5b36a';
  ctx.fillStyle = css(base);
  ctx.fillRect(0, 0, W, H);
  // sheen variation: broad bands across the mat
  drawTiled(ctx, toneLayer(16, 128, fbmGrid(16, 128, { cx: 1, cy: 8, oct: 3, seed: (seed & 0xfff) + 4 }), '#8e8c48', '#d6d28c', 0.5, 1.4), W, H);
  const lg = ctx.createLinearGradient(HB, 0, W - HB, 0);
  lg.addColorStop(0, css('#6f6d34', 0.25));
  lg.addColorStop(0.5, css('#e8e4a4', 0.12));
  lg.addColorStop(1, css('#6f6d34', 0.25));
  ctx.fillStyle = lg;
  ctx.fillRect(HB, 0, W - 2 * HB, H);
  // straw weave: rows along y, broken by warp threads along x
  const pitch = 5;
  const warp = 22;
  for (let y = 0; y < H; y += pitch) {
    const rowShift = (Math.floor(y / pitch) % 2) * (warp / 2);
    for (let x = HB - warp + rowShift; x < W - HB; x += warp) {
      const xa = Math.max(HB, x), xb = Math.min(W - HB, x + warp);
      if (xb <= xa) continue;
      const v = rng.range(-0.07, 0.07);
      ctx.fillStyle = v > 0 ? css('#e2dd98', v * 2.2) : css('#6e6b30', -v * 2.2);
      ctx.fillRect(xa, y, xb - xa, pitch);
      ctx.fillStyle = css('#e9e5a8', 0.28);
      ctx.fillRect(xa + 1, y + 0.6, xb - xa - 2, 1);
    }
    ctx.fillStyle = css('#76732f', 0.5);
    ctx.fillRect(HB, y + pitch - 1, W - 2 * HB, 1);
  }
  // warp threads
  for (let x = HB + warp / 2; x < W - HB; x += warp) {
    ctx.fillStyle = css('#8c8943', 0.32);
    ctx.fillRect(x - 0.6, 0, 1.2, H);
  }
  // occasional darker / lighter straw strands
  for (let i = 0; i < 40; i++) {
    const y = Math.floor(rng.range(0, H / pitch)) * pitch;
    const x = rng.range(HB, W - HB - 60);
    ctx.fillStyle = rng.chance(0.5) ? css('#7a7632', 0.3) : css('#ece8b0', 0.3);
    ctx.fillRect(x, y, rng.range(40, 200), pitch - 1);
  }
  // heri borders along both long edges
  const heri = (x0) => {
    ctx.fillStyle = css('#1d2a1e');
    ctx.fillRect(x0, 0, HB, H);
    drawTiled(ctx, toneLayer(8, 64, fbmGrid(8, 64, { cx: 1, cy: 4, oct: 3, seed: x0 + 5 }), '#0c120c', '#34473a', 0.5), W, H, { sx: HB / 8, sy: H / 64, ox: x0 });
    ctx.fillStyle = css('#3c5642', 0.9);
    ctx.fillRect(x0 + HB * 0.3, 0, 1.6, H);
    ctx.fillRect(x0 + HB * 0.7 - 1.6, 0, 1.6, H);
    ctx.fillStyle = css('#0c120c', 0.8);
    for (let y = 3; y < H; y += 9) ctx.fillRect(x0 + HB * 0.5 - 1, y, 2, 4);
    ctx.fillStyle = css('#0a0e0a');
    ctx.fillRect(x0 === 0 ? HB - 2.5 : x0, 0, 2.5, H);
    ctx.fillStyle = css('#58705a', 0.5);
    ctx.fillRect(x0 === 0 ? 1 : x0 + HB - 2, 0, 1, H);
  };
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, HB, H); ctx.clip();
  heri(0);
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.rect(W - HB, 0, HB, H); ctx.clip();
  heri(W - HB);
  ctx.restore();
  // stitches along the heri inner edge (on the mat side)
  ctx.fillStyle = css('#4a4a22', 0.55);
  for (let y = 5; y < H; y += 12) {
    ctx.fillRect(HB + 3, y, 1.4, 5);
    ctx.fillRect(W - HB - 4.4, y + 6, 1.4, 5);
  }
  // short ends
  ctx.fillStyle = css('#4a4820', 0.6);
  ctx.fillRect(HB, 0, W - 2 * HB, 2.5);
  ctx.fillRect(HB, H - 2.5, W - 2 * HB, 2.5);
  grain(ctx, W, H, 0.08);
  return c;
}

// ---------------------------------------------------------------------------
// Chochin lantern wrap (u goes around, v top->bottom)
// ---------------------------------------------------------------------------
function monCrest(ctx, cx, cy, rx, ry) {
  // maru ni umebachi: ring + five round petals, pre-stretched vertically
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const white = css('#fbf2e2');
  const dark = css('#7a140a');
  ctx.fillStyle = white;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.arc(0, 0, 0.85, 0, TAU, true);
  ctx.fill();
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * TAU) / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.29, 0, TAU);
    ctx.fill();
  }
  // petal separations and centre
  ctx.strokeStyle = dark;
  ctx.lineWidth = 0.045;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + ((k + 0.5) * TAU) / 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 0.2, Math.sin(a) * 0.2);
    ctx.lineTo(Math.cos(a) * 0.5, Math.sin(a) * 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(0, 0, 0.17, 0, TAU);
  ctx.fill();
  ctx.fillStyle = white;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * TAU) / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.035, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function lantern(seed) {
  const W = 256, H = 512;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(W, H);
  const bandH = Math.round(H * 0.1);
  const y0 = bandH, y1 = H - bandH;
  // glowing paper: brighter at the vertical centre
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, css('#7e1a10'));
  g.addColorStop(0.18, css('#b52a18'));
  g.addColorStop(0.5, css('#f2622e'));
  g.addColorStop(0.82, css('#b52a18'));
  g.addColorStop(1, css('#7e1a10'));
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, y1 - y0);
  // hot core glow (tileable horizontally: full-width band)
  const cg = ctx.createLinearGradient(0, y0, 0, y1);
  cg.addColorStop(0.3, css('#ffb45a', 0));
  cg.addColorStop(0.5, css('#ffc26a', 0.35));
  cg.addColorStop(0.7, css('#ffb45a', 0));
  ctx.fillStyle = cg;
  ctx.fillRect(0, y0, W, y1 - y0);
  // paper variation
  drawTiled(ctx, toneLayer(32, 64, fbmGrid(32, 64, { cx: 4, cy: 4, oct: 3, seed: (seed & 0xfff) + 3 }), '#6a120a', '#ff9a50', 0.22, 1.3), W, H);
  // ribs every ~6% with bulging paper between them
  const ribStep = H * 0.06;
  const nr = Math.round((y1 - y0) / ribStep);
  const step = (y1 - y0) / nr;
  for (let i = 0; i < nr; i++) {
    const ya = y0 + i * step;
    const bg = ctx.createLinearGradient(0, ya, 0, ya + step);
    bg.addColorStop(0, css('#4a0a04', 0.28));
    bg.addColorStop(0.3, css('#ffcf8a', 0.1));
    bg.addColorStop(0.55, css('#ffcf8a', 0.14));
    bg.addColorStop(1, css('#4a0a04', 0.3));
    ctx.fillStyle = bg;
    ctx.fillRect(0, ya, W, step);
  }
  for (let i = 1; i < nr; i++) {
    const ya = y0 + i * step;
    const ph = rng.range(0, TAU);
    const pts = [];
    for (let x = -4; x <= W + 4; x += 8) pts.push([x, ya + 0.8 * Math.sin((x / W) * TAU * 2 + ph)]);
    ctx.fillStyle = css('#5a0e06', 0.9);
    ctx.fill(ribbon(pts, 2.2, { taperA: 0, taperB: 0 }).path);
    ctx.fillStyle = css('#ffb070', 0.35);
    ctx.fillRect(0, ya + 2, W, 1.2);
  }
  // crests at u = 0 (wrapping) and u = 0.5, pre-stretched for a lantern ~1.6x taller than wide
  const my = (y0 + y1) / 2, mrx = 25, mry = 82;
  for (const mx of [0, W / 2]) {
    wrapped(ctx, W, H, [mx - mrx - 2, my - mry - 2, mx + mrx + 2, my + mry + 2], () => {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = css('#5a0e06');
      ctx.beginPath(); ctx.ellipse(mx, my, mrx + 3, mry + 8, 0, 0, TAU); ctx.fill();
      ctx.restore();
      monCrest(ctx, mx, my, mrx, mry);
    }, true, false);
  }
  // lacquer bands top and bottom
  const band = (ya, yb, top) => {
    ctx.fillStyle = css('#161112');
    ctx.fillRect(0, ya, W, yb - ya);
    const hg = ctx.createLinearGradient(0, ya, 0, yb);
    hg.addColorStop(0, css('#000000', 0));
    hg.addColorStop(top ? 0.62 : 0.38, css('#5a4c52', 0.7));
    hg.addColorStop(1, css('#000000', 0));
    ctx.fillStyle = hg;
    ctx.fillRect(0, ya, W, yb - ya);
    ctx.fillStyle = css('#c79a3a', 0.85);
    ctx.fillRect(0, top ? yb - 5 : ya + 3, W, 2);
    ctx.fillStyle = css('#000000');
    ctx.fillRect(0, top ? yb - 2 : ya, W, 2);
  };
  band(0, y0, true);
  band(y1, H, false);
  grain(ctx, W, H, 0.08);
  return c;
}
