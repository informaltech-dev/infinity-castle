// Touch-device detection and input-mode switching (touch vs keyboard / mouse / gamepad),
// plus the mobile-browser chores: page gestures, fullscreen and landscape lock.
//
// `device.touch` follows the last input the player used: a finger on the screen switches it on,
// a key press, real mouse movement or a gamepad (see Input.onGamepadUse) switches it off.
// ?touch=1 / ?touch=0 pins it (handy for testing the touch layout on a desktop browser).

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const forced = params.get('touch'); // '1' | '0' | null
const mq = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
// opened from the home screen (manifest display: fullscreen), not in a browser tab
const installed = (typeof navigator !== 'undefined' && navigator.standalone === true) || mq('(display-mode: standalone)') || mq('(display-mode: fullscreen)');

const listeners = new Set();

export const device = {
  /** Show the on-screen controls and touch wording. */
  touch: forced === '1' || (forced !== '0' && mq('(hover: none) and (pointer: coarse)')),
  /** The device has a touch screen (or touch is forced): touch-only settings stay listed in both modes. */
  touchCapable:
    forced === '1' || (forced !== '0' && ((typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || mq('(any-pointer: coarse)'))),
  /** A mouse or trackpad is present (pointer lock is possible; a phone with a keyboard has none). */
  hasMouse: typeof matchMedia !== 'function' || matchMedia('(any-pointer: fine)').matches,
  /** An iPhone browser tab: no fullscreen API, but its bars tuck away when the page scrolls (see ui/safari-bars.js). */
  iosBrowser: /iPhone|iPod/.test(ua) && !installed,
  /** The first touch of the session happened (used to decide defaults such as auto resolution). */
  touchSeen: false,

  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** @param {Event} [cause] the input event behind the switch (a touch that went down on the game can be adopted by the controls) */
  setTouch(on, cause) {
    on = !!on;
    if (forced === '1') on = true;
    else if (forced === '0') on = false;
    if (on === this.touch) return;
    this.touch = on;
    document.documentElement.classList.toggle('is-touch', on);
    for (const fn of listeners) {
      try {
        fn(on, cause);
      } catch (e) {
        console.error('[device] listener failed', e);
      }
    }
  },

  get portrait() {
    return window.innerHeight > window.innerWidth;
  },

  get fullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  },

  /** The page may go fullscreen (not on iPhone Safari). */
  get canFullscreen() {
    return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  },

  /**
   * Fullscreen + landscape lock where the browser allows it (Android Chrome, iPad Safari).
   * iPhone Safari has neither; there the page works in the normal browser window (or from the
   * home screen). Must be called from a user gesture.
   */
  requestImmersive() {
    if (!this.touch) return;
    // the lock also turns the page when the phone's auto-rotate is off
    const lock = () => {
      try {
        screen.orientation?.lock?.('landscape')?.catch?.(() => {});
      } catch (_) { /* unsupported */ }
    };
    if (this.fullscreen) return lock();
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    try {
      const p = req.call(el, { navigationUI: 'hide' });
      if (p && p.then) p.then(lock, () => {});
      else lock();
    } catch (_) { /* not allowed */ }
  },
};

if (typeof window !== 'undefined') {
  document.documentElement.classList.toggle('is-touch', device.touch);
  // sizing for fingers follows the screen, not the input mode: flipping modes must not move a menu under a tap
  document.documentElement.classList.toggle('has-touch', device.touchCapable);
  matchMedia('(any-pointer: fine)').addEventListener?.('change', (e) => {
    device.hasMouse = e.matches;
  });

  window.addEventListener(
    'pointerdown',
    (e) => {
      // a pen counts as touch only on a touch screen (a desktop drawing tablet drives the mouse UI)
      if (e.pointerType === 'touch' || (e.pointerType === 'pen' && device.touchCapable)) {
        device.touchSeen = true;
        device.setTouch(true, e);
      }
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    'keydown',
    (e) => {
      // modifier-only presses (e.g. a keyboard case waking up) do not count
      if (e.isTrusted && !['Shift', 'Control', 'Alt', 'Meta', 'Unidentified'].includes(e.key)) device.setTouch(false);
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'mouse' && (Math.abs(e.movementX) + Math.abs(e.movementY) > 2)) device.setTouch(false);
    },
    { capture: true, passive: true },
  );

  // iOS Safari still pinch-zooms on gesture events even with touch-action: none on the page.
  const stop = (e) => e.preventDefault();
  document.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('gesturechange', stop, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  // long-press callouts / context menus on the game surface
  document.addEventListener('contextmenu', (e) => {
    if (device.touch) e.preventDefault();
  });
}

export default device;
