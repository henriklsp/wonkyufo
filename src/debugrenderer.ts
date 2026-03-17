import { UFO, D_VEL, D_ACCEL, D_JERK, D_SNAP, D_CRACKLE, D_POP } from './ufo';
import { SafeZone } from './safezone';
import { CANVAS_HEIGHT } from './constants';

// DebugRenderer draws developer overlays on top of the game frame.
// It is only instantiated and called when DEBUG_MODE is true, so it has no
// runtime cost in production builds.
export class DebugRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  draw(ufo: UFO, safeZone: SafeZone): void {
    this.drawSafeZoneIndicator(safeZone);
    this.drawDerivativeBars(ufo);
  }

  // Draws a green vertical strip on the left edge of the screen. The strip
  // spans the full canvas height; the safe zone band within it is filled more
  // brightly so its position and height are immediately readable at a glance.
  private drawSafeZoneIndicator(safeZone: SafeZone): void {
    const ctx = this.ctx;
    const x = 2;
    const w = 10;

    ctx.fillStyle = 'rgba(0, 80, 0, 0.35)';
    ctx.fillRect(x, 0, w, CANVAS_HEIGHT);

    ctx.fillStyle = 'rgba(0, 255, 60, 0.55)';
    ctx.fillRect(x, safeZone.top, w, safeZone.bottom - safeZone.top);

    ctx.strokeStyle = 'rgba(0, 255, 60, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, safeZone.top);    ctx.lineTo(x + w, safeZone.top);
    ctx.moveTo(x, safeZone.bottom); ctx.lineTo(x + w, safeZone.bottom);
    ctx.stroke();
  }

  // Draws 5 vertical bars at the top of the screen, one per controlled
  // derivative (acceleration → pop). Each bar is centred on a zero line;
  // green bars extend upward for positive values, red bars extend downward for
  // negative ones. The ±100 dashed lines mark the display clamp boundary, so
  // values outside that range (e.g. raw pop which reaches 10 000) are shown at
  // full bar height rather than overflowing the panel.
  private drawDerivativeBars(ufo: UFO): void {
    const ctx = this.ctx;

    const derivs = [
      { label: 'pop', value: ufo.d[D_POP] },
      { label: 'crc', value: ufo.d[D_CRACKLE] },
      { label: 'snp', value: ufo.d[D_SNAP] },
      { label: 'jrk', value: ufo.d[D_JERK] },
      { label: 'acc', value: ufo.d[D_ACCEL] },
      { label: 'spd', value: -ufo.d[D_VEL] },  // negate: canvas Y is down, so upward motion is negative
    ];

    const BAR_W = 28;
    const GAP = 8;
    const ZERO_Y = 140;        // y-coordinate of the zero baseline
    const SCALE = 1;           // 1 px per unit, so ±100 units → ±100 px
    const LEFT = 200;          // x of first bar — kept right of the UFO (~80 px)

    const totalW = derivs.length * (BAR_W + GAP) - GAP;

    // Panel background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(LEFT - 6, ZERO_Y - 108, totalW + 12, 230);

    // ±100 reference lines (dashed)
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    for (const offsetY of [-100, 100]) {
      ctx.beginPath();
      ctx.moveTo(LEFT - 6, ZERO_Y + offsetY * SCALE);
      ctx.lineTo(LEFT + totalW + 6, ZERO_Y + offsetY * SCALE);
      ctx.stroke();
    }
    ctx.restore();

    // Zero line (solid)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LEFT - 6, ZERO_Y);
    ctx.lineTo(LEFT + totalW + 6, ZERO_Y);
    ctx.stroke();

    // Bars and labels
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < derivs.length; i++) {
      const x = LEFT + i * (BAR_W + GAP);
      const raw = derivs[i].value;
      const clamped = Math.max(-100, Math.min(100, raw));
      const h = Math.abs(clamped) * SCALE;

      ctx.fillStyle = clamped >= 0 ? 'rgba(0, 220, 80, 0.85)' : 'rgba(220, 50, 50, 0.85)';
      if (clamped >= 0) {
        ctx.fillRect(x, ZERO_Y - h, BAR_W, h);
      } else {
        ctx.fillRect(x, ZERO_Y, BAR_W, h);
      }

      ctx.fillStyle = '#ccc';
      ctx.fillText(derivs[i].label, x + BAR_W / 2, ZERO_Y + 104);

      // Numeric value in small text below the label
      ctx.fillStyle = '#888';
      ctx.fillText(Math.round(raw).toString(), x + BAR_W / 2, ZERO_Y + 116);
    }
  }
}
