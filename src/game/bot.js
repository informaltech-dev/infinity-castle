// Debug autoplayer (?bot=1): drives the Input object like a (mediocre) human so whole fights can be
// simulated headlessly to catch runtime errors and balance problems.
export class Bot {
  constructor(game) {
    this.g = game;
    this.t = 0;
    this.next = 0;
    this.holdBlock = 0;
    this.log = { actions: {}, errors: 0 };
    this.lockCd = 0;
    this.attackUntil = 0;
  }

  press(code) {
    this.g.input.keys.add(code);
    this.g.input.keysPressed.add(code);
    this.log.actions[code] = (this.log.actions[code] || 0) + 1;
  }
  /** Left-button attack in the given mode; toggles the mode with Q first when needed. */
  attack(kind, hold) {
    const inp = this.g.input;
    if (inp.attackMode !== kind) {
      this.press('KeyQ');
      return false;
    }
    if (inp.mouse.has(0)) inp.buttonUp(0);
    inp.buttonDown(0);
    this.attackUntil = this.t + hold;
    this.log.actions[kind] = (this.log.actions[kind] || 0) + 1;
    return true;
  }
  releaseButtons() {
    const inp = this.g.input;
    for (const b of [0, 2]) if (inp.mouse.has(b)) inp.buttonUp(b);
    this.holdBlock = 0;
    this.attackUntil = 0;
  }

  update(dt) {
    const g = this.g;
    const p = g.player;
    const inp = g.input;
    this.t += dt;
    // release one-frame keys
    for (const k of ['Space', 'Digit1', 'Digit2', 'Digit3', 'KeyR', 'Tab', 'KeyQ']) inp.keys.delete(k);
    if (this.attackUntil && this.t > this.attackUntil) {
      inp.buttonUp(0);
      this.attackUntil = 0;
    }
    if (!p || !p.alive || !p.control) {
      inp.keys.clear();
      this.releaseButtons();
      return;
    }
    const foes = g.enemies.filter((e) => e.alive && e.targetable !== false);
    if (!foes.length) {
      inp.keys.clear();
      this.releaseButtons();
      return;
    }
    let tgt = foes.sort((a, b) => p.distTo(a) - p.distTo(b))[0];
    if (!p.lockTarget || !p.lockTarget.alive) {
      if (this.t > this.lockCd) {
        this.press('Tab');
        this.lockCd = this.t + 1;
      }
    } else tgt = p.lockTarget;
    const d = p.distTo(tgt);
    inp.keys.delete('KeyW');
    inp.keys.delete('KeyS');
    inp.keys.delete('KeyA');
    inp.keys.delete('KeyD');
    // blocking
    if (this.holdBlock > 0) {
      this.holdBlock -= dt;
      if (!inp.mouse.has(2)) inp.buttonDown(2);
      if (this.holdBlock <= 0) inp.buttonUp(2);
      return;
    }
    // side-step incoming projectiles like a player would
    for (const pr of g.combat.projectiles) {
      if (pr.owner === p) continue;
      const dx = p.pos.x - pr.pos.x, dz = p.pos.z - pr.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 5 && (dx * pr.vel.x + dz * pr.vel.z) > 0 && Math.random() < 0.5) {
        inp.keys.add(Math.random() < 0.5 ? 'KeyA' : 'KeyD');
        this.press('Space');
        return;
      }
    }
    const threat = tgt.state === 'action' || tgt.state === 'attack';
    if (threat && d < 4 && Math.random() < 0.08) {
      if (Math.random() < 0.6) this.press('Space');
      else this.holdBlock = 0.5;
      return;
    }
    if (d > 2.6) {
      inp.keys.add('KeyW');
      if (d > 8 && Math.random() < 0.02) this.press('Digit1');
      return;
    }
    if (Math.random() < 0.3) inp.keys.add(Math.random() < 0.5 ? 'KeyA' : 'KeyD');
    if (this.t < this.next) return;
    const r = Math.random();
    if (p.conc >= p.maxConc && r < 0.3) this.press('KeyR');
    else if (p.breath > 60 && r < 0.2) this.press(['Digit1', 'Digit2', 'Digit3'][Math.floor(Math.random() * 3)]);
    else if (r < 0.28) {
      // heavy: tap or charge
      if (!this.attack('heavy', Math.random() < 0.4 ? 0.8 : 0.1)) return;
    } else if (!this.attack('light', 0.1)) return;
    this.next = this.t + 0.18 + Math.random() * 0.25;
  }
}
