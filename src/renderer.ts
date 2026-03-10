import { UFO, D_POS, D_ACCEL, D_JERK, D_SNAP, D_CRACKLE, D_POP } from './ufo';
import { Asteroid } from './asteroid';
import { SafeZone } from './safezone';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  MAX_ENGINE_ACCEL, ACCEL_EXHAUST_MIN, EXHAUST_Y_OFFSET,
  MIN_JERK, MAX_JERK, JERK_PULSE_MIN_HZ, JERK_PULSE_MAX_HZ,
  MIN_SNAP, MAX_SNAP, ENGINE_GLOW_Y,
  MIN_CRACKLE, MAX_CRACKLE, CRACKLE_FREQUENCY,
  STAR_ALPHA_BASE, STAR_ALPHA_SCALE,
  RIM_LIGHT_Y_FRACTION, RIM_LIGHT_RADIUS_FRACTION, RIM_LIGHT_X_SPREAD,
  RIM_LIGHT_X_OFFSETS, RIM_LIGHT_VALUE_MIN,
} from './constants';

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

// Converts HSV (h: 0–360, s: 0–1, v: 0–1) to a CSS rgb() string.
function hsvToRgb(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return `rgb(${Math.round((r + m) * 255)},${Math.round((g + m) * 255)},${Math.round((b + m) * 255)})`;
}

// Renderer centralises every canvas draw call, keeping game logic files free
// of rendering concerns. It holds the loaded image assets and exposes one
// focused method per visual element. Separating rendering here also makes it
// easy to swap sprites, add post-processing, or support a HiDPI pixel ratio
// in one place without touching game logic.
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private ufoImage: HTMLImageElement | null = null;
  private asteroidImages: (HTMLImageElement | null)[] = [null, null];
  private exhaustImage: HTMLImageElement | null = null;
  private exhaustLowImage: HTMLImageElement | null = null;
  private engineGlowImage: HTMLImageElement | null = null;
  private time: number = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }

  // Advances the internal clock used for exhaust flicker/pulse animations.
  // Called every frame so effects run on title and dead screens too.
  tick(dt: number): void {
    this.time += dt;
  }

  // Fetches all sprite assets. Each image is loaded independently so a single
  // missing file does not prevent the others from loading.
  async loadAssets(): Promise<void> {
    const tryLoad = (src: string) => loadImage(src).catch(() => null);
    const base = import.meta.env.BASE_URL;
    [this.ufoImage, this.asteroidImages[0], this.asteroidImages[1], this.exhaustImage, this.exhaustLowImage, this.engineGlowImage] = await Promise.all([
      tryLoad(`${base}assets/ufo.png`),
      tryLoad(`${base}assets/asteroid1.png`),
      tryLoad(`${base}assets/asteroid2.png`),
      tryLoad(`${base}assets/exhaust.png`),
      tryLoad(`${base}assets/exhaustlow.png`),
      tryLoad(`${base}assets/engineglow.png`),
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
      ctx.globalAlpha = STAR_ALPHA_BASE + star.r * STAR_ALPHA_SCALE;
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
  // Draws the exhaust plume behind the UFO. Called before asteroids so the
  // plume appears beneath them in the draw order.
  // Height encodes acceleration. Image and alpha encode jerk:
  //   Non-negative jerk → exhaust image; negative jerk → exhaustlow image.
  //   Positive jerk     → binary square-wave alpha (fully on or off).
  //   Zero/negative jerk→ smooth sine-wave alpha (0..1 continuously).
  // Frequency linearly interpolates from JERK_PULSE_MIN_HZ at MIN_JERK to JERK_PULSE_MAX_HZ at MAX_JERK.
  drawExhaust(ufo: UFO): void {
    const { x, radius: r } = ufo;
    const y = ufo.d[D_POS];
    const ctx = this.ctx;
    const accelT = ufo.d[D_ACCEL] / MAX_ENGINE_ACCEL;
    const exhaustHeight = ACCEL_EXHAUST_MIN + accelT * (r * 4);
    const img = ufo.d[D_JERK] >= 0 ? this.exhaustImage : this.exhaustLowImage;
    const t = (ufo.d[D_JERK] - MIN_JERK) / (MAX_JERK - MIN_JERK); // 0..1
    const rate = JERK_PULSE_MIN_HZ + (JERK_PULSE_MAX_HZ - JERK_PULSE_MIN_HZ) * t;
    const wave = Math.sin(2 * Math.PI * rate * this.time);
    const alpha = ufo.d[D_JERK] > 0 ? (wave >= 0 ? 1 : 0) : 0.5 + 0.5 * wave;
    if (img) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, x - r, y + r - EXHAUST_Y_OFFSET, r * 2, exhaustHeight);
      ctx.restore();
    }
  }

  // has built up.
  drawUfo(ufo: UFO): void {
    const { x, radius: r } = ufo;
    const y = ufo.d[D_POS];
    const ctx = this.ctx;

    // Engine glow: same size as UFO image, positioned so 5 px overlaps UFO bottom.
    // Snap sets base alpha (0 at snap≤0, linear to 1 at MAX_SNAP).
    // When crackle is positive, each cycle flashes full-on then full-off briefly
    // before returning to the snap alpha, giving a crackling build-up effect.
    {
      const snapAlpha = ufo.d[D_SNAP] <= 0 ? 0 : ufo.d[D_SNAP] / MAX_SNAP;
      let glowAlpha: number;
      if (ufo.d[D_CRACKLE] > 0) {
        const period = 1 / CRACKLE_FREQUENCY;
        const phase = this.time % period;
        if (phase < period * 0.1) {
          glowAlpha = 1;
        } else if (phase < period * 0.2) {
          glowAlpha = 0;
        } else {
          glowAlpha = snapAlpha;
        }
      } else {
        glowAlpha = snapAlpha;
      }
      const glowTop = (y - r) - ENGINE_GLOW_Y;
      ctx.save();
      ctx.globalAlpha = glowAlpha;
      if (this.engineGlowImage) {
        ctx.drawImage(this.engineGlowImage, x - r, glowTop, r * 2, r * 2);
      } else {
        const glowCenterY = glowTop + r;
        const grad = ctx.createRadialGradient(x, glowCenterY, 0, x, glowCenterY, r);
        grad.addColorStop(0, 'rgba(80,180,255,1)');
        grad.addColorStop(1, 'rgba(80,180,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, glowCenterY, r, 0, Math.PI * 2);
        ctx.fill();
      }
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

    // Rim lights encode the pop/crackle state via HSV colour:
    //   Hue   — green while space winds crackle up, red while it winds down, blue at limits.
    //   Value — scales with crackle (0.5 at MIN_CRACKLE → 1.0 at MAX_CRACKLE).
    //   Sat   — always maximum.
    const hue = (ufo.d[D_POP] > 0) ? 120   // green: winding up
              : (ufo.d[D_POP] < 0) ? 0     // red:   winding down
              : 240;                         // blue:  pop effectively zero, at limit
    const crackleT = (ufo.d[D_CRACKLE] - MIN_CRACKLE) / (MAX_CRACKLE - MIN_CRACKLE);
    const val = RIM_LIGHT_VALUE_MIN + (1 - RIM_LIGHT_VALUE_MIN) * crackleT;
    const lightColor = hsvToRgb(hue, 1, val);
    for (const lx of RIM_LIGHT_X_OFFSETS) {
      ctx.beginPath();
      ctx.arc(x + lx * r * RIM_LIGHT_X_SPREAD, y + r * RIM_LIGHT_Y_FRACTION, r * RIM_LIGHT_RADIUS_FRACTION, 0, Math.PI * 2);
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

    const asteroidImage = this.asteroidImages[asteroid.imageIndex];
    if (asteroidImage) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.drawImage(asteroidImage, -r, -r, size, size);
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
    demoUfo.d[D_POS] = cy - 110;
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
    ctx.fillText('Hold SPACE to pop thruster acceleration', cx, cy + 58);
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
