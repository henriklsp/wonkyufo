import {
  ASTEROID_ROTATION_MAX,
} from './constants';

// Asteroid is a single obstacle that travels from right to left across the
// screen. Its shape, rotation speed, and entry point are all randomised at
// construction time so no two feel identical, which is important for replayability
// in a game with no level design. Collision is handled by the game loop using
// the radius as a bounding circle — the irregular visual shape intentionally
// extends slightly beyond the hitbox to reward near-miss skill.
export class Asteroid {
  x: number;
  y: number;
  radius: number;
  speedX: number;

  readonly imageIndex: number; // 0 or 1 — selects which asteroid sprite to draw
  // Public so the renderer can apply the same angle when drawing the sprite.
  rotation: number;
  private rotationSpeed: number;

  constructor(x: number, y: number, radius: number, speedX: number) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.speedX = speedX;
    this.imageIndex = Math.random() < 0.5 ? 0 : 1;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * ASTEROID_ROTATION_MAX;
  }

  // Moves the asteroid left and spins it. Spin is purely cosmetic but makes
  // the field feel alive — static rocks would read as flat UI elements.
  update(dt: number) {
    this.x += this.speedX * dt;
    this.rotation += this.rotationSpeed * dt;
  }

  // The game loop calls this to cull off-screen asteroids. Using the right
  // edge of the bounding circle (x + radius) ensures the asteroid is fully
  // invisible before being discarded, avoiding a pop-out artefact.
  isDead(): boolean {
    return this.x + this.radius < 0;
  }

}
