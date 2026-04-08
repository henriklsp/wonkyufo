export const DEBUG_MODE = false;

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
export const MAX_SNAP = 40;           // pixels/sec⁴
export const MIN_SNAP = -100;           // pixels/sec⁴
export const MAX_CRACKLE = 20;        // pixels/sec⁵
export const MIN_CRACKLE = -50;       // pixels/sec⁵
export const MAX_POP = 1000;           // pixels/sec⁶
export const MIN_POP = -30;         // pixels/sec⁶
// Rate at which a derivative smoothly returns toward its limit when outside bounds.
export const D_CLAMP_SPEED = 200;     // units/sec (shared across all derivative orders)

// Exhaust flicker/pulse rates driven by jerk (Hz).
// Frequency linearly interpolates from JERK_PULSE_MIN_HZ at MIN_JERK to JERK_PULSE_MAX_HZ at MAX_JERK.
export const JERK_PULSE_MIN_HZ = 1;   // Hz — exhaust rate at MIN_JERK
export const JERK_PULSE_MAX_HZ = 15;  // Hz — exhaust rate at MAX_JERK
// Exhaust: min height in pixels (at zero accel).
export const ACCEL_EXHAUST_MIN = 5;    // px — exhaust height at zero acceleration
// How far above the UFO bottom edge the top of the exhaust image is anchored.
// Increase to move the exhaust higher (more hidden behind the hull at low thrust).
export const EXHAUST_Y_OFFSET = 17;    // px
// ENGINE_GLOW_Y: absolute Y offset of the glow image top-left from the UFO image
// top-left, where negative = lower on screen. Formula: glowTop = (y − r) − ENGINE_GLOW_Y.
export const ENGINE_GLOW_Y = -45;
// When crackle is positive the engine glow flashes at CRACKLE_FREQUENCY Hz.
// Each cycle: 10% at alpha=1, 10% at alpha=0, 80% at snap-driven alpha.
export const CRACKLE_FREQUENCY = 7;  // Hz

// Rim lights on the UFO hull encode the pop/crackle state via HSV colour.
export const RIM_LIGHT_Y_FRACTION = 0.35;      // light centre Y offset as fraction of UFO radius (below centre)
export const RIM_LIGHT_RADIUS_FRACTION = 0.05; // light dot radius as fraction of UFO radius
export const RIM_LIGHT_X_SPREAD = 0.85;        // X spread of outer lights as fraction of UFO radius
export const RIM_LIGHT_X_OFFSETS = [-0.65, 0, 0.65] as const; // relative X positions of the three lights
export const RIM_LIGHT_VALUE_MIN = 0.5;        // HSV value at minimum crackle (scales up to 1.0 at max crackle)

// The UFO collision radius is slightly smaller than its visual art to give the
// player a touch of forgiveness on near misses.
export const UFO_RADIUS = 40;
export const UFO_COLLISION_RADIUS = 26;
// Keeping the UFO in the left quarter lets the player see far ahead while
// still having room to react.
export const UFO_X_FRACTION = 0.05;   // UFO fixed x as fraction of canvas width

// Rebound zone: a band at the top and bottom of the screen that nudges the
// UFO's position toward centre. Does not touch the physics chain (jerk/accel).
export const REBOUND_ZONE_FRACTION = 0.1;  // zone depth as fraction of canvas height
export const REBOUND_SPEED = 95;           // pixels/sec push at the very edge (falls to 0 at zone boundary)

// Safe zone: a moving band guaranteed to be free of asteroids, giving the
// player a navigable corridor through the field at all times.
export const SAFE_ZONE_FRACTION = 0.3;      // zone height as fraction of canvas height
export const SAFE_ZONE_SPEED = 25;           // pixels/sec the zone centre travels
export const SAFE_ZONE_FLIP_MIN = 1;   // seconds — minimum time between random direction flips
export const SAFE_ZONE_FLIP_MAX = 20;  // seconds — maximum time between random direction flips

// Asteroids
// At t=0 speed is uniformly random in [ASTEROID_SPEED_BASE ± ASTEROID_SPEED_RANGE/2].
// The whole distribution is multiplied by a factor that ramps from 1.0 to
// ASTEROID_SPEED_MAX_FACTOR over ASTEROID_SPEED_CAP_TIME seconds, then holds.
export const ASTEROID_SPEED_BASE = 90;      // pixels/sec (midpoint of starting range)
// Per-asteroid speed jitter prevents the field from feeling like a conveyor belt.
export const ASTEROID_SPEED_RANGE = 60;     // randomness +/-, so starting range is [60, 120]
export const ASTEROID_SPEED_MAX_FACTOR = 2.0; // factor cap (doubles the range to [120, 240])
export const ASTEROID_SPEED_CAP_TIME = 100; // seconds until max factor is reached
export const ASTEROID_RADIUS_MIN = 25;
export const ASTEROID_RADIUS_MAX = 70;
export const ASTEROID_ROTATION_MAX = 2.5;   // max rotation speed half-range (rad/sec); actual = random(-max, max)

// Spawning
export const REBOUND_ZONE_SPAWN_CHANCE = 0.18; // probability that an asteroid spawns in each rebound zone
export const SPAWN_INTERVAL_BASE = 5000;  // ms between spawns
// Interval jitter breaks up rhythmic patterns the player could memorize.
export const SPAWN_INTERVAL_RANGE = 2000;  // randomness +/- ms
// Floor prevents the game from becoming literally impossible at high difficulty.
export const MIN_SPAWN_INTERVAL = 500;    // ms floor
export const ASTEROID_WAVE_INTERVAL = 50; // seconds between waves
export const ASTEROID_WAVE_COUNT = 7;     // extra asteroids per wave
// Difficulty ramp
// Speed uses a continuous time factor (see ASTEROID_SPEED_MAX_FACTOR / CAP_TIME above).
// Spawn rate decreases continuously at SPAWN_RAMP_RATE ms/sec, uncapped beyond 100 s,
// so the field keeps getting denser long after speed has plateaued.
export const SPAWN_RAMP_RATE = 11; // ms/sec reduction in spawn interval 


// Exhaust push: asteroids directly below the UFO are nudged downward by the exhaust.
// Force scales with engine acceleration and falls off with horizontal and vertical distance.
export const EXHAUST_PUSH_SPEED = 300;  // max pixels/sec displacement (centered, full accel)

// Audio volumes (0..1)
export const VOL_JET_EXHAUST = 0.2;  // accelerate
export const VOL_JET_ENGINE  = 0.3;  // jerk
export const VOL_SPACESHIP   = 0.25;  // snap
export const VOL_UFO_NOISE   = 0.2;  // ufo noise when jerk/snap/crackle all negative
export const VOL_GAME_OVER   = 0.8;  // game over sting
export const VOL_TITLE_MUSIC = 0.3;  // title screen track
export const VOL_MUSIC       = 0.3;  // background soundtrack
export const VOL_RAMP_RATE   = 0.6;  // max volume change per second 
