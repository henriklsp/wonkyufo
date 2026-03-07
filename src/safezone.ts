import {
  CANVAS_HEIGHT,
  SAFE_ZONE_FRACTION,
  SAFE_ZONE_SPEED,
  REBOUND_ZONE_FRACTION,
} from './constants';

// SafeZone is a moving horizontal band that is kept clear of asteroids,
// guaranteeing the player always has a navigable corridor. Its centre
// bounces between the rebound zone boundaries and can randomly flip
// direction once per second (10 % chance).
export class SafeZone {
  center: number;
  readonly halfHeight: number;
  private direction: number = -1; // -1 = moving up (decreasing y)
  private flipTimer: number = 0;

  constructor() {
    this.halfHeight = (SAFE_ZONE_FRACTION * CANVAS_HEIGHT) / 2;
    this.center = CANVAS_HEIGHT / 2;
  }

  get top(): number {
    return this.center - this.halfHeight;
  }

  get bottom(): number {
    return this.center + this.halfHeight;
  }

  reset() {
    this.center = CANVAS_HEIGHT / 2;
    this.direction = -1;
    this.flipTimer = 0;
  }

  update(dt: number) {
    this.center += this.direction * SAFE_ZONE_SPEED * dt;

    // Flip at the inner edge of each rebound zone.
    const minCenter = CANVAS_HEIGHT * REBOUND_ZONE_FRACTION;
    const maxCenter = CANVAS_HEIGHT * (1 - REBOUND_ZONE_FRACTION);
    if (this.center <= minCenter) {
      this.center = minCenter;
      this.direction = 1;
    } else if (this.center >= maxCenter) {
      this.center = maxCenter;
      this.direction = -1;
    }

    // 10 % chance of a random direction flip each second.
    this.flipTimer += dt;
    if (this.flipTimer >= 1) {
      this.flipTimer -= 1;
      if (Math.random() < 0.1) this.direction *= -1;
    }
  }

  // True when a circle at (y, radius) overlaps the safe zone band.
  overlaps(y: number, radius: number): boolean {
    return y + radius > this.top && y - radius < this.bottom;
  }
}
