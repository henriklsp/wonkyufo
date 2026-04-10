import { Game } from './game';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

// Setting width/height on the canvas element defines the logical drawing
// resolution. CSS size is set separately by resize(), so these two concerns
// are independent — the game always renders at 800×400 regardless of window size.
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Scales the canvas CSS dimensions to fill as much of the window as possible
// while preserving the 2:1 aspect ratio. Using Math.min of both axes means
// the canvas never overflows in either direction. Called on load and on every
// resize event so the game remains properly centred if the window is resized.
function resize() {
  const w = window.visualViewport?.width ?? window.innerWidth;
  const h = window.visualViewport?.height ?? window.innerHeight;
  const scaleX = w / CANVAS_WIDTH;
  const scaleY = h / CANVAS_HEIGHT;
  const scale = Math.min(scaleX, scaleY);
  canvas.style.width = `${CANVAS_WIDTH * scale}px`;
  canvas.style.height = `${CANVAS_HEIGHT * scale}px`;
}

resize();
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

// start() is async because it awaits image preloading before the first frame,
// ensuring sprites are never drawn in a partially-loaded state.
const game = new Game(canvas);
game.start();
