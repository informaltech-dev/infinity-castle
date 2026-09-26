// Effect sprites: ground crack decal, compass-needle mandala (additive),
// breaking wave, splash, flame, sumi smoke, blob shadow.
import {
  TAU, lerp, makeRng, canvas2d, css, catmull, blobPts, pathOf, ribbon, offsetPts, grain,
} from './core.js';

// ---------------------------------------------------------------------------
// Ground crack decal (alpha blend)
// ---------------------------------------------------------------------------
function jagged(x, y, a, len, rng, jit = 0.38, stepMin = 13, stepMax = 26) {
  const pts = [[x, y]];
  let cx = x, cy = y, ca = a, d = 0;
  while (d < len) {
    const step = Math.min(rng.range(stepMin, stepMax), len - d + 2);
    ca = a + (ca - a) * 0.4 + rng.range(-jit, jit);
    cx += Math.cos(ca) * step;
    cy += Math.sin(ca) * step;
    d += step;
    pts.push([cx, cy]);
  }
  return pts;
}

export function crack(seed) {
  const S = 512, C = S / 2;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  const INK = '#1a100a', CHIP = '#dcbb90', DUST = '#8e6c48', SHADE = '#4a3020';
  const cracks = [];
  const mains = [];
  const nMain = rng.int(8, 10);
  for (let i = 0; i < nMain; i++) {
    const a0 = (i / nMain) * TAU + rng.range(-0.2, 0.2);
    const r0 = rng.range(26, 34);
    const pts = jagged(C + Math.cos(a0) * r0, C + Math.sin(a0) * r0, a0, rng.range(105, 225), rng);
    mains.push(pts);
    cracks.push({ pts, w: rng.range(10, 14), main: true });
    const nb = rng.int(0, 2);
    for (let b = 0; b < nb; b++) {
      const k = Math.max(1, Math.floor(rng.range(0.3, 0.7) * pts.length));
      const [bx, by] = pts[k];
      const bp = jagged(bx, by, a0 + rng.sign() * rng.range(0.5, 0.95), rng.range(30, 80), rng, 0.45, 9, 18);
      cracks.push({ pts: bp, w: rng.range(4, 5.5) * (1 - k / pts.length * 0.4) });
    }
  }
  // a few concentric fractures linking neighbouring cracks
  for (const rr of [72, 128]) {
    for (let i = 0; i < nMain; i++) {
      if (!rng.chance(0.45)) continue;
      const near = (A) => A.reduce((best, p) => (Math.abs(Math.hypot(p[0] - C, p[1] - C) - rr) < Math.abs(Math.hypot(best[0] - C, best[1] - C) - rr) ? p : best), A[0]);
      const pa = near(mains[i]), pb = near(mains[(i + 1) % nMain]);
      const pts = [pa];
      for (let k = 1; k < 4; k++) {
        const t = k / 4;
        const ang = Math.atan2(lerp(pa[1], pb[1], t) - C, lerp(pa[0], pb[0], t) - C);
        const r = rr * rng.range(0.92, 1.08);
        pts.push([C + Math.cos(ang) * r, C + Math.sin(ang) * r]);
      }
      pts.push(pb);
      cracks.push({ pts, w: rng.range(3, 4.2), ring: true });
    }
  }
  const width = (cr) => (t) => (cr.ring ? cr.w * (1 - Math.abs(t - 0.5) * 1.2) : cr.w * Math.pow(1 - t, 0.75) + 1.2);
  // shaded far wall + light chipped rim on opposite sides of each crack
  for (const cr of cracks) {
    const side = rng.sign();
    const wf = width(cr);
    const dark = offsetPts(cr.pts, (t) => -side * (wf(t) * 0.5 + 1));
    ctx.fillStyle = css(SHADE, 0.55);
    ctx.fill(ribbon(dark, (t) => wf(t) * 0.8, { taperA: 0, taperB: 0.2 }).path);
    // chipped light edge in broken pieces
    const n = cr.pts.length;
    for (let k = 0; k < n - 1; k++) {
      if (!rng.chance(0.55)) continue;
      const seg = offsetPts(cr.pts, (t) => side * (wf(t) * 0.5 + 1.6)).slice(k, k + 2);
      const t = k / (n - 1);
      ctx.fillStyle = css(CHIP, 0.95);
      ctx.fill(ribbon(seg, Math.max(1.4, wf(t) * 0.38), { taperA: 0.3, taperB: 0.3, pow: 1 }).path);
    }
  }
  for (const cr of cracks) {
    ctx.fillStyle = css(INK);
    ctx.fill(ribbon(cr.pts, width(cr), { taperA: cr.ring ? 0.3 : 0, taperB: 0.12, pow: 0.8 }).path);
  }
  // splinters flaking along the main cracks near the impact
  ctx.lineJoin = 'miter';
  for (let i = 0; i < 26; i++) {
    const cr = rng.pick(mains);
    const k = Math.floor(rng.range(0.05, 0.55) * cr.length);
    const [x, y] = cr[k];
    const s2 = rng.range(4, 9), a = rng.range(0, TAU);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * s2 * 1.4, y + Math.sin(a) * s2 * 1.4);
    ctx.lineTo(x + Math.cos(a + 2.3) * s2 * 0.6, y + Math.sin(a + 2.3) * s2 * 0.6);
    ctx.lineTo(x + Math.cos(a + 3.9) * s2 * 0.7, y + Math.sin(a + 3.9) * s2 * 0.7);
    ctx.closePath();
    ctx.fillStyle = css(rng.chance(0.65) ? CHIP : DUST);
    ctx.fill();
    ctx.strokeStyle = css(INK);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  // crushed crater at the centre with radial shards
  const core = pathOf(catmull(blobPts(C, C, 38, rng, { n: 18, amp: 0.22, harmonics: 7 }), 2, true), true);
  ctx.fillStyle = css(INK);
  ctx.fill(core);
  ctx.save();
  ctx.clip(core);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + rng.range(-0.15, 0.15);
    const r0 = rng.range(8, 16), r1 = rng.range(26, 40), hw = rng.range(0.1, 0.2);
    ctx.beginPath();
    ctx.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0);
    ctx.lineTo(C + Math.cos(a - hw) * r1, C + Math.sin(a - hw) * r1);
    ctx.lineTo(C + Math.cos(a + hw * 0.6) * r1 * 0.9, C + Math.sin(a + hw * 0.6) * r1 * 0.9);
    ctx.closePath();
    ctx.fillStyle = css(i % 3 === 0 ? CHIP : i % 3 === 1 ? DUST : '#5a3e28');
    ctx.fill();
    ctx.strokeStyle = css('#0c0704');
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
  ctx.fillStyle = css('#0c0704');
  ctx.beginPath(); ctx.arc(C, C, 9, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = css(INK);
  ctx.lineWidth = 3;
  ctx.stroke(core);
  // debris
  for (let i = 0; i < 30; i++) {
    const a = rng.range(0, TAU), r = rng.range(44, 110);
    const x = C + Math.cos(a) * r, y = C + Math.sin(a) * r, s3 = rng.range(2, 5);
    const pts = blobPts(x, y, s3, rng, { n: 4, amp: 0.35, harmonics: 2 });
    const p = pathOf(pts, true);
    ctx.fillStyle = css(rng.chance(0.6) ? CHIP : DUST);
    ctx.fill(p);
    ctx.strokeStyle = css(INK);
    ctx.lineWidth = 1.1;
    ctx.stroke(p);
  }
  // alpha falls off outward
  ctx.globalCompositeOperation = 'destination-in';
  const g = ctx.createRadialGradient(C, C, 0, C, C, C);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.5, 'rgba(0,0,0,1)');
  g.addColorStop(0.82, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

// ---------------------------------------------------------------------------
// Compass-needle mandala (ADDITIVE): rgb = brightness, alpha = luminance
// ---------------------------------------------------------------------------
export function compass(seed) {
  const S = 1024, C = S / 2;
  const rng = makeRng(seed);
  const major = new Path2D();
  const minor = new Path2D();
  const rings = new Path2D();
  const seg = (p, a, r0, r1) => {
    p.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0);
    p.lineTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1);
  };
  const line = (p, x0, y0, x1, y1) => { p.moveTo(x0, y0); p.lineTo(x1, y1); };
  // snowflake branches on a spoke
  const branchSet = (p, q, a, radii, lens, sub) => {
    for (let i = 0; i < radii.length; i++) {
      const r = radii[i], L = lens[i];
      const bx = C + Math.cos(a) * r, by = C + Math.sin(a) * r;
      for (const s of [-1, 1]) {
        const ba = a + s * (Math.PI / 3);
        const ex = bx + Math.cos(ba) * L, ey = by + Math.sin(ba) * L;
        line(p, bx, by, ex, ey);
        if (sub) {
          for (const t of [0.45, 0.75]) {
            const sx = bx + Math.cos(ba) * L * t, sy = by + Math.sin(ba) * L * t;
            const sl = L * (1 - t) * 0.55;
            for (const s2 of [-1, 1]) {
              const sa = ba + s2 * (Math.PI / 3);
              line(q, sx, sy, sx + Math.cos(sa) * sl, sy + Math.sin(sa) * sl);
            }
          }
        }
      }
    }
  };
  const N = 12;
  for (let k = 0; k < N; k++) {
    const a = -Math.PI / 2 + (k / N) * TAU;
    seg(major, a, 34, 468);
    branchSet(major, minor, a, [96, 158, 226, 300, 368, 428], [34, 58, 78, 70, 52, 30], true);
    // crystal tip
    const tx = C + Math.cos(a) * 478, ty = C + Math.sin(a) * 478;
    const nx = -Math.sin(a), ny = Math.cos(a);
    major.moveTo(tx + Math.cos(a) * 16, ty + Math.sin(a) * 16);
    major.lineTo(tx + nx * 7, ty + ny * 7);
    major.lineTo(tx - Math.cos(a) * 12, ty - Math.sin(a) * 12);
    major.lineTo(tx - nx * 7, ty - ny * 7);
    major.closePath();
    // secondary spokes between the main ones
    const a2 = a + Math.PI / N;
    seg(minor, a2, 120, 330);
    branchSet(minor, minor, a2, [180, 250], [26, 34], false);
    // small diamond on the secondary spoke
    const dx = C + Math.cos(a2) * 350, dy = C + Math.sin(a2) * 350;
    const mx = -Math.sin(a2), my = Math.cos(a2);
    minor.moveTo(dx + Math.cos(a2) * 14, dy + Math.sin(a2) * 14);
    minor.lineTo(dx + mx * 6, dy + my * 6);
    minor.lineTo(dx - Math.cos(a2) * 14, dy - Math.sin(a2) * 14);
    minor.lineTo(dx - mx * 6, dy - my * 6);
    minor.closePath();
  }
  // crystalline star polygons {12/5} and inner hexagram
  const star = (p, r, step, off = -Math.PI / 2) => {
    for (let k = 0; k < N; k++) {
      const a = off + (k / N) * TAU, b = off + (((k + step) % N) / N) * TAU;
      line(p, C + Math.cos(a) * r, C + Math.sin(a) * r, C + Math.cos(b) * r, C + Math.sin(b) * r);
    }
  };
  star(minor, 390, 5);
  star(minor, 226, 4, -Math.PI / 2 + Math.PI / 12);
  star(major, 96, 4);
  // rings with compass graduations
  for (const r of [34, 110, 244, 388, 452, 486]) {
    rings.moveTo(C + r, C);
    rings.arc(C, C, r, 0, TAU);
  }
  const ticks = new Path2D();
  for (let k = 0; k < 144; k++) {
    const a = (k / 144) * TAU;
    const long = k % 12 === 0, mid = k % 6 === 0;
    seg(ticks, a, 452, 452 + (long ? 22 : mid ? 14 : 7));
  }
  for (let k = 0; k < 72; k++) seg(ticks, (k / 72) * TAU, 244, 252);

  const strokeAll = (g, scale, passes) => {
    g.save();
    g.scale(scale, scale);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.globalCompositeOperation = 'lighter';
    for (const [path, col, a, w] of passes) {
      g.strokeStyle = css(col, a);
      g.lineWidth = w;
      g.stroke(path);
    }
    g.restore();
  };
  const { c, ctx } = canvas2d(S, S);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  // wide soft glow: draw small and stretch
  const glow = canvas2d(S / 8, S / 8);
  strokeAll(glow.ctx, 1 / 8, [[major, '#3fb8ff', 0.5, 26], [minor, '#3fb8ff', 0.3, 18], [rings, '#3fb8ff', 0.25, 16]]);
  const glow2 = canvas2d(S / 4, S / 4);
  strokeAll(glow2.ctx, 1 / 4, [[major, '#7fe6ff', 0.55, 10], [minor, '#7fe6ff', 0.4, 7], [rings, '#7fe6ff', 0.3, 6], [ticks, '#7fe6ff', 0.3, 5]]);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(glow.c, 0, 0, S, S);
  ctx.drawImage(glow2.c, 0, 0, S, S);
  ctx.restore();
  // crisp lines with white-hot cores
  strokeAll(ctx, 1, [
    [rings, '#7fe6ff', 0.45, 1.6],
    [ticks, '#7fe6ff', 0.75, 1.6],
    [minor, '#7fe6ff', 0.8, 2.2],
    [major, '#7fe6ff', 0.95, 3.4],
    [minor, '#ffffff', 0.55, 0.9],
    [major, '#ffffff', 0.9, 1.3],
  ]);
  // central white-hot node
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const cg = ctx.createRadialGradient(C, C, 0, C, C, 60);
  cg.addColorStop(0, 'rgba(255,255,255,1)');
  cg.addColorStop(0.25, 'rgba(160,240,255,0.8)');
  cg.addColorStop(1, 'rgba(60,180,255,0)');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(C, C, 60, 0, TAU); ctx.fill();
  // faint sparkle points at the branch tips
  for (let i = 0; i < 90; i++) {
    const a = rng.range(0, TAU), r = rng.range(60, 490);
    const x = C + Math.cos(a) * r, y = C + Math.sin(a) * r, s = rng.range(0.8, 2.2);
    ctx.fillStyle = css('#dff8ff', rng.range(0.3, 0.8));
    ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // alpha mirrors luminance; rgb keeps the brightness
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const m = Math.max(d[i], d[i + 1], d[i + 2]);
    d[i + 3] = m;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// Hokusai breaking wave crest (alpha blend)
// ---------------------------------------------------------------------------
export function waveCurl(seed) {
  const S = 512;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  const U = (pts) => pts.map(([x, y]) => [x * S, y * S]);
  const INK = '#16204e';
  // back of the wave rising from bottom-left, cresting, and hooking back in at the lip
  const outer = catmull(U([[-0.02, 1.02], [0.03, 0.8], [0.11, 0.58], [0.23, 0.38], [0.38, 0.21], [0.54, 0.11], [0.68, 0.085], [0.79, 0.14], [0.855, 0.26], [0.85, 0.39], [0.8, 0.485], [0.725, 0.525]]), 10);
  // underside of the lip, round the hollow tube and down the front face
  const inner = catmull(U([[0.725, 0.525], [0.728, 0.46], [0.705, 0.385], [0.645, 0.315], [0.555, 0.3], [0.47, 0.355], [0.41, 0.475], [0.38, 0.65], [0.39, 0.83], [0.43, 1.02]]), 10);
  const body = pathOf(outer.concat(inner.slice(1)), true);
  const nO = outer.length;
  const scallop = (base, amp, freq) => (t) => base * (1 + amp * Math.abs(Math.sin(t * freq * Math.PI)));

  ctx.lineJoin = 'round';
  ctx.strokeStyle = css(INK);
  ctx.lineWidth = 8;
  ctx.stroke(body);
  ctx.fillStyle = css('#1d4f91');
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  // colour bands following the back of the wave (left normal points into the body)
  ctx.fillStyle = css('#2f7fc8');
  ctx.fill(ribbon(offsetPts(outer.slice(6), 0.055 * S), scallop(0.13 * S, 0.22, 8), { taperA: 0.3, taperB: 0.05 }).path);
  ctx.fillStyle = css('#7cc4ef');
  ctx.fill(ribbon(offsetPts(outer.slice(Math.floor(nO * 0.38)), 0.022 * S), scallop(0.05 * S, 0.45, 9), { taperA: 0.35, taperB: 0.02 }).path);
  // under the curl
  ctx.fillStyle = css('#2f7fc8');
  ctx.fill(ribbon(offsetPts(inner.slice(0, 36), 0.02 * S), scallop(0.05 * S, 0.3, 5), { taperA: 0.02, taperB: 0.6 }).path);
  // flow striations
  for (let k = 0; k < 10; k++) {
    const off = 0.045 * S + k * 0.021 * S;
    const from = 2 + k, to = nO - 14 - k * 2;
    if (to - from < 8) continue;
    const pts = offsetPts(outer.slice(from, to), off);
    const light = k % 2 === 0;
    ctx.fillStyle = css(light ? '#a8dcf7' : '#123a74', light ? 0.9 : 0.85);
    ctx.fill(ribbon(pts, light ? 2.6 : 2.2, { taperA: 0.3, taperB: 0.3 }).path);
  }
  // white foam riding the crest
  ctx.fillStyle = css('#ffffff');
  ctx.fill(ribbon(outer.slice(Math.floor(nO * 0.5)), scallop(0.034 * S, 1.1, 12), { taperA: 0.3, taperB: 0 }).path);
  ctx.restore();

  // foam claws curling off the lip
  const lip = outer.slice(Math.floor(nO * 0.6)).concat(inner.slice(1, 12));
  const claws = [];
  const nC = 11;
  for (let i = 0; i < nC; i++) {
    const t = (i + 0.4) / nC;
    const k = Math.min(lip.length - 2, Math.floor(t * (lip.length - 1)));
    const p = lip[k], q = lip[k + 1];
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const ox = Math.sin(ang), oy = -Math.cos(ang); // outward (away from the body)
    const len = rng.range(0.075, 0.115) * S * (1.05 - Math.abs(t - 0.45) * 0.6);
    const a0 = Math.atan2(oy, ox);
    const pts = [];
    for (let j = 0; j <= 16; j++) {
      const s2 = j / 16;
      const a = a0 + 2.8 * s2 * s2;
      const r = len * (s2 < 0.75 ? s2 : 0.75 + (s2 - 0.75) * 0.4);
      pts.push([p[0] - ox * 5 + Math.cos(a0) * r * 0.9 + Math.cos(a) * r * 0.3, p[1] - oy * 5 + Math.sin(a0) * r * 0.9 + Math.sin(a) * r * 0.3]);
    }
    claws.push({ rib: ribbon(pts, (s2) => 0.034 * S * (1 - s2 * 0.75), { taperA: 0, taperB: 0.3, pow: 0.6 }), pts });
  }
  ctx.strokeStyle = css(INK);
  ctx.lineWidth = 6;
  for (const cl of claws) ctx.stroke(cl.rib.path);
  ctx.fillStyle = css('#ffffff');
  for (const cl of claws) ctx.fill(cl.rib.path);
  for (const cl of claws) {
    ctx.save();
    ctx.clip(cl.rib.path);
    ctx.fillStyle = css('#bfe3f8');
    ctx.fill(ribbon(offsetPts(cl.pts, 0.012 * S), (s2) => 0.014 * S * (1 - s2), { taperA: 0.1, taperB: 0.3 }).path);
    ctx.restore();
  }
  // spray
  for (let i = 0; i < 26; i++) {
    const p = lip[Math.floor(rng.range(0, 1) * (lip.length - 1))];
    const r = rng.range(2.5, 7.5);
    const x = p[0] + rng.range(-12, 44), y = p[1] + rng.range(-36, 44);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = css('#ffffff');
    ctx.strokeStyle = css(INK);
    ctx.lineWidth = 2.4;
    ctx.stroke(); ctx.fill();
  }
  return c;
}

// ---------------------------------------------------------------------------
// Radial water splash (alpha blend)
// ---------------------------------------------------------------------------
export function splash(seed) {
  const S = 512, C = S / 2;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  const INK = '#1b3a6b';
  const shapes = [];
  const shades = [];
  const coreR = 72;
  const core = catmull(blobPts(C, C, coreR, rng, { n: 14, amp: 0.16, harmonics: 5 }), 4, true);
  shapes.push(pathOf(core, true));
  shades.push(pathOf(catmull(blobPts(C + 4, C + 6, coreR * 0.62, rng, { n: 12, amp: 0.2 }), 4, true), true));
  const nS = 20;
  for (let i = 0; i < nS; i++) {
    const a = (i / nS) * TAU + rng.range(-0.1, 0.1);
    const L = (i % 2 ? rng.range(120, 170) : rng.range(170, 232)) * (0.85 + 0.15 * Math.sin(a * 2 + 1));
    const wb = rng.range(26, 38);
    const bend = rng.range(-0.12, 0.12);
    const pts = [];
    for (let j = 0; j <= 16; j++) {
      const s = j / 16;
      const r = coreR * 0.5 + (L - coreR * 0.5) * s;
      const aa = a + bend * s * s;
      pts.push([C + Math.cos(aa) * r, C + Math.sin(aa) * r]);
    }
    const spike = ribbon(pts, (s) => wb * Math.pow(1 - s, 0.85) * (1 + 0.25 * Math.sin(s * 9)), { taperA: 0, taperB: 0.08, pow: 1 });
    shapes.push(spike.path);
    shades.push(ribbon(offsetPts(pts.slice(2, 12), wb * 0.18), (s) => wb * 0.32 * (1 - s), { taperA: 0.2, taperB: 0.3 }).path);
    // bulb at the spike tip
    {
      const tp = pts[13];
      const p = new Path2D();
      p.ellipse(tp[0], tp[1], wb * 0.3, wb * 0.24, a, 0, TAU);
      shapes.push(p);
    }
    if (rng.chance(0.7)) {
      const r = L + rng.range(14, 34), dr = rng.range(5, 10);
      const p = new Path2D();
      p.ellipse(C + Math.cos(a) * r, C + Math.sin(a) * r, dr * 1.5, dr, a, 0, TAU);
      shapes.push(p);
    }
  }
  for (let i = 0; i < 30; i++) {
    const a = rng.range(0, TAU), r = rng.range(90, 240), dr = rng.range(2.5, 7);
    const p = new Path2D();
    p.ellipse(C + Math.cos(a) * r, C + Math.sin(a) * r, dr * rng.range(1, 1.8), dr, a, 0, TAU);
    shapes.push(p);
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = css(INK);
  ctx.lineWidth = 6;
  for (const p of shapes) ctx.stroke(p);
  ctx.fillStyle = css('#f4fbff');
  for (const p of shapes) ctx.fill(p);
  ctx.save();
  const clip = new Path2D();
  for (const p of shapes) clip.addPath(p);
  ctx.clip(clip);
  ctx.fillStyle = css('#9fd8f5');
  for (const p of shades) ctx.fill(p);
  ctx.fillStyle = css('#5fb2e6');
  ctx.beginPath();
  ctx.ellipse(C + 6, C + 10, coreR * 0.34, coreR * 0.28, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  // ripple ring lines inside the core
  ctx.strokeStyle = css(INK, 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(C + 2, C + 4, coreR * 0.78, coreR * 0.7, 0, 3.6, 5.6); ctx.stroke();
  ctx.fillStyle = css('#ffffff');
  ctx.beginPath(); ctx.ellipse(C - 18, C - 20, 10, 6, -0.6, 0, TAU); ctx.fill();
  return c;
}

// ---------------------------------------------------------------------------
// Ukiyo-e flame tongue (alpha blend, tip at the top)
// ---------------------------------------------------------------------------
export function flame(seed) {
  const W = 256, H = 512;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(W, H);
  // contour: [x, y, bulge] -- quadratic segments bowing by `bulge` (px, + = to the left of travel)
  const K = [
    [128, 502, 0], [56, 480, -10], [26, 420, -8], [34, 360, -6], [16, 282, 18], [62, 322, 10], [48, 150, 26], [100, 222, 14],
    [128, 22, 30], [158, 190, 12], [210, 100, 22], [190, 258, 10], [240, 248, 14], [222, 336, -6], [230, 410, -8], [202, 478, -10],
  ];
  const flamePath = (sx = 1, sy = 1, ox = 128, oy = 470) => {
    const pts = K.map(([x, y, b]) => [ox + (x - ox) * sx, oy + (y - oy) * sy, b * Math.min(sx, sy)]);
    const p = new Path2D();
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      const bul = b[2];
      p.quadraticCurveTo(mx + (dy / l) * bul, my - (dx / l) * bul, b[0], b[1]);
    }
    p.closePath();
    return p;
  };
  const outer = flamePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = css('#4e0606');
  ctx.lineWidth = 9;
  ctx.stroke(outer);
  ctx.fillStyle = css('#c01a16');
  ctx.fill(outer);
  ctx.save();
  ctx.clip(outer);
  const layers = [[0.78, 0.8, '#ec6a1c'], [0.56, 0.6, '#ffc832'], [0.3, 0.34, '#fff4b0']];
  for (const [sx, sy, col] of layers) {
    const p = flamePath(sx, sy, 128, 480);
    ctx.strokeStyle = css('#8a1a0a');
    ctx.lineWidth = 3.4;
    ctx.stroke(p);
    ctx.fillStyle = css(col);
    ctx.fill(p);
  }
  // inner flow lines
  ctx.strokeStyle = css('#8a1a0a', 0.8);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1, x2, y2] of [[70, 440, 60, 330, 80, 250], [186, 440, 200, 340, 180, 260], [110, 430, 100, 330, 122, 200]]) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x1, y1, x2, y2); ctx.stroke();
  }
  ctx.restore();
  // detached wisps / embers floating outside the body
  let placed = 0;
  for (let tries = 0; tries < 200 && placed < 5; tries++) {
    const x = rng.range(24, 232), y = rng.range(20, 330);
    const s = rng.range(8, 15);
    if (ctx.isPointInPath(outer, x, y) || ctx.isPointInPath(outer, x, y + s * 1.8) || ctx.isPointInPath(outer, x, y - s * 2)) continue;
    if (ctx.isPointInPath(outer, x + s * 1.5, y) || ctx.isPointInPath(outer, x - s * 1.5, y)) continue;
    const i = placed++;
    const p = new Path2D();
    p.moveTo(x, y - s * 1.6);
    p.quadraticCurveTo(x + s * 0.9, y - s * 0.2, x + s * 0.4, y + s * 0.5);
    p.quadraticCurveTo(x, y + s * 0.8, x - s * 0.4, y + s * 0.5);
    p.quadraticCurveTo(x - s * 0.7, y - s * 0.2, x, y - s * 1.6);
    ctx.lineWidth = 4;
    ctx.strokeStyle = css('#4e0606');
    ctx.stroke(p);
    ctx.fillStyle = css(i % 2 ? '#ec6a1c' : '#c01a16');
    ctx.fill(p);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Sumi-ink smoke puff (alpha blend)
// ---------------------------------------------------------------------------
export function smoke(seed) {
  const S = 256, CX = 128, CY = 140;
  const rng = makeRng(seed);
  const { c, ctx } = canvas2d(S, S);
  const puffs = [[CX, CY, 58]];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI + rng.range(-0.12, 0.12); // upper arc: puffy top
    const r = rng.range(56, 66);
    puffs.push([CX + Math.cos(a) * r * 1.2, CY + Math.sin(a) * r * 0.85, rng.range(30, 42)]);
  }
  puffs.push([CX - 58, CY + 30, 32], [CX + 60, CY + 28, 30], [CX - 18, CY + 44, 30], [CX + 22, CY + 44, 30]);
  const paths = puffs.map(([x, y, r]) => pathOf(catmull(blobPts(x, y, r, rng, { n: 12, amp: 0.08 }), 3, true), true));
  const clip = new Path2D();
  for (const p of paths) clip.addPath(p);
  // wet bleed around the outside
  ctx.lineJoin = 'round';
  for (const [lw, a] of [[24, 0.14], [14, 0.3]]) {
    ctx.strokeStyle = css('#26262c', a);
    ctx.lineWidth = lw;
    for (const p of paths) ctx.stroke(p);
  }
  ctx.strokeStyle = css('#18181c');
  ctx.lineWidth = 5.5;
  for (const p of paths) ctx.stroke(p);
  ctx.fillStyle = css('#5c5c64');
  for (const p of paths) ctx.fill(p);
  ctx.save();
  ctx.clip(clip);
  const vg = ctx.createLinearGradient(0, CY - 90, 0, CY + 80);
  vg.addColorStop(0, 'rgba(140,140,150,0.55)');
  vg.addColorStop(0.55, 'rgba(90,90,98,0.1)');
  vg.addColorStop(1, 'rgba(24,24,28,0.6)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, S, S);
  // puff lobe lines on the upper side only (ukiyo-e cloud stylisation)
  ctx.lineCap = 'round';
  for (const [x, y, r] of puffs.slice(1, n + 1)) {
    ctx.strokeStyle = css('#26262c', 0.55);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.98, Math.PI * 1.1, Math.PI * 1.75);
    ctx.stroke();
    ctx.strokeStyle = css('#a8a8b2', 0.45);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - 2, y + 2, r * 0.78, Math.PI * 1.15, Math.PI * 1.6);
    ctx.stroke();
  }
  // a couple of curling wisps
  for (let i = 0; i < 3; i++) {
    const [x, y, r] = puffs[rng.int(1, n)];
    const pts = [];
    const dir = rng.sign(), a0 = rng.range(0, TAU);
    for (let k = 0; k <= 24; k++) {
      const t = k / 24;
      const a = a0 + dir * t * 1.2 * TAU;
      pts.push([x + Math.cos(a) * r * 0.5 * (1 - t * 0.75), y + 6 + Math.sin(a) * r * 0.5 * (1 - t * 0.75)]);
    }
    ctx.fillStyle = css('#1e1e24', 0.75);
    ctx.fill(ribbon(pts, 3.2, { taperA: 0.3, taperB: 0.4 }).path);
  }
  grain(ctx, S, S, 0.3, 'overlay');
  ctx.restore();
  // feather the silhouette slightly
  ctx.globalCompositeOperation = 'destination-in';
  const g = ctx.createRadialGradient(CX, CY, 40, CX, CY, 132);
  g.addColorStop(0, 'rgba(0,0,0,0.96)');
  g.addColorStop(0.75, 'rgba(0,0,0,0.88)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

// ---------------------------------------------------------------------------
// Soft blob shadow
// ---------------------------------------------------------------------------
export function shadow() {
  const S = 128, C = 64;
  const { c, ctx } = canvas2d(S, S);
  const g = ctx.createRadialGradient(C, C, 0, C, C, C);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const a = 0.6 * Math.pow(1 - t, 1.6) * (1 - t * t * 0.3);
    g.addColorStop(t, `rgba(0,0,0,${a.toFixed(4)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return c;
}
