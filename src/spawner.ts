import { Asteroid } from './asteroid';
import { SafeZone } from './safezone';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  ASTEROID_SPEED_BASE,
  ASTEROID_SPEED_RANGE,
  ASTEROID_RADIUS_MIN,
  ASTEROID_RADIUS_MAX,
  SPAWN_INTERVAL_BASE,
  SPAWN_INTERVAL_RANGE,
  DIFFICULTY_RAMP_INTERVAL,
  SPEED_INCREASE_PER_STEP,
  INTERVAL_DECREASE_PER_STEP,
  MIN_SPAWN_INTERVAL,
  SAFE_ZONE_FRACTION,
  REBOUND_ZONE_FRACTION,
} from './constants';

// Spawner owns the pacing of the game: when asteroids appear, how large they
// are, and how fast they move. It uses two independent timers — one for the
// next individual spawn and one for periodic difficulty ramps — so the two
// concerns don't interfere with each other. All state resets cleanly on
// restart so consecutive games feel identical at the start.
export class Spawner {
  private timer: number = 0;
  private nextSpawn: number;
  private difficultyTimer: number = 0;
  private difficultyStep: number = 0;

  constructor() {
    this.nextSpawn = this.randomInterval();
  }

  // Resets to the exact same state as construction so a new game always starts
  // at the same difficulty, regardless of how far the previous game progressed.
  reset() {
    this.timer = 0;
    this.difficultyTimer = 0;
    this.difficultyStep = 0;
    this.nextSpawn = this.randomInterval();
  }

  // Advances both timers and returns any asteroids that should be added to the
  // scene this frame. Returning new asteroids rather than mutating a shared list
  // keeps the spawner decoupled from the game's asteroid collection.
  update(dt: number, safeZone: SafeZone): Asteroid[] {
    this.timer += dt;
    this.difficultyTimer += dt;

    // Difficulty steps up on a fixed wall-clock cadence. Subtracting rather
    // than resetting handles the case where dt pushes past multiple thresholds
    // in a single frame (unlikely but correct).
    const rampSecs = DIFFICULTY_RAMP_INTERVAL / 1000;
    if (this.difficultyTimer >= rampSecs) {
      this.difficultyTimer -= rampSecs;
      this.difficultyStep++;
    }

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

  // Computes a randomised wait time for the next spawn, shrinking the base
  // interval as difficulty climbs but never going below the floor that
  // keeps the game physically survivable.
  private randomInterval(): number {
    const baseMs = Math.max(
      MIN_SPAWN_INTERVAL,
      SPAWN_INTERVAL_BASE - this.difficultyStep * INTERVAL_DECREASE_PER_STEP
    );
    const jitter = (Math.random() - 0.5) * SPAWN_INTERVAL_RANGE;
    return (baseMs + jitter) / 1000; // convert to seconds to match dt units
  }

  // Constructs one asteroid at a random height along the right edge. Placing it
  // at x = canvasWidth + radius means it enters from fully off-screen, so the
  // player gets a brief preview as it slides in rather than a sudden pop-in.
  private spawnOne(safeZone: SafeZone): Asteroid {
    const radius =
      ASTEROID_RADIUS_MIN +
      Math.random() * (ASTEROID_RADIUS_MAX - ASTEROID_RADIUS_MIN);
    const x = CANVAS_WIDTH + radius;
    const zoneDepth = REBOUND_ZONE_FRACTION * CANVAS_HEIGHT;
    const roll = Math.random();
    let y: number;
    if (roll < 0.15) {
      // Upper rebound zone
      y = radius + Math.random() * (zoneDepth - radius);
    } else if (roll < 0.30) {
      // Lower rebound zone
      y = (CANVAS_HEIGHT - zoneDepth) + Math.random() * (zoneDepth - radius);
    } else {
      // Anywhere on screen; push out of safe zone if needed.
      y = radius + Math.random() * (CANVAS_HEIGHT - radius * 2);
      if (safeZone.overlaps(y, radius)) {
        const push = SAFE_ZONE_FRACTION * CANVAS_HEIGHT + radius;
        y += Math.random() < 0.5 ? -push : push;
      }
    }
    const speed =
      ASTEROID_SPEED_BASE +
      this.difficultyStep * SPEED_INCREASE_PER_STEP +
      (Math.random() - 0.5) * ASTEROID_SPEED_RANGE;
    return new Asteroid(x, y, radius, -speed);
  }
}
