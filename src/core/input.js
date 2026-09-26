// Keyboard / mouse / gamepad / touch input with action mapping and pointer lock.
// Touch arrives through the "virtual" source: the on-screen controls (ui/touch.js) press and
// release named actions, set the stick vector and add look deltas.

const KEY_ACTIONS = {
  light: [],
  heavy: [],
  dodge: ['Space'],
  block: [],
  stance: ['KeyQ'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  skill1: ['Digit1'],
  skill2: ['Digit2'],
  skill3: ['Digit3'],
  ult: ['KeyR'],
  lock: ['Tab'],
  pause: ['Escape', 'KeyP'],
};
const MOUSE_ACTIONS = { block: [2], lock: [1] };
// The left mouse button attacks; whether as a light or a heavy attack follows `attackMode` (Q toggles it).
const ATTACK_BUTTON = 0;

// Standard gamepad mapping indices
const GP = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.keysPressed = new Set();
    this.keysReleased = new Set();
    this.mouse = new Set();
    this.mousePressed = new Set();
    this.mouseReleased = new Set();
    this.mdx = 0;
    this.mdy = 0;
    this.locked = false;
    this.gp = null;
    this.gpPrev = [];
    this.gpNow = [];
    this.gpAxes = [0, 0, 0, 0];
    this.gpActive = false;
    this.enabled = true;
    /** 'light' | 'heavy': what the attack button does. */
    this.attackMode = 'light';
    // mode latched when the attack button went down, so a held press (heavy charge) keeps its meaning
    this._attackAs = 'light';
    /** Hook: (event) => boolean consumed. Called for keydown before game handling. */
    this.keyHook = null;
    /** Hook for pointer lock changes */
    this.onLockChange = null;
    /** Hook: the gamepad was used (switches the touch layout off). */
    this.onGamepadUse = null;
    this.lastLockExit = 0;
    // virtual (touch) source
    this.touchMode = false;
    this.vDown = new Set();
    this.vPressed = new Set();
    this.vReleased = new Set();
    this.vMove = { x: 0, y: 0 };
    this.vSprint = false;
    this._lastTouchT = -1e9;
    // (a pen on a touch screen too: device.js has switched touchMode on by the time this runs)
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || (e.pointerType === 'pen' && this.touchMode)) this._lastTouchT = performance.now();
    }, { capture: true, passive: true });

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
    window.addEventListener('blur', () => this.clearAll());
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    window.addEventListener('mouseup', (e) => this._onMouseUp(e));
    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        // Guard against the huge spurious deltas some browsers emit right after locking.
        if (Math.abs(e.movementX) < 400 && Math.abs(e.movementY) < 400) {
          this.mdx += e.movementX;
          this.mdy += e.movementY;
        }
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked) this.lastLockExit = performance.now();
      if (!this.locked) this.clearAll();
      this.onLockChange?.(this.locked);
    });
    window.addEventListener('gamepadconnected', () => (this.gpActive = true));
  }

  requestLock() {
    // touch screens steer the camera with the right thumb; there is no cursor to capture
    if (this.locked || this.touchMode) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) {
        p.catch(() => {
          // unadjustedMovement unsupported or too soon after exit; retry plain.
          try {
            const p2 = this.canvas.requestPointerLock();
            p2?.catch?.(() => {});
          } catch (_) { /* ignore */ }
        });
      }
    } catch (_) {
      try { this.canvas.requestPointerLock(); } catch (_) { /* ignore */ }
    }
  }
  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  clearAll() {
    this.keys.clear();
    this.mouse.clear();
  }

  /** Touch button transitions: action is an action name ('light', 'dodge', 'block' …). */
  setVirtual(action, down) {
    if (down) {
      if (!this.vDown.has(action)) {
        this.vDown.add(action);
        this.vPressed.add(action);
      }
    } else if (this.vDown.has(action)) {
      this.vDown.delete(action);
      this.vReleased.add(action);
    }
  }
  /** Touch stick: x = right, y = forward, both -1..1; sprint when pushed past the ring. */
  setStick(x, y, sprint = false) {
    this.vMove.x = x;
    this.vMove.y = y;
    this.vSprint = !!sprint;
  }
  /** Touch look, already converted to "mouse pixel" units. */
  addLook(dx, dy) {
    this.mdx += dx;
    this.mdy += dy;
  }
  clearVirtual() {
    for (const a of this.vDown) this.vReleased.add(a);
    this.vDown.clear();
    this.setStick(0, 0, false);
  }

  _onKeyDown(e) {
    if (this.keyHook && this.keyHook(e)) {
      e.preventDefault();
      return;
    }
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    this.keysPressed.add(e.code);
  }
  _onKeyUp(e) {
    this.keys.delete(e.code);
    this.keysReleased.add(e.code);
  }
  /** Mouse events that browsers synthesise after a tap must not attack. */
  _compatMouse() {
    return performance.now() - this._lastTouchT < 900;
  }
  _onMouseDown(e) {
    if (this._compatMouse()) return;
    this.buttonDown(e.button);
    if (e.button === 1) e.preventDefault();
  }
  _onMouseUp(e) {
    if (this._compatMouse() && !this.mouse.has(e.button)) return;
    this.buttonUp(e.button);
  }
  /** Mouse button transitions (also used by the debug bot). */
  buttonDown(b) {
    if (b === ATTACK_BUTTON) this._attackAs = this.attackMode;
    this.mouse.add(b);
    this.mousePressed.add(b);
  }
  buttonUp(b) {
    if (this.mouse.has(b)) this.mouseReleased.add(b);
    this.mouse.delete(b);
  }
  toggleAttackMode() {
    this.attackMode = this.attackMode === 'heavy' ? 'light' : 'heavy';
    return this.attackMode;
  }
  _attackButton(action, set) {
    return action === this._attackAs && set.has(ATTACK_BUTTON);
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    this.gp = pad;
    this.gpPrev = this.gpNow;
    if (!pad) {
      this.gpNow = [];
      this.gpAxes[0] = this.gpAxes[1] = this.gpAxes[2] = this.gpAxes[3] = 0;
      return;
    }
    this.gpNow = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
    for (let i = 0; i < 4; i++) this.gpAxes[i] = dz(pad.axes[i] || 0);
    if (this.gpNow.some(Boolean) || this.gpAxes.some((a) => a !== 0)) this.gpActive = true;
    // a fresh press or a firm push (not stick drift) means the player picked up the pad
    if (this.onGamepadUse && (this.gpNow.some((b, i) => b && !this.gpPrev[i]) || this.gpAxes.some((a) => Math.abs(a) > 0.5))) this.onGamepadUse();
  }
  gpDown(i) { return !!this.gpNow[i]; }
  gpPressed(i) { return !!this.gpNow[i] && !this.gpPrev[i]; }
  gpReleased(i) { return !this.gpNow[i] && !!this.gpPrev[i]; }

  _gpAction(name, mode) {
    if (!this.gp) return false;
    const f = mode === 'down' ? (i) => this.gpDown(i) : mode === 'pressed' ? (i) => this.gpPressed(i) : (i) => this.gpReleased(i);
    const lb = this.gpDown(GP.LB);
    switch (name) {
      case 'light': return !lb && f(GP.X);
      case 'heavy': return !lb && f(GP.Y);
      case 'dodge': return f(GP.A);
      case 'block': return f(GP.RB);
      case 'sprint': return f(GP.L3) || (mode === 'down' && this.gpDown(GP.B) && !lb);
      case 'skill1': return lb && f(GP.X);
      case 'skill2': return lb && f(GP.Y);
      case 'skill3': return lb && f(GP.B);
      case 'ult': return f(GP.RT);
      case 'lock': return f(GP.R3);
      case 'pause': return f(GP.START);
      default: return false;
    }
  }

  down(action) {
    if (!this.enabled) return false;
    if (this.vDown.has(action) || (action === 'sprint' && this.vSprint)) return true;
    for (const k of KEY_ACTIONS[action] || []) if (this.keys.has(k)) return true;
    for (const b of MOUSE_ACTIONS[action] || []) if (this.mouse.has(b)) return true;
    if (this._attackButton(action, this.mouse)) return true;
    return this._gpAction(action, 'down');
  }
  pressed(action) {
    if (!this.enabled) return false;
    if (this.vPressed.has(action)) return true;
    for (const k of KEY_ACTIONS[action] || []) if (this.keysPressed.has(k)) return true;
    for (const b of MOUSE_ACTIONS[action] || []) if (this.mousePressed.has(b)) return true;
    if (this._attackButton(action, this.mousePressed)) return true;
    return this._gpAction(action, 'pressed');
  }
  released(action) {
    if (this.vReleased.has(action)) return true;
    for (const k of KEY_ACTIONS[action] || []) if (this.keysReleased.has(k)) return true;
    for (const b of MOUSE_ACTIONS[action] || []) if (this.mouseReleased.has(b)) return true;
    if (this._attackButton(action, this.mouseReleased)) return true;
    return this._gpAction(action, 'released');
  }

  /** Movement vector in input space: x = right, y = forward. */
  move(out) {
    let x = 0, y = 0;
    if (this.enabled) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.gp) {
        x += this.gpAxes[0];
        y -= this.gpAxes[1];
      }
      x += this.vMove.x;
      y += this.vMove.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    out.x = x;
    out.y = y;
    return out;
  }

  /** Look delta in "mouse pixel" units. */
  look(out, dt) {
    out.x = this.mdx;
    out.y = this.mdy;
    if (this.gp) {
      out.x += this.gpAxes[2] * 900 * dt;
      out.y += this.gpAxes[3] * 600 * dt;
    }
    return out;
  }

  endFrame() {
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.mousePressed.clear();
    this.mouseReleased.clear();
    this.vPressed.clear();
    this.vReleased.clear();
    this.mdx = 0;
    this.mdy = 0;
  }

  /** Gamepad buttons translated to menu key names for the UI. */
  menuKeysFromGamepad() {
    if (!this.gp) return [];
    const out = [];
    if (this.gpPressed(GP.UP) || (this.gpAxes[1] < -0.6 && !(this._navHeld))) out.push('ArrowUp');
    if (this.gpPressed(GP.DOWN) || (this.gpAxes[1] > 0.6 && !(this._navHeld))) out.push('ArrowDown');
    if (this.gpPressed(GP.LEFT) || (this.gpAxes[0] < -0.6 && !(this._navHeld))) out.push('ArrowLeft');
    if (this.gpPressed(GP.RIGHT) || (this.gpAxes[0] > 0.6 && !(this._navHeld))) out.push('ArrowRight');
    this._navHeld = Math.abs(this.gpAxes[0]) > 0.6 || Math.abs(this.gpAxes[1]) > 0.6;
    if (this.gpPressed(GP.A)) out.push('Enter');
    if (this.gpPressed(GP.B)) out.push('Escape');
    if (this.gpPressed(GP.START)) out.push('Escape');
    return out;
  }
}
