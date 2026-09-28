// Mobile check: screenshots of every screen at phone / tablet sizes, and a touch test that drives the
// on-screen controls with real multi-touch events (Chrome DevTools protocol) and checks the results.
// Needs `pnpm dev` running (or BASE=<url>). Output: tests/out/mobile/.
//
//   node tests/mobile.mjs shots <device> [title menu select controls settings loading fight finisher pause result boss moon]
//   node tests/mobile.mjs touch <device>
//   node tests/mobile.mjs bars               (iPhone Safari: the swipe-up prompt that tucks the browser bars away)
//
// devices: se ip14 safari14 pixel small ipad desk portrait
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'mobile');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:5190/';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const DEVICES = {
  se: { width: 667, height: 375, ua: IPHONE },
  ip14: { width: 844, height: 390, ua: IPHONE },
  safari14: { width: 750, height: 342, ua: IPHONE }, // iPhone 14 in Safari with the toolbar showing
  pixel: { width: 915, height: 412, ua: ANDROID },
  small: { width: 640, height: 320, ua: ANDROID },
  ipad: { width: 1180, height: 820, ua: IPHONE },
  desk: { width: 1440, height: 900, ua: null, desktop: true },
  portrait: { width: 390, height: 844, ua: IPHONE },
};

const [, , cmd = 'shots', devArg, ...rest] = process.argv;
// the bars check always runs as an iPhone 14 in Safari: bars shown = the viewport is shorter than the screen
const devName = cmd === 'bars' ? 'safari14' : devArg || 'ip14';
const dev = DEVICES[devName];
if (!dev) {
  console.error(`unknown device "${devName}"; one of: ${Object.keys(DEVICES).join(' ')}`);
  process.exit(2);
}
const dpr = Number(process.env.DPR || 1);

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--hide-scrollbars'],
});
const context = await browser.newContext({
  viewport: { width: dev.width, height: dev.height },
  ...(cmd === 'bars' ? { screen: { width: 844, height: 390 } } : {}),
  deviceScaleFactor: dpr,
  isMobile: !dev.desktop,
  hasTouch: !dev.desktop,
  userAgent: dev.ua || undefined,
});
// Keep the test browser off the real screen: on macOS a pointer lock grabs the system cursor even from a
// headless browser, and a fullscreen or orientation request can take over a display. Counted, never made.
await context.addInitScript(() => {
  const calls = (window.__sysCalls = { lock: 0, fullscreen: 0, orientation: 0 });
  const none = (k) => function () {
    calls[k]++;
    return Promise.resolve();
  };
  Element.prototype.requestPointerLock = none('lock');
  Element.prototype.requestFullscreen = none('fullscreen');
  if ('webkitRequestFullscreen' in Element.prototype) Element.prototype.webkitRequestFullscreen = none('fullscreen');
  Document.prototype.exitPointerLock = function () {};
  try {
    if (screen.orientation) screen.orientation.lock = none('orientation');
  } catch (_) { /* read-only here */ }
});
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 300));
});
page.on('pageerror', (e) => errors.push('EXC ' + String(e).slice(0, 400)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  const f = path.join(OUT, `${devName}-${name}.png`);
  await page.screenshot({ path: f });
  console.log('shot', f);
};
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, ms = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await ev(fn)) return true;
    await sleep(100);
  }
  throw new Error('timeout waiting for ' + fn);
};
/** Advance the simulation n seconds quickly (frozen stepping), then run live again. */
const skip = (sec) => ev((s) => {
  const g = window.__game;
  g.frozen = true;
  g.debugStep(Math.round(s * 60));
  g.frozen = false;
}, sec);

async function load(query = '') {
  await page.goto(BASE + query, { waitUntil: 'domcontentloaded' });
  await waitFor(() => window.__game && window.__game.state !== 'loading' && document.fonts.status === 'loaded');
  await sleep(600);
}

const cdp = await context.newCDPSession(page);
const touch = {
  pts: new Map(),
  async send(type) {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...this.pts.values()] });
  },
  async down(id, x, y) {
    this.pts.set(id, { x, y, id, radiusX: 8, radiusY: 8, force: 1 });
    await this.send('touchStart');
  },
  async move(id, x, y) {
    const p = this.pts.get(id);
    p.x = x;
    p.y = y;
    await this.send('touchMove');
  },
  async up(id) {
    this.pts.delete(id);
    await this.send('touchEnd');
  },
  async drag(id, x0, y0, x1, y1, ms = 300, steps = 12) {
    await this.down(id, x0, y0);
    for (let i = 1; i <= steps; i++) {
      await this.move(id, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
      await sleep(ms / steps);
    }
  },
  async tap(id, x, y, hold = 60) {
    await this.down(id, x, y);
    await sleep(hold);
    await this.up(id);
  },
};
const btn = (a) => ev((a) => {
  const el = document.querySelector(`.ic-layer--touch [data-a="${a}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, vis: getComputedStyle(el).opacity };
}, a);

if (cmd === 'shots') {
  const want = rest.length ? rest : ['title', 'menu', 'select', 'controls', 'settings', 'loading', 'fight', 'boss', 'pause', 'result', 'defeat'];
  const q = dev.desktop ? '?' : '?touch=1';
  await load(q);
  if (want.includes('title')) await shot('title');
  if (want.includes('menu')) {
    await ev(() => window.__game.ui.showMenu());
    await sleep(900);
    await shot('menu');
  }
  if (want.includes('select')) {
    await ev(() => window.__game.ui.showCharacterSelect('story'));
    await sleep(1200);
    await shot('select');
    for (const [i, id] of [[1, 'giyu'], [2, 'rengoku'], [3, 'obanai'], [4, 'sanemi'], [5, 'gyomei']]) {
      await ev((k) => window.__game.ui.screens.select.select(k, null), i);
      await sleep(700);
      await shot('select-' + id);
    }
  }
  if (want.includes('controls')) {
    await ev(() => {
      const ui = window.__game.ui;
      ui.showMenu();
      ui._openSub('controls');
    });
    await sleep(1000);
    await shot('controls');
  }
  if (want.includes('settings')) {
    await ev(() => {
      const ui = window.__game.ui;
      ui.showMenu();
      ui._openSub('settings');
    });
    await sleep(1000);
    await shot('settings');
  }
  if (want.includes('loading')) {
    await ev(() => window.__game.ui.showLoading(0.46, '描繪紙門與燈籠……'));
    await sleep(900);
    await shot('loading');
    await ev(() => window.__game.ui.hideLoading());
  }
  if (want.some((w) => ['fight', 'pause', 'result', 'defeat'].includes(w))) {
    await load(q + '&play=tanjiro&mode=story');
    await skip(17);
    await sleep(400);
    await skip(3);
    await ev(() => {
      const g = window.__game;
      g.combo.count = 12;
      g.combo.timer = 3;
      g.player.conc = g.player.maxConc;
      g.player.breath = 55;
    });
    await sleep(900);
    await shot('fight');
    if (want.includes('pause')) {
      await ev(() => window.__game.pause());
      await sleep(900);
      await shot('pause');
      await ev(() => window.__game.ui.screens.pause.dialog.ask('重新開始', '確定要重新開始嗎？目前的戰鬥進度將會遺失。', () => {}));
      await sleep(500);
      await shot('pause-confirm');
      await ev(() => window.__game.ui.screens.pause.dialog.close());
      await ev(() => window.__game.resume());
    }
    if (want.includes('result')) {
      await ev(() => window.__game.gameOver(true));
      await sleep(3200);
      await shot('result');
    }
  }
  if (want.includes('finisher')) {
    await load(q + '&play=tanjiro&mode=story');
    await skip(17);
    await ev(() => {
      const g = window.__game;
      g.player.control = false;
      g.hud.prompt('斬首', '左鍵');
    });
    await sleep(900);
    await shot('finisher');
  }
  if (want.includes('boss')) {
    await load(q + '&play=giyu&mode=boss');
    await skip(13.5);
    await sleep(300);
    await skip(4);
    await sleep(4500);
    await shot('boss');
  }
  // Kokushibo: the select screen in his mode, and the fight (violet boss bar, crescents in the air)
  if (want.includes('moon')) {
    await load(q);
    await ev(() => window.__game.ui.showCharacterSelect('kokushibo'));
    await sleep(1200);
    await shot('select-kokushibo');
    await load(q + '&play=obanai&mode=kokushibo&seed=3');
    await skip(15);
    await sleep(300);
    // (a player standing still would not last long)
    await ev(() => (window.__game.player.god = true));
    await skip(3.4);
    await sleep(4500);
    await shot('moon');
  }
}

if (cmd === 'touch') {
  const checks = [];
  const check = (name, ok, info = '') => {
    checks.push({ name, ok: !!ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
  };
  // no ?touch parameter: the phone context itself must switch the touch layout on
  await load('?play=tanjiro&mode=boss');
  const auto = await ev(() => ({ touch: window.__game.input.touchMode, active: window.__game.ui.touch.active, rs: window.__game.settings.renderScale }));
  check('auto-detects a touch screen', auto.touch && auto.active && auto.rs === 'auto', JSON.stringify(auto));
  await skip(13.5);
  await sleep(300);
  // freeze the demons so the controls can be checked in isolation
  await ev(() => {
    const g = window.__game;
    const f = () => {
      g.enemyTimeScale = 0;
      requestAnimationFrame(f);
    };
    f();
  });
  await skip(2);
  await sleep(300);
  const st = () => ev(() => {
    const g = window.__game;
    const p = g.player;
    return { state: p.state, move: p.curMove, x: p.pos.x, z: p.pos.z, speed: p.speed || 0, yaw: g.cameraRig.yaw, lock: !!p.lockTarget, gs: g.state, ui: g.ui.active, layer: g.ui.touch.active };
  });
  const W = dev.width, H = dev.height;
  const lockBtn = await btn('lock');
  // release the director's lock-on so the camera only follows the finger
  if ((await st()).lock) await touch.tap(8, lockBtn.x, lockBtn.y);
  await sleep(150);

  // 1. stick: walk, then push past the ring to sprint
  let a = await st();
  await touch.drag(1, W * 0.16, H * 0.72, W * 0.16, H * 0.72 - 50, 150);
  await sleep(1000);
  let b = await st();
  check('stick walks', Math.hypot(b.x - a.x, b.z - a.z) > 1 && b.speed > 2, `moved ${Math.hypot(b.x - a.x, b.z - a.z).toFixed(2)} m at ${b.speed.toFixed(1)} m/s`);
  await touch.move(1, W * 0.16, H * 0.72 - 120);
  await sleep(700);
  b = await st();
  check('stick past the ring sprints', b.speed > 7.5, `${b.speed.toFixed(1)} m/s`);
  await shot('touch-sprint');
  // 2. second finger turns the camera while the first keeps moving
  a = await st();
  await touch.drag(2, W * 0.62, H * 0.4, W * 0.62 - 160, H * 0.4, 400);
  await touch.up(2);
  b = await st();
  await touch.up(1);
  check('right-side drag turns the camera (while moving)', Math.abs(b.yaw - a.yaw) > 0.3, `yaw ${a.yaw.toFixed(2)} -> ${b.yaw.toFixed(2)}`);
  await sleep(700);
  // a thumb put down right at the bottom edge and held still must not walk (the stick centres under it)
  a = await st();
  await touch.down(12, W * 0.08, H - 8);
  await sleep(700);
  b = await st();
  await touch.up(12);
  check('a still thumb at the screen edge does not walk', Math.hypot(b.x - a.x, b.z - a.z) < 0.15, `moved ${Math.hypot(b.x - a.x, b.z - a.z).toFixed(2)} m`);
  // a resting thumb on the camera side keeps auto-follow from turning the view
  await touch.down(13, W * 0.62, H * 0.35);
  await touch.drag(14, W * 0.16, H * 0.72, W * 0.16 - 50, H * 0.72, 150);
  a = await st();
  await sleep(1500);
  b = await st();
  await touch.up(14);
  await touch.up(13);
  check('a resting camera thumb stops auto-follow', Math.abs(b.yaw - a.yaw) < 0.05, `yaw ${a.yaw.toFixed(2)} -> ${b.yaw.toFixed(2)}`);
  await sleep(500);
  // a key press switches to the keyboard layout; the touch that switches back must already drive the stick
  await page.keyboard.press('F9');
  await sleep(100);
  const km = await ev(() => ({ touch: window.__game.input.touchMode, layer: window.__game.ui.touch.active }));
  a = await st();
  await touch.drag(15, W * 0.16, H * 0.72, W * 0.16, H * 0.72 - 50, 150);
  await sleep(800);
  b = await st();
  await touch.up(15);
  check('a key press switches to keyboard, the next touch drives the stick', !km.touch && !km.layer && b.layer && Math.hypot(b.x - a.x, b.z - a.z) > 0.5, `keyboard ${!km.touch}, moved ${Math.hypot(b.x - a.x, b.z - a.z).toFixed(2)} m`);
  await sleep(700);
  // 3. buttons
  const press = async (id, a, hold = 60) => {
    const p = await btn(a);
    await touch.down(id, p.x, p.y);
    await sleep(hold);
  };
  await press(3, 'light');
  await touch.up(3);
  await sleep(120);
  b = await st();
  check('斬 = light attack', b.state === 'action' && /^light/.test(b.move), `${b.state}/${b.move}`);
  await sleep(800);
  await press(3, 'dodge');
  await touch.up(3);
  await sleep(120);
  b = await st();
  check('閃 = dodge', b.move === 'dodge', `${b.state}/${b.move}`);
  await sleep(800);
  await press(4, 'block', 300);
  b = await st();
  check('防 held = block', b.state === 'block', b.state);
  await shot('touch-block');
  await touch.up(4);
  await sleep(250);
  b = await st();
  check('防 released = guard drops', b.state === 'move', b.state);
  await press(5, 'heavy', 800);
  b = await st();
  check('重 held = charging', b.state === 'charge', b.state);
  await touch.up(5);
  await sleep(150);
  b = await st();
  check('重 released after 0.6 s = charged thrust', b.move === 'thrust', `${b.state}/${b.move}`);
  await sleep(1500);
  await ev(() => {
    const p = window.__game.player;
    p.breath = p.maxBreath;
    p.skillCd = p.skillCd.map(() => 0);
  });
  await sleep(200);
  await shot('touch-ready');
  await press(6, 'skill1');
  await touch.up(6);
  await sleep(150);
  b = await st();
  check('壹 = first breathing form', b.state === 'action' && b.move !== 'thrust', `${b.state}/${b.move}`);
  await sleep(2000);
  await ev(() => {
    const p = window.__game.player;
    p.conc = p.maxConc;
  });
  await sleep(300);
  await press(7, 'ult');
  await touch.up(7);
  await sleep(200);
  b = await st();
  check('奧 = ultimate', b.state === 'ult', b.state);
  await sleep(6000);
  // 4. lock-on: button toggles, a tap on the demon locks onto it
  a = await st();
  await touch.tap(8, lockBtn.x, lockBtn.y);
  await sleep(200);
  b = await st();
  check('鎖 toggles lock-on', a.lock !== b.lock, `${a.lock} -> ${b.lock}`);
  // (locked on, the camera swings to the demon; let it settle so the demon is on screen after unlocking)
  await sleep(1200);
  if ((await st()).lock) {
    await touch.tap(8, lockBtn.x, lockBtn.y);
    await sleep(300);
  }
  const bp = await ev(() => {
    const g = window.__game;
    return g.hud.project(g.boss.chest(g.camera.position.clone()));
  });
  if (bp.on) {
    await touch.tap(9, bp.x, bp.y);
    await sleep(200);
    b = await st();
  }
  check('tapping the demon locks onto it', bp.on && b.lock, bp.on ? '' : 'demon off screen');
  // 5. pause button, then resume from the menu with a tap
  const pz = await btn('pause');
  await touch.tap(10, pz.x, pz.y);
  await sleep(600);
  b = await st();
  check('pause button pauses and hides the controls', b.gs === 'paused' && b.ui === 'pause' && !b.layer, `${b.gs}/${b.ui}/${b.layer}`);
  await shot('touch-pause');
  const rsm = await ev(() => {
    const r = window.__game.ui.screens.pause.items[0].el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await touch.tap(11, rsm.x, rsm.y);
  await sleep(600);
  b = await st();
  check('tapping 繼續 resumes', b.gs === 'playing' && b.layer, `${b.gs}/${b.layer}`);
  // 6. leaving the app pauses
  await ev(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(200);
  b = await st();
  check('backgrounding the page pauses', b.gs === 'paused', b.gs);
  await ev(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    window.__game.resume();
  });
  await sleep(300);
  // 7. automatic resolution (fed synthetic frame times): slow frames lower it and headroom raises it again;
  //    nothing counts outside a run, a lone stall in a fluid run changes nothing, and a device too slow
  //    for 8 fps still steps down
  const drs = await ev(() => {
    const g = window.__game;
    const d = g._drs;
    const pr0 = d.pr;
    const feed = (ms, n) => {
      for (let i = 0; i < n; i++) g._drsTick(typeof ms === 'function' ? ms(i) : ms);
      return +d.pr.toFixed(3);
    };
    d.pr = 0.9;
    const slow = feed(40, 300);
    const fast = feed(12, 3000);
    d.pr = 0.9;
    const stall = feed((i) => (i % 150 === 75 ? 400 : 20), 1200);
    d.pr = 0.9;
    g.state = 'title';
    const menu = feed(40, 300);
    g.state = 'playing';
    d.pr = 0.9;
    const crawl = feed(220, 60);
    d.pr = pr0;
    g.resize();
    return { slow, fast, stall, menu, crawl };
  });
  check('auto resolution follows the frame rate', drs.slow < 0.9 && drs.fast > drs.slow && drs.stall === 0.9 && drs.menu === 0.9 && drs.crawl < 0.9, JSON.stringify(drs));
  // 8. frame cap: about 60 draws a second on 120 / 144 / 165 Hz screens (jittery vsync), none at 60 / 90 Hz
  const cap = await ev(() => {
    const g = window.__game;
    const out = {};
    const reset = () => {
      g._rafT = 0;
      g._rafP = 16.7;
      g._rafS.length = 0;
      g._frameT = 0;
    };
    for (const hz of [60, 90, 120, 144, 165]) {
      reset();
      let draws = 0;
      // vsync grid with 0.8 ms of timestamp jitter; the first second (period not measured yet) is not counted
      for (let i = 0; i < hz * 5; i++) {
        const t = 1000 + (i * 1000) / hz + (Math.random() - 0.5) * 0.8;
        if (!g._skipFrame(t)) {
          g._frameT = t;
          if (i >= hz) draws++;
        }
      }
      out[hz] = Math.round(draws / 4);
    }
    reset();
    return out;
  });
  const near = (v, want) => Math.abs(v - want) <= 2;
  check('frame cap paces 120/144/165 Hz, leaves 60/90 Hz alone', near(cap[60], 60) && near(cap[90], 90) && near(cap[120], 60) && near(cap[144], 72) && near(cap[165], 55), JSON.stringify(cap));
  // 9. a finger still down on the controls when the result screen opens must not press what is now under it
  const rsBtns = await ev(() => {
    const g = window.__game;
    g.gameOver(false);
    return true;
  });
  await sleep(1500);
  const target = await ev(() => {
    const it = window.__game.ui.screens.result.items.at(-1);
    const r = it.el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: it.el.textContent.trim() };
  });
  await load('?play=tanjiro&mode=boss');
  await skip(15.5);
  await sleep(300);
  await ev(() => {
    window.__acts = [];
    window.__game.ui._resultAction = (k) => window.__acts.push(k);
  });
  await touch.down(16, target.x, target.y);
  await ev(() => window.__game.gameOver(false));
  await sleep(80);
  await touch.up(16);
  await sleep(400);
  const acts = await ev(() => window.__acts);
  check('lifting a finger over the new result screen presses nothing', rsBtns && acts.length === 0, `finger on "${target.t}", actions ${JSON.stringify(acts)}`);
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  if (failed) process.exitCode = 1;
}

if (cmd === 'bars') {
  const checks = [];
  const check = (name, ok, info = '') => {
    checks.push({ name, ok: !!ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
  };
  const state = () => ev(() => {
    const el = document.querySelector('.ic-swipe');
    return { scroll: document.documentElement.classList.contains('ios-scroll'), prompt: !!el && !el.hidden, gs: window.__game.state, h: innerHeight };
  });
  const barsOut = () => page.setViewportSize({ width: 750, height: 342 });
  const barsAway = () => page.setViewportSize({ width: 844, height: 390 });
  await load('');
  let s = await state();
  check('iPhone Safari with its bars out: page scrolls, swipe prompt up', s.scroll && s.prompt, JSON.stringify(s));
  await shot('bars-prompt');
  // an upward swipe on the prompt scrolls the page (that is what tucks Safari's bars away)
  await touch.drag(1, 375, 250, 375, 90, 250);
  await touch.up(1);
  await sleep(300);
  const sy = await ev(() => window.scrollY);
  await barsAway();
  await sleep(300);
  s = await state();
  check('the swipe scrolls the page; bars tucked away hide the prompt', sy > 50 && !s.prompt, `scrollY ${sy}, ${JSON.stringify(s)}`);
  await ev(() => window.__game.startGame('story', 'tanjiro'));
  await sleep(1500);
  await barsOut();
  await sleep(400);
  s = await state();
  check('bars coming back mid-fight: prompt again, fight paused', s.prompt && s.gs === 'paused', JSON.stringify(s));
  await ev(() => document.querySelector('.ic-swipe .sw-skip').click());
  await sleep(200);
  await barsAway();
  await barsOut();
  await sleep(400);
  s = await state();
  check('略過 turns the prompt off for the session', !s.prompt, JSON.stringify(s));
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  if (failed) process.exitCode = 1;
}

console.log('page errors:', errors.length ? errors : 'none');
if (errors.length) process.exitCode = 1;
await browser.close();
