// Trailer runtime: plays a timeline of scripted scenes on top of the real game, one frame per clock tick.
//
// Each scene rebuilds the stage it needs (world, lighting, actors), may simulate a muted pre-roll, then drives
// the game with scripted input / direct move calls (update) and an optional camera of its own (camera).
// Overlays (title cards) and the soundtrack are pure functions of trailer time, so any range can be rendered
// on its own and every render of it is identical.
import * as THREE from 'three';
import { ease as EASE, clamp, lerp } from '../src/core/math.js';
import { buildAkaza, buildDemon } from '../src/actors/characters.js';
import { Boss } from '../src/actors/boss.js';
import { Enemy } from '../src/actors/enemy.js';

export const FPS = 60;
const DT = 1 / FPS;
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const vec = (a) => (a instanceof THREE.Vector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));

const KEY_OF = { dodge: 'Space', skill1: 'Digit1', skill2: 'Digit2', skill3: 'Digit3', ult: 'KeyR', stance: 'KeyQ', lock: 'Tab', sprint: 'ShiftLeft' };

/** Scene context handed to scene scripts. */
class Scene {
  constructor(tr, def) {
    this.tr = tr;
    this.g = tr.g;
    this.def = def;
    this.t = 0;
    this.actions = [];
    this.holds = [];
    this.moveKeys = null;
    this.timeScale = null;
    this.data = {};
    this.p = null;
    this.boss = null;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.camFov = 50;
    this.camRoll = 0;
    this.camSet = false;
    this._follow = null;
  }

  get T() {
    return this.tr.t;
  }

  /** Run fn once when scene time reaches t (negative times run during the pre-roll). */
  at(t, fn) {
    this.actions.push({ t, fn, done: false });
    this.actions.sort((a, b) => a.t - b.t);
    return this;
  }

  // ------------------------------------------------------------ input (drives the player like a person would)
  tap(action) {
    const inp = this.g.input;
    if (action === 'light' || action === 'heavy') {
      if (inp.attackMode !== action) inp.toggleAttackMode();
      if (inp.mouse.has(0)) inp.buttonUp(0);
      inp.buttonDown(0);
      this.holds.push({ until: this.t + DT * 1.5, button: 0 });
      return;
    }
    const k = KEY_OF[action];
    if (!k) return;
    inp.keys.add(k);
    inp.keysPressed.add(k);
    this.holds.push({ until: this.t + DT * 1.5, key: k });
  }

  /** Hold the attack button in heavy mode (charged thrust) or the block button for `dur` seconds. */
  hold(action, dur) {
    const inp = this.g.input;
    if (action === 'heavy' || action === 'light') {
      if (inp.attackMode !== action) inp.toggleAttackMode();
      if (inp.mouse.has(0)) inp.buttonUp(0);
      inp.buttonDown(0);
      this.holds.push({ until: this.t + dur, button: 0 });
    } else if (action === 'block') {
      inp.buttonDown(2);
      this.holds.push({ until: this.t + dur, button: 2 });
    } else if (KEY_OF[action]) {
      inp.keys.add(KEY_OF[action]);
      inp.keysPressed.add(KEY_OF[action]);
      this.holds.push({ until: this.t + dur, key: KEY_OF[action] });
    }
  }

  /** Movement keys, e.g. move('W'), move('WD'), move(null). */
  move(keys) {
    this.moveKeys = keys ? keys.split('').map((c) => 'Key' + c.toUpperCase()) : null;
  }

  _input() {
    const inp = this.g.input;
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) inp.keys.delete(k);
    if (this.moveKeys) for (const k of this.moveKeys) inp.keys.add(k);
    for (let i = this.holds.length - 1; i >= 0; i--) {
      const h = this.holds[i];
      if (this.t < h.until) continue;
      if (h.button != null) inp.buttonUp(h.button);
      if (h.key) inp.keys.delete(h.key);
      this.holds.splice(i, 1);
    }
  }

  /** Hold the game's time scale (null hands it back to the game). */
  slow(x) {
    this.timeScale = x;
    if (x == null) {
      this.g.slowTarget = 1;
      this.g.slowT = 0;
    }
  }

  /** Frames an actor needs to fall `h` metres starting at vertical speed v0 (the game's integration). */
  static fallFrames(h, v0 = 0) {
    let y = h;
    let v = v0;
    let n = 0;
    while (y > 0 && n < 1000) {
      v -= 22 * DT;
      y += v * DT;
      n++;
    }
    return n;
  }

  // ------------------------------------------------------------ actors
  demon(variant, pos, o = {}) {
    const g = this.g;
    const model = buildDemon(g.T, variant, o.seed ?? g.director.seed++);
    const e = new Enemy(g, model, variant);
    g.scene.add(model.root);
    e.shadow = g.director._shadow(g);
    const p = vec(pos);
    const face = o.face === undefined ? this.p : o.face;
    const yaw = o.yaw ?? (face ? Math.atan2(face.pos.x - p.x, face.pos.z - p.z) : 0);
    if (o.spawn) {
      e.spawnAt(p, yaw);
      if (o.door) g.world.openDoorNear(p);
    } else {
      e.pos.copy(p);
      e.yaw = yaw;
      e.setState(o.state || 'chase');
    }
    if (o.cooldown != null) e.cooldown = o.cooldown;
    if (o.hp != null) e.hp = o.hp;
    g.enemies.push(e);
    return e;
  }

  akaza(pos = [0, 0, 8], yaw = Math.PI, o = {}) {
    const g = this.g;
    const model = buildAkaza(g.T);
    const b = new Boss(g, model);
    b.pos.copy(vec(pos));
    b.yaw = yaw;
    g.scene.add(model.root);
    b.shadow = g.director._shadow(g);
    g.enemies.push(b);
    g.boss = b;
    b.setState(o.state || 'idle');
    b.cooldown = o.cooldown ?? 1e9;
    // scripted: no phase changes or final technique of his own (phase 3 is the last one)
    b.phase = o.phase ?? 1;
    b.finalCd = 1e9;
    if (o.lowHp) {
      b.phase = 3;
      b.hp = o.lowHp;
    }
    if (o.light) g.onBossPhase?.(o.light);
    this.boss = b;
    return b;
  }

  // ------------------------------------------------------------ camera
  /** Point in `actor`'s frame: x = its right, y = up, z = its forward. `yaw` overrides the actor's facing. */
  rel(actor, [x, y, z], yaw, out = new THREE.Vector3()) {
    const base = actor.pos ?? actor;
    const a = yaw ?? actor.yaw ?? 0;
    const fx = Math.sin(a), fz = Math.cos(a);
    return out.set(base.x - fz * x + fx * z, (base.y || 0) + y, base.z + fx * x + fz * z);
  }

  cam(pos, look, fov = this.camFov, roll = 0) {
    this.camPos.copy(pos.isVector3 ? pos : vec(pos));
    this.camLook.copy(look.isVector3 ? look : vec(look));
    this.camFov = fov;
    this.camRoll = roll;
    this.camSet = true;
  }

  /**
   * Keyframed camera: keys = [{ t, pos, look, fov, roll, e }] where pos/look are [x,y,z] or (S) => Vector3
   * (evaluated live, for moving subjects). Eased per segment with the easing named on the later key.
   */
  path(keys, t = this.t) {
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
    const k0 = keys[i];
    const k1 = keys[Math.min(i + 1, keys.length - 1)];
    const span = Math.max(1e-4, k1.t - k0.t);
    const a = k1 === k0 ? 1 : (EASE[k1.e || 'inOut'] || EASE.inOut)(clamp((t - k0.t) / span));
    const ev = (x, out) => (typeof x === 'function' ? out.copy(x(this)) : x.isVector3 ? out.copy(x) : out.set(x[0], x[1], x[2]));
    const p0 = ev(k0.pos, new THREE.Vector3()), p1 = ev(k1.pos, new THREE.Vector3());
    const l0 = ev(k0.look, new THREE.Vector3()), l1 = ev(k1.look, new THREE.Vector3());
    this.cam(p0.lerp(p1, a), l0.lerp(l1, a), lerp(k0.fov ?? this.camFov, k1.fov ?? k0.fov ?? this.camFov, a), lerp(k0.roll ?? 0, k1.roll ?? k0.roll ?? 0, a));
  }

  /** Damped chase camera: position/look given in `actor`'s frame (fixed yaw), smoothed with rate k. */
  follow(actor, offset, lookOff, fov, { yaw, k = 6, lookK = 10 } = {}) {
    const want = this.rel(actor, offset, yaw, _v);
    const wantL = this.rel(actor, lookOff, yaw, _v2);
    if (!this._follow) this._follow = { p: want.clone(), l: wantL.clone() };
    const f = this._follow;
    f.p.lerp(want, 1 - Math.exp(-k * DT));
    f.l.lerp(wantL, 1 - Math.exp(-lookK * DT));
    this.cam(f.p, f.l, fov);
  }

  _applyCamera() {
    const cam = this.g.camera;
    cam.position.copy(this.camPos);
    cam.up.set(0, 1, 0);
    cam.lookAt(this.camLook);
    if (this.camRoll) cam.rotateZ(this.camRoll);
    if (Math.abs(cam.fov - this.camFov) > 1e-3) {
      cam.fov = this.camFov;
      cam.updateProjectionMatrix();
    }
    // keep the game's trauma shake on top of the scripted framing (the rig only advances it when a player exists)
    const rig = this.g.cameraRig;
    rig._applyShake(this.g.player ? 0 : DT);
  }
}

export { Scene };

export class Trailer {
  constructor(game, timeline, overlay) {
    this.g = game;
    this.audio = game.audio;
    this.tl = timeline;
    this.overlay = overlay;
    this.active = false;
    this.ready = false;
    this.frame = -1;
    this.t = 0;
    this.cur = null;
    this.audio.clock = () => this.t;
    const sc = timeline.scenes;
    for (let i = 0; i < sc.length; i++) sc[i].end = i + 1 < sc.length ? sc[i + 1].at : timeline.duration;
    this.duration = timeline.duration;
    overlay?.setItems(timeline.overlays || []);
    this._hook();
  }

  _hook() {
    const g = this.g;
    const loop = g._loop.bind(g);
    const upPlay = g._updatePlaying.bind(g);
    const upMenu = g._updateMenus.bind(g);
    this._upPlay = upPlay;
    g._loop = () => {
      this._beforeFrame();
      loop();
    };
    g._updatePlaying = (dt) => {
      upPlay(dt);
      this._afterUpdate();
    };
    g._updateMenus = (dt) => {
      upMenu(dt);
      this._afterUpdate();
    };
    // no pointer lock while capturing; the HUD must not ask for it
    g.input.requestLock = () => {};
    g.input.exitLock = () => {};
    g.input.locked = true;
  }

  /** Start at frame `from` (scenes before it are skipped; the scene containing it is simulated up to it). */
  begin(from = 0) {
    this.active = true;
    this.frame = from - 1;
    this.t = from / FPS;
    this.cur = null;
    this.audio.events = [];
    for (const c of this.tl.cues || []) this.audio.cue(c.at, c.name, c.o || {});
    return { frames: Math.round(this.duration * FPS), duration: this.duration };
  }

  sceneAt(t) {
    const sc = this.tl.scenes;
    for (let i = sc.length - 1; i >= 0; i--) if (t >= sc[i].at - 1e-9) return sc[i];
    return sc[0];
  }

  _beforeFrame() {
    if (!this.active) return;
    this.frame++;
    this.t = this.frame / FPS;
    const def = this.sceneAt(this.t);
    if (!this.cur || this.cur.def !== def) this._enter(def, this.t - def.at);
    const S = this.cur;
    S.t = this.t - def.at;
    this._step(S);
  }

  _step(S) {
    S._input();
    for (const a of S.actions) {
      if (a.done || S.t < a.t - 1e-9) continue;
      a.done = true;
      a.fn(S);
    }
    S.def.update?.(S, S.t);
    const g = this.g;
    if (S.data.autoParry && S.p) this._autoParry(S);
    if (S.timeScale != null) {
      g.timeScale = g.slowTarget = S.timeScale;
      g.slowT = 0;
    }
  }

  /** Raise the guard just before an incoming hit lands (perfect-parry window is the first 0.2 s of a block). */
  _autoParry(S) {
    const p = S.p;
    if (p.state === 'block' || S.holds.some((h) => h.button === 2)) return;
    for (const e of this.g.enemies) {
      const r = e.alive && e.action;
      if (!r) continue;
      for (const h of r.def.hits || []) {
        const dt = (h.t - r.t) / Math.max(0.05, r.speed ?? 1);
        if (dt > 0 && dt <= (S.data.parryLead ?? 0.09)) {
          S.hold('block', 0.3);
          return;
        }
      }
    }
  }

  _afterUpdate() {
    if (!this.active || this._prerolling) return;
    const S = this.cur;
    if (!S) return;
    S.camSet = false;
    if (S.def.camera && S.def.camera(S, S.t) !== false && S.camSet) S._applyCamera();
    this.overlay?.update(this.t, S);
    this.audio.commitListener(this.g.camera);
  }

  /** Enter a scene; `skip` > 0 when rendering starts in its middle (simulated silently up to there). */
  _enter(def, skip = 0) {
    const g = this.g;
    this.audio.muted = true;
    window.__vclock?.seed(hash(def.id));
    const S = (this.cur = new Scene(this, def));
    this._stage(S);
    def.setup?.(S);
    const pre = Math.round((def.preroll || 0) * FPS) + Math.max(0, Math.round(skip * FPS));
    if (pre > 0) {
      this._prerolling = true;
      const base = -Math.round((def.preroll || 0) * FPS);
      for (let i = 0; i < pre; i++) {
        S.t = (base + i) / FPS;
        this._step(S);
        g.realTime += DT;
        if (g.state === 'playing') this._upPlay(DT);
        g.input.endFrame();
      }
      this._prerolling = false;
    }
    this.audio.gain = def.sfx ?? 1;
    this.audio.muted = !!def.mute;
    this.audio.resync();
    this.overlay?.hud(def.hud || 'cine');
  }

  _stage(S) {
    const g = this.g;
    const def = S.def;
    const st = def.stage || {};
    const char = st.char || 'tanjiro';
    const d = g.director;
    d.script = null;
    d.waitFn = null;
    d.wait = 0;
    d.tokens.clear();
    d.waveQueue = null;
    d.bossDown = null;
    d.charId = char;
    g._clearActors();
    g.fx.clear();
    g.fx.screen.tint.setRGB(1, 1, 1);
    g.boss = null;
    g.timeScale = g.slowTarget = 1;
    g.slowT = 0;
    g.freezeT = 0;
    g.enemyTimeScale = 1;
    g.combo.count = 0;
    g.combo.timer = 0;
    g.input.keys.clear();
    for (const b of [0, 1, 2]) if (g.input.mouse.has(b)) g.input.buttonUp(b);
    g.input.attackMode = 'light';
    g.input.endFrame();
    const rig = g.cameraRig;
    rig.lock = null;
    rig.stopCine();
    rig.trauma = 0;
    rig.fovKick = 0;
    rig.shakeT = 0;
    // every scene starts from the same state whatever was rendered before it
    g.time = def.at;
    g.realTime = def.at;
    d.seed = 1 + (hash(def.id) % 97);
    const hud = g.ui?.hud;
    if (hud) {
      hud.callouts?.clear();
      hud.bannerC?.clear();
      hud.sub?.clear();
      hud.promptC?.hide();
      hud.toasts?.clear();
      hud.intro?.clear();
      hud.dmg?.clear();
      hud.setLetterbox?.(false);
    }
    if (st.world === 'title') {
      g.world.buildHall();
      g.world.time = 0;
      g._lightingHall();
      g.state = 'title';
      g.ui.hideAll();
      g.hud.reset();
      return;
    }
    const world = st.world || 'hall';
    if (world === 'arena') g.world.buildArena();
    else g.world.buildHall();
    g.world.time = 0;
    if (world === 'arena') g._lightingArena();
    else g._lightingHall();
    g.mode = 'story';
    g.charId = char;
    g.state = 'playing';
    g.frozen = false;
    g.ui.showHUD(char);
    g.hud.reset();
    if (st.player !== false) {
      const pl = st.player || {};
      const p = d.spawnPlayer(vec(pl.pos || [0, 0, 0]), pl.yaw ?? 0);
      p.god = pl.god ?? true;
      if (pl.god === false) p.hp = p.maxHp = 9999;
      p.conc = pl.conc ?? 0;
      p.breath = p.maxBreath;
      S.p = p;
    }
  }
}
