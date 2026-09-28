import * as THREE from 'three';
import { angleDiff, clamp } from '../core/math.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _d = new THREE.Vector3();

const DIFF = {
  easy: { toPlayer: 0.6, toEnemy: 1.25, tokens: 1 },
  normal: { toPlayer: 0.9, toEnemy: 1.0, tokens: 2 },
  hard: { toPlayer: 1.45, toEnemy: 0.85, tokens: 3 },
  duel: { toPlayer: 1.35, toEnemy: 1.1, tokens: 3 },
};

/**
 * Hit resolution with all the "hit feel": hitstop, shake, flashes, cut lines, sparks, sounds, numbers.
 * Hit definition fields:
 *   range, arc (deg), offset (forward), height, dmg, poise, knock, launch, stun ('light'|'heavy'|'down'),
 *   hitstop, shake, style, power, sfx, unblockable, unparryable, radius (for circle shapes), shape ('arc'|'circle'|'line'),
 *   width (line), crit, finisher, gain, from (the point the blow comes from when that is not the attacker,
 *   e.g. a crescent blade far from its owner: knockback, blocking and the hit spark use it)
 */
export class Combat {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
  }

  get diff() {
    const d = this.game.settings?.difficulty;
    return Object.hasOwn(DIFF, d ?? '') ? DIFF[d] : DIFF.normal;
  }

  targetsFor(att) {
    const g = this.game;
    if (att.team === 'player') return g.enemies.filter((e) => e.alive && e.targetable !== false);
    return g.player && g.player.alive ? [g.player] : [];
  }

  inShape(att, tgt, h) {
    const shape = h.shape || 'arc';
    const off = h.offset ?? 0;
    const ox = att.pos.x + Math.sin(att.yaw) * off;
    const oz = att.pos.z + Math.cos(att.yaw) * off;
    const dx = tgt.pos.x - ox, dz = tgt.pos.z - oz;
    const dist = Math.hypot(dx, dz);
    // vertical check (jumps / airborne)
    const ty = tgt.posY || 0;
    if (h.height !== undefined && ty > h.height) return false;
    if (shape === 'circle') return dist <= (h.range ?? 2) + tgt.radius;
    if (shape === 'ring') {
      const r = h.ringR ?? 0;
      return Math.abs(dist - r) <= (h.ringW ?? 0.8) + tgt.radius * 0.5;
    }
    if (shape === 'line') {
      // capsule along facing from origin, length range, half width
      const fx = Math.sin(att.yaw), fz = Math.cos(att.yaw);
      const along = dx * fx + dz * fz;
      const across = Math.abs(-dx * fz + dz * fx);
      return along >= -tgt.radius && along <= (h.range ?? 3) + tgt.radius && across <= (h.width ?? 0.8) + tgt.radius;
    }
    if (dist > (h.range ?? 2.2) + tgt.radius) return false;
    if (dist < tgt.radius + 0.35) return true;
    const ang = Math.abs(angleDiff(att.yaw + ((h.dir ?? 0) * Math.PI) / 180, Math.atan2(dx, dz)));
    const tol = Math.atan2(tgt.radius, Math.max(dist, 0.01));
    return ang <= ((h.arc ?? 120) * Math.PI) / 360 + tol;
  }

  sweep(att, h, runner, key) {
    const hitSet = runner ? runner.hitSets.get(key) || new Set() : new Set();
    if (runner) runner.hitSets.set(key, hitSet);
    let any = false;
    for (const tgt of this.targetsFor(att)) {
      if (hitSet.has(tgt)) continue;
      if (!this.inShape(att, tgt, h)) continue;
      hitSet.add(tgt);
      const r = this.applyHit(att, tgt, h);
      if (r !== 'miss') any = true;
    }
    return any;
  }

  /** Returns 'hit' | 'block' | 'parry' | 'dodge' | 'perfect' | 'miss' */
  applyHit(att, victim, h, opts = {}) {
    const g = this.game;
    if (!victim.alive) return 'miss';
    const isPlayerVictim = victim === g.player;
    // --- defence (player only)
    if (isPlayerVictim) {
      const res = victim.defend(att, h);
      if (res) return res;
    } else if (victim.invuln > 0) return 'miss';
    else if (victim.tryCounter?.(att, h)) return 'parry';

    // --- damage
    const diff = this.diff;
    let dmg = h.dmg ?? 10;
    let crit = !!h.crit;
    let counter = false;
    if (h.fixed) {
      // (an execution: exactly what it says)
    } else if (att.team === 'player') {
      dmg *= diff.toEnemy * (att.dmgMul ?? 1);
      const c = att.consumeCrit?.(victim, h);
      if (c) crit = true;
      counter = c === 'counter';
      if (crit) dmg *= 1.8;
      if (victim.staggered) dmg *= 1.3;
    } else {
      dmg *= diff.toPlayer;
      if (victim.blocking && !h.unblockable) dmg *= 0.25;
    }
    if (!h.fixed) dmg = Math.round(dmg * (0.92 + Math.random() * 0.16));
    victim.hp -= dmg;
    victim.lastHitT = g.time;
    victim.lastAttacker = att;

    // hit point on the victim's body
    const cp = victim.chest(_v);
    const src = h.from || att.pos;
    _d.set(src.x - victim.pos.x, 0, src.z - victim.pos.z);
    if (_d.lengthSq() < 1e-6) _d.set(0, 0, 1);
    _d.normalize();
    const hitPos = _v2.copy(cp).addScaledVector(_d, victim.radius * 0.7);
    hitPos.y += (Math.random() - 0.5) * 0.35 + (h.yOff ?? 0);
    const pushDir = _v3.copy(_d).negate();

    const power = h.power ?? 0.5;
    const style = h.style || (att.team === 'player' ? 'steel' : 'demon');
    // --- feedback
    const hs = (h.hitstop ?? 0.06) * (crit ? 1.4 : 1);
    att.hitstop = Math.max(att.hitstop, hs * (att.team === 'player' ? 1 : 0.6));
    victim.hitstop = Math.max(victim.hitstop, hs + 0.02);
    g.cameraRig.shake((h.shake ?? 0.2) * (crit ? 1.3 : 1) * (isPlayerVictim ? 1.2 : 1));
    if (h.fov) g.cameraRig.kick(h.fov);
    victim.flash(isPlayerVictim ? 0xff4040 : 0xffffff, 0.09);
    const cutDir = att.swordVel && att.swordVel.lengthSq() > 0.5 ? att.swordVel : null;
    g.fx.hit(hitPos, pushDir, { style: h.blunt ? (style === 'akaza' ? 'akaza' : 'steel') : style, power, crit, blunt: !!h.blunt, cutDir });
    if (crit) {
      g.fx.screen.flash(0xffffff, 0.25, 10);
      g.fx.screen.chroma(0.6);
    }
    if (h.impact) g.fx.screen.impact(h.impact, h.impactA, h.impactB);
    if ((power >= 0.85 || crit) && !h.blunt) g.freeze?.(crit ? 0.07 : 0.045);
    else if (isPlayerVictim && (h.stun === 'down')) g.freeze?.(0.06);
    if (h.radial) g.fx.screen.radial(h.radial);
    const sfx = h.sfx || (h.blunt ? 'hitBlunt' : 'hitSlash');
    g.audio?.play(sfx, { intensity: clamp(power + (crit ? 0.3 : 0)), pos: hitPos });
    if (crit) g.audio?.play('hitCrit', { pos: hitPos });

    // --- knockback / reactions
    const knock = h.knock ?? 1.5;
    victim.knock.copy(pushDir).multiplyScalar(knock / (victim.mass || 1));
    if (!isPlayerVictim) {
      g.onPlayerHit?.(victim, dmg, crit, h);
      // (真劍: a counter -- a crit off a parry or a perfect dodge -- bites deep into his posture; any other crit
      // only as a crit; and a flurry's many ticks wear it only a little each: its closing blow is what tells.
      // A boss's posture only: the lesser demons keep theirs as on any difficulty)
      const duel = victim.isBoss ? g.rules?.duel : null;
      const pm = duel && att.team === 'player' ? (counter ? duel.posture.counter : duel.posture.hit * (crit ? 1.5 : 1)) * (h.every ? duel.posture.tick : 1) : crit ? 1.5 : 1;
      victim.poise -= (h.poise ?? 10) * pm;
      g.hud?.damageNumber(hitPos, dmg, crit ? 'crit' : 'normal');
    } else {
      if (g._dmgLog) g._dmgLog[att.curMove || att.curAttack || 'proj'] = (g._dmgLog[att.curMove || att.curAttack || 'proj'] || 0) + dmg;
      g.onPlayerDamaged?.(dmg, h, att);
      g.hud?.damageNumber(hitPos, dmg, 'player');
    }
    if (victim.hp <= 0) {
      victim.hp = 0;
      victim.die(att, h, { hitPos: hitPos.clone(), dir: pushDir.clone() });
    } else {
      victim.onHit(att, h, { dmg, crit, hitPos: hitPos.clone(), dir: pushDir.clone() });
    }
    return 'hit';
  }

  // ------------------------------------------------------------------ projectiles
  /** p: { pos, vel, radius, life, owner, hit, fx: (proj, dt) => void, onEnd } */
  spawn(p) {
    p.age = 0;
    p.hitSet = new Set();
    this.projectiles.push(p);
    return p;
  }

  update(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      p.pos.addScaledVector(p.vel, dt);
      p.fx?.(p, dt);
      let dead = p.age >= p.life;
      if (!dead) {
        for (const tgt of this.targetsFor(p.owner)) {
          if (p.hitSet.has(tgt)) continue;
          const dx = tgt.pos.x - p.pos.x, dz = tgt.pos.z - p.pos.z;
          const dy = p.pos.y - (tgt.pos.y + 1.0 + (tgt.posY || 0));
          if (Math.hypot(dx, dz) < p.radius + tgt.radius && Math.abs(dy) < 1.4) {
            p.hitSet.add(tgt);
            // resolve with a synthetic attacker facing along the projectile
            const res = this.applyHit(p.owner, tgt, p.hit);
            p.onHit?.(p, tgt, res);
            if (!p.pierce) dead = true;
          }
        }
      }
      if (dead) {
        p.onEnd?.(p);
        this.projectiles.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.projectiles) p.onEnd?.(p);
    this.projectiles.length = 0;
  }
}
