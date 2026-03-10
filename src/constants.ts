// Canvas dimensions define the logical coordinate space. All physics values are
// expressed in these units (pixels), so changing these would require rescaling
// constants too. The 2:1 ratio gives a wide field of view for incoming asteroids.
export const CANVAS_WIDTH = 1600;
export const CANVAS_HEIGHT = 800;

// Stars: fixed count and random ranges for the scrolling parallax background.
export const STAR_COUNT = 90;
export const STAR_RADIUS_MIN = 0.2;   // minimum star dot radius in pixels
export const STAR_RADIUS_RANGE = 1.4; // random additional radius on top of min
export const STAR_SPEED_MIN = 8;      // pixels/sec (slowest, most distant stars)
export const STAR_SPEED_RANGE = 25;   // random speed added on top of min
export const STAR_ALPHA_BASE = 0.4;   // base alpha for the dimmest stars
export const STAR_ALPHA_SCALE = 0.4;  // additional alpha scaled by radius (so bigger=brighter)

// Game loop
export const SCORE_PER_SECOND = 10;  // points awarded per second of survival
export const MAX_FRAME_DT = 0.1;     // seconds — cap on dt to prevent physics spikes after pauses

// UFO physics
//
// The six-level derivative chain (all upward-positive):
//   position ← velocity ← acceleration ← jerk ← snap ← crackle ← pop
export const GRAVITY = 30;             // pixels/sec²  (downward)
export const MAX_ENGINE_ACCEL = 80;    // pixels/sec²  (max upward thrust)
export const MIN_ENGINE_ACCEL = 0;     // pixels/sec²  (min upward thrust — 0 means thrusters only push up or turn off)
export const MAX_JERK = 100;            // pixels/sec³
export const MIN_JERK = -100;           // pixels/sec³
export const MAX_SNAP = 80;           // pixels/sec⁴
export const MIN_SNAP = -100;           // pixels/sec⁴
export const MAX_CRACKLE = 70;        // pixels/sec⁵
export const MIN_CRACKLE = -100;       // pixels/sec⁵
export const MAX_POP = 10000;           // pixels/sec⁶
export const MIN_POP = -200;         // pixels/sec⁶
// Rate at which a derivative smoothly returns toward its limit when outside bounds.
export const D_CLAMP_SPEED = 1000;     // units/sec (shared across all derivative orders)

// Exhaust flicker/pulse rates driven by jerk (Hz).
// Frequency linearly interpolates from JERK_PULSE_MIN_HZ at MIN_JERK to JERK_PULSE_MAX_HZ at MAX_JERK.
export const JERK_PULSE_MIN_HZ = 2;   // Hz — exhaust rate at MIN_JERK
export const JERK_PULSE_MAX_HZ = 15;  // Hz — exhaust rate at MAX_JERK
// Exhaust: min height in pixels (at zero accel).
export const ACCEL_EXHAUST_MIN = 5;    // px — exhaust height at zero acceleration
// How far above the UFO bottom edge the top of the exhaust image is anchored.
// Increase to move the exhaust higher (more hidden behind the hull at low thrust).
export const EXHAUST_Y_OFFSET = 17;    // px
// ENGINE_GLOW_Y: absolute Y offset of the glow image top-left from the UFO image
// top-left, where negative = lower on screen. Formula: glowTop = (y − r) − ENGINE_GLOW_Y.
// At −45 with UFO_RADIUS=25: glowTop = y+20, glow bottom = y+70, UFO bottom = y+25 → 5 px overlap.
export const ENGINE_GLOW_Y = -35;
// When crackle is positive the engine glow flashes at CRACKLE_FREQUENCY Hz.
// Each cycle: 10% at alpha=1, 10% at alpha=0, 80% at snap-driven alpha.
export const CRACKLE_FREQUENCY = 10;  // Hz

// Rim lights on the UFO hull encode the pop/crackle state via HSV colour.
export const RIM_LIGHT_Y_FRACTION = 0.22;      // light centre Y offset as fraction of UFO radius (below centre)
export const RIM_LIGHT_RADIUS_FRACTION = 0.05; // light dot radius as fraction of UFO radius
export const RIM_LIGHT_X_SPREAD = 0.85;        // X spread of outer lights as fraction of UFO radius
export const RIM_LIGHT_X_OFFSETS = [-0.65, 0, 0.65] as const; // relative X positions of the three lights
export const RIM_LIGHT_VALUE_MIN = 0.5;        // HSV value at minimum crackle (scales up to 1.0 at max crackle)

// The UFO collision radius is slightly smaller than its visual art to give the
// player a touch of forgiveness on near misses.
export const UFO_RADIUS = 30;
export const UFO_COLLISION_RADIUS = 22;
// Keeping the UFO in the left quarter lets the player see far ahead while
// still having room to react.
export const UFO_X_FRACTION = 0.05;   // UFO fixed x as fraction of canvas width

// Rebound zone: a band at the top and bottom of the screen that nudges the
// UFO's position toward centre. Does not touch the physics chain (jerk/accel).
export const REBOUND_ZONE_FRACTION = 0.1;  // zone depth as fraction of canvas height
export const REBOUND_SPEED = 80;           // pixels/sec push at the very edge (falls to 0 at zone boundary)

// Safe zone: a moving band guaranteed to be free of asteroids, giving the
// player a navigable corridor through the field at all times.
export const SAFE_ZONE_FRACTION = 0.3;      // zone height as fraction of canvas height
export const SAFE_ZONE_SPEED = 20;           // pixels/sec the zone centre travels
export const SAFE_ZONE_FLIP_CHANCE = 0.1;   // probability of random direction flip per check interval
export const SAFE_ZONE_FLIP_INTERVAL = 1;   // seconds between random flip checks

// Asteroids
export const ASTEROID_SPEED_BASE = 100;     // pixels/sec
// Per-asteroid speed jitter prevents the field from feeling like a conveyor belt.
export const ASTEROID_SPEED_RANGE = 80;     // randomness +/-
export const ASTEROID_RADIUS_MIN = 20;
export const ASTEROID_RADIUS_MAX = 70;
export const ASTEROID_ROTATION_MAX = 2.5;   // max rotation speed half-range (rad/sec); actual = random(-max, max)

// Spawning
export const REBOUND_ZONE_SPAWN_CHANCE = 0.15; // probability that an asteroid spawns in each rebound zone
export const SPAWN_INTERVAL_BASE = 3000;  // ms between spawns
// Interval jitter breaks up rhythmic patterns the player could memorize.
export const SPAWN_INTERVAL_RANGE = 600;  // randomness +/- ms
// Floor prevents the game from becoming literally impossible at high difficulty.
export const MIN_SPAWN_INTERVAL = 400;    // ms floor

// Difficulty ramp
// Steps are time-based rather than score-based so difficulty is predictable
// to the designer and independent of any lucky dodges or unlucky clusters.
export const DIFFICULTY_RAMP_INTERVAL = 10000; // ms between difficulty steps
export const SPEED_INCREASE_PER_STEP = 20;     // pixels/sec added per step
export const INTERVAL_DECREASE_PER_STEP = 80;  // ms removed per step
