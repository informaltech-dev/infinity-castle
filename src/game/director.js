import * as THREE from 'three';
import { Player } from '../actors/player.js';
import { Enemy } from '../actors/enemy.js';
import { Akaza } from '../actors/boss.js';
import { Kokushibo, kokushiboTier } from '../actors/kokushibo.js';
import { buildTanjiro, buildGiyu, buildRengoku, buildObanai, buildSanemi, buildGyomei, buildAkaza, buildKokushibo, buildDemon } from '../actors/characters.js';
import { CHAR_FX } from './moves.js';
import { LAYER_FX } from '../render/pipeline.js';

const WAVES = [
  { title: '第一波', sub: '惡鬼自紙門湧出', list: ['grunt', 'grunt', 'grunt', 'grunt'], max: 3 },
  { title: '第二波', sub: '疾走之鬼', list: ['grunt', 'fast', 'grunt', 'fast', 'grunt'], max: 4 },
  { title: '第三波', sub: '巨鬼現身', list: ['brute', 'grunt', 'fast', 'grunt', 'fast', 'grunt'], max: 4 },
];

const LINES = {
  tanjiro: {
    intro: ['竈門炭治郎', '這裡就是……無限城。鬼的氣味好濃！'],
    boss: ['竈門炭治郎', '猗窩座——！這次我一定要斬下你的頸！'],
    kokushibo: ['竈門炭治郎', '好可怕的氣味……連空氣都在發抖。但我不會退縮！'],
    victory: ['竈門炭治郎', '……安息吧。'],
  },
  giyu: {
    intro: ['富岡義勇', '……鬼舞辻的巢穴。不能在這裡停下腳步。'],
    boss: ['富岡義勇', '上弦之參……我會在這裡斬了你。'],
    kokushibo: ['富岡義勇', '上弦之壹……就算賭上這條命，也要在這裡斬了你。'],
    victory: ['富岡義勇', '……結束了。'],
  },
  rengoku: {
    intro: ['煉獄杏壽郎', '唔姆！這就是無限城嗎！鬼的巢穴，就由我一口氣燒盡！'],
    boss: ['煉獄杏壽郎', '猗窩座！我不會成為鬼。我要履行我的職責！'],
    kokushibo: ['煉獄杏壽郎', '上弦之壹！好驚人的壓迫感！但我的心，依然在燃燒！'],
    victory: ['煉獄杏壽郎', '……燃燒你的心吧。向前邁進！'],
  },
  obanai: {
    intro: ['伊黑小芭內', '……令人作嘔的地方。鬼一隻也別想逃。'],
    boss: ['伊黑小芭內', '上弦之參……你的頸，由我來取。'],
    kokushibo: ['伊黑小芭內', '上弦之壹……就算是你，我也會取下你的頸。'],
    victory: ['伊黑小芭內', '……哼。不過如此。'],
  },
  sanemi: {
    intro: ['不死川實彌', '哈！到處都是鬼的臭味。全部給我出來，一隻不剩地剁碎！'],
    boss: ['不死川實彌', '上弦之參是吧……你這傢伙的頸，我收下了！'],
    kokushibo: ['不死川實彌', '上弦之壹……好啊，就讓你嘗嘗我這身血的滋味！'],
    victory: ['不死川實彌', '……哼。鬼就該死在這裡。'],
  },
  gyomei: {
    intro: ['悲鳴嶼行冥', '南無阿彌陀佛……這座城裡，到處都是可憐的東西。'],
    boss: ['悲鳴嶼行冥', '上弦之參……南無阿彌陀佛。今日，便在此處了結你。'],
    kokushibo: ['悲鳴嶼行冥', '上弦之壹……好沉的氣息。南無阿彌陀佛——我會將你的頸，擊碎在此。'],
    victory: ['悲鳴嶼行冥', '……南無阿彌陀佛。願你來世，安然往生。'],
  },
};

/** What Akaza says to each of them as the fight begins. */
const AKAZA_GREETS = {
  tanjiro: '又見面了，炭治郎。讓我看看你變得多強了！',
  giyu: '好強的鬥氣……你是柱吧。成為鬼吧！',
  rengoku: '杏壽郎！又見面了。這一次，你一定要成為鬼！',
  obanai: '蛇一般的劍氣……你也是柱吧。成為鬼吧！',
  sanemi: '好兇暴的鬥氣！這股血的氣味……你也是柱吧。成為鬼吧！',
  gyomei: '這鬥氣……簡直是至高之境！你就是鬼殺隊最強之人吧。成為鬼吧，與我永遠戰下去！',
};

/** What Kokushibo says to each of them. (Tanjiro wears the hanafuda earrings his brother wore.) */
const KOKUSHIBO_GREETS = {
  tanjiro: '那副耳飾……為何會在你身上……',
  giyu: '水之呼吸……鍛鍊得不錯。可惜，在月光之下，不過是一圈漣漪。',
  rengoku: '炎之呼吸……燒了數百年的火焰。讓我看看，它還能燒到什麼地步。',
  obanai: '蛇之呼吸……自水分出的一支。區區旁支，也想觸及明月嗎。',
  sanemi: '這氣味……是稀血。而且是極其罕見的稀血。你以為，這種東西能令我醉倒嗎。',
  gyomei: '如此鍛鍊至極的肉體……這三百年來，我從未見過能與你匹敵之人。',
};

const BUILDERS = { tanjiro: buildTanjiro, giyu: buildGiyu, rengoku: buildRengoku, obanai: buildObanai, sanemi: buildSanemi, gyomei: buildGyomei };
export const isPlayable = (id) => Object.hasOwn(BUILDERS, id);

export class Director {
  constructor(game) {
    this.game = game;
    this.script = null;
    this.wait = 0;
    this.waitFn = null;
    this.tokens = new Set();
    this.lastTokenT = -9;
    this.seed = 1;
    this.pending = [];
  }

  get lines() {
    return LINES[this.charId] || LINES.tanjiro;
  }
  get fxs() {
    return CHAR_FX[this.charId] || CHAR_FX.tanjiro;
  }

  // ---------------------------------------------------------------- script runner
  run(gen) {
    this.script = gen;
    this.wait = 0;
    this.waitFn = null;
    this._step();
  }
  _step() {
    if (!this.script) return;
    const r = this.script.next();
    if (r.done) {
      this.script = null;
      return;
    }
    const v = r.value;
    if (typeof v === 'number') this.wait = v;
    else if (typeof v === 'function') this.waitFn = v;
    else this.wait = 0;
  }
  update(dt, realDt) {
    if (!this.script) return;
    if (this.waitFn) {
      if (this.waitFn()) {
        this.waitFn = null;
        this._step();
      }
      return;
    }
    this.wait -= realDt;
    if (this.wait <= 0) this._step();
    void dt;
  }

  // ---------------------------------------------------------------- tokens
  requestToken(e) {
    const g = this.game;
    if (this.tokens.has(e)) return true;
    for (const t of this.tokens) if (!t.alive || t.state !== 'attack') this.tokens.delete(t);
    if (this.tokens.size >= g.combat.diff.tokens) return false;
    if (g.time - this.lastTokenT < 0.45) return false;
    if (g.player && (g.player.state === 'down' || !g.player.alive)) return false;
    this.tokens.add(e);
    this.lastTokenT = g.time;
    return true;
  }
  releaseToken(e) {
    this.tokens.delete(e);
  }

  // ---------------------------------------------------------------- start
  start(mode, charId) {
    const g = this.game;
    g._clearActors();
    g.fx.clear();
    g.boss = null;
    g.enemyTimeScale = 1;
    g.timeScale = g.slowTarget = 1;
    g.slowT = 0;
    g.combo.count = 0;
    this.tokens.clear();
    this.charId = isPlayable(charId) ? charId : 'tanjiro';
    g.cameraRig.lock = null;
    g.cameraRig.stopCine();
    if (mode === 'boss') this.run(this.bossOnly('akaza'));
    else if (mode === 'kokushibo') this.run(this.bossOnly('kokushibo'));
    else this.run(this.story());
  }

  spawnPlayer(pos, yaw) {
    const g = this.game;
    const model = BUILDERS[this.charId](g.T);
    const p = new Player(g, this.charId, model);
    p.pos.copy(pos);
    p.yaw = yaw;
    g.scene.add(model.root);
    p.shadow = this._shadow(g);
    g.player = p;
    g.cameraRig.snapBehind(yaw);
    g.cameraRig.focus.set(pos.x, 1.4, pos.z);
    return p;
  }

  _shadow(g) {
    const tex = g.T?.shadow;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex || null, color: tex ? 0xffffff : 0x000000, transparent: true, opacity: tex ? 0.75 : 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.layers.set(LAYER_FX);
    m.renderOrder = 1;
    g.scene.add(m);
    return m;
  }

  spawnEnemy(variant, pos) {
    const g = this.game;
    const model = buildDemon(g.T, variant, this.seed++);
    const e = new Enemy(g, model, variant);
    g.scene.add(model.root);
    e.shadow = this._shadow(g);
    const yaw = g.player ? Math.atan2(g.player.pos.x - pos.x, g.player.pos.z - pos.z) : 0;
    e.spawnAt(pos.clone(), yaw);
    g.enemies.push(e);
    g.world.openDoorNear(pos);
    g.audio?.play('doorSlide', { pos, volume: 0.6 });
    return e;
  }

  onKill(e) {
    const g = this.game;
    // last demon of a wave: short kill-cam slow motion
    if (this.waveQueue && this.waveQueue.length === 0 && !g.enemies.some((o) => o.alive && o !== e && !o.isBoss)) {
      g.slowmo(0.25, 0.9);
      g.fx.screen.impact(0.08, 0x0a0608, 0xf6efe2);
      g.fx.screen.radial(0.4);
      g.cameraRig.kick(8);
      g.audio?.play('impactFrame');
    }
  }

  onBossDefeated(boss) {
    this.bossDown = boss;
  }

  onPlayerDeath() {
    this.run(this.defeat());
  }

  // ---------------------------------------------------------------- scripts
  *story() {
    const g = this.game;
    g.world.buildHall();
    g._lightingHall();
    const p = this.spawnPlayer(new THREE.Vector3(0, 0, -2), 0);
    g.audio?.playMusic('stage', 2);
    yield* this.introFall(p);
    for (let i = 0; i < WAVES.length; i++) {
      yield* this.wave(i);
      if (!p.alive) return;
      yield 0.8;
      g.hud.banner('擊退', i < WAVES.length - 1 ? '呼吸調勻，體力回復' : '', 'victory');
      g.audio?.play('taiko');
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4);
      p.breath = p.maxBreath;
      yield 2.4;
    }
    yield* this.shiftToBoss();
    yield* this.bossFight();
  }

  *bossOnly(which) {
    const g = this.game;
    g.world.buildArena();
    if (which === 'kokushibo') g._lightingMoon();
    else g._lightingArena();
    this.spawnPlayer(new THREE.Vector3(0, 0, -8), 0);
    g.player.conc = 40;
    yield* which === 'kokushibo' ? this.kokushiboFight() : this.bossFight();
  }

  *introFall(p) {
    const g = this.game;
    p.interruptUlt();
    p.control = false;
    p.setState('cine');
    p.posY = 13;
    p.onGround = false;
    p.yVel = -2;
    p.anim.play(p.clips.fall, { fade: 0, hold: true });
    g.hud.letterbox(true);
    g.audio?.play('biwaShift');
    g.cameraRig.play([
      { t: 0, pos: [6, 1.2, 7], look: [0, 9, 0], fov: 60 },
      { t: 1.1, pos: [4.5, 1.6, 5.5], look: [0, 2.5, 0], fov: 52, e: 'inOut' },
      { t: 2.2, pos: [2.6, 1.5, 3.8], look: [0, 1.1, 0], fov: 48, e: 'out' },
    ], { anchor: p.pos.clone(), hold: true });
    let landed = false;
    p.onLand = () => {
      landed = true;
      p.anim.play(p.clips.landing, { fade: 0.02 });
      g.fx.ground(p.pos, { size: 2.2, color: 0xfff0d8, crack: true });
      g.cameraRig.shake(0.6);
      g.audio?.play('land', { volume: 1 });
      g.audio?.play('groundSlam', { volume: 0.5 });
      p.onLand = null;
    };
    yield () => landed;
    yield 0.5;
    g.hud.banner('無限城', '鬼舞辻無慘的根據地', 'normal');
    yield 1.4;
    g.hud.subtitle(this.lines.intro[0], this.lines.intro[1], 3);
    yield 2.2;
    g.cameraRig.stopCine();
    g.cameraRig.snapBehind(p.yaw);
    g.cameraRig._syncFromCamera();
    g.cameraRig.yaw = p.yaw + Math.PI;
    g.hud.letterbox(false);
    p.control = true;
    p.setState('move');
    g.input.requestLock();
    g.hud.subtitle(
      '操作',
      g.input.touchMode
        ? '左半邊按住拖曳移動・右半邊滑動轉視角・「斬」攻擊・「閃」閃避・按住「防」防禦'
        : '左鍵攻擊・Q 切換輕重・右鍵防禦・空白鍵閃避・1／2／3 呼吸法・R 奧義・Tab 鎖定',
      6,
    );
  }

  *wave(i) {
    const g = this.game;
    const W = WAVES[i];
    g.hud.banner(W.title, W.sub, 'danger');
    g.audio?.play('waveStart');
    g.hud.objective(`擊退惡鬼（${W.title}）`);
    yield 1.2;
    const queue = W.list.slice();
    this.waveQueue = queue;
    const spawnOne = () => {
      const v = queue.shift();
      const pts = g.world.spawnPoints;
      // spawn away from the player
      const sorted = pts.slice().sort((a, b) => b.distanceTo(g.player.pos) - a.distanceTo(g.player.pos));
      const pt = sorted[Math.floor(Math.random() * Math.min(4, sorted.length))];
      this.spawnEnemy(v, pt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0, 0)));
    };
    let spawnT = 0;
    while (queue.length || g.enemies.some((e) => e.alive)) {
      if (!g.player.alive) return;
      const alive = g.enemies.filter((e) => e.alive).length;
      spawnT -= 0.1;
      if (queue.length && alive < W.max && spawnT <= 0) {
        spawnOne();
        spawnT = 0.7;
      }
      yield 0.1;
    }
    g.hud.objective('');
  }

  *shiftToBoss() {
    const g = this.game;
    const p = g.player;
    p.interruptUlt();
    p.control = false;
    g.hud.subtitle('', '錚——　鳴女的琵琶聲響徹無限城……', 3);
    g.audio?.play('biwaShift');
    g.audio?.playMusic(null, 2);
    g.world.shiftAll(1.5);
    g.cameraRig.shake(0.5);
    yield 1.4;
    g.audio?.play('biwaShift');
    g.world.shiftAll(1.5);
    g.cameraRig.shake(0.7);
    g.fx.screen.exposure = 0;
    yield 1.2;
    // rebuild as the boss arena
    g._clearActors();
    g.fx.clear();
    g.world.buildArena();
    g._lightingArena();
    const np = this.spawnPlayer(new THREE.Vector3(0, 0, -8), 0);
    np.hp = np.maxHp;
    np.conc = Math.max(np.conc, 30);
    g.fx.screen.exposure = 1;
    yield 0.3;
  }

  *bossFight() {
    const g = this.game;
    const p = g.player;
    const model = buildAkaza(g.T);
    const boss = new Akaza(g, model);
    boss.pos.set(0, 0, 8);
    boss.yaw = Math.PI;
    g.scene.add(model.root);
    boss.shadow = this._shadow(g);
    g.enemies.push(boss);
    g.boss = boss;
    this.bossDown = null;
    boss.anim.play(boss.clips.taunt, { fade: 0, hold: true });
    boss.setState('intro');
    // intro cinematic
    p.interruptUlt();
    p.control = false;
    p.setState('cine');
    g.hud.letterbox(true);
    g.fx.screen.exposure = 1;
    g.audio?.play('biwa', { note: 0, volume: 0.8 });
    g.audio?.playMusic(null, 0.8);
    g.cameraRig.play([
      { t: 0, pos: [1.2, 1.6, -11.5], look: [0, 1.4, 8], fov: 50 },
      { t: 2.2, pos: [1.0, 1.7, 3.5], look: [0, 1.6, 8], fov: 42, e: 'inOut' },
      { t: 3.6, pos: [0.5, 1.75, 5.9], look: [0, 1.7, 8], fov: 32, e: 'inOut' },
    ], { hold: true });
    // Entrance theme: its second hit (2.16 s in) lands on the title card at 3.0 s, and it swells ~10.2 s in,
    // right as control returns. It hands over to the battle theme by itself when it ends.
    yield 0.84;
    g.audio?.playMusic('appear', 0.05);
    yield 2.16;
    g.hud.bossIntro({ title: '上弦之參', name: '猗窩座', subtitle: '破壞殺・羅針' });
    g.audio?.play('bossRoar');
    g.fx.screen.flash(0x7fe6ff, 0.35, 4);
    yield 3.2;
    g.hud.subtitle('猗窩座', AKAZA_GREETS[this.charId], 3);
    boss.anim.stop(0.3);
    yield 2.4;
    g.hud.subtitle(this.lines.boss[0], this.lines.boss[1], 2.6);
    g.cameraRig.play([
      { t: 0, pos: [1.6, 1.9, -12], look: [0, 1.2, 0], fov: 50 },
      { t: 2.4, pos: [0.4, 2.1, -13.2], look: [0, 1.3, 0], fov: 52, e: 'inOut' },
    ], { onEnd: () => {} });
    yield 2.44;
    g.hud.letterbox(false);
    g.cameraRig.stopCine();
    g.cameraRig.yaw = Math.PI;
    g.cameraRig.pitch = 0.2;
    p.control = true;
    p.setState('move');
    boss.setState('idle');
    boss.cooldown = 0.8;
    p.lockTarget = boss;
    g.cameraRig.lock = boss;
    g.hud.objective('擊敗上弦之參・猗窩座');
    g.input.requestLock();
    // fight until he kneels
    yield () => this.bossDown || !p.alive;
    if (!p.alive) return;
    yield* this.finisher(boss);
  }

  *finisher(boss) {
    const g = this.game;
    const p = g.player;
    const { yaw } = yield* this._decapitate(boss);
    g.cameraRig.play([
      { t: 0, pos: [2.5, 1.4, -1.5], look: [0, 1.4, 1.5], fov: 40 },
      { t: 2.5, pos: [3.4, 1.8, -2.8], look: [0, 1.2, 1.0], fov: 38, e: 'inOut' },
      { t: 6.5, pos: [4.6, 2.6, -4.6], look: [0, 1.0, 0], fov: 42, e: 'inOut' },
    ], { anchor: boss.pos.clone(), relYaw: yaw, hold: true });
    yield 0.25;
    g.fx.screen.impact(0.1, 0x050305, 0xfff4e8);
    g.slowmo(0.3, 1.2);
    yield 2.2;
    g.hud.subtitle('猗窩座', '……還不夠……我還能……', 2.4);
    yield 2.6;
    g.hud.subtitle('猗窩座', '……戀雪。', 3.0);
    g.audio?.play('biwa', { note: 5, volume: 0.6 });
    yield 3.2;
    g.hud.subtitle(this.lines.victory[0], this.lines.victory[1], 2.4);
    p.anim.play(p.clips.victory, { fade: 0.3, hold: true });
    p.setTrail(null);
    yield 2.8;
    g.fx.screen.desatTarget = 0;
    g.hud.letterbox(false);
    g.gameOver(true);
  }

  /** The prompt, the dash through him, the head. Returns the direction of the cut and its yaw. */
  *_decapitate(boss) {
    const g = this.game;
    const p = g.player;
    g.hud.objective('');
    p.interruptUlt();
    p.control = false;
    p.action = null;
    p.setState('cine');
    p.invuln = 99;
    g.slowmo(0.25, 2.5);
    g.audio?.playMusic(null, 1.5);
    g.hud.prompt('斬首', '左鍵');
    g.fx.screen.desatTarget = 0.5;
    let pressed = false;
    const t0 = g.realTime;
    yield () => {
      if (g.input.pressed('light') || g.input.pressed('heavy')) pressed = true;
      return pressed || g.realTime - t0 > 4;
    };
    g.hud.hidePrompt();
    g.slowTarget = 1;
    g.slowT = 0;
    g.timeScale = 1;
    // teleport-dash through him
    const dir = new THREE.Vector3(boss.pos.x - p.pos.x, 0, boss.pos.z - p.pos.z).normalize();
    g.fx.effects.afterimage(p.model, { color: this.fxs.after, life: 0.5, alpha: 0.5 });
    p.pos.copy(boss.pos).addScaledVector(dir, 2.2);
    p.faceInstant(boss.pos.clone().addScaledVector(dir, 10));
    p.anim.play(p.clips.light3, { fade: 0, time: 0.17, hold: true });
    p.setTrail(this.fxs.style);
    g.hud.letterbox(true);
    g.fx.screen.impact(0.16, 0x050305, 0xfff4e8);
    g.fx.screen.radial(0.9);
    g.fx.screen.speed(1, 0.4);
    g.audio?.play('finisher');
    g.audio?.play('impactFrame');
    g.audio?.duck(0.8, 1.2);
    g.cameraRig.shake(0.9);
    boss.behead(dir);
    g.fx.hit(boss.chest(new THREE.Vector3()), dir, { style: this.fxs.style, power: 1, crit: true });
    g.fx.effects.arc({
      center: boss.chest(new THREE.Vector3()).setY(1.62),
      f: new THREE.Vector3(-dir.z, 0, dir.x),
      s: dir.clone(),
      radius: 1.2, width: 0.6, arc: Math.PI * 1.2, style: this.fxs.style, life: 0.6, wipe: 0.05,
    });
    return { dir, yaw: Math.atan2(dir.x, dir.z) };
  }

  // ---------------------------------------------------------------- Kokushibo
  *kokushiboFight() {
    const g = this.game;
    const p = g.player;
    // one player for now; the party tier and seed are what a shared fight would hand every machine
    const q = new URLSearchParams(location.search);
    const tier = kokushiboTier(1, q.get('tier'));
    const seed = Number(q.get('seed')) || (Date.now() & 0x7fffffff) || 1;
    const model = buildKokushibo(g.T);
    const boss = new Kokushibo(g, model, tier, seed);
    boss.pos.set(0, 0, 8);
    boss.yaw = Math.PI;
    g.scene.add(model.root);
    boss.shadow = this._shadow(g);
    g.enemies.push(boss);
    g.boss = boss;
    this.bossDown = null;
    boss.anim.play(boss.clips.taunt, { fade: 0, hold: true });
    boss.setState('intro');
    // intro: from behind the player across the whole floor, then a slow push in to his eyes
    p.interruptUlt();
    p.control = false;
    p.setState('cine');
    g.hud.letterbox(true);
    g.fx.screen.exposure = 1;
    g.audio?.playMusic(null, 0.8);
    g.audio?.play('biwa', { note: 0, volume: 0.8 });
    g.cameraRig.play([
      { t: 0, pos: [1.4, 1.5, -11.5], look: [0, 1.5, 8], fov: 48 },
      { t: 2.6, pos: [0.9, 1.7, 3.2], look: [0, 1.7, 8], fov: 40, e: 'inOut' },
      { t: 4.2, pos: [0.3, 1.77, 6.5], look: [0, 1.73, 8], fov: 26, e: 'inOut' },
    ], { hold: true });
    yield 1.4;
    g.audio?.play('biwa', { note: 3, volume: 0.7 });
    yield 1.3;
    g.audio?.playMusic('moon', 0.3);
    boss.eyeFlash();
    g.hud.bossIntro({ title: '上弦之壹', name: '黑死牟', subtitle: '月之呼吸', theme: 'moon' });
    g.audio?.play('moonRead');
    g.fx.screen.flash(0xc8a0ff, 0.35, 4);
    yield 3.2;
    g.hud.subtitle('黑死牟', KOKUSHIBO_GREETS[this.charId], 3.2);
    boss.anim.stop(0.4);
    yield 2.8;
    g.hud.subtitle(this.lines.kokushibo[0], this.lines.kokushibo[1], 2.6);
    g.cameraRig.play([
      { t: 0, pos: [1.6, 1.9, -12], look: [0, 1.2, 0], fov: 50 },
      { t: 2.4, pos: [0.4, 2.1, -13.2], look: [0, 1.3, 0], fov: 52, e: 'inOut' },
    ], { onEnd: () => {} });
    yield 2.44;
    g.hud.letterbox(false);
    g.cameraRig.stopCine();
    g.cameraRig.yaw = Math.PI;
    g.cameraRig.pitch = 0.2;
    p.control = true;
    p.setState('move');
    boss.setState('idle');
    boss.cooldown = 1.0;
    p.lockTarget = boss;
    g.cameraRig.lock = boss;
    g.hud.objective('擊敗上弦之壹・黑死牟');
    g.input.requestLock();
    yield () => this.bossDown || !p.alive;
    if (!p.alive) return;
    yield* this.kokushiboFinisher(boss);
  }

  /** The manga's end of him: the head comes off, grows back monstrous, he sees himself, and crumbles. */
  *kokushiboFinisher(boss) {
    const g = this.game;
    const p = g.player;
    g.hud.subtitle('黑死牟', '……我……會輸……？', 2);
    const { yaw } = yield* this._decapitate(boss);
    g.cameraRig.play([
      { t: 0, pos: [2.5, 1.5, -1.5], look: [0, 1.5, 1.5], fov: 40 },
      { t: 3, pos: [3.2, 1.9, -2.6], look: [0, 1.4, 1.0], fov: 38, e: 'inOut' },
    ], { anchor: boss.pos.clone(), relYaw: yaw, hold: true });
    yield 0.25;
    g.fx.screen.impact(0.1, 0x050305, 0xfff4e8);
    g.slowmo(0.3, 1.2);
    yield 1.8;
    // he does not fall
    g.hud.subtitle('黑死牟', '……不。我不會在這裡倒下……！', 2.2);
    yield 1.0;
    boss.regrow();
    g.cameraRig.play([
      { t: 0, pos: [2.6, 1.6, -2.2], look: [0, 1.6, 0.6], fov: 38 },
      { t: 4.5, pos: [1.6, 1.9, -3.0], look: [0, 1.8, 0.4], fov: 32, e: 'inOut' },
    ], { anchor: boss.pos.clone(), relYaw: yaw, hold: true });
    yield 2.4;
    g.hud.subtitle('黑死牟', '……映在刀身上的……那是……什麼……？', 2.8);
    yield 3.0;
    g.hud.subtitle('黑死牟', '這醜陋的樣子……就是我……？', 2.6);
    g.fx.screen.desatTarget = 0.6;
    yield 2.6;
    boss.crumble();
    g.audio?.play('biwa', { note: 5, volume: 0.6 });
    yield 2.0;
    g.hud.subtitle('黑死牟', '……我究竟……是為了什麼……', 3.0);
    yield 3.4;
    // what is left on the boards
    const at = (boss.flute?.position ?? boss.pos).clone();
    g.cameraRig.play([
      { t: 0, pos: [at.x + 0.75, 0.62, at.z - 0.55], look: [at.x, 0.02, at.z], fov: 32 },
      { t: 4, pos: [at.x + 0.5, 0.42, at.z - 0.36], look: [at.x, 0.02, at.z], fov: 28, e: 'inOut' },
    ], { hold: true });
    g.hud.subtitle('', '散去的灰燼之中，只留下一支笛子。', 3.2);
    yield 3.6;
    g.hud.subtitle(this.lines.victory[0], this.lines.victory[1], 2.4);
    p.anim.play(p.clips.victory, { fade: 0.3, hold: true });
    p.setTrail(null);
    yield 2.8;
    g.fx.screen.desatTarget = 0;
    g.hud.letterbox(false);
    g.gameOver(true);
  }

  *defeat() {
    const g = this.game;
    g.hud.objective('');
    yield 2.6;
    g.gameOver(false);
  }
}
