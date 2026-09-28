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

/**
 * A skilled player for balance runs (真劍 above all): watches the boss, reacts to each tell after a human
 * reaction time (sometimes to the wind-up itself, too early), parries or dodges, punishes his openings with
 * a couple of cuts or a technique, and executes a broken posture. `o` tunes how good it is.
 */
export class ReaderBot extends Bot {
  constructor(game, o = {}) {
    super(game);
    this.o = { rt: 0.22, rtVar: 0.06, parry: 0.5, impatient: 0.25, miss: 0.12, greed: 2, skillUse: 0.7, ...o };
    this.react = null;
    this.hold = 0;
    this.lastTell = -99;
    this.seenAction = null;
    this.hits = 0;
    this.stateSeen = '';
    this.dodgeCd = 0;
    this.retreat = 0;
    this.log.reader = { tells: 0, parries: 0, dodges: 0, early: 0 };
  }

  rnd(m, v) {
    // (a rough bell curve)
    return m + (Math.random() + Math.random() + Math.random() - 1.5) * v * 1.2;
  }

  update(dt) {
    const g = this.g;
    const p = g.player;
    const inp = g.input;
    this.t += dt;
    for (const k of ['Space', 'Digit1', 'Digit2', 'Digit3', 'KeyR', 'Tab', 'KeyQ']) inp.keys.delete(k);
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) inp.keys.delete(k);
    if (this.attackUntil && this.t > this.attackUntil) {
      inp.buttonUp(0);
      this.attackUntil = 0;
    }
    if (!p || !p.alive || !p.control) {
      this.releaseButtons();
      this.react = null;
      return;
    }
    const b = g.boss && g.boss.alive && g.boss.targetable !== false ? g.boss : null;
    if (!b) {
      this.releaseButtons();
      return;
    }
    if (!p.lockTarget && this.t > this.lockCd) {
      this.press('Tab');
      this.lockCd = this.t + 1;
    }
    // (reactions keep to the game's clock: in slow motion a player sees the blow coming slowly too)
    const gdt = g.time - (this.gt ?? g.time);
    this.gt = g.time;
    const now = g.time;
    this.dodgeCd -= gdt;
    const d = p.distTo(b);
    // --- a new tell: schedule the answer after a reaction time (now and then, off the wind-up instead)
    const r = b.action;
    if (r && r !== this.seenAction) {
      this.seenAction = r;
      if (Math.random() < this.o.impatient && r.nextStrike() != null) {
        // an impatient read: answering the wind-up itself, not its flash
        this.react = { at: now + this.rnd(this.o.rt, this.o.rtVar) + 0.05, r, early: true };
      }
    }
    if (b.lastTellT !== this.lastTell) {
      this.lastTell = b.lastTellT;
      this.log.reader.tells++;
      if (!this.react || this.react.r !== r) this.react = { at: now + Math.max(0.1, this.rnd(this.o.rt, this.o.rtVar)), r };
      else if (this.react.early && Math.random() > this.o.impatient) this.react = { at: now + Math.max(0.1, this.rnd(this.o.rt, this.o.rtVar)), r };
    }
    // --- guard held for a parry (or a block), unless the next blow calls for a fresh press
    if (this.hold > 0) {
      this.hold -= gdt;
      const due = this.react && now >= this.react.at;
      if (this.hold <= 0 || due) {
        inp.buttonUp(2);
        this.hold = 0;
      }
      if (!due) return;
    }
    if (this.react && now >= this.react.at) {
      const rr = this.react;
      this.react = null;
      if (rr.early) this.log.reader.early++;
      const why = b.action !== rr.r ? 'gone' : d >= 9 ? 'far' : Math.random() <= this.o.miss ? 'miss' : null;
      this.trace?.push(`${g.time.toFixed(2)} react ${b.curMove}:${b.curKind} ${rr.early ? 'EARLY ' : ''}${why || 'act'} p:${p.state}/${p.curMove} st${Math.round(p.stamina)} cd${this.dodgeCd.toFixed(2)}`);
      if (!why) {
        const s = rr.r.nextStrike();
        const h = s != null && [...(rr.r.def.hits || [])].find((x) => Math.abs(x.t - s) < 1e-6);
        const parryable = h && !h.unparryable && !h.unblockable && !rr.r.def.perilous && b.curMove !== 'cast';
        if (parryable && Math.random() < this.o.parry && (p.state !== 'action' || p.curMove === 'parry')) {
          this.releaseButtons();
          inp.buttonDown(2);
          this.hold = 0.3;
          this.log.reader.parries++;
          return;
        }
        if (this.dodgeAway(p, b)) return;
      }
    }
    // --- a marked area (a line down the floor, a circle round him): step out of it while it fills
    if (b.state === 'action' && this.outOfZone(p, b)) return;
    // --- backing off out of a whirl's reach
    if (this.retreat > 0) {
      this.retreat -= gdt;
      inp.keys.add('KeyS');
      if (b.state === 'action' || b.moons?.list.length) return;
    }
    // --- crescents, shock rings or thrown blows about to reach us: slip them
    const proj = g.combat.projectiles.some((pr) => {
      if (pr.owner === p) return false;
      const dx = p.pos.x - pr.pos.x, dz = p.pos.z - pr.pos.z;
      const dist = Math.hypot(dx, dz);
      const closing = (dx * pr.vel.x + dz * pr.vel.z) / Math.max(dist, 1e-3);
      return closing > 0 && dist / Math.max(closing, 1) < 0.28;
    });
    if (this.dodgeCd <= 0 && p.state !== 'action' && (proj || b.threatens?.(p, 0.28) || (b.hazards || []).some((hz) => { const dd = Math.hypot(p.pos.x - hz.c.x, p.pos.z - hz.c.z); return dd - hz.r > -0.4 && dd - hz.r < hz.speed * 0.25; }))) {
      if (this.dodgeAway(p, b)) return;
    }
    // --- execution
    if (p.execTarget?.()) {
      if (this.t > this.next) {
        this.attack(g.input.attackMode, 0.1);
        this.next = this.t + 0.4;
      }
      if (d > 3) inp.keys.add('KeyW');
      return;
    }
    // --- an opening: his recovery, a recoil, a broken posture
    const open = b.state === 'recover' || b.state === 'hit' || b.state === 'stagger';
    if (b.state !== this.stateSeen) {
      this.stateSeen = b.state;
      if (open) this.hits = 0;
    }
    if (open) {
      if (d > 2.4) {
        inp.keys.add('KeyW');
        return;
      }
      if (this.t < this.next || p.state === 'action') return;
      const left = b.state === 'recover' ? b.recoverLen - b.stateT : b.state === 'hit' ? b.stunLen - b.stateT : b.staggerLen - b.stateT;
      const sk = p.skills.findIndex((s, i) => p.skillCd[i] <= 0 && p.breath >= s.cost);
      if (p.conc >= p.maxConc && left > 0.3) this.press('KeyR');
      else if (sk >= 0 && left > 0.55 && Math.random() < this.o.skillUse && this.hits === 0) {
        this.press('Digit' + (sk + 1));
        this.hits += 2;
      } else if (this.hits < this.o.greed && left > 0.25 && p.stamina > 30) {
        if (!this.attack('light', 0.08)) return;
        this.hits++;
      }
      this.next = this.t + 0.22;
      return;
    }
    // --- neutral: keep just outside his reach, circling
    const want = b.phase >= 2 ? 6 : 4.2;
    if (d > want + 1) inp.keys.add('KeyW');
    else if (d < want - 0.8) inp.keys.add('KeyS');
    inp.keys.add(Math.sin(this.t * 0.7) > 0 ? 'KeyA' : 'KeyD');
  }

  /**
   * Forms that mark the floor first: a player walks (runs) out of the mark rather than waiting to dodge.
   * Lines lie along his facing (half-width, length); circles are round him.
   */
  outOfZone(p, b) {
    const Z = {
      eternal: ['line', 4.0, 11], descend: ['line', 1.6, 9], mirror: ['line', 2.8, 12], saw: ['line', 2.0, 14], annihilationCharge: ['line', 1.4, 13],
      dragon: ['circle', 7.2], spiral: ['circle', 9.6], cast: ['circle', 5.2],
    }[b.curMove];
    if (!Z) return false;
    const inp = this.g.input;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    const rx = p.pos.x - b.pos.x, rz = p.pos.z - b.pos.z;
    if (Z[0] === 'line') {
      const along = rx * fx + rz * fz;
      const across = -rx * fz + rz * fx;
      if (along < -1 || along > Z[2] || Math.abs(across) > Z[1]) return false;
      // sideways, the shorter way out (the camera looks down the line at him)
      inp.keys.add(across > 0 ? 'KeyA' : 'KeyD');
    } else {
      if (Math.hypot(rx, rz) > Z[1]) return false;
      inp.keys.add('KeyS');
    }
    inp.keys.add('ShiftLeft');
    this.sprinting = true;
    return true;
  }

  /** A side-step; straight back (and keep going) from a blow that sweeps all round him. */
  dodgeAway(p, b) {
    if (this.dodgeCd > 0 || p.stamina < 20 || p.state === 'down') return false;
    const inp = this.g.input;
    this.releaseButtons();
    const r = b.action;
    const s = r?.nextStrike();
    const h = s != null ? (r.def.hits || []).find((x) => Math.abs(x.t - s) < 1e-6) || (r.def.multi || [])[0] : null;
    // (a shock ring is dodged through, not outrun)
    const round = /cast|spiral|dragon|spinKick|eightCore|barrage/.test(b.curMove || '') || (h?.shape === 'circle' && !/groundSlam|axeKick|flipKick|finalType/.test(b.curMove || '')) || (h?.arc ?? 0) >= 200;
    if (round) {
      inp.keys.add('KeyS');
      this.retreat = 0.7;
    } else if (b.moons) {
      // (his cuts leave moons hanging where they passed: out and away, not just aside)
      inp.keys.add('KeyS');
      inp.keys.add(Math.random() < 0.5 ? 'KeyA' : 'KeyD');
    } else {
      inp.keys.add(Math.random() < 0.5 ? 'KeyA' : 'KeyD');
      if (p.distTo(b) < 2) inp.keys.add('KeyS');
    }
    this.press('Space');
    this.dodgeCd = 0.3;
    this.log.reader.dodges++;
    return true;
  }
}
