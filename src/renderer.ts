import { UFO } from './ufo';
import { Asteroid } from './asteroid';
import { SafeZone } from './safezone';
import { CANVAS_WIDTH, CANVAS_HEIGHT, MAX_ENGINE_ACCEL, MIN_JERK, MAX_JERK } from './constants';

export interface Star {
  x: number;
  y: number;
  r: number;
  speed: number;
}

// Wraps a single image load as a promise so multiple assets can be awaited in
// parallel via Promise.all rather than sequencing them serially.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

// Renderer centralises every canvas draw call, keeping game logic files free
// of rendering concerns. It holds the loaded image assets and exposes one
// focused method per visual element. Separating rendering here also makes it
// easy to swap sprites, add post-processing, or support a HiDPI pixel ratio
// in one place without touching game logic.
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private ufoImage: HTMLImageElement | null = null;
  private asteroidImage: HTMLImageElement | null = null;
  private exhaustImage: HTMLImageElement | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  // Fetches all sprite assets in parallel. Must resolve before the game loop
  // starts so drawUfo and drawAsteroid always have images ready to paint.
  async loadAssets(): Promise<void> {
    [this.ufoImage, this.asteroidImage, this.exhaustImage] = await Promise.all([
      loadImage('/assets/ufo.png'),
      loadImage('/assets/asteroid.png'),
      loadImage('/assets/exhaust.png'),
    ]);
  }

  // Paints the solid background that clears the previous frame. Done as a
  // filled rect rather than clearRect so the deep-space colour is visible at
  // the edges when the canvas is letterboxed inside a larger window.
  drawBackground(): void {
    this.ctx.fillStyle = '#050510';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // Stars use varying alpha tied to radius so larger (faster) stars appear
  // brighter, reinforcing the parallax depth cue from their different speeds.
  drawStars(stars: Star[]): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#fff';
    for (const star of stars) {
      ctx.globalAlpha = 0.4 + star.r * 0.4;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Draws the UFO sprite centred on ufo.x/ufo.y at exactly diameter (radius*2)
  // so the image fills the collision circle. The engine glow is rendered as a
  // canvas gradient beneath the sprite so it bleeds out around the hull rather
  // than being clipped by the image boundary, and its opacity scales with the
  // current thrust level to give real-time feedback on how much acceleration
  // has built up.
  drawUfo(ufo: UFO): void {
    const { x, y, radius: r, engineAccel } = ufo;
    const ctx = this.ctx;

    // Exhaust is drawn before the UFO sprite so it appears behind the hull.
    // Height scales linearly with engineAccel so the flame visually represents
    // current thrust output. Alpha follows the same ratio, fading to fully
    // transparent at zero so there is no visible exhaust when the engine is off.
    // Width is fixed at the UFO diameter so the flame always fits the hull width.
    if (this.exhaustImage) {
      const t = engineAccel / MAX_ENGINE_ACCEL;
      const exhaustHeight = Math.max(1, t * r * 2);
      const exhaustAlpha = t * 0.5;
      ctx.save();
      ctx.globalAlpha = exhaustAlpha;
      // Anchor the wide top edge of the exhaust to the bottom of the UFO circle.
      ctx.drawImage(this.exhaustImage, x - r, y + r, r * 2, exhaustHeight);
      ctx.restore();
    }

    const size = r * 2;
    if (this.ufoImage) {
      ctx.drawImage(this.ufoImage, x - r, y - r, size, size);
    } else {
      // Fallback drawn if assets haven't loaded yet (e.g. during hot-reload).
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#7ac';
      ctx.fill();
    }

    // Rim lights sit on the disc edge and show the current jerk level — black
    // when thrust is fully released (jerk at its negative floor) through gray
    // to white when jerk is fully wound up. This gives the player a direct
    // read on how much more thrust headroom they have before hitting MAX_JERK.
    const t = (ufo.jerk - MIN_JERK) / (MAX_JERK - MIN_JERK);
    const v = Math.round(Math.max(0, Math.min(1, t)) * 255);
    const lightColor = `rgb(${v},${v},${v})`;
    const lightOffsets = [-0.65, 0, 0.65];
    for (const lx of lightOffsets) {
      ctx.beginPath();
      ctx.arc(x + lx * r * 0.85, y + r * 0.22, r * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = lightColor;
      ctx.fill();
    }
  }

  // Draws the asteroid sprite centred on its position, sized to its collision
  // diameter, and rotated to match its current spin angle. The rotation is
  // applied via translate+rotate rather than a CSS transform so it composes
  // correctly with the rest of the canvas state.
  drawAsteroid(asteroid: Asteroid): void {
    const { x, y, radius: r, rotation } = asteroid;
    const ctx = this.ctx;
    const size = r * 2;

    if (this.asteroidImage) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.drawImage(this.asteroidImage, -r, -r, size, size);
      ctx.restore();
    } else {
      // Fallback drawn if assets haven't loaded yet.
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#665544';
      ctx.fill();
    }
  }

  // Debug visualisation: draws the safe zone as a blue bracket on the right
  // edge of the screen so its position and extent are visible during testing.
  drawSafeZone(safeZone: SafeZone): void {
    const ctx = this.ctx;
    const x = CANVAS_WIDTH - 6;
    const w = 4;
    ctx.fillStyle = 'rgba(0, 120, 255, 0.6)';
    ctx.fillRect(x, safeZone.top, w, safeZone.bottom - safeZone.top);
  }

  // Score is drawn twice — a dark shadow offset by one pixel first, then the
  // coloured value on top — so it remains legible against any background colour.
  drawHud(score: number): void {
    const ctx = this.ctx;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 17px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(`SCORE: ${score}`, CANVAS_WIDTH - 9, 11);
    ctx.fillStyle = '#7cf';
    ctx.fillText(`SCORE: ${score}`, CANVAS_WIDTH - 10, 10);
  }

  // Draws the attract screen. A demo UFO sprite is shown above the title text
  // so the player immediately sees the thing they are controlling before
  // pressing space — communicating the game object without instructions.
  drawTitle(): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    // Construct a minimal stand-in UFO just to supply the position and radius
    // that drawUfo needs. Its physics state is irrelevant here.
    const demoUfo = new UFO();
    demoUfo.y = cy - 110;
    this.drawUfo(demoUfo);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 62px monospace';
    ctx.fillStyle = 'rgba(0,100,200,0.4)';
    ctx.fillText('WONKY UFO', cx + 3, cy - 43);

    ctx.fillStyle = '#4af';
    ctx.fillText('WONKY UFO', cx, cy - 46);

    ctx.font = '18px monospace';
    ctx.fillStyle = '#9df';
    ctx.fillText('Press SPACE to launch', cx, cy + 20);

    ctx.font = '13px monospace';
    ctx.fillStyle = '#467';
    ctx.fillText('Hold SPACE to thrust  ·  Avoid asteroids', cx, cy + 58);
  }

  // The dead screen keeps the final game frame visible underneath a
  // semi-transparent overlay so the player can see exactly what killed them.
  // The asteroids and UFO are drawn by the caller before this is called.
  drawDead(score: number): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 58px monospace';
    ctx.fillStyle = 'rgba(180,0,0,0.4)';
    ctx.fillText('GAME OVER', cx + 3, cy - 48);

    ctx.fillStyle = '#f44';
    ctx.fillText('GAME OVER', cx, cy - 50);

    ctx.font = '22px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Score: ${score}`, cx, cy + 10);

    ctx.font = '16px monospace';
    ctx.fillStyle = '#9df';
    ctx.fillText('Press SPACE to play again', cx, cy + 52);
  }
}
