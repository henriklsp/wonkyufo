import { Asteroid } from './asteroid';
import { SafeZone } from './safezone';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  ASTEROID_SPEED_BASE,
  ASTEROID_SPEED_RANGE,
  ASTEROID_SPEED_MAX_FACTOR,
  ASTEROID_SPEED_CAP_TIME,
  ASTEROID_RADIUS_MIN,
  ASTEROID_RADIUS_MAX,
  SPAWN_INTERVAL_BASE,
  SPAWN_INTERVAL_RANGE,
  SPAWN_RAMP_RATE,
  MIN_SPAWN_INTERVAL,
  SAFE_ZONE_FRACTION,
  REBOUND_ZONE_FRACTION,
  REBOUND_ZONE_SPAWN_CHANCE,
} from './constants';

// Spawner owns the pacing of the game: when asteroids appear, how large they
// are, and how fast they move. It uses two independent timers — one for the
// next individual spawn and one for periodic difficulty ramps — so the two
// concerns don't interfere with each other. All state resets cleanly on
// restart so consecutive games feel identical at the start.
export class Spawner {
  private timer: number = 0;
  private nextSpawn: number;
  private elapsed: number = 0; // total seconds since game start

  constructor() {
    this.nextSpawn = this.randomInterval();
  }

  // Resets to the exact same state as construction so a new game always starts
  // at the same difficulty, regardless of how far the previous game progressed.
  reset() {
    this.timer = 0;
    this.elapsed = 0;
    this.nextSpawn = this.randomInterval();
  }

  // Advances timers and returns any asteroids that should be added to the
  // scene this frame. Returning new asteroids rather than mutating a shared list
  // keeps the spawner decoupled from the game's asteroid collection.
  update(dt: number, safeZone: SafeZone): Asteroid[] {
    this.timer += dt;
    this.elapsed += dt;

    // The while loop catches up if a frame was very long (e.g. tab unfocus).
    // The dt cap in the game loop means this normally fires at most once.
    const spawned: Asteroid[] = [];
    while (this.timer >= this.nextSpawn) {
      this.timer -= this.nextSpawn;
      this.nextSpawn = this.randomInterval();
      spawned.push(this.spawnOne(safeZone));
    }
    return spawned;
  }

  // Computes a randomised wait time for the next spawn. Spawn interval shrinks
  // continuously at SPAWN_RAMP_RATE ms/sec with no upper time cap, so the field
  // keeps getting denser even after asteroid speed has plateaued.
  private randomInterval(): number {
    const baseMs = SPAWN_INTERVAL_BASE - this.elapsed * SPAWN_RAMP_RATE;
    const jitter = (Math.random() - 0.5) * SPAWN_INTERVAL_RANGE;
    return Math.max(MIN_SPAWN_INTERVAL, baseMs + jitter) / 1000; // convert to seconds to match dt units
  }

  // Constructs one asteroid at a random height along the right edge. Placing it
  // at x = canvasWidth + radius means it enters from fully off-screen, so the
  // player gets a brief preview as it slides in rather than a sudden pop-in.
  private spawnOne(safeZone: SafeZone): Asteroid {
    const radius =
      ASTEROID_RADIUS_MIN +
      Math.random() * (ASTEROID_RADIUS_MAX - ASTEROID_RADIUS_MIN);
    const x = CANVAS_WIDTH + radius;

    const speedFactor = Math.min(
      1 + this.elapsed * (ASTEROID_SPEED_MAX_FACTOR - 1) / ASTEROID_SPEED_CAP_TIME,
      ASTEROID_SPEED_MAX_FACTOR
    );
    const speed = speedFactor * (ASTEROID_SPEED_BASE + (Math.random() - 0.5) * ASTEROID_SPEED_RANGE);
    const travelTime = CANVAS_WIDTH / speed;

    const roll = Math.random();
    let y: number;
    if (roll < REBOUND_ZONE_SPAWN_CHANCE) {
      y = this.yInUpperReboundZone(radius);
    } else if (roll < REBOUND_ZONE_SPAWN_CHANCE * 2) {
      y = this.yInLowerReboundZone(radius);
    } else {
      y = this.yAvoidingSafeZone(radius, safeZone, travelTime);
    }

    return new Asteroid(x, y, radius, -speed);
  }

  private yInUpperReboundZone(radius: number): number {
    const zoneDepth = REBOUND_ZONE_FRACTION * CANVAS_HEIGHT;
    return radius + Math.random() * (zoneDepth - radius);
  }

  private yInLowerReboundZone(radius: number): number {
    const zoneDepth = REBOUND_ZONE_FRACTION * CANVAS_HEIGHT;
    return (CANVAS_HEIGHT - zoneDepth) + Math.random() * (zoneDepth - radius);
  }

  // Tries up to 3 random y positions across the full screen height. If every
  // attempt lands in the predicted safe zone, falls back to a rebound zone
  // where the safe zone never reaches.
  private yAvoidingSafeZone(radius: number, safeZone: SafeZone, travelTime: number): number {
    for (let attempt = 0; attempt < 3; attempt++) {
      const y = radius + Math.random() * (CANVAS_HEIGHT - radius * 2);
      if (!safeZone.predictedOverlaps(y, radius, travelTime)) return y;
    }
    return Math.random() < 0.5
      ? this.yInUpperReboundZone(radius)
      : this.yInLowerReboundZone(radius);
  }
}
