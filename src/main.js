import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { AudioSystem } from './audio/audio.js';
import { createTextures } from './render/textures.js';

const game = new Game({
  canvas: document.getElementById('game-canvas'),
  uiRoot: document.getElementById('ui-root'),
  UIClass: UI,
  AudioClass: AudioSystem,
  createTextures,
});
game.boot();
