import * as THREE from 'three';
import { device } from '../core/device.js';

const _v = new THREE.Vector3();

/** Bridges game state to the DOM HUD (projects world positions, throttles updates). */
export class HudAdapter {
  constructor(game, hud) {
    this.game = game;
    this.hud = hud || null;
    this.showNumbers = true;
    this._bars = [];
    // pointer-lock hint (lives outside the UI module)
    const el = document.createElement('div');
    el.id = 'lock-hint';
    el.textContent = '點擊畫面以操控視角';
    el.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:18%', 'transform:translateX(-50%)', 'z-index:30',
      "font:600 clamp(14px,1.6vmin,20px)/1.4 'Noto Serif TC','Songti TC',serif", 'letter-spacing:.3em',
      'color:#efe6d2', 'padding:.6em 1.6em', 'pointer-events:none', 'opacity:0', 'transition:opacity .3s',
      'background:linear-gradient(90deg,transparent,rgba(13,11,12,.78) 18%,rgba(13,11,12,.78) 82%,transparent)',
      'text-shadow:0 0 6px #000',
    ].join(';');
    document.body.appendChild(el);
    this.lockHint = el;
    // off-screen attack warnings: red ink chevrons on the screen edge
    this.threatLayer = document.createElement('div');
    this.threatLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:25;overflow:hidden';
    document.body.appendChild(this.threatLayer);
    this.threatPool = [];
  }

  _threat(i) {
    let el = this.threatPool[i];
    if (!el) {
      el = document.createElement('div');
      el.innerHTML = '<svg width="54" height="54" viewBox="0 0 54 54"><path d="M8 40 L27 10 L46 40 L27 30 Z" fill="#e0294a" stroke="#1a0508" stroke-width="3" stroke-linejoin="round"/></svg>';
      el.style.cssText = 'position:absolute;left:0;top:0;width:54px;height:54px;margin:-27px 0 0 -27px;filter:drop-shadow(0 0 8px rgba(224,41,74,.9));transition:opacity .12s';
      this.threatLayer.appendChild(el);
      this.threatPool[i] = el;
    }
    return el;
  }

  _updateThreats() {
    const g = this.game;
    const cam = g.camera;
    let n = 0;
    if (g.state === 'playing' && g.player && g.player.alive) {
      for (const e of g.enemies) {
        if (!e.alive || !e.action || (e.state !== 'attack' && e.state !== 'action')) continue;
        const wind = e.action.def.windup ?? 0.4;
        if (e.action.t > wind + 0.1) continue;
        e.chest(_v);
        const p = _v.clone().project(cam);
        const behind = p.z > 1;
        const on = !behind && Math.abs(p.x) < 0.92 && Math.abs(p.y) < 0.9;
        if (on) continue;
        // direction on screen (flip when behind the camera)
        let x = p.x, y = p.y;
        if (behind) { x = -x; y = -y; }
        const a = Math.atan2(y, x);
        const r = Math.min(this.game.width, this.game.height) * 0.42;
        const cx = this.game.width / 2 + Math.cos(a) * r * (this.game.width / this.game.height > 1 ? 1.35 : 1);
        const cy = this.game.height / 2 - Math.sin(a) * r;
        const el = this._threat(n++);
        el.style.opacity = '1';
        el.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) rotate(${(-a + Math.PI / 2).toFixed(3)}rad) scale(${(1 + 0.15 * Math.sin(g.realTime * 20)).toFixed(3)})`;
      }
    }
    for (let i = n; i < this.threatPool.length; i++) this.threatPool[i].style.opacity = '0';
  }

  reset() {
    const h = this.hud;
    if (!h) return;
    h.setBoss?.(null);
    h.setCombo?.(0);
    h.setLockOn?.(0, 0, false, 1);
    h.setEnemyBars?.([]);
    h.setDanger?.(0);
    h.setLetterbox?.(false);
    h.hidePrompt?.();
    h.setObjective?.('');
  }

  project(pos) {
    _v.copy(pos).project(this.game.camera);
    const onScreen = _v.z < 1 && _v.x > -1.2 && _v.x < 1.2 && _v.y > -1.2 && _v.y < 1.2;
    return { x: (_v.x * 0.5 + 0.5) * this.game.width, y: (-_v.y * 0.5 + 0.5) * this.game.height, on: onScreen };
  }

  callout(o) { this.hud?.callout?.(o); }
  toast(t, s) { this.hud?.toast?.(t, s); }
  banner(t, s, st) { this.hud?.banner?.(t, s, st); }
  subtitle(sp, t, d) { this.hud?.subtitle?.(sp, t, d); }
  prompt(t, k) {
    this._prompt = [t, k];
    // on a touch screen, point at the on-screen attack button instead of a mouse button
    if (this.game.input.touchMode && (k === '左鍵' || k === '右鍵')) k = k === '左鍵' ? 'touch:斬' : 'touch:防';
    this.hud?.prompt?.(t, k);
  }
  hidePrompt() {
    this._prompt = null;
    this.hud?.hidePrompt?.();
  }
  /** The input mode changed: re-show a prompt on screen with the new mode's button. */
  refreshPrompt() {
    if (this._prompt && this.hud?.promptC?.on) this.prompt(...this._prompt);
  }
  letterbox(on) { this.hud?.setLetterbox?.(on); }
  bossIntro(o) { this.hud?.bossIntro?.(o); }
  objective(t) { this.hud?.setObjective?.(t); }
  setVisible(v) { this.hud?.setVisible?.(v); }

  damageNumber(pos, value, kind) {
    if (!this.showNumbers || !this.hud) return;
    const p = this.project(pos);
    if (p.on) this.hud.damageNumber?.(p.x + (Math.random() - 0.5) * 30, p.y - 20, value, kind);
  }

  update() {
    const h = this.hud;
    const g = this.game;
    const p = g.player;
    // (no hint without a mouse: a phone driven by a keyboard cannot lock a pointer)
    const needLock = g.state === 'playing' && !g.input.locked && !g.input.gpActive && !g.input.touchMode && device.hasMouse && p && p.control && !g.frozen;
    if (needLock !== this._hintOn) {
      this._hintOn = needLock;
      this.lockHint.style.opacity = needLock ? '1' : '0';
    }
    this._updateThreats();
    if (!h || !p) return;
    h.setPlayer?.({
      hp: Math.max(0, p.hp), maxHp: p.maxHp,
      stamina: p.stamina, maxStamina: p.maxStamina,
      breath: p.breath, maxBreath: p.maxBreath,
      conc: p.conc, maxConc: p.maxConc,
    });
    const skills = p.skills.map((s, i) => ({
      key: s.key, form: s.form, name: s.name, cost: s.cost,
      ready: p.skillCd[i] <= 0 && p.breath >= s.cost,
      cooldown01: s.cd > 0 ? p.skillCd[i] / s.cd : 0,
    }));
    h.setSkills?.(skills, { key: 'R', name: p.ultInfo.name, glyph: p.ultInfo.glyph, charge01: p.conc / p.maxConc, ready: p.conc >= p.maxConc });
    h.setAttackMode?.(g.input.attackMode);
    h.ui?.touch?.sync({
      lock: !!(p.lockTarget && p.lockTarget.alive),
      control: p.control && p.alive,
      cue: !!h.promptC?.on,
      // the letterbox is only ever up while the player has no control (the boss title card can outlast it)
      cine: !!h._lb,
    });
    h.setCombo?.(g.combo.count >= 2 ? g.combo.count : 0);
    const boss = g.boss;
    if (boss && boss.state !== 'intro' && !boss.removed && boss.hp > 0 && boss.alive) {
      h.setBoss?.({ title: '上弦之參', name: '猗窩座', hp: boss.hp, maxHp: boss.maxHp, phaseMarks: [0.6, 0.25] });
    } else if (!boss || boss.removed || !boss.alive) h.setBoss?.(null);
    // lock-on
    const lock = p.lockTarget;
    if (lock && lock.alive) {
      const c = lock.chest(_v).clone();
      const pr = this.project(c);
      const dist = g.camera.position.distanceTo(c);
      h.setLockOn?.(pr.x, pr.y, pr.on, Math.max(0.6, Math.min(1.4, 6 / dist)));
    } else h.setLockOn?.(0, 0, false, 1);
    // enemy bars (not boss)
    const bars = this._bars;
    bars.length = 0;
    for (const e of g.enemies) {
      if (e.isBoss || !e.alive) continue;
      if (e.hp >= e.maxHp && g.time - e.lastHitT > 3) continue;
      e.head(_v);
      _v.y += 0.45;
      const pr = this.project(_v);
      bars.push({ id: e.id, x: pr.x, y: pr.y, hp01: e.hp / e.maxHp, visible: pr.on });
    }
    h.setEnemyBars?.(bars);
    h.setDanger?.(g.fx?.screen.danger ?? 0);
  }
}
