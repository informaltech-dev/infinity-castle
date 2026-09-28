// Trailer entry (dev server only: /trailer/). Boots the real game with the audio recorder in place of the
// audio system, then waits for trailer/capture.mjs (or a person) to start the timeline.
import { Game } from '../src/game/game.js';
import { UI } from '../src/ui/ui.js';
import { createTextures } from '../src/render/textures.js';
import { AudioLog } from './audio-log.js';
import { Trailer } from './trailer.js';
import { Overlay } from './overlay.js';
import { TIMELINE as MAIN } from './shots.js';
import { SURVEY } from './survey.js';
import { TIMELINE as MOON } from './moon.js';
import { renderSoundtrack } from './audio-render.js';

const TIMELINES = { main: MAIN, survey: SURVEY, moon: MOON };
const TIMELINE = TIMELINES[new URLSearchParams(location.search).get('tl')] || MAIN;

const game = new Game({
  canvas: document.getElementById('game-canvas'),
  uiRoot: document.getElementById('ui-root'),
  UIClass: UI,
  AudioClass: AudioLog,
  createTextures,
});
game.boot();

const overlay = new Overlay(document.getElementById('trailer-root'), game);
const trailer = new Trailer(game, TIMELINE, overlay);
window.__trailer = trailer;

// every glyph the trailer can show, so the web-font subsets are loaded before the first frame
async function loadFonts() {
  const text = [TIMELINE.glyphs || '', document.getElementById('ui-root').textContent, overlay.glyphs()].join('');
  const faces = ['400 40px "LXGW WenKai TC"', '700 40px "LXGW WenKai TC"', '500 40px "Noto Serif TC"', '700 40px "Noto Serif TC"', '900 40px "Noto Serif TC"'];
  await Promise.all(faces.map((f) => document.fonts.load(f, text).catch(() => {})));
  await document.fonts.ready;
}

(async () => {
  while (game.state !== 'title') await new Promise((r) => setTimeout(r, 50));
  await loadFonts();
  trailer.ready = true;
  if (new URLSearchParams(location.search).has('play')) trailer.begin(+(new URLSearchParams(location.search).get('from') || 0));
})();

trailer.renderAudio = async (opts) => {
  const out = await renderSoundtrack(trailer.audio.events, TIMELINE, opts);
  trailer._audioOut = out;
  return { sampleRate: out.sampleRate, bytes: out.wav.byteLength, stats: out.stats };
};
/** WAV bytes as base64, in slices small enough for the DevTools protocol. */
trailer.audioChunk = (i, size = 4 << 20) => {
  const u8 = new Uint8Array(trailer._audioOut.wav, i * size, Math.max(0, Math.min(size, trailer._audioOut.wav.byteLength - i * size)));
  let s = '';
  for (let k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000));
  return btoa(s);
};
