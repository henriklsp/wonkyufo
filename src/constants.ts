// Canvas dimensions define the logical coordinate space. All physics values are
// expressed in these units (pixels), so changing these would require rescaling
// constants too. The 2:1 ratio gives a wide field of view for incoming asteroids.
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 400;

// UFO physics
//
// These four constants form a chain: JERK_INCREASE builds jerk while space is
// held, jerk accumulates into engineAccel, and engineAccel fights GRAVITY each
// frame. The layered approach means thrust feels "warm up" rather than
// snapping on instantly, making the game feel floaty and skill-dependent.
export const GRAVITY = 20;            // pixels/sec²  (downward)
export const MAX_ENGINE_ACCEL = 60;   // pixels/sec²  (max upward thrust)
export const MAX_JERK = 50;          // pixels/sec³  (max upward jerk)
export const MIN_JERK = -50; 		// pixels/sec³  (min upward jerk / max downward jerk)
// Snap is the rate of change of jerk (4th derivative of position).
// Holding space applies MAX_SNAP; releasing applies MIN_SNAP (negative).
// Derived from the jerk range so wind-up/down times stay correct if jerk limits are tuned:
// MIN_JERK → MAX_JERK in 0.5 s
export const MAX_SNAP = (MAX_JERK - MIN_JERK) / 0.5;  // pixels/sec⁴
// MAX_JERK → MIN_JERK in 2 s
export const MIN_SNAP = -(MAX_JERK - MIN_JERK) / 2;   // pixels/sec⁴

// The UFO collision radius is slightly smaller than its visual art to give the
// player a touch of forgiveness on near misses.
export const UFO_RADIUS = 15;
export const UFO_COLLISION_RADIUS = 12;
// Keeping the UFO in the left quarter lets the player see far ahead while
// still having room to react.
export const UFO_X_FRACTION = 0.09;   // UFO fixed x as fraction of canvas width

// Rebound zone: a band at the top and bottom of the screen that nudges the
// UFO's position toward centre. Does not touch the physics chain (jerk/accel).
export const REBOUND_ZONE_FRACTION = 0.1;  // zone depth as fraction of canvas height
export const REBOUND_SPEED = 50;           // pixels/sec push at the very edge (falls to 0 at zone boundary)

// Safe zone: a moving band guaranteed to be free of asteroids, giving the
// player a navigable corridor through the field at all times.
export const SAFE_ZONE_FRACTION = 0.25;   // zone height as fraction of canvas height
export const SAFE_ZONE_SPEED = 30;       // pixels/sec the zone centre travels

// Asteroids
export const ASTEROID_SPEED_BASE = 100;   // pixels/sec
// Per-asteroid speed jitter prevents the field from feeling like a conveyor belt.
export const ASTEROID_SPEED_RANGE = 80;   // randomness +/-
export const ASTEROID_RADIUS_MIN = 10;
export const ASTEROID_RADIUS_MAX = 20;

// Spawning
export const SPAWN_INTERVAL_BASE = 1800;  // ms between spawns
// Interval jitter breaks up rhythmic patterns the player could memorize.
export const SPAWN_INTERVAL_RANGE = 600;  // randomness +/- ms
// Floor prevents the game from becoming literally impossible at high difficulty.
export const MIN_SPAWN_INTERVAL = 600;    // ms floor

// Difficulty ramp
// Steps are time-based rather than score-based so difficulty is predictable
// to the designer and independent of any lucky dodges or unlucky clusters.
export const DIFFICULTY_RAMP_INTERVAL = 10000; // ms between difficulty steps
export const SPEED_INCREASE_PER_STEP = 20;     // pixels/sec added per step
export const INTERVAL_DECREASE_PER_STEP = 80;  // ms removed per step
