import {
  MAX_ENGINE_ACCEL,
  VOL_JET_EXHAUST, VOL_JET_ENGINE, VOL_SPACESHIP, VOL_UFO_NOISE, VOL_GAME_OVER, VOL_TITLE_MUSIC, VOL_MUSIC,
  VOL_RAMP_RATE,
} from './constants';

type Track = {
  el: HTMLAudioElement | null;
  current: number;   // actual volume being applied right now (0..1)
  playing: boolean;
  resetOnStart?: boolean;  // if true, rewind to 0 each time playback begins
};

// AudioManager owns all game audio. Each sound is an HTMLAudioElement so
// the browser handles decoding and we just control playback and volume.
// Volumes ramp toward their targets at VOL_RAMP_RATE per second so abrupt
// physics transitions fade smoothly rather than cutting in/out instantly.
export class AudioManager {
  private jetExhaust: Track = { el: null, current: 0, playing: false };
  private jetEngine:  Track = { el: null, current: 0, playing: false };
  private spaceship:  Track = { el: null, current: 0, playing: false };
  private ufoNoise:   Track = { el: null, current: 0, playing: false, resetOnStart: true };
  private titleMusicEl: HTMLAudioElement | null = null;
  private titleMusicStarted = false;
  private titleMusicFadingOut = false;
  private metalHit: HTMLAudioElement | null = null;
  private gameOver: Track = { el: null, current: 0, playing: false };
  private gameOverTarget = 0;
  private music: Track = { el: null, current: 0, playing: false };
  private musicTarget = 0;
  private ufoNoiseActive = false;
  private muted = false;

  private get tracks(): Track[] {
    return [this.jetExhaust, this.jetEngine, this.spaceship, this.ufoNoise];
  }

  async loadAssets(): Promise<void> {
    const base = import.meta.env.BASE_URL;
    const make = (file: string) => {
      const el = new Audio(`${base}assets/${file}`);
      el.loop = true;
      el.volume = 0;
      el.preload = 'auto';
      return el;
    };
    this.jetExhaust.el = make('jetexhaust.mp3');
    this.jetEngine.el  = make('jetengine.mp3');
    this.spaceship.el  = make('spaceship.mp3');
    this.ufoNoise.el   = make('ufo_noise.mp3');
    this.music.el      = make('SpunkyUFO.mp3');
    const tm = new Audio(`${base}assets/WonkyUFO.mp3`);
    tm.loop = false;
    tm.volume = 0;
    tm.preload = 'auto';
    this.titleMusicEl = tm;
    const hit = new Audio(`${base}assets/metal-hit.mp3`);
    hit.preload = 'auto';
    this.metalHit = hit;
    const go = new Audio(`${base}assets/game-over.mp3`);
    go.preload = 'auto';
    this.gameOver.el = go;
  }

  // Must be called from a user gesture handler (e.g. keydown) to satisfy the
  // browser autoplay policy. Starts all elements playing silently so subsequent
  // play() calls from the game loop are allowed.
  unlock(): void {
    for (const track of this.tracks) {
      if (track.el) { track.el.volume = 0; track.el.play().catch(() => {}); }
    }
    if (this.metalHit) { this.metalHit.volume = 0; this.metalHit.play().catch(() => {}); this.metalHit.pause(); }
    if (this.gameOver.el) { this.gameOver.el.volume = 0; this.gameOver.el.play().catch(() => {}); this.gameOver.el.pause(); }
    if (this.music.el && !this.music.playing) { this.music.el.volume = 0; this.music.el.play().catch(() => {}); this.music.el.pause(); }
  }

  // Called every frame with current physics derivative values.
  update(dt: number, accel: number, jerk: number, snap: number, crackle: number): void {
    this.drive(dt, this.jetExhaust, accel / MAX_ENGINE_ACCEL * VOL_JET_EXHAUST);
    this.drive(dt, this.jetEngine,  jerk    > 0 ? VOL_JET_ENGINE  : 0);
    this.drive(dt, this.spaceship,  snap    > 0 ? VOL_SPACESHIP   : 0);

    if (jerk < 0 && snap < 0 && crackle < 0) this.ufoNoiseActive = true;
    if (crackle > 0) this.ufoNoiseActive = false;
    this.drive(dt, this.ufoNoise, this.ufoNoiseActive ? VOL_UFO_NOISE : 0);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    for (const track of this.tracks) {
      if (track.el) track.el.muted = this.muted;
    }
    if (this.metalHit) this.metalHit.muted = this.muted;
    if (this.gameOver.el) this.gameOver.el.muted = this.muted;
    if (this.titleMusicEl) this.titleMusicEl.muted = this.muted;
    if (this.music.el) this.music.el.muted = this.muted;
    return this.muted;
  }

  playGameOver(): void {
    const track = this.gameOver;
    if (!track.el) return;
    track.el.currentTime = 0;
    track.current = 0;
    this.gameOverTarget = VOL_GAME_OVER;
  }

  fadeOutGameOver(): void {
    this.gameOverTarget = 0;
  }

  // Drives the game-over track ramp. Called every frame regardless of game
  // state so the fade-out continues after a restart.
  tickGameOver(dt: number): void {
    this.drive(dt, this.gameOver, this.gameOverTarget);
  }

  // Rewinds and immediately plays the soundtrack at VOL_MUSIC.
  playMusic(): void {
    const track = this.music;
    if (!track.el) return;
    track.el.currentTime = 0;
    track.current = VOL_MUSIC;
    track.el.volume = VOL_MUSIC;
    this.musicTarget = VOL_MUSIC;
    if (!track.playing) {
      track.el.play().catch(() => {});
      track.playing = true;
    }
  }

  fadeOutMusic(): void {
    this.musicTarget = 0;
  }

  // Drives the music track ramp. Called every frame so fade-out completes
  // even after the game transitions away from the playing state.
  tickMusic(dt: number): void {
    this.drive(dt, this.music, this.musicTarget);
  }

  // Safe to call from any trigger (key, mouseover, unmute). play() is called
  // directly each time until it succeeds — calling play() on an already-playing
  // element is a no-op. titleMusicStarted is only set on the first success so
  // non-gesture attempts (e.g. mouseenter) fail silently and leave the door
  // open for the next real user gesture.
  playTitleMusic(): void {
    if (this.titleMusicStarted) return;
    const el = this.titleMusicEl;
    if (!el) return;
    el.currentTime = 0;
    el.volume = VOL_TITLE_MUSIC;
    el.play().then(() => {
      this.titleMusicStarted = true;
      this.titleMusicFadingOut = false;
    }).catch(() => {});
  }

  fadeOutTitleMusic(): void {
    this.titleMusicFadingOut = true;
  }

  tickTitleMusic(dt: number): void {
    const el = this.titleMusicEl;
    if (!el || !this.titleMusicStarted || !this.titleMusicFadingOut) return;
    el.volume = Math.max(0, el.volume - VOL_RAMP_RATE * dt);
    if (el.volume <= 0) el.pause();
  }

  suspend(): void {
    for (const track of [...this.tracks, this.music, this.gameOver]) {
      if (track.el && track.playing) track.el.pause();
    }
    if (this.titleMusicEl && !this.titleMusicEl.paused) this.titleMusicEl.pause();
  }

  resume(): void {
    for (const track of [...this.tracks, this.music, this.gameOver]) {
      if (track.el && track.playing) track.el.play().catch(() => {});
    }
    if (this.titleMusicEl && this.titleMusicStarted && !this.titleMusicFadingOut && this.titleMusicEl.volume > 0) {
      this.titleMusicEl.play().catch(() => {});
    }
  }

  playMetalHit(): void {
    const el = this.metalHit;
    if (!el) return;
    el.volume = 1;
    el.currentTime = 0;
    el.play().catch(() => {});
  }

  stopAll(): void {
    this.ufoNoiseActive = false;
    for (const track of this.tracks) {
      track.current = 0;
      if (track.el && track.playing) {
        track.el.volume = 0;
        track.el.pause();
        track.el.currentTime = 0;
        track.playing = false;
      }
    }
  }

  // Ramps track.current toward target at VOL_RAMP_RATE/s, then applies it.
  // Starts playback as soon as target > 0; pauses only once current reaches 0.
  private drive(dt: number, track: Track, target: number): void {
    const { el } = track;
    if (!el) return;

    const maxDelta = VOL_RAMP_RATE * dt;
    const diff = target - track.current;
    track.current += Math.sign(diff) * Math.min(Math.abs(diff), maxDelta);

    if (target > 0 && !track.playing) {
      if (track.resetOnStart) el.currentTime = 0;
      el.play().catch(() => {});
      track.playing = true;
    }

    if (track.current <= 0) {
      track.current = 0;
      if (track.playing) {
        el.pause();
        el.currentTime = 0;
        track.playing = false;
      }
    } else {
      el.volume = track.current;
    }
  }
}
