import {
  CANVAS_HEIGHT,
  SAFE_ZONE_FRACTION,
  SAFE_ZONE_SPEED,
  SAFE_ZONE_FLIP_MIN,
  SAFE_ZONE_FLIP_MAX,
  REBOUND_ZONE_FRACTION,
} from './constants';

// SafeZone is a moving horizontal band that is kept clear of asteroids,
// guaranteeing the player always has a navigable corridor. Its centre
// bounces between the rebound zone boundaries and flips direction at a
// randomised interval between SAFE_ZONE_FLIP_MIN and SAFE_ZONE_FLIP_MAX
// seconds. The next flip time is known in advance so the spawner can
// predict where the safe zone will be when a new asteroid arrives at the
// UFO, and spawn outside that predicted position.
export class SafeZone {
  center: number;
  readonly halfHeight: number;
  direction: number = -1; // -1 = moving up (decreasing y)
  nextFlipIn: number;     // seconds until the next random direction flip

  constructor() {
    this.halfHeight = (SAFE_ZONE_FRACTION * CANVAS_HEIGHT) / 2;
    this.center = CANVAS_HEIGHT / 2;
    this.nextFlipIn = this.randomFlipInterval();
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
    this.nextFlipIn = this.randomFlipInterval();
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

    // Countdown to the next random flip.
    this.nextFlipIn -= dt;
    if (this.nextFlipIn <= 0) {
      this.direction *= -1;
      this.nextFlipIn = this.randomFlipInterval();
    }
  }

  // Predicts where the safe zone centre will be after travelTime seconds.
  // If the scheduled random flip fires before arrival, the direction is
  // inverted from that point onward. Boundary clamp prevents the result from
  // landing outside the rebound zone.
  predictCenter(travelTime: number): number {
    const minCenter = CANVAS_HEIGHT * REBOUND_ZONE_FRACTION;
    const maxCenter = CANVAS_HEIGHT * (1 - REBOUND_ZONE_FRACTION);

    let dir = this.direction;
    let predicted: number;

    if (this.nextFlipIn < travelTime) {
      // Zone travels in current direction up to the flip, then reverses.
      predicted = this.center + dir * SAFE_ZONE_SPEED * this.nextFlipIn;
      dir *= -1;
      predicted += dir * SAFE_ZONE_SPEED * (travelTime - this.nextFlipIn);
    } else {
      predicted = this.center + dir * SAFE_ZONE_SPEED * travelTime;
    }

    return Math.max(minCenter, Math.min(maxCenter, predicted));
  }

  // True when a circle at (y, radius) overlaps the safe zone band at its
  // predicted position after travelTime seconds.
  predictedOverlaps(y: number, radius: number, travelTime: number): boolean {
    const predicted = this.predictCenter(travelTime);
    return y + radius > predicted - this.halfHeight &&
           y - radius < predicted + this.halfHeight;
  }

  // True when a circle at (y, radius) overlaps the safe zone band now.
  overlaps(y: number, radius: number): boolean {
    return y + radius > this.top && y - radius < this.bottom;
  }

  private randomFlipInterval(): number {
    return SAFE_ZONE_FLIP_MIN + Math.random() * (SAFE_ZONE_FLIP_MAX - SAFE_ZONE_FLIP_MIN);
  }
}
