export type GameLoopMode = 'realtime' | 'onDemand'

export interface GameLoopOptions {
  /** When set, every tick receives this fixed dt instead of the real elapsed time. */
  fixedDt?: number
  /** Called every frame even during hit-pause, so the last frame stays rendered. */
  onRender?: (dt: number) => void
  /**
   * Loop mode (default 'realtime'):
   * - 'realtime' — runs continuously at the browser's refresh rate. Best for action games.
   * - 'onDemand' — sleeps until markDirty() is called, then runs exactly one frame.
   *   Best for puzzle games, turn-based games, level editors, and any scene where
   *   nothing changes unless the user (or a script) acts. Saves battery and CPU.
   */
  mode?: GameLoopMode
}

export class GameLoop {
  private rafId = 0
  private lastTime = 0
  private running = false
  private paused = false
  private hitPauseTimer = 0
  private readonly fixedDt: number | undefined
  private readonly onRender: ((dt: number) => void) | undefined
  private readonly mode: GameLoopMode
  private dirtyScheduled = false

  constructor(
    private readonly onTick: (dt: number) => void,
    options?: GameLoopOptions,
  ) {
    this.fixedDt = options?.fixedDt
    this.onRender = options?.onRender
    this.mode = options?.mode ?? 'realtime'
  }

  /** Freeze gameplay for `duration` seconds. Physics/scripts stop but rendering continues. */
  hitPause(duration: number): void {
    this.hitPauseTimer = duration
    // In onDemand mode the loop is otherwise asleep, so wake it for the freeze.
    if (this.mode === 'onDemand') this.markDirty()
  }

  /**
   * Request exactly one frame. No-op in realtime mode (which is always ticking) or
   * when the loop isn't running. Safe to call multiple times per frame — calls within
   * a single frame coalesce to one scheduled rAF. Calls made during onTick are honored
   * and will schedule the next frame.
   */
  markDirty(): void {
    if (this.mode !== 'onDemand') return
    if (!this.running) return
    if (this.dirtyScheduled) return
    this.dirtyScheduled = true
    this.rafId = requestAnimationFrame(this.frame)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.paused = false
    this.lastTime = performance.now()
    if (this.mode === 'realtime') {
      this.rafId = requestAnimationFrame(this.frame)
    } else {
      // onDemand: render one initial frame so the scene is visible, then sleep.
      this.dirtyScheduled = true
      this.rafId = requestAnimationFrame(this.frame)
    }
  }

  stop(): void {
    this.running = false
    this.dirtyScheduled = false
    cancelAnimationFrame(this.rafId)
  }

  pause(): void {
    if (!this.running) return
    this.running = false
    this.paused = true
    this.dirtyScheduled = false
    cancelAnimationFrame(this.rafId)
  }

  resume(): void {
    if (!this.paused) return
    this.paused = false
    this.running = true
    this.lastTime = performance.now()
    if (this.mode === 'realtime') {
      this.rafId = requestAnimationFrame(this.frame)
    } else {
      // onDemand: render one frame on resume so the user sees the current state.
      this.dirtyScheduled = true
      this.rafId = requestAnimationFrame(this.frame)
    }
  }

  get isRunning(): boolean {
    return this.running
  }

  get isPaused(): boolean {
    return this.paused
  }

  get isOnDemand(): boolean {
    return this.mode === 'onDemand'
  }

  private frame = (time: number): void => {
    if (!this.running) return
    // Reset the dirty flag first so markDirty() calls during onTick can schedule the
    // next frame. (onDemand only — realtime ignores this flag.)
    if (this.mode === 'onDemand') this.dirtyScheduled = false

    // Cap delta at 100ms to prevent spiral of death after tab switch or long sleeps.
    const rawDt = Math.min((time - this.lastTime) / 1000, 0.1)
    this.lastTime = time
    const dt = this.fixedDt ?? rawDt

    if (this.hitPauseTimer > 0) {
      // Use real wall-clock time so freeze duration is accurate in fixed-dt mode
      this.hitPauseTimer -= rawDt
      // Still render the frozen frame so the screen isn't blank
      this.onRender?.(0)
      if (this.mode === 'realtime') {
        this.rafId = requestAnimationFrame(this.frame)
      } else if (this.hitPauseTimer > 0) {
        // Keep the onDemand loop awake for the rest of the freeze
        this.dirtyScheduled = true
        this.rafId = requestAnimationFrame(this.frame)
      }
      return
    }

    this.onTick(dt)

    if (this.mode === 'realtime') {
      this.rafId = requestAnimationFrame(this.frame)
    }
    // onDemand: if markDirty() was called during onTick, dirtyScheduled is now true and
    // rafId has already been set. Otherwise we sleep until the next external markDirty().
  }
}
