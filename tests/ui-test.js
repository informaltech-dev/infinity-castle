// Mock harness for the UI module: fake 3D backdrop + simulated game loop driving every HUD feature.
import { UI } from '../src/ui/ui.js';
import { CHARACTERS } from '../src/ui/data.js';

const $ = (s) => document.querySelector(s);

// ?slow=8 stretches every UI timer (callout hold, banner, toast …) so screenshots can catch them.
const SLOW = Number(new URLSearchParams(window.location.search).get('slow')) || 1;
if (SLOW !== 1) {
  const st = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms, ...a) => st(fn, (Number(ms) || 0) * SLOW, ...a);
}
const logEl = $('#hz-log');
function log(...a) {
  const line = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
  logEl.textContent = `${line}\n${logEl.textContent}`.slice(0, 5000);
}

/* ------------------------------------------------------------------ tiny UI sound synth */
let ac = null;
function blip(name) {
  try {
    ac = ac || new AudioContext();
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    const f = { uiHover: 1320, uiSelect: 880, uiConfirm: 520, uiBack: 300 }[name] || 440;
    o.type = name === 'uiConfirm' ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(f, t);
    if (name === 'uiConfirm') o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.12);
    if (name === 'uiBack') o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(name === 'uiHover' ? 0.02 : 0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.2);
  } catch (e) {
    /* audio optional */
  }
}

/* ------------------------------------------------------------------ state */
const state = { mode: 'story', char: 'tanjiro', preview: 'tanjiro', sim: false, paused: false, inGame: false, screen: '' };
const charData = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

const ui = new UI(document.getElementById('ui-root'), {
  onStart(mode, character) {
    log('onStart', mode, character);
    startRun(mode, character);
  },
  onResume() {
    log('onResume');
    state.paused = false;
  },
  onRestart() {
    log('onRestart');
    startRun(state.mode, state.char);
  },
  onQuitToTitle() {
    log('onQuitToTitle');
    state.sim = false;
    state.inGame = false;
    syncSimButton();
    ui.showTitle();
  },
  onSettingsChange(s) {
    log('onSettingsChange', s);
  },
  onUiSound(name) {
    blip(name);
  },
  onSelectPreview(c) {
    log('onSelectPreview', c);
    state.preview = c;
  },
  onScreenChange(name) {
    log('onScreenChange', name);
    state.screen = name;
    if (name === 'pause') state.paused = true;
    if (name === 'hud') state.paused = false;
  },
});
window.ui = ui;

/* ------------------------------------------------------------------ fake 3D backdrop */
const canvas = $('#game-canvas');
const g = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
}
window.addEventListener('resize', resize);
resize();

function drawBackdrop(t) {
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#1d1024');
  grd.addColorStop(0.55, '#2b1420');
  grd.addColorStop(1, '#0b0608');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H * 0.45;
  g.lineWidth = 1;
  g.strokeStyle = 'rgba(214,150,92,0.16)';
  const ph = (t * 0.06) % 1;
  for (let i = 0; i < 10; i++) {
    const k = Math.pow(0.72, i - ph);
    const w = W * 1.05 * k, hh = H * 1.05 * k;
    g.strokeRect(cx - w / 2, cy - hh / 2, w, hh);
  }
  g.beginPath();
  for (let i = 0; i <= 18; i++) {
    const x = (i / 18) * W;
    g.moveTo(x, 0);
    g.lineTo(cx, cy);
    g.moveTo(x, H);
    g.lineTo(cx, cy);
  }
  g.stroke();
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996 + t * 0.04;
    const r = 0.18 + (i % 5) * 0.07;
    const x = cx + Math.cos(a) * W * r;
    const y = cy + Math.sin(a) * H * r * 0.55;
    const rad = g.createRadialGradient(x, y, 0, x, y, 30);
    rad.addColorStop(0, 'rgba(255,176,96,0.5)');
    rad.addColorStop(1, 'rgba(255,120,60,0)');
    g.fillStyle = rad;
    g.beginPath();
    g.arc(x, y, 30, 0, Math.PI * 2);
    g.fill();
  }
  const fl = g.createRadialGradient(cx, H * 0.86, 0, cx, H * 0.86, W * 0.4);
  fl.addColorStop(0, 'rgba(120,40,40,0.35)');
  fl.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fl;
  g.fillRect(0, H * 0.6, W, H * 0.4);
}

function drawFigure(x, base, s, cols, t, enemy = false) {
  g.save();
  g.translate(x, base);
  g.scale(s, s);
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath();
  g.ellipse(0, 0, 60, 14, 0, 0, Math.PI * 2);
  g.fill();
  const bob = Math.sin(t * 2) * 3;
  g.translate(0, bob);
  g.fillStyle = '#121014';
  g.fillRect(-18, -95, 14, 95);
  g.fillRect(4, -95, 14, 95);
  // haori
  g.beginPath();
  g.moveTo(-36, -205);
  g.lineTo(36, -205);
  g.lineTo(54, -60);
  g.lineTo(-54, -60);
  g.closePath();
  g.fillStyle = cols[0];
  g.fill();
  if (!enemy) {
    g.beginPath();
    g.moveTo(0, -205);
    g.lineTo(36, -205);
    g.lineTo(54, -60);
    g.lineTo(0, -60);
    g.closePath();
    g.fillStyle = cols[1];
    g.fill();
  }
  g.fillStyle = enemy ? '#3a0d14' : '#e8d3b8';
  g.beginPath();
  g.arc(0, -232, 26, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#141014';
  g.beginPath();
  g.arc(0, -242, 28, Math.PI, 0);
  g.fill();
  if (!enemy) {
    g.strokeStyle = cols[2] || '#cfe3f0';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(40, -140);
    g.lineTo(150, -230);
    g.stroke();
  } else {
    g.fillStyle = '#ff3a4a';
    g.fillRect(-12, -238, 7, 4);
    g.fillRect(5, -238, 7, 4);
  }
  g.restore();
}

/* ------------------------------------------------------------------ simulated run */
const sim = {};
function startRun(mode, character) {
  state.mode = mode;
  state.char = character;
  state.inGame = true;
  let p = 0;
  const texts = ['構築無限城', '召喚鬼群', '調和呼吸'];
  ui.showLoading(0, texts[0]);
  const iv = setInterval(() => {
    p = Math.min(1, p + 0.06 + Math.random() * 0.05);
    ui.showLoading(p, texts[Math.min(2, Math.floor(p * 3))]);
    if (p >= 1) {
      clearInterval(iv);
      setTimeout(() => {
        ui.hideLoading();
        ui.showHUD(character);
        resetSim(mode, character);
        state.sim = true;
        syncSimButton();
        if (mode === 'boss') {
          ui.hud.setLetterbox(true);
          setTimeout(() => ui.hud.bossIntro({ title: '上弦之參', name: '猗窩座', subtitle: '術式展開・破壞殺・羅針' }), 500);
          setTimeout(() => {
            ui.hud.setLetterbox(false);
            sim.bossOn = true;
          }, 3900);
        } else {
          ui.hud.banner('第一波', '鬼群來襲', 'normal');
        }
      }, 250);
    }
  }, 90);
}

function resetSim(mode, character) {
  const c = charData(character);
  Object.assign(sim, {
    t: 0,
    c,
    hp: 1500,
    maxHp: 1500,
    st: 100,
    maxSt: 100,
    br: 70,
    maxBr: 100,
    conc: 20,
    maxConc: 100,
    combo: 0,
    cds: [0, 0, 0],
    costs: [25, 35, 50],
    nextHit: 0.8,
    nextSkill: 2.2,
    nextToast: 3.4,
    nextHurt: 2.5,
    nextEnemyCallout: 7,
    ultReadyAt: 0,
    bossOn: false,
    boss: { hp: 18000, maxHp: 18000 },
    enemies: Array.from({ length: mode === 'boss' ? 0 : 5 }, (_, i) => ({ id: `oni-${i}`, a: (i / 5) * Math.PI * 2, r: 0.2 + (i % 3) * 0.05, hp: 1, sp: 0.25 + (i % 2) * 0.15 })),
    wave: 1,
  });
  ui.hud.setObjective(mode === 'boss' ? '擊敗上弦之參・猗窩座' : '擊退第一波鬼群（剩餘 5）');
}

function techniqueCallout(tq, c) {
  ui.hud.callout({ school: tq.school || c.school.split('・')[0], form: tq.form, name: tq.name, style: tq.style, side: 'right' });
}

function useSkill(i) {
  const c = sim.c;
  const tq = c.techniques[i];
  if (!tq || sim.cds[i] > 0 || sim.br < sim.costs[i]) return;
  sim.br -= sim.costs[i];
  sim.cds[i] = 1;
  techniqueCallout(tq, c);
}

function useUlt() {
  if (sim.conc < sim.maxConc) return;
  const c = sim.c;
  const tq = c.techniques[3];
  sim.conc = 0;
  techniqueCallout({ ...tq, style: c.id === 'giyu' ? 'calm' : 'fire' }, c);
  ui.hud.setLetterbox(true);
  setTimeout(() => ui.hud.setLetterbox(false), 1600);
}

function enemyScreen(e, t) {
  const x = W / 2 + Math.cos(e.a + t * e.sp) * W * e.r;
  const base = H * 0.66 + Math.sin(e.a + t * e.sp) * H * 0.08;
  const s = (H / 720) * (0.55 + Math.sin(e.a + t * e.sp) * 0.12);
  return { x, base, s, headY: base - 270 * s };
}

function simTick(dt, t) {
  sim.t += dt;
  const c = sim.c;
  sim.st = Math.min(sim.maxSt, sim.st + dt * 22);
  if (Math.random() < dt * 0.7) sim.st = Math.max(0, sim.st - 28);
  sim.br = Math.min(sim.maxBr, sim.br + dt * 7.5);
  sim.conc = Math.min(sim.maxConc, sim.conc + dt * 7);
  for (let i = 0; i < 3; i++) sim.cds[i] = Math.max(0, sim.cds[i] - dt / (3 + i * 1.5));

  // hits on enemies / boss
  const alive = sim.enemies.filter((e) => e.hp > 0);
  if (sim.t > sim.nextHit) {
    sim.nextHit = sim.t + 0.22 + Math.random() * 0.4;
    const crit = Math.random() < 0.18;
    const dmg = Math.round((crit ? 420 : 120) + Math.random() * 160);
    sim.combo += 1;
    if (sim.bossOn) {
      sim.boss.hp = Math.max(0, sim.boss.hp - dmg);
      ui.hud.damageNumber(W / 2 + (Math.random() - 0.5) * 60, H * 0.36, dmg, crit ? 'crit' : 'normal');
      if (sim.boss.hp <= 0) sim.boss.hp = sim.boss.maxHp;
    } else if (alive.length) {
      const e = alive[Math.floor(Math.random() * alive.length)];
      const p = enemyScreen(e, t);
      e.hp = Math.max(0, e.hp - dmg / 1800);
      ui.hud.damageNumber(p.x, p.headY + 10, dmg, crit ? 'crit' : 'normal');
      if (e.hp <= 0) {
        setTimeout(() => {
          e.hp = 1;
        }, 2500);
        ui.hud.setObjective(`擊退第一波鬼群（剩餘 ${Math.max(0, alive.length - 1)}）`);
      }
    }
  }
  if (Math.random() < dt * 0.04) sim.combo = 0;

  // player takes damage
  if (sim.t > sim.nextHurt) {
    sim.nextHurt = sim.t + 1.5 + Math.random() * 2.5;
    const d = Math.round(80 + Math.random() * 220);
    sim.hp = Math.max(1, sim.hp - d);
    ui.hud.damageNumber(W / 2 + 30, H * 0.5, d, 'player');
    if (sim.hp < sim.maxHp * 0.18) setTimeout(() => (sim.hp = sim.maxHp), 2600);
  }

  // skills
  if (sim.t > sim.nextSkill) {
    sim.nextSkill = sim.t + 2.6 + Math.random() * 1.2;
    const order = [0, 1, 2].sort(() => Math.random() - 0.5);
    for (const i of order) {
      if (sim.cds[i] === 0 && sim.br >= sim.costs[i]) {
        useSkill(i);
        break;
      }
    }
  }
  if (sim.conc >= sim.maxConc) {
    if (!sim.ultReadyAt) sim.ultReadyAt = sim.t;
    else if (sim.t - sim.ultReadyAt > 3.5) {
      sim.ultReadyAt = 0;
      useUlt();
    }
  }
  if (sim.bossOn && sim.t > sim.nextEnemyCallout) {
    sim.nextEnemyCallout = sim.t + 6 + Math.random() * 4;
    const moves = ['空式', '亂式', '滅式', '碎式・萬葉閃柳'];
    ui.hud.callout({ school: '破壞殺', form: '', name: moves[Math.floor(Math.random() * moves.length)], style: 'demon', side: 'left' });
  }
  if (sim.t > sim.nextToast) {
    sim.nextToast = sim.t + 3 + Math.random() * 3;
    const toasts = c.id === 'giyu' ? [['完美格擋', 'counter'], ['反擊', 'counter'], ['破防', 'break'], ['完美閃避', 'perfect']] : [['完美閃避', 'perfect'], ['隙之線', 'info'], ['破防', 'break'], ['反擊', 'counter']];
    const [txt, st] = toasts[Math.floor(Math.random() * toasts.length)];
    ui.hud.toast(txt, st);
  }

  // push to HUD (every frame, like the real game)
  ui.hud.setPlayer({ hp: sim.hp, maxHp: sim.maxHp, stamina: sim.st, maxStamina: sim.maxSt, breath: sim.br, maxBreath: sim.maxBr, conc: sim.conc, maxConc: sim.maxConc });
  const skills = c.techniques.slice(0, 3).map((tq, i) => ({
    key: tq.key,
    form: tq.form || tq.school,
    name: tq.name,
    cost: sim.costs[i],
    ready: sim.cds[i] === 0 && sim.br >= sim.costs[i],
    cooldown01: sim.cds[i],
  }));
  const u = c.techniques[3];
  ui.hud.setSkills(skills, { key: 'R', name: u.form ? `${u.form}・${u.name}` : `${u.school}・${u.name}`, charge01: sim.conc / sim.maxConc, ready: sim.conc >= sim.maxConc });
  ui.hud.setAttackMode(Math.floor(sim.t / 4) % 2 ? 'heavy' : 'light');
  ui.hud.setCombo(sim.combo);
  ui.hud.setDanger(sim.hp / sim.maxHp < 0.35 ? 1 - sim.hp / sim.maxHp / 0.35 : 0);
  ui.hud.setBoss(sim.bossOn ? { title: '上弦之參', name: '猗窩座', hp: sim.boss.hp, maxHp: sim.boss.maxHp, phaseMarks: [0.6, 0.25] } : null);
  const bars = sim.enemies.map((e) => {
    const p = enemyScreen(e, t);
    return { id: e.id, x: p.x, y: p.headY - 16, hp01: e.hp, visible: e.hp > 0 };
  });
  ui.hud.setEnemyBars(bars);
  if (sim.bossOn) {
    ui.hud.setLockOn(W / 2 + Math.sin(t * 0.8) * W * 0.06, H * 0.42, true, 1.25);
  } else {
    const target = sim.enemies.find((e) => e.hp > 0);
    if (target) {
      const p = enemyScreen(target, t);
      ui.hud.setLockOn(p.x, p.headY + 110 * p.s, true, 0.8 + p.s * 0.5);
    } else ui.hud.setLockOn(0, 0, false);
  }
}

/* ------------------------------------------------------------------ main loop */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  drawBackdrop(t);
  const screen = state.screen;
  if (screen === 'select') {
    const c = state.preview === 'giyu' ? ['#7a1f2e', '#8a7a30', '#9fd6f5'] : ['#1b3d33', '#2f8f74', '#ffb070'];
    drawFigure(W / 2, H * 0.84, (H / 720) * 1.35, c, t);
  } else if (state.inGame) {
    if (sim.enemies) for (const e of sim.enemies) if (e.hp > 0) {
      const p = enemyScreen(e, t);
      drawFigure(p.x, p.base, p.s, ['#2a0a10', '#2a0a10'], t + e.a, true);
    }
    if (sim.bossOn) drawFigure(W / 2 + Math.sin(t * 0.8) * W * 0.06, H * 0.72, (H / 720) * 1.0, ['#5a1030', '#5a1030'], t, true);
    const c = state.char === 'giyu' ? ['#7a1f2e', '#8a7a30', '#9fd6f5'] : ['#1b3d33', '#2f8f74', '#ffb070'];
    drawFigure(W / 2, H * 0.95, (H / 720) * 1.1, c, t);
    if (state.sim && !state.paused && sim.c) simTick(dt, t);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Manual stepping (useful when the page is in a background tab where rAF is paused).
window.__step = (n = 30, dt = 1 / 30) => {
  for (let i = 0; i < n; i++) {
    const t = performance.now() / 1000 + i * dt;
    if (state.inGame && state.sim && !state.paused && sim.c) simTick(dt, t);
  }
  drawBackdrop(performance.now() / 1000);
  return { hp: sim.hp, combo: sim.combo, boss: sim.bossOn ? sim.boss.hp : null };
};

/* ------------------------------------------------------------------ keyboard (harness only) */
window.addEventListener('keydown', (e) => {
  if (ui.isMenuOpen()) {
    if (ui.handleKey(e)) e.preventDefault();
    return;
  }
  if (!state.inGame) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    ui.showPause();
  } else if (e.key === '1' || e.key === '2' || e.key === '3') useSkill(Number(e.key) - 1);
  else if (e.key === 'r' || e.key === 'R') useUlt();
});

/* ------------------------------------------------------------------ harness buttons */
function syncSimButton() {
  $('#hz-sim').classList.toggle('on', state.sim);
}
let lbOn = false;
let promptOn = false;
const actions = {
  loading() {
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(1, p + 0.035);
      ui.showLoading(p, p < 0.5 ? '構築無限城' : '載入角色');
      if (p >= 1) {
        clearInterval(iv);
        setTimeout(() => ui.showTitle(), 300);
      }
    }, 60);
  },
  title: () => ui.showTitle(),
  menu: () => ui.showMenu(),
  'select-story': () => ui.showCharacterSelect('story'),
  'select-boss': () => ui.showCharacterSelect('boss'),
  'hud-tanjiro': () => enterHud('tanjiro'),
  'hud-giyu': () => enterHud('giyu'),
  pause: () => {
    if (!state.inGame) enterHud(state.char);
    ui.showPause();
  },
  win: () => ui.showResult({ victory: true, character: state.char, stats: { time: 222.4, maxCombo: 87, kills: 27, damageTaken: 1240, rank: 'S' } }),
  lose: () => ui.showResult({ victory: false, character: state.char, stats: { time: 131, maxCombo: 18, kills: 9, damageTaken: 3120, rank: 'C' } }),
  hide: () => {
    state.sim = false;
    state.inGame = false;
    syncSimButton();
    ui.hideAll();
  },
  sim: () => {
    if (!state.inGame) enterHud(state.char);
    state.sim = !state.sim;
    syncSimButton();
  },
  intro: () => {
    if (!state.inGame) enterHud(state.char);
    ui.hud.bossIntro({ title: '上弦之參', name: '猗窩座', subtitle: '術式展開・破壞殺・羅針' });
    setTimeout(() => (sim.bossOn = true), 3200);
  },
  banner: () => ui.hud.banner('第二波', '鬼群再臨', 'normal'),
  'danger-banner': () => ui.hud.banner('上弦之參', '猗窩座現身', 'danger'),
  callout: () => {
    const c = sim.c || charData(state.char);
    const i = Math.floor(Math.random() * 4);
    const tq = c.techniques[i];
    techniqueCallout({ ...tq, style: i === 3 && c.id === 'giyu' ? 'calm' : tq.style }, c);
  },
  toast: () => ui.hud.toast(['完美閃避', '反擊', '破防'][Math.floor(Math.random() * 3)], ['perfect', 'counter', 'break'][Math.floor(Math.random() * 3)]),
  sub: () => ui.hud.subtitle('猗窩座', '你的鬥氣真是出色。成為鬼吧，與我永遠切磋下去！', 3.5),
  prompt: () => {
    promptOn = !promptOn;
    if (promptOn) ui.hud.prompt('斬首', '左鍵');
    else ui.hud.hidePrompt();
  },
  letterbox: () => {
    lbOn = !lbOn;
    ui.hud.setLetterbox(lbOn);
    if (lbOn) ui.hud.subtitle('富岡義勇', '……水之呼吸，拾壹之型。', 3);
  },
  hurt: () => {
    if (sim.hp) sim.hp = Math.max(1, sim.hp - 400);
  },
  ult: () => {
    if (sim.maxConc) sim.conc = sim.maxConc;
  },
};

function enterHud(ch) {
  state.char = ch;
  state.inGame = true;
  ui.showHUD(ch);
  resetSim('story', ch);
  state.sim = true;
  syncSimButton();
}

document.querySelectorAll('#harness [data-a]').forEach((b) => {
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    b.blur();
    const fn = actions[b.dataset.a];
    if (fn) fn();
  });
});
$('#hz-min').addEventListener('click', () => {
  $('#harness').classList.toggle('is-min');
  $('#hz-min').textContent = $('#harness').classList.contains('is-min') ? '展開' : '收合';
  $('#hz-min').blur();
});

if (new URLSearchParams(window.location.search).has('clean')) $('#harness').style.display = 'none';
window.addEventListener('keydown', (e) => {
  if (e.code === 'Backquote') {
    const hz = $('#harness');
    hz.style.display = hz.style.display === 'none' ? '' : 'none';
  }
});

// boot: short loading then title — or jump straight to a scene: ui.html?clean&scene=hud-giyu
const SCENES = {
  title: () => ui.showTitle(),
  menu: () => ui.showMenu(),
  select: () => ui.showCharacterSelect('story'),
  'select-boss': () => ui.showCharacterSelect('boss'),
  controls: () => {
    ui.showMenu();
    ui._openSub('controls');
  },
  settings: () => {
    ui.showMenu();
    ui._openSub('settings');
  },
  hud: () => enterHud('tanjiro'),
  'hud-giyu': () => enterHud('giyu'),
  boss: () => {
    enterHud('tanjiro');
    sim.bossOn = true;
    sim.enemies = [];
  },
  intro: () => {
    enterHud('tanjiro');
    sim.enemies = [];
    ui.hud.bossIntro({ title: '上弦之參', name: '猗窩座', subtitle: '術式展開・破壞殺・羅針' });
  },
  pause: () => {
    enterHud('tanjiro');
    ui.showPause();
  },
  win: () => actions.win(),
  lose: () => actions.lose(),
};
const scene = new URLSearchParams(window.location.search).get('scene');
if (scene && SCENES[scene]) {
  SCENES[scene]();
  window.__scene = scene;
} else actions.loading();
log('測試台已就緒：以方向鍵／WASD、Enter、Esc 操作選單。');
