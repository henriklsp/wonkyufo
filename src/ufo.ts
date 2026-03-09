import {
  EASY_MODE,
  GRAVITY,
  MAX_ENGINE_ACCEL,
  MAX_JERK,
  MIN_JERK,
  MIN_ENGINE_ACCEL,
  MAX_SNAP,
  MIN_SNAP,
  MAX_CRACKLE,
  MIN_CRACKLE,
  MAX_POP,
  MIN_POP,
  UFO_RADIUS,
  UFO_X_FRACTION,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  UFO_COLLISION_RADIUS,
  REBOUND_ZONE_FRACTION,
  REBOUND_SPEED,
} from './constants';

// Derivative index constants — export so renderer and game can reference
// physics state by name rather than magic numbers.
export const D_POS     = 0;  // y position   (pixels)
export const D_VEL     = 1;  // velocity      (pixels/s)
export const D_ACCEL   = 2;  // engine accel  (pixels/s²)
export const D_JERK    = 3;  // jerk          (pixels/s³)
export const D_SNAP    = 4;  // snap          (pixels/s⁴)
export const D_CRACKLE = 5;  // crackle       (pixels/s⁵)
export const D_POP     = 6;  // pop           (pixels/s⁶)
const CHAIN_START      = D_ACCEL;  // first order with a real limit

// Hard limits for each derivative order.
// Infinity entries are unclamped; isOutOfBounds() handles position game-over.
const MAX_D: number[] = [
  Infinity,           // D_POS
  Infinity,           // D_VEL
  MAX_ENGINE_ACCEL,   // D_ACCEL
  MAX_JERK,           // D_JERK
  MAX_SNAP,           // D_SNAP
  MAX_CRACKLE,        // D_CRACKLE
  MAX_POP,            // D_POP
];
const MIN_D: number[] = [
  -Infinity,          // D_POS
  -Infinity,          // D_VEL
  MIN_ENGINE_ACCEL,   // D_ACCEL
  MIN_JERK,           // D_JERK
  MIN_SNAP,           // D_SNAP
  MIN_CRACKLE,        // D_CRACKLE
  MIN_POP,            // D_POP
];

// UFO is the player-controlled entity. It moves only vertically — horizontal
// position is fixed so the challenge is purely about altitude management.
// In full mode physics are modelled six levels deep (position ← velocity ←
// acceleration ← jerk ← snap ← crackle ← pop) for a very slow-build thrust
// feel. EASY_MODE collapses this to four levels by setting snap directly.
export class UFO {
  x: number;
  d: number[] = [0, 0, 0, 0, 0, 0, 0];
  spaceHeld: boolean = false;
  readonly radius: number = UFO_RADIUS;

  constructor() {
    this.x = CANVAS_WIDTH * UFO_X_FRACTION;
    this.d[D_POS] = CANVAS_HEIGHT / 2;
  }

  // Resets only the mutable physics state, not position x, because x is
  // structural and never changes between runs.
  reset(): void {
    this.d = [CANVAS_HEIGHT / 2, 0, MIN_ENGINE_ACCEL, MIN_JERK, MIN_SNAP, MIN_CRACKLE, MIN_POP];
  }

  // Returns the effective upper bound for derivative n. For orders above
  // CHAIN_START the limit cascades: if the order below is already at its own
  // max the current order is clamped to 0 so it cannot push the chain further.
  getMax(n: number): number {
    if (n <= CHAIN_START) return MAX_D[n];
    return this.d[n - 1] < this.getMax(n - 1) ? MAX_D[n] : 0;
  }

  // Symmetric lower-bound cascade: if the order below is already at its min
  // the current order is clamped to 0.
  getMin(n: number): number {
    if (n <= CHAIN_START) return MIN_D[n];
    return this.d[n - 1] > this.getMin(n - 1) ? MIN_D[n] : 0;
  }

  // Advances physics by one frame. In EASY_MODE snap is set directly from
  // input (4-level chain). Otherwise pop drives crackle drives snap (6-level
  // chain). From snap downward the chain is identical in both modes.
  update(dt: number, spaceHeld: boolean): void {
    this.spaceHeld = spaceHeld;

    if (EASY_MODE) {
      this.d[D_SNAP] = spaceHeld ? MAX_SNAP : MIN_SNAP;
      const atEffMin = this.d[D_SNAP] <= this.getMin(D_SNAP);
      this.d[D_POP] = (!spaceHeld && atEffMin) ? 0 : (spaceHeld ? MAX_POP : MIN_POP);
      for (let n = D_JERK; n >= D_ACCEL; n--) {
        this.d[n] = Math.max(this.getMin(n), Math.min(this.getMax(n), this.d[n] + this.d[n + 1] * dt));
      }
    } else {
      this.d[D_POP] = spaceHeld ? MAX_POP : MIN_POP;  // raw pop drives crackle this frame
      for (let n = D_CRACKLE; n >= D_ACCEL; n--) {
        this.d[n] = Math.max(this.getMin(n), Math.min(this.getMax(n), this.d[n] + this.d[n + 1] * dt));
      }
      // Pop is zero only when winding down (space not held) and crackle has
      // reached its effective minimum, i.e. it cannot decrease further.
      const atEffMin = this.d[D_CRACKLE] <= this.getMin(D_CRACKLE);
      this.d[D_POP] = (!spaceHeld && atEffMin) ? 0 : this.d[D_POP];  // effective pop for display
    }

    // Canvas Y increases downward, so gravity adds to velocityY (pulls down)
    // and engine thrust subtracts from it (pushes up).
    this.d[D_VEL] += (GRAVITY - this.d[D_ACCEL]) * dt;
    this.d[D_POS] += this.d[D_VEL] * dt;

    // Rebound zone: directly nudge position toward centre without touching the
    // physics chain. Force scales linearly from REBOUND_SPEED at the edge to 0
    // at REBOUND_ZONE_FRACTION of canvas height away from the edge.
    const zoneDepth = CANVAS_HEIGHT * REBOUND_ZONE_FRACTION;
    if (this.d[D_POS] < zoneDepth) {
      const t = 1 - this.d[D_POS] / zoneDepth;
      this.d[D_POS] += REBOUND_SPEED * t * dt;
    } else if (this.d[D_POS] > CANVAS_HEIGHT - zoneDepth) {
      const t = 1 - (CANVAS_HEIGHT - this.d[D_POS]) / zoneDepth;
      this.d[D_POS] -= REBOUND_SPEED * t * dt;
    }
  }

  // Used by the game loop to detect the top/bottom boundary kill condition.
  // Checks the edge of the sprite circle, not its centre, so the player
  // visually grazes the wall before dying.
  isOutOfBounds(): boolean {
    return this.d[D_POS] - UFO_COLLISION_RADIUS < 0 || this.d[D_POS] + UFO_COLLISION_RADIUS > CANVAS_HEIGHT;
  }
}
