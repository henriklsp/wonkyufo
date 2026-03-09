import { UFO, D_POS } from './ufo';
import { Asteroid } from './asteroid';
import { Spawner } from './spawner';
import { SafeZone } from './safezone';
import { Renderer, Star } from './renderer';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, UFO_COLLISION_RADIUS,
  STAR_COUNT, STAR_RADIUS_MIN, STAR_RADIUS_RANGE, STAR_SPEED_MIN, STAR_SPEED_RANGE,
  SCORE_PER_SECOND, MAX_FRAME_DT,
} from './constants';

type GameState = 'title' | 'playing' | 'dead';

// Game is the top-level orchestrator. It owns the animation loop, input state,
// all game objects, and the state machine that transitions between title,
// playing, and dead screens. Keeping all of this in one class avoids the need
// for a shared event bus or global state while the game is small enough that
// a single coordinator is readable.
export class Game {
  private state: GameState = 'title';
  private ufo: UFO;
  private asteroids: Asteroid[] = [];
  private spawner: Spawner;
  private safeZone: SafeZone;
  private renderer: Renderer;
  private spaceHeld = false;
  private lastTime: number | null = null;
  private score = 0;
  private scoreTimer = 0;
  private launchGrace = 0;  // seconds remaining in the post-launch input blackout
  private stars: Star[] = [];

  // Sets up all long-lived objects and attaches input listeners. Stars are
  // generated once here rather than each frame because their count and initial
  // positions are fixed — only their x position scrolls.
  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')!;
    this.renderer = new Renderer(ctx);
    this.ufo = new UFO();
    this.spawner = new Spawner();
    this.safeZone = new SafeZone();

    // Varying radius and speed creates a parallax-like depth effect: small,
    // slow stars read as distant; larger, faster ones as close.
    for (let i = 0; i < STAR_COUNT; i++) {
      this.stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        r: Math.random() * STAR_RADIUS_RANGE + STAR_RADIUS_MIN,
        speed: Math.random() * STAR_SPEED_RANGE + STAR_SPEED_MIN,
      });
    }

    // keydown fires repeatedly when held, so the !spaceHeld guard prevents
    // startGame being called on every repeated keydown event after the first.
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!this.spaceHeld) {
          this.spaceHeld = true;
          if (this.state === 'title') this.startGame();
          else if (this.state === 'dead') this.startGame();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.spaceHeld = false;
    });
  }

  // Loads sprite assets, then kicks off the rAF loop. Awaiting assets here
  // ensures drawUfo and drawAsteroid always have images available from frame one.
  async start(): Promise<void> {
    await this.renderer.loadAssets();
    requestAnimationFrame((t) => this.loop(t));
  }

  // Transitions to playing state and wipes all per-run data. Called both on
  // first launch from the title screen and on restart from the dead screen,
  // so both paths share the same clean-slate guarantee.
  private startGame() {
    this.state = 'playing';
    this.ufo.reset();
    this.asteroids = [];
    this.spawner.reset();
    this.safeZone.reset();
    this.score = 0;
    this.scoreTimer = 0;
    this.launchGrace = 0.2;
  }

  // Core animation loop. lastTime starts null so the first frame produces dt=0,
  // avoiding a spike from the gap between construction and the first rAF call.
  // dt is capped at 100ms so a long pause (tab switch, debugger) doesn't
  // catapult the UFO or spawn a wall of asteroids on resume.
  private loop(timestamp: number) {
    if (this.lastTime === null) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, MAX_FRAME_DT);
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  // Advances all simulation state for the frame. Stars scroll on every state
  // so the background stays alive on the title and dead screens. Everything
  // else is gated on the playing state — checking early prevents subtle bugs
  // where a collision check runs against stale asteroid positions.
  private update(dt: number) {
    this.renderer.tick(dt);
    for (const star of this.stars) {
      star.x -= star.speed * dt;
      // Wrap rather than respawn so star density stays constant.
      if (star.x < 0) star.x += CANVAS_WIDTH;
    }

    if (this.state !== 'playing') return;

    this.launchGrace = Math.max(0, this.launchGrace - dt);
    this.ufo.update(dt, this.launchGrace > 0 ? false : this.spaceHeld);
    this.safeZone.update(dt);

    const newAsteroids = this.spawner.update(dt, this.safeZone);
    this.asteroids.push(...newAsteroids);

    for (const a of this.asteroids) a.update(dt);
    // Filter in one pass rather than splicing during iteration.
    this.asteroids = this.asteroids.filter((a) => !a.isDead());

    // Score is time-survival based: 10 points per second, floored so it
    // reads as whole numbers rather than decimals.
    this.scoreTimer += dt;
    this.score = Math.floor(this.scoreTimer * SCORE_PER_SECOND);

    // Boundary check before collision so escaping the arena ends the game
    // even if no asteroid was involved.
    if (this.ufo.isOutOfBounds()) {
      this.state = 'dead';
      return;
    }

    // Circle–circle collision: cheaper than polygon intersection and slightly
    // more forgiving, which suits the fast-paced feel of the game.
    for (const a of this.asteroids) {
      const dx = this.ufo.x - a.x;
      const dy = this.ufo.d[D_POS] - a.y;
      if (Math.sqrt(dx * dx + dy * dy) < UFO_COLLISION_RADIUS + a.radius) {
        this.state = 'dead';
        return;
      }
    }
  }

  // Paints the frame in back-to-front order: background, stars, then
  // state-specific content. All drawing is delegated to the renderer.
  private draw() {
    this.renderer.drawBackground();
    this.renderer.drawStars(this.stars);

    if (this.state === 'title') {
      this.renderer.drawTitle();
    } else if (this.state === 'playing') {
      this.renderer.drawExhaust(this.ufo);
      for (const a of this.asteroids) this.renderer.drawAsteroid(a);
      this.renderer.drawUfo(this.ufo);
      this.renderer.drawHud(this.score);
    } else {
      // The dead screen keeps the final game frame visible beneath the overlay
      // so the player can see exactly what killed them.
      this.renderer.drawExhaust(this.ufo);
      for (const a of this.asteroids) this.renderer.drawAsteroid(a);
      this.renderer.drawUfo(this.ufo);
      this.renderer.drawDead(this.score);
    }
  }
}
