#!/usr/bin/env node
// Frame-exact trailer capture. Headless Chrome (GPU) renders /trailer/ one virtual-clock frame at a time,
// screenshots (canvas + DOM HUD + title cards) stream into ffmpeg, then the two soundtrack stems are rendered
// offline in the page and mixed, levelled and muxed with ffmpeg.
//
//   pnpm dev                                      (dev server on :5190, in another terminal)
//   node trailer/capture.mjs                      1080p60 → trailer/out/trailer.mp4
//   node trailer/capture.mjs --preview            540p30 draft of the same simulation
//   node trailer/capture.mjs --from 12 --to 20    a range, in seconds
//   node trailer/capture.mjs --stills 3.2,10.5    PNG stills only
//   node trailer/capture.mjs --sheet 0.5          contact sheets, one thumbnail every 0.5 s
//   --scale 2                                     render at 2x and downscale (supersampled edges)
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2);
  const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  args[k] = v;
}

const FPS = 60;
const W = 1920;
const H = 1080;
const URL = args.url || 'http://localhost:5190/trailer/';
const preview = !!args.preview;
const scale = +(args.scale ?? (preview ? 0.5 : 1));
const outFps = +(args.fps ?? (preview ? 30 : 60));
const every = Math.max(1, Math.round(FPS / outFps));
const outDir = path.resolve(args.dir || 'trailer/out');
const name = args.name || (preview ? 'preview' : 'trailer');
fs.mkdirSync(outDir, { recursive: true });

const log = (...m) => console.log(`[capture ${new Date().toLocaleTimeString()}]`, ...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ffmpeg(argsList, opts = {}) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argsList], { encoding: 'utf8', ...opts });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);
  return r;
}

const browser = await chromium.launch({
  channel: args.channel || 'chrome',
  headless: !args.headed,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--hide-scrollbars'],
});
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`  [page ${m.type()}]`, m.text().slice(0, 300));
});
page.on('pageerror', (e) => console.log('  [page exception]', String(e).slice(0, 500)));
await page.addInitScript(() => {
  window.__VCLOCK_MANUAL = true;
});
log(`loading ${URL} (scale ${scale})`);
await page.goto(URL, { waitUntil: 'domcontentloaded' });

// boot: pump the virtual clock until the game has reached its title screen and the fonts are in
for (let i = 0; ; i++) {
  const ok = await page.evaluate(() => {
    if (!window.__vclock) return false;
    window.__vclock.advance(1000 / 60);
    return !!(window.__trailer && window.__trailer.ready);
  });
  if (ok) break;
  if (i > 20000) throw new Error('trailer page never became ready');
  await sleep(i < 50 ? 20 : 2);
}
const renderer = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const e = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
log('ready; GPU:', renderer);

const duration = await page.evaluate(() => window.__trailer.duration);
const from = Math.round((+args.from || 0) * FPS);
const to = Math.min(Math.round((args.to != null ? +args.to : duration) * FPS), Math.round(duration * FPS));
const cdp = await context.newCDPSession(page);
const shot = async (format = 'jpeg', quality = 94) => {
  const r = await cdp.send('Page.captureScreenshot', format === 'png' ? { format } : { format, quality, optimizeForSpeed: true });
  return Buffer.from(r.data, 'base64');
};
const step = () => page.evaluate(() => window.__vclock.advance(1000 / 60));

await page.evaluate((f) => window.__trailer.begin(f), from);

// ---------------------------------------------------------------- stills / contact sheets
if (args.stills || args.sheet) {
  const times = args.stills
    ? String(args.stills).split(',').map(Number).sort((a, b) => a - b)
    : Array.from({ length: Math.floor((to - from) / FPS / +args.sheet) }, (_, i) => from / FPS + i * +args.sheet);
  const dir = path.join(outDir, args.stills ? 'stills' : 'sheet');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let f = from;
  let n = 0;
  for (const t of times) {
    const target = Math.round(t * FPS);
    while (f <= target) {
      await step();
      f++;
    }
    const buf = await shot(args.stills ? 'png' : 'jpeg', 88);
    const file = path.join(dir, args.stills ? `still_${t.toFixed(2)}.png` : `t_${String(n).padStart(4, '0')}.jpg`);
    fs.writeFileSync(file, buf);
    n++;
  }
  if (args.sheet) {
    const cols = 6;
    const rows = 5;
    ffmpeg(['-framerate', '1', '-i', path.join(dir, 't_%04d.jpg'), '-vf', `scale=400:-1,tile=${cols}x${rows}:padding=4`, path.join(dir, 'sheet_%02d.jpg')]);
  }
  log(`wrote ${n} images to ${dir}`);
  await browser.close();
  process.exit(0);
}

// ---------------------------------------------------------------- video
const videoFile = path.join(outDir, `${name}.video.mp4`);
const vf = [];
if (scale !== 1 && !preview) vf.push(`scale=${W}:${H}:flags=lanczos`);
const enc = spawn(
  'ffmpeg',
  [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(outFps), '-c:v', 'mjpeg', '-i', '-',
    ...(vf.length ? ['-vf', vf.join(',')] : []),
    '-c:v', 'libx264', '-preset', preview ? 'veryfast' : 'slow', '-crf', preview ? '23' : '15',
    '-pix_fmt', 'yuv420p', '-r', String(outFps), '-movflags', '+faststart', videoFile,
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] },
);
const encDone = new Promise((res, rej) => enc.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
const write = (buf) => new Promise((res) => (enc.stdin.write(buf) ? res() : enc.stdin.once('drain', res)));

const t0 = Date.now();
let captured = 0;
for (let f = from; f < to; f++) {
  await step();
  if ((f - from) % every !== 0) continue;
  await write(await shot('jpeg', preview ? 85 : 95));
  captured++;
  if (captured % (outFps * 2) === 0) {
    const el = (Date.now() - t0) / 1000;
    const done = (f - from + 1) / (to - from);
    log(`${(f / FPS).toFixed(1)}s / ${(to / FPS).toFixed(1)}s  ${(el / captured * 1000).toFixed(0)} ms/frame  eta ${Math.round(el / done - el)}s`);
  }
}
enc.stdin.end();
await encDone;
log(`video: ${captured} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${videoFile}`);

if (args['no-audio']) {
  await browser.close();
  process.exit(0);
}

// ---------------------------------------------------------------- soundtrack stems
const mix = await page.evaluate(() => window.__trailer.tl.mix || {});
for (const stem of ['music', 'sfx']) {
  const info = await page.evaluate((s) => window.__trailer.renderAudio({ stem: s }), stem);
  const size = 4 << 20;
  const parts = [];
  for (let i = 0; i * size < info.bytes; i++) parts.push(Buffer.from(await page.evaluate((k) => window.__trailer.audioChunk(k), i), 'base64'));
  fs.writeFileSync(path.join(outDir, `${stem}.wav`), Buffer.concat(parts));
  log(`${stem} stem: peak ${info.stats.peak.toFixed(3)}${info.stats.plays != null ? `, ${info.stats.plays} sounds` : ''}`);
}
await browser.close();

// mix: stems at their gains → limiter → two-pass loudness normalisation → AAC, muxed with the video
const ss = (from / FPS).toFixed(4);
const len = ((to - from) / FPS).toFixed(4);
const mixFile = path.join(outDir, `${name}.mix.wav`);
const target = mix.lufs ?? -14;
const pre = `[0:a]atrim=start=${ss}:duration=${len},asetpts=N/SR/TB,volume=${mix.music ?? 0.6}[m];[1:a]atrim=start=${ss}:duration=${len},asetpts=N/SR/TB,volume=${mix.sfx ?? 1}[s];[m][s]amix=inputs=2:normalize=0:duration=longest,aresample=192000,alimiter=limit=0.8:attack=2:release=80:level=disabled,aresample=48000[a]`;
ffmpeg(['-i', path.join(outDir, 'music.wav'), '-i', path.join(outDir, 'sfx.wav'), '-filter_complex', pre, '-map', '[a]', '-c:a', 'pcm_f32le', mixFile]);
const m1 = spawnSync('ffmpeg', ['-hide_banner', '-i', mixFile, '-af', `loudnorm=I=${target}:TP=-1.5:LRA=14:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
const js = JSON.parse(m1.stderr.slice(m1.stderr.lastIndexOf('{'), m1.stderr.lastIndexOf('}') + 1));
log(`mix loudness ${js.input_i} LUFS, true peak ${js.input_tp} dBTP → ${target} LUFS`);
const ln = `loudnorm=I=${target}:TP=-1.5:LRA=14:measured_I=${js.input_i}:measured_TP=${js.input_tp}:measured_LRA=${js.input_lra}:measured_thresh=${js.input_thresh}:offset=${js.target_offset}:linear=true`;
const finalFile = path.join(outDir, `${name}.mp4`);
ffmpeg(['-i', videoFile, '-i', mixFile, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', `${ln},aresample=48000`, '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', finalFile]);
log(`done → ${finalFile}`);
