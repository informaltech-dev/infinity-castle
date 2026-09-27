import * as THREE from 'three';
import { Pipeline } from '../render/pipeline.js';
import { Lighting, setPreset, updateCameraLight } from '../render/materials.js';
import { Input } from '../core/input.js';
import { device } from '../core/device.js';
import { CameraRig } from './camera.js';
import { Combat } from './combat.js';
import { Director, isPlayable } from './director.js';
import { FX } from '../fx/fx.js';
import { World } from '../world/castle.js';
import { HudAdapter } from './hud.js';
import { buildTanjiro, buildGiyu, buildRengoku, buildObanai } from '../actors/characters.js';
import { createAnimator } from '../actors/animsets.js';
import { clamp } from '../core/math.js';

const DEFAULT_SETTINGS = {
  masterVolume: 0.8, sfxVolume: 0.9, musicVolume: 0.6, mouseSensitivity: 1.0, invertY: false,
  renderScale: 1.0, animStyle: 'anime', cameraShake: 1.0, damageNumbers: true, difficulty: 'normal',
};

export class Game {
  constructor({ canvas, uiRoot, UIClass, AudioClass, createTextures }) {
    this.canvas = canvas;
    this.pipeline = new Pipeline(canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 900);
    this.cameraRig = new CameraRig(this.camera);
    this.input = new Input(canvas);
    this.combat = new Combat(this);
    this.enemies = [];
    this.player = null;
    this.time = 0;
    this.realTime = 0;
    this.timeScale = 1;
    this.slowTarget = 1;
    this.slowT = 0;
    this.enemyTimeScale = 1;
    this.state = 'loading';
    this.createTextures = createTextures;
    this.settings = { ...DEFAULT_SETTINGS };
    this.audio = AudioClass ? new AudioClass() : null;
    this.ui = UIClass
      ? new UIClass(uiRoot, {
          onStart: (mode, ch) => this.startGame(mode, ch),
          onResume: () => this.resume(),
          onRestart: () => this.restart(),
          onQuitToTitle: () => this.toTitle(),
          onSettingsChange: (s) => this.applySettings(s),
          onUiSound: (n) => this.audio?.play(n),
          onSelectPreview: (c) => this.previewCharacter(c),
          onScreenChange: (s) => this._onScreen(s),
          onBlockingOverlay: () => this.pause(),
        })
      : null;
    this.hud = new HudAdapter(this, this.ui?.hud);
    if (this.ui?.getSettings) this.settings = { ...DEFAULT_SETTINGS, ...this.ui.getSettings() };
    this.director = new Director(this);
    this.stats = { time: 0, maxCombo: 0, kills: 0, damageTaken: 0 };
    this.combo = { count: 0, timer: 0 };
    this._clock = new THREE.Timer();
    this.input.keyHook = (e) => this._keyHook(e);
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'playing' && !this._suppressPause && !this.input.touchMode) this.pause();
    };
    canvas.addEventListener('mousedown', () => {
      this._unlockAudio();
      if (this.state === 'playing') this.input.requestLock();
    });
    window.addEventListener('resize', () => this.resize());
    // iOS reports the new size a moment after the rotation
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 300));
    window.visualViewport?.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', () => this._unlockAudio(), { capture: true });
    window.addEventListener('pointerdown', () => this._unlockAudio(), { capture: true });
    // touch: pointerdown is not a user activation for audio on mobile browsers, pointerup is
    window.addEventListener('pointerup', () => this._unlockAudio(), { capture: true });
    // leaving the page (app switch, lock screen, other tab) pauses the fight
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    matchMedia('(orientation: portrait)').addEventListener?.('change', (e) => {
      if (e.matches && this.input.touchMode && this.state === 'playing') this.pause();
    });
    this._bindTouch();
    this._drs = { pr: 0, t: 0, s: [], ema: 0, good: 0, cool: 1 };
    this._frameT = 0;
    this._rafT = 0;
    this._rafP = 16.7;
    this._rafS = [];
    this.resize();
    window.__game = this;
  }

  // ---------------------------------------------------------------- touch
  _bindTouch() {
    const input = this.input;
    const setMode = (on, cause) => {
      input.touchMode = on;
      this.cameraRig.autoFollow = on;
      if (on) input.exitLock();
      else input.clearVirtual();
      this.ui?.setTouchMode?.(on, false, cause);
      // the portrait warning now covers the screen: hold the fight as a rotation would
      if (on && this.state === 'playing' && matchMedia('(orientation: portrait)').matches) this.pause();
      // a prompt on screen names the old input's button
      this.hud.refreshPrompt();
    };
    setMode(device.touch);
    device.onChange(setMode);
    input.onGamepadUse = () => device.setTouch(false);
    this.ui?.touch?.bind({
      action: (a, down) => input.setVirtual(a, down),
      stick: (x, y, sprint) => input.setStick(x, y, sprint),
      look: (dx, dy) => {
        // a swipe across the whole screen turns the camera about half a circle
        const k = Math.PI / Math.max(480, this.width || window.innerWidth);
        input.addLook((dx * k) / 0.0026, (dy * k * 0.8) / 0.0022);
      },
      tap: (x, y) => this._tapLock(x, y),
      pause: () => this.pause(),
      release: () => input.clearVirtual(),
    });
  }

  /** Touch: tapping a demon on screen locks onto it. */
  _tapLock(x, y) {
    const p = this.player;
    if (this.state !== 'playing' || !p || !p.control) return;
    let best = null;
    let bestD = Math.max(56, Math.min(this.width, this.height) * 0.16);
    const c = new THREE.Vector3();
    for (const e of this.enemies) {
      if (!e.alive || e.targetable === false) continue;
      const s = this.hud.project(e.chest(c));
      if (!s.on) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best || best === p.lockTarget) return;
    p.lockTarget = best;
    this.cameraRig.lock = best;
    this.audio?.play('uiSelect', { volume: 0.4 });
  }

  async boot() {
    this.ui?.showLoading(0.02, '無限城構築中……');
    this._loop();
    let T = {};
    try {
      T = await this.createTextures((done, total) => this.ui?.showLoading(0.05 + (done / total) * 0.75, '描繪紙門與燈籠……'));
    } catch (e) {
      console.error('texture generation failed', e);
    }
    this.T = T;
    if (T.paper) this.pipeline.setPaper(T.paper);
    this.ui?.showLoading(0.85, '召喚鬼殺隊……');
    await new Promise((r) => setTimeout(r, 16));
    this.fx = new FX(this.scene, T, this.pipeline);
    this.world = new World(this.scene, T);
    this.world.buildHall();
    this._lightingHall();
    // preview models for the select screen
    this.previews = { tanjiro: buildTanjiro(T), giyu: buildGiyu(T), rengoku: buildRengoku(T), obanai: buildObanai(T) };
    for (const k in this.previews) {
      const m = this.previews[k];
      m.anim = createAnimator(m);
      m.root.visible = false;
      this.scene.add(m.root);
    }
    this.applySettings(this.settings);
    this.ui?.showLoading(1, '完成');
    await new Promise((r) => setTimeout(r, 250));
    this.ui?.hideLoading();
    this.toTitle();
    // debug shortcut: ?play=tanjiro|giyu|rengoku|obanai&mode=story|boss
    const q = new URLSearchParams(location.search);
    if (q.get('play')) this.startGame(q.get('mode') || 'story', q.get('play'));
    if (q.get('bot')) import('./bot.js').then(({ Bot }) => (this._liveBot = new Bot(this)));
  }

  _lightingHall() {
    setPreset({
      lightDir: new THREE.Vector3(0.35, 0.85, 0.4),
      lightColor: 0xffe2bf,
      ambTop: 0xa898ac,
      ambBottom: 0x5a4450,
      rimColor: 0xffb070,
      fogColor: 0x120a0e,
      fogRange: [30, 150],
      voidY: -3,
    });
    this.pipeline.clearColor.set(0x07050a);
  }
  _lightingArena() {
    setPreset({
      lightDir: new THREE.Vector3(-0.4, 0.8, 0.45),
      lightColor: 0xffd8c0,
      ambTop: 0x9a8eb6,
      ambBottom: 0x4a3854,
      rimColor: 0x9fdcff,
      fogColor: 0x0c0812,
      fogRange: [34, 170],
      voidY: -3,
    });
  }

  applySettings(s) {
    this.settings = { ...this.settings, ...s };
    const st = this.settings;
    this.audio?.setVolumes({ master: st.masterVolume, sfx: st.sfxVolume, music: st.musicVolume });
    this.cameraRig.sens = st.mouseSensitivity;
    this.cameraRig.invertY = st.invertY;
    this.cameraRig.shakeScale = st.cameraShake;
    this.hud.showNumbers = st.damageNumbers !== false;
    this.resize();
  }

  get stepHz() {
    return this.settings.animStyle === 'smooth' ? 0 : 15;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = this.settings?.renderScale ?? 1;
    let pr;
    if (scale === 'auto') {
      const d = this._drs;
      // first guess: about a megapixel of shading, refined by _drsTick from the measured frame rate
      if (!d.pr) d.pr = clamp(Math.sqrt(1.1e6 / Math.max(1, w * h)), 0.75, Math.min(dpr, 1.75));
      pr = clamp(d.pr, 0.6, dpr);
    } else pr = clamp(dpr * scale, 0.5, 2);
    this.pipeline.setSize(w, h, pr);
    this.width = w;
    this.height = h;
  }

  /**
   * Automatic resolution: steps the pixel ratio down when frames run long, back up when there is headroom.
   * Only a run in progress is measured (menus and the title scene say nothing about a fight's cost); the first
   * window after (re)entering play and any window with a lone stall (shader compile, arena build) are dropped,
   * and the slowest twentieth of each window is ignored so an odd hitch does not cost resolution.
   */
  _drsTick(frameMs) {
    const d = this._drs;
    if (this.settings.renderScale !== 'auto') return;
    const restart = () => {
      d.s.length = 0;
      d.t = 0;
      d.cool = Math.max(d.cool, 1);
    };
    if (this.state !== 'playing' || this.frozen || !(frameMs > 0 && frameMs < 1000)) {
      d.ema = 0;
      return restart();
    }
    d.ema = d.ema ? d.ema + (frameMs - d.ema) * 0.1 : frameMs;
    // a stall in an otherwise fluid run is loading work, not the render cost (a slow device keeps every frame)
    if (frameMs > 120 && d.ema < 60) return restart();
    d.s.push(Math.min(frameMs, 250));
    d.t += frameMs;
    if (d.t < 1500) return;
    const s = d.s.sort((a, b) => a - b);
    const keep = s.length - Math.floor(s.length * 0.05);
    let sum = 0;
    for (let i = 0; i < keep; i++) sum += s[i];
    const avg = sum / keep;
    s.length = 0;
    d.t = 0;
    if (d.cool > 0) {
      d.cool--;
      return;
    }
    const max = Math.min(window.devicePixelRatio || 1, 2);
    let pr = d.pr;
    if (avg > 22) {
      pr = Math.max(0.6, pr * (avg > 30 ? 0.8 : 0.88));
      d.good = 0;
    } else if (avg < 17.8) {
      if (++d.good >= 3 && pr < max) {
        pr = Math.min(max, pr * 1.1);
        d.good = 0;
      }
    } else d.good = 0;
    if (Math.abs(pr - d.pr) > 0.01) {
      d.pr = pr;
      d.cool = 1;
      this.resize();
    }
  }

  _unlockAudio() {
    // phones: the first touch-down is not a user activation, so keep asking until the context runs
    if (this.audio && this._audioUnlocked && this.audio.suspended) this.audio.unlock();
    if (this.audio && !this._audioUnlocked) {
      this._audioUnlocked = true;
      this.audio.unlock().then(() => {
        this.applySettings(this.settings);
        if (this.state === 'title' || this.state === 'menu') this.audio.playMusic('title');
      }).catch(() => {});
    }
  }

  _keyHook(e) {
    if (this.ui?.isMenuOpen?.()) {
      if (e.type === 'keydown') {
        const consumed = this.ui.handleKey(e);
        return consumed !== false;
      }
    }
    if (this.state === 'playing' && (e.code === 'Escape' || e.code === 'KeyP')) {
      this.pause();
      return true;
    }
    return false;
  }

  _onScreen(name) {
    this.screen = name;
    if (name === 'select') this.previewCharacter(this._previewId || 'tanjiro');
    else if (this.state !== 'playing' && this.previews) for (const k in this.previews) this.previews[k].root.visible = false;
  }

  // ---------------------------------------------------------------- flow
  toTitle() {
    this.input.exitLock();
    this.audio?.hold?.(false);
    this._clearActors();
    this.fx?.clear();
    this.state = 'title';
    this.timeScale = this.slowTarget = 1;
    this.enemyTimeScale = 1;
    if (this.world && this.world.mode !== 'hall') {
      this.world.buildHall();
      this.world.mode = 'hall';
      this._lightingHall();
    }
    this.cameraRig.stopCine();
    this.cameraRig.lock = null;
    this.hud.reset();
    this.ui?.showTitle();
    if (this._audioUnlocked) this.audio?.playMusic('title');
  }

  previewCharacter(id) {
    this._previewId = id;
    if (!this.previews) return;
    for (const k in this.previews) {
      const m = this.previews[k];
      const show = k === id && (this.screen === 'select');
      if (show && !m.root.visible) {
        m.root.position.set(0, 0, 0);
        m.root.rotation.y = 0.35;
        m.anim.anim.play(m.anim.clips.victory, { fade: 0, hold: true });
        m.anim.anim.clipTime = 1.2;
        this._previewT = 0;
        this.fx?.particles.smoke(new THREE.Vector3(0, 0.3, 0), 10, 0x1a1016, 0.7, 1.4, 0.8);
      }
      m.root.visible = show;
    }
  }

  startGame(mode, charId) {
    this.frozen = false;
    this.audio?.hold?.(false);
    this._unlockAudio();
    this.mode = mode;
    if (!isPlayable(charId)) charId = 'tanjiro'; // e.g. a mistyped ?play= id
    this.charId = charId;
    this.stats = { time: 0, maxCombo: 0, kills: 0, damageTaken: 0 };
    for (const k in this.previews || {}) this.previews[k].root.visible = false;
    this.ui?.hideAll();
    this.ui?.showHUD(charId);
    this.hud.reset();
    this.state = 'playing';
    this.input.requestLock();
    this.director.start(mode, charId);
  }

  restart() {
    this.ui?.hidePause?.();
    this.ui?.hideAll();
    this.startGame(this.mode, this.charId);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this._suppressPause = true;
    this.input.exitLock();
    this._suppressPause = false;
    this.audio?.setSlowmo(0.6);
    // a cinematic is cut to its music (the boss's entrance theme): the sound stops with the picture
    if (this.hud.hud?._lb) this.audio?.hold?.(true);
    this.ui?.showPause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.ui?.hidePause();
    this.state = 'playing';
    this.audio?.setSlowmo(0);
    this.audio?.hold?.(false);
    this.input.requestLock();
  }

  gameOver(victory) {
    if (this.state === 'result') return;
    this.state = 'result';
    this.input.exitLock();
    const s = this.stats;
    s.damageTaken = Math.round(s.damageTaken);
    const score = (victory ? 60 : 0) + Math.min(20, s.maxCombo / 2) + Math.max(0, 20 - s.damageTaken / 15) + (victory ? Math.max(0, 20 - s.time / 30) : 0);
    s.rank = score > 95 ? 'S' : score > 75 ? 'A' : score > 55 ? 'B' : 'C';
    this.ui?.showResult({ victory, character: this.charId, stats: { time: Math.round(s.time), maxCombo: s.maxCombo, kills: s.kills, damageTaken: s.damageTaken, rank: s.rank } });
    if (victory) this.audio?.play('victory');
    this.audio?.playMusic(victory ? 'victory' : 'defeat', 2.5);
  }

  _clearActors() {
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    if (this.player) {
      // an ultimate still running would leave the enemies' clock slowed
      this.player.interruptUlt();
      this.player.dispose();
      this.scene.remove(this.player.trail.mesh);
      this.scene.remove(this.player.threadMesh);
      this.player = null;
    }
    this.combat.clear();
  }

  // ---------------------------------------------------------------- time
  slowmo(scale, duration) {
    this.slowTarget = Math.min(this.slowTarget, scale);
    this.timeScale = Math.min(this.timeScale, scale);
    this.slowT = Math.max(this.slowT, duration);
    this.fx?.screen && (this.fx.screen.desatTarget = Math.max(this.fx.screen.desatTarget, 0.35));
  }
  freeze(t) {
    this.freezeT = Math.max(this.freezeT || 0, t);
  }
  slowmoSoft(scale, duration) {
    if (this.slowT > 0) return;
    this.slowmo(scale, duration);
  }

  worldToScreen(pos, out = new THREE.Vector2()) {
    const v = pos.clone().project(this.camera);
    return out.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
  }

  // ---------------------------------------------------------------- callbacks from combat
  onPlayerHit(victim, dmg, crit, h) {
    const p = this.player;
    this.combo.count++;
    this.combo.timer = 2.4;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo.count);
    if (p) p.gain(1.6 + dmg * 0.035, 2.2);
    void victim; void crit; void h;
  }
  onPlayerDamaged(dmg) {
    this.combo.count = 0;
    this.stats.damageTaken += dmg;
    this.fx.screen.chroma(0.5);
  }
  onEnemyKilled(e) {
    this.stats.kills++;
    this.director.onKill(e);
  }
  onBossDefeated(boss) {
    this.director.onBossDefeated(boss);
  }
  onBossPhase(n) {
    // the arena's light turns colder as Akaza unleashes his technique
    if (n >= 2) setPreset({ rimColor: 0x7fe6ff, lightColor: n >= 3 ? 0xd8e8ff : 0xe8e0ff, fogColor: n >= 3 ? 0x080a14 : 0x0a0912 });
  }

  onPlayerDeath() {
    this.director.onPlayerDeath();
  }

  // ---------------------------------------------------------------- loop
  _loop(ts) {
    requestAnimationFrame((t) => this._loop(t));
    const now = ts ?? performance.now();
    if (this._skipFrame(now)) return;
    this._drsTick(now - (this._frameT || now));
    this._frameT = now;
    this._clock.update();
    let realDt = Math.min(this._clock.getDelta(), 1 / 20);
    this.realTime += realDt;
    this.input.pollGamepad();
    // gamepad menu navigation
    if (this.ui?.isMenuOpen?.()) for (const k of this.input.menuKeysFromGamepad()) this.ui.handleKey({ key: k, code: k, preventDefault() {} });
    else if (this.state === 'playing' && this.input.pressed('pause') && this.input.gp) this.pause();

    if (this.frozen) realDt = 0;
    if (this._liveBot && this.state === 'playing') this._liveBot.update(realDt);
    if (this.state === 'playing') this._updatePlaying(realDt);
    else this._updateMenus(realDt);

    if (this.world) {
      updateCameraLight(this.camera);
      this.pipeline.render(this.scene, this.camera, this.realTime);
    }
    this.input.endFrame();
  }

  /**
   * Phones with 100 Hz+ screens draw about 60 frames a second (battery, heat): whole refreshes are skipped,
   * counted against the refresh period (the median of the last 15 frame intervals: jitter and dropped frames
   * wash out). 120 Hz → every 2nd refresh (60 fps), 144 Hz → every 2nd (72), 165 Hz → every 3rd (55);
   * 90 Hz is left alone.
   * @param {number} now  the rAF timestamp
   */
  _skipFrame(now) {
    const dt = now - (this._rafT || now);
    this._rafT = now;
    if (dt > 2 && dt < 50) {
      const s = this._rafS;
      s.push(dt);
      if (s.length >= 15) {
        s.sort((a, b) => a - b);
        this._rafP = s[7];
        s.length = 0;
      }
    }
    const P = this._rafP;
    if (!this.input.touchMode || P >= 9.5) return false;
    return Math.round((now - this._frameT) / P) < Math.round(16.667 / P);
  }

  /** Debug: headless autoplay for n frames; returns a summary. */
  async runBot(frames = 3600, dt = 1 / 60) {
    const { Bot } = await import('./bot.js');
    this.frozen = true;
    const bot = this._bot || (this._bot = new Bot(this));
    const errors = [];
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      try {
        bot.update(dt);
        this.realTime += dt;
        if (this.state === 'playing') this._updatePlaying(dt);
        this.input.endFrame();
      } catch (e) {
        errors.push(String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
        if (errors.length > 5) break;
      }
      const p = this.player;
      if (p && !Number.isFinite(p.pos.x)) { errors.push('player NaN'); break; }
      if (this.state === 'result') break;
    }
    updateCameraLight(this.camera);
    this.pipeline.render(this.scene, this.camera, this.realTime);
    const boss = this.boss;
    return {
      ms: Math.round(performance.now() - t0), state: this.state, gameTime: this.time.toFixed(1),
      player: this.player && { hp: Math.round(this.player.hp), state: this.player.state, conc: Math.round(this.player.conc) },
      boss: boss && { hp: Math.round(boss.hp), phase: boss.phase, state: boss.state },
      enemies: this.enemies.filter((e) => e.alive).length, kills: this.stats.kills, maxCombo: this.stats.maxCombo,
      actions: bot.log.actions, errors,
    };
  }

  /** Debug: advance the simulation deterministically while frozen. */
  debugStep(n = 1, dt = 1 / 60) {
    for (let i = 0; i < n; i++) {
      this.realTime += dt;
      if (this.state === 'playing') this._updatePlaying(dt);
      else this._updateMenus(dt);
      this.input.endFrame();
    }
    updateCameraLight(this.camera);
    this.pipeline.render(this.scene, this.camera, this.realTime);
  }

  _updateMenus(realDt) {
    const t = this.realTime;
    if (this.hud._hintOn) {
      this.hud._hintOn = false;
      this.hud.lockHint.style.opacity = '0';
    }
    this.hud._updateThreats();
    if (!this.world) return;
    this.world.update(realDt, this._audioUnlocked ? this.audio : null);
    if (this.state !== 'paused') this._motes(realDt);
    this.fx?.update(realDt, realDt, this.camera.position);
    if (this.state === 'paused') return;
    if (this.screen === 'select' && this.previews) {
      const m = this.previews[this._previewId];
      if (m) {
        this._previewT = (this._previewT || 0) + realDt;
        m.anim.anim.stepHz = this.stepHz;
        if (m.anim.anim.clip && this._previewT > 2.5) {
          m.anim.anim.stop(0.4);
        }
        m.root.rotation.y = 0.35 + Math.sin(t * 0.3) * 0.15;
        m.anim.anim.update(realDt);
        m.anim.anim.apply();
        m.rig.updateSprings(realDt);
      }
      this.camera.position.set(0.08, 1.3, 4.1);
      this.camera.lookAt(0.08, 1.02, 0);
      if (this.camera.fov !== 36) {
        this.camera.fov = 36;
        this.camera.updateProjectionMatrix();
      }
      return;
    }
    // slow drift through the great hall, looking up at the walls of shoji
    const a = t * 0.035 + 0.6;
    this.camera.position.set(Math.sin(a) * 6.5, 2.0 + Math.sin(t * 0.11) * 0.6, Math.cos(a) * 6.5);
    this.camera.lookAt(Math.sin(a + 2.4) * 14, 4.2 + Math.sin(t * 0.07) * 1.2, Math.cos(a + 2.4) * 14);
    if (this.camera.fov !== 55) {
      this.camera.fov = 55;
      this.camera.updateProjectionMatrix();
    }
  }

  _updatePlaying(realDt) {
    // time control
    if (this.slowT > 0) {
      this.slowT -= realDt;
      if (this.slowT <= 0) {
        this.slowTarget = 1;
        if (this.fx) this.fx.screen.desatTarget = 0;
      }
    }
    this.timeScale += (this.slowTarget - this.timeScale) * Math.min(1, realDt * (this.slowTarget < this.timeScale ? 30 : 5));
    let dt = realDt * this.timeScale;
    // global impact freeze (big hits): the whole world holds for a few frames
    if (this.freezeT > 0) {
      this.freezeT -= realDt;
      dt = 0;
    }
    this.time += dt;
    this.stats.time += realDt;
    Lighting.uTime.value = this.time;
    this.audio?.setSlowmo(clamp(1 - this.timeScale, 0, 1));

    this.director.update(dt, realDt);
    const p = this.player;
    if (p) {
      p.anim.stepHz = this.stepHz;
      p.update(dt, realDt);
    }
    for (const e of this.enemies) {
      e.anim.stepHz = e.isBoss ? this.stepHz : this.stepHz ? 12 : 0;
      e.update(dt, realDt);
    }
    this.enemies = this.enemies.filter((e) => !e.removed);
    this._separate();
    this.combat.update(dt);
    this.world.update(dt, this.audio);
    // combo decay
    if (this.combo.timer > 0) {
      this.combo.timer -= dt;
      if (this.combo.timer <= 0) this.combo.count = 0;
    }
    // camera
    const look = { x: 0, y: 0 };
    if (this.input.locked || this.input.gp || this.input.touchMode) this.input.look(look, realDt);
    // a camera-drag thumb resting on the screen counts as looking (no auto-follow under it)
    this.cameraRig.lookHeld = !!this.ui?.touch?.lookHeld;
    if (p) this.cameraRig.update(dt, realDt, p, p.control ? look : null);
    if (this.cameraRig.lock && !this.cameraRig.lock.alive) this.cameraRig.lock = null;
    this._motes(realDt);
    this.fx.update(dt, realDt, this.camera.position);
    // audio listener
    if (this.audio) {
      const f = new THREE.Vector3();
      this.camera.getWorldDirection(f);
      const r = new THREE.Vector3(-f.z, 0, f.x).normalize();
      this.audio.setListener(this.camera.position, f, r);
      const dangerHp = p ? p.hp / p.maxHp : 1;
      const danger = p && p.alive ? clamp((0.3 - dangerHp) / 0.3) : 0;
      this.audio.setDanger(danger);
      this.fx.screen.danger = danger * 0.8;
      this.audio.setMusicIntensity(clamp(this.enemies.filter((e) => e.alive).length / 5 + (this.boss ? 0.5 : 0)));
    }
    this.hud.update(realDt);
  }

  /** Ambient warm dust/ember motes drifting around the camera. */
  _motes(dt) {
    if (!this.fx) return;
    this._moteAcc = (this._moteAcc || 0) + dt * 14;
    const c = this.camera.position;
    while (this._moteAcc > 1) {
      this._moteAcc -= 1;
      const p = new THREE.Vector3(c.x + (Math.random() - 0.5) * 22, c.y + (Math.random() - 0.4) * 8, c.z + (Math.random() - 0.5) * 22);
      if (p.y < 0.2) p.y = 0.2 + Math.random();
      const warm = Math.random() < 0.8;
      this.fx.particles.emit({
        additive: true, pos: p, vel: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.15 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3),
        color: new THREE.Color(warm ? 0xffb060 : 0xbfd8ff), alpha: 0.35 + Math.random() * 0.35, size: 0.025 + Math.random() * 0.035,
        shape: 7, life: 3 + Math.random() * 3, drag: 0.2, fadeIn: 0.25,
      });
    }
  }

  _separate() {
    const all = this.player && this.player.alive ? [this.player, ...this.enemies.filter((e) => e.alive)] : this.enemies.filter((e) => e.alive);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = a.radius + b.radius;
        if (d < min && d > 1e-4) {
          const push = (min - d) / 2;
          const nx = dx / d, nz = dz / d;
          const wa = b.mass / (a.mass + b.mass), wb = a.mass / (a.mass + b.mass);
          a.pos.x -= nx * push * 2 * wa;
          a.pos.z -= nz * push * 2 * wa;
          b.pos.x += nx * push * 2 * wb;
          b.pos.z += nz * push * 2 * wb;
        }
      }
    }
  }
}
