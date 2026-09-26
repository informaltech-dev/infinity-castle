// 無限城 — DOM/CSS user interface (menus + in-game HUD).
// Public API: see class UI below. The UI never installs global keyboard listeners; the game
// forwards keydown events to ui.handleKey() while ui.isMenuOpen() is true.
import './ui.css';
import './menus.css';
import './select.css';
import './hud.css';
import './touch.css';
import './compact.css';
import { h } from './dom.js';
import { device } from '../core/device.js';
import { TouchControls } from './touch.js';
import { installTextures } from './textures.js';
import { SVG_DEFS } from './icons.js';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, sanitizeSettings } from './settings.js';
import { LoadingScreen, TitleScreen, MenuScreen, PauseScreen, ResultScreen } from './screens-main.js';
import { SelectScreen, ControlsScreen, SettingsScreen } from './screens-options.js';
import { HUD } from './hud.js';

const MENU_SCREENS = ['title', 'menu', 'select', 'controls', 'settings', 'pause', 'result'];
const IGNORED_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock', 'OS', 'Fn', 'FnLock', 'Hyper', 'Super', 'ContextMenu', 'Dead', 'Unidentified', 'Process', 'AltGraph']);

function mapAction(key, code) {
  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      return 'up';
    case 'KeyS':
    case 'ArrowDown':
      return 'down';
    case 'KeyA':
    case 'ArrowLeft':
      return 'left';
    case 'KeyD':
    case 'ArrowRight':
      return 'right';
    case 'Enter':
    case 'NumpadEnter':
    case 'Space':
      return 'confirm';
    case 'Escape':
    case 'Backspace':
      return 'back';
    default:
      break;
  }
  switch (key) {
    case 'ArrowUp':
    case 'Up':
    case 'w':
    case 'W':
      return 'up';
    case 'ArrowDown':
    case 'Down':
    case 's':
    case 'S':
      return 'down';
    case 'ArrowLeft':
    case 'Left':
    case 'a':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'Right':
    case 'd':
    case 'D':
      return 'right';
    case 'Enter':
    case ' ':
    case 'Spacebar':
      return 'confirm';
    case 'Escape':
    case 'Esc':
    case 'Backspace':
      return 'back';
    default:
      return null;
  }
}

export class UI {
  /**
   * @param {HTMLElement} root  #ui-root
   * @param {object} callbacks  { onStart, onResume, onRestart, onQuitToTitle, onSettingsChange, onUiSound, onSelectPreview, onScreenChange }
   */
  constructor(root, callbacks = {}) {
    this.root = root || document.body;
    this.cb = callbacks || {};
    this.settings = loadSettings();

    this.el = h('div', { class: 'ic-ui', lang: 'zh-Hant' });
    installTextures(this.el);
    this.el.insertAdjacentHTML('afterbegin', SVG_DEFS);
    this.hudLayer = h('div', { class: 'ic-layer ic-layer--hud' });
    this.touchLayer = h('div', { class: 'ic-layer ic-layer--touch', hidden: true });
    this.screenLayer = h('div', { class: 'ic-layer ic-layer--screens' });
    this.topLayer = h('div', { class: 'ic-layer ic-layer--top' });
    this.el.append(this.hudLayer, this.touchLayer, this.screenLayer, this.topLayer);
    this.root.append(this.el);

    this.hud = new HUD(this, this.hudLayer);
    this.touchMode = device.touch;
    this.el.classList.toggle('is-touch', this.touchMode);
    this.touch = new TouchControls(this, this.touchLayer);
    this.touch.setSize(this.settings.touchButtonSize);
    this.topLayer.append(this.touch.rotateEl);
    const portrait = typeof matchMedia === 'function' ? matchMedia('(orientation: portrait)') : null;
    const syncPortrait = () => this.touch.rotateEl.classList.toggle('is-on', !!portrait?.matches);
    portrait?.addEventListener?.('change', syncPortrait);
    syncPortrait();
    this.screens = {
      loading: new LoadingScreen(this),
      title: new TitleScreen(this),
      menu: new MenuScreen(this),
      select: new SelectScreen(this),
      controls: new ControlsScreen(this),
      settings: new SettingsScreen(this),
      pause: new PauseScreen(this),
      result: new ResultScreen(this),
    };
    for (const s of Object.values(this.screens)) (s.name === 'loading' ? this.topLayer : this.screenLayer).append(s.el);

    this.active = null; // currently interactive screen name (or null)
    this._subReturn = null; // 'menu' | 'pause' while controls/settings are open
    this._hudChar = null;
    this._inRun = false;
    this._stamp = 0; // bumped by every public screen call (used to detect synchronous game reactions)
    this._lastAct = 0;
    if (this.touchMode) this.setTouchMode(true, true);
  }

  /**
   * Touch screen vs keyboard/mouse wording and layout (the game calls this when the input changes).
   * @param {Event} [cause] the touch that switched the mode: the controls take it over if it landed on a run
   */
  setTouchMode(on, force = false, cause = null) {
    on = !!on;
    if (on === this.touchMode && !force) return;
    this.touchMode = on;
    this.el.classList.toggle('is-touch', on);
    for (const s of Object.values(this.screens)) s.onTouchMode?.(on);
    this._refreshTouch();
    if (on && cause) this.touch.adopt(cause);
  }

  /** The touch controls are live while a run is on screen and no menu covers it. */
  _refreshTouch() {
    if (!this.touch) return;
    this.touch.setActive(this.touchMode && this.hud.visible && this.active === null && !this.screens.loading.visible);
  }

  /* ================================================================ public API */

  handleKey(event) {
    if (!event || !this.active) return false;
    const key = typeof event.key === 'string' ? event.key : '';
    const code = typeof event.code === 'string' ? event.code : '';
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (/^F\d{1,2}$/.test(key) || /^F\d{1,2}$/.test(code)) return false;
    if (this.screens.loading.visible) return true; // loading overlay blocks menu input
    if (this.active === 'title') {
      if (IGNORED_KEYS.has(key) || key === 'Tab') return false;
      if (!key && !code) return false;
      if (!event.repeat) this._titleAdvance();
      return true;
    }
    const a = mapAction(key, code);
    if (!a) return false;
    if (event.repeat && (a === 'confirm' || a === 'back')) return true;
    const s = this.screens[this.active];
    if (!s) return false;
    return s.nav(a) !== false;
  }

  isMenuOpen() {
    return this.active !== null;
  }

  getSettings() {
    return { ...this.settings };
  }

  showLoading(progress01, text) {
    this._stamp++;
    const s = this.screens.loading;
    if (!s.visible) {
      s.show();
      this._emit('loading');
    }
    s.set(progress01, text);
  }

  hideLoading() {
    this._stamp++;
    this.screens.loading.hide();
    this._refreshTouch();
  }

  showTitle() {
    this._stamp++;
    this._leaveRun();
    this._open('title');
  }

  showMenu() {
    this._stamp++;
    this._leaveRun();
    this._open('menu');
  }

  showCharacterSelect(mode) {
    this._stamp++;
    this._leaveRun();
    this._open('select', mode === 'boss' ? 'boss' : 'story');
  }

  showHUD(characterId) {
    this._stamp++;
    this._hideScreens();
    this.screens.loading.hide();
    this.active = null;
    this._subReturn = null;
    this.el.classList.remove('is-result', 'is-paused');
    if (characterId) this._hudChar = characterId;
    if (!this._inRun) this.hud.reset();
    this._inRun = true;
    this.hud.configure(this._hudChar || 'tanjiro');
    this.touch.configure(this._hudChar || 'tanjiro');
    this.hud.setVisible(true);
    this._emit('hud');
  }

  showPause() {
    this._stamp++;
    if (this.active === 'pause') return;
    this._subReturn = null;
    this.el.classList.add('is-paused');
    this._open('pause');
  }

  hidePause() {
    this._stamp++;
    const open = this.active === 'pause' || this._subReturn === 'pause' || this.screens.pause.visible;
    if (!open) return;
    this.screens.pause.hide();
    if (this._subReturn === 'pause') {
      this.screens.controls.hide();
      this.screens.settings.hide();
      this._subReturn = null;
    }
    this.el.classList.remove('is-paused');
    this.active = null;
    if (this.hud.visible) this._emit('hud');
  }

  showResult(data = {}) {
    this._stamp++;
    if (data && (data.character === 'tanjiro' || data.character === 'giyu')) this._hudChar = data.character;
    this._subReturn = null;
    this._inRun = false;
    this.el.classList.remove('is-paused');
    this.el.classList.add('is-result');
    this.hud.promptC.hide();
    this.hud.setLockOn(0, 0, false);
    this._open('result', data || {});
  }

  hideAll() {
    this._stamp++;
    this._hideScreens();
    this.screens.loading.hide();
    this.hud.setVisible(false);
    this.el.classList.remove('is-result', 'is-paused');
    this.active = null;
    this._subReturn = null;
    this._inRun = false;
    this._refreshTouch();
  }

  /* ================================================================ internals */

  _emit(name) {
    this._refreshTouch();
    this._call('onScreenChange', name);
  }

  _sound(name) {
    this._call('onUiSound', name);
  }

  _call(fn, ...args) {
    const f = this.cb && this.cb[fn];
    if (typeof f !== 'function') return undefined;
    try {
      return f(...args);
    } catch (err) {
      console.error(`[UI] callback ${fn} failed:`, err);
      return undefined;
    }
  }

  /** Run fn unless another activation happened a moment ago (prevents click + key double fire). */
  _guarded(fn) {
    const now = performance.now();
    if (now - this._lastAct < 140) return;
    this._lastAct = now;
    fn();
  }

  _hideScreens(except) {
    for (const name of MENU_SCREENS) if (name !== except) this.screens[name].hide();
  }

  _open(name, arg) {
    this._hideScreens(name);
    this.screens.loading.hide();
    this.screens[name].show(arg);
    this.active = name;
    this._emit(name);
  }

  _leaveRun() {
    this._subReturn = null;
    this._inRun = false;
    this.el.classList.remove('is-result', 'is-paused');
    if (this.hud.visible) {
      this.hud.setVisible(false);
      this.hud.reset();
    }
  }

  _openSub(name) {
    this._subReturn = this.active === 'pause' ? 'pause' : 'menu';
    this._open(name);
  }

  _closeSub() {
    const back = this._subReturn || 'menu';
    this._subReturn = null;
    this._open(back, back === 'pause' ? true : undefined);
  }

  _titleAdvance() {
    if (this.active !== 'title') return;
    // the first tap is a user gesture: go fullscreen + landscape where the browser allows it
    if (this.touchMode) device.requestImmersive();
    this._guarded(() => {
      this._sound('uiConfirm');
      this.showMenu();
    });
  }

  _menuSelect(id) {
    this._sound('uiSelect');
    if (id === 'story' || id === 'boss') this.showCharacterSelect(id);
    else if (id === 'controls' || id === 'settings') this._openSub(id);
  }

  _pauseSelect(id) {
    switch (id) {
      case 'resume':
        this._resumeFromPause();
        break;
      case 'controls':
      case 'settings':
        this._sound('uiSelect');
        this._openSub(id);
        break;
      case 'restart':
        this._restart();
        break;
      case 'quit':
        this._quit();
        break;
      default:
        break;
    }
  }

  _resumeFromPause() {
    this._sound('uiConfirm');
    this.hidePause();
    this._call('onResume');
  }

  /** After an action callback: if the game answered with a loading screen, retire the screen that fired it. */
  _settleAfter(source) {
    if (this.active === source && this.screens.loading.visible) {
      this.screens[source].hide();
      if (this._subReturn) {
        this.screens.controls.hide();
        this.screens.settings.hide();
        this._subReturn = null;
      }
      this.el.classList.remove('is-paused', 'is-result');
      this.active = null;
    }
  }

  _startGame(mode, character) {
    this._sound('uiConfirm');
    const before = this._stamp;
    this._hudChar = character;
    this._call('onStart', mode, character);
    if (this._stamp === before) this.showHUD(character);
    else this._settleAfter('select');
  }

  _restart() {
    const source = this.active;
    const before = this._stamp;
    this._call('onRestart');
    if (this._stamp === before) {
      this._inRun = false;
      this.showHUD(this._hudChar);
    } else if (source) this._settleAfter(source);
  }

  _quit() {
    const source = this.active;
    const before = this._stamp;
    this._call('onQuitToTitle');
    if (this._stamp === before) this.showTitle();
    else if (source) this._settleAfter(source);
  }

  _resultAction(kind) {
    this._sound('uiConfirm');
    if (kind === 'restart') this._restart();
    else this._quit();
  }

  _preview(characterId) {
    this._call('onSelectPreview', characterId);
  }

  _setSetting(key, value) {
    this.settings = sanitizeSettings({ ...this.settings, [key]: value });
    saveSettings(this.settings);
    this.touch.setSize(this.settings.touchButtonSize);
    this._call('onSettingsChange', { ...this.settings });
  }

  _resetSettings() {
    this.settings = { ...DEFAULT_SETTINGS };
    saveSettings(this.settings);
    this.touch.setSize(this.settings.touchButtonSize);
    this._call('onSettingsChange', { ...this.settings });
  }
}

export default UI;
