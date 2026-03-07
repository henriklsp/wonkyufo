import {
  GRAVITY,
  MAX_ENGINE_ACCEL,
  MAX_JERK,
  MIN_JERK,
  MAX_SNAP,
  MIN_SNAP,
  UFO_RADIUS,
  UFO_X_FRACTION,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  UFO_COLLISION_RADIUS,
  REBOUND_ZONE_FRACTION,
  REBOUND_SPEED,
} from './constants';

// UFO is the player-controlled entity. It moves only vertically — horizontal
// position is fixed so the challenge is purely about altitude management.
// Physics are modelled four levels deep (position ← velocity ← acceleration ←
// jerk ← snap) to produce the characteristic slow-build / slow-decay thrust
// feel rather than the abrupt on/off response of simpler Flappy Bird clones.
export class UFO {
  x: number;
  y: number;
  velocityY: number = 0;
  engineAccel: number = 0;
  jerk: number = 0;
  snap: number = 0;
  readonly radius: number = UFO_RADIUS;

  constructor() {
    this.x = CANVAS_WIDTH * UFO_X_FRACTION;
    this.y = CANVAS_HEIGHT / 2;
  }

  // Resets only the mutable physics state, not position x, because x is
  // structural and never changes between runs.
  reset() {
    this.y = CANVAS_HEIGHT / 2;
    this.velocityY = 0;
    this.engineAccel = 0;
    this.jerk = 0;
    this.snap = 0;
  }

  // Advances physics by one frame. Snap is set directly from input — no
  // ramping at this level — then propagates down the chain: snap drives jerk,
  // jerk drives engineAccel, engineAccel opposes gravity to drive velocity.
  update(dt: number, spaceHeld: boolean) {
    this.snap = spaceHeld ? MAX_SNAP : MIN_SNAP;
    this.jerk = Math.min(MAX_JERK, Math.max(MIN_JERK, this.jerk + this.snap * dt));
    // Prevent jerk from driving acceleration past its limits: positive jerk is
    // pointless when accel is already maxed, negative jerk when it's already zero.
    if (this.engineAccel >= MAX_ENGINE_ACCEL) this.jerk = Math.min(this.jerk, 0);
    if (this.engineAccel <= 0)               this.jerk = Math.max(this.jerk, 0);

    this.engineAccel = Math.max(
      0,
      Math.min(this.engineAccel + this.jerk * dt, MAX_ENGINE_ACCEL)
    );

    // Canvas Y increases downward, so gravity adds to velocityY (pulls down)
    // and engine thrust subtracts from it (pushes up).
    this.velocityY += (GRAVITY - this.engineAccel) * dt;
    this.y += this.velocityY * dt;

    // Rebound zone: directly nudge position toward centre without touching the
    // physics chain. Force scales linearly from REBOUND_SPEED at the edge to 0
    // at REBOUND_ZONE_FRACTION of canvas height away from the edge.
    const zoneDepth = CANVAS_HEIGHT * REBOUND_ZONE_FRACTION;
    if (this.y < zoneDepth) {
      const t = 1 - this.y / zoneDepth;
      this.y += REBOUND_SPEED * t * dt;
    } else if (this.y > CANVAS_HEIGHT - zoneDepth) {
      const t = 1 - (CANVAS_HEIGHT - this.y) / zoneDepth;
      this.y -= REBOUND_SPEED * t * dt;
    }
  }

  // Used by the game loop to detect the top/bottom boundary kill condition.
  // Checks the edge of the sprite circle, not its centre, so the player
  // visually grazes the wall before dying.
  isOutOfBounds(): boolean {
    return this.y - UFO_COLLISION_RADIUS < 0 || this.y + UFO_COLLISION_RADIUS > CANVAS_HEIGHT;
  }

}
