// iPhone Safari has no fullscreen API for web pages, and in landscape its tab bar and address bar take a
// good slice of the height. Scrolling the page is what tucks them away, so there the document is made
// scrollable (under the fixed game, which never scrolls itself) and, while the bars are out, a prompt asks
// for one upward swipe. Opened from the home screen (manifest: display fullscreen) there are no bars at all.
import { h } from './dom.js';
import { device } from '../core/device.js';

const SKIP_KEY = 'ic-bars-skip';
// ?barstest: also prompt in portrait (the iOS Simulator cannot be turned without its app)
const TEST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('barstest');

const SWIPE_SVG =
  '<svg class="sw-i" viewBox="0 0 64 96" aria-hidden="true"><path class="sw-trail" d="M32 84V30"/><path class="sw-head" d="M18 40 32 24l14 16"/><circle class="sw-dot" cx="32" cy="84" r="7"/></svg>';

const store = {
  get(k) {
    try {
      return sessionStorage.getItem(k);
    } catch (_) {
      return null;
    }
  },
  set(k, v) {
    try {
      sessionStorage.setItem(k, v);
    } catch (_) { /* private mode */ }
  },
};

export class SafariBars {
  /** @param {() => void} onShow  the prompt went up (the game pauses a fight under it) */
  constructor(onShow) {
    this.onShow = onShow;
    this.on = false;
    this.skipped = store.get(SKIP_KEY) === '1';
    // viewport height with the bars tucked away, per orientation: the screen until a collapse is seen
    // (some versions keep a small address pill, so the measured height then replaces the guess)
    const s = typeof screen !== 'undefined' ? screen : { width: 0, height: 0 };
    this.full = { l: Math.min(s.width, s.height), p: Math.max(s.width, s.height) };
    this.h0 = 0;
    this.el = null;
    if (!device.iosBrowser) return;

    document.documentElement.classList.add('ios-scroll');
    this.el = h('div', {
      class: 'ic-swipe',
      hidden: true,
      html: `<div class="sw-box">${SWIPE_SVG}<p class="sw-t">向上滑動，全螢幕遊玩</p><p class="sw-s">iPhone 的 Safari 無法讓網頁全螢幕，向上滑動即可收起網址列與分頁列。</p><p class="sw-s">想要完全沒有瀏覽器介面：點「分享」選「加入主畫面」，之後從主畫面圖示開啟。</p><div class="sw-skip" role="button">略過</div></div>`,
    });
    document.body.append(this.el);
    this.el.querySelector('.sw-skip').addEventListener('click', (e) => {
      e.stopPropagation();
      this.skip();
    });
    const check = () => this.check();
    window.addEventListener('resize', check);
    window.visualViewport?.addEventListener('resize', check);
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(check, 400));
    device.onChange(check);
    check();
  }

  skip() {
    this.skipped = true;
    store.set(SKIP_KEY, '1');
    this.check();
  }

  check() {
    if (!this.el) return;
    const landscape = window.innerWidth > window.innerHeight;
    const o = landscape ? 'l' : 'p';
    const H = window.innerHeight;
    if (this.on && H > this.h0 + 20) this.full[o] = Math.min(this.full[o], H); // the swipe tucked the bars away
    const out = H < this.full[o] - 24;
    const want = out && !this.skipped && device.touch && (landscape || TEST);
    if (want && this.on) this._giveUpLater();
    if (want === this.on) return;
    this.on = want;
    this.el.hidden = !want;
    if (!want) return;
    this.h0 = H;
    // leave room below for the swipe to move the page
    window.scrollTo(0, 0);
    this.onShow?.();
  }

  /** A browser that never tucks its bars away (in-app web views): stop asking once the page has scrolled. */
  _giveUpLater() {
    if (window.scrollY < 120) return;
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      if (this.on && window.scrollY >= 120 && window.innerHeight <= this.h0 + 20) this.skip();
    }, 900);
  }
}

export default SafariBars;
