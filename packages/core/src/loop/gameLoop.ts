export interface GameLoopOptions {
  /** When set, every tick receives this fixed dt instead of the real elapsed time. */
  fixedDt?: number
  /** Called every frame even during hit-pause, so the last frame stays rendered. */
  onRender?: (dt: number) => void
}

export class GameLoop {
  private rafId = 0
  private lastTime = 0
  private running = false
  private paused = false
  private hitPauseTimer = 0
  private readonly fixedDt: number | undefined
  private readonly onRender: ((dt: number) => void) | undefined

  constructor(
    private readonly onTick: (dt: number) => void,
    options?: GameLoopOptions,
  ) {
    this.fixedDt = options?.fixedDt
    this.onRender = options?.onRender
  }

  /** Freeze gameplay for `duration` seconds. Physics/scripts stop but rendering continues. */
  hitPause(duration: number): void {
    this.hitPauseTimer = duration
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.paused = false
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.frame)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  pause(): void {
    if (!this.running) return
    this.running = false
    this.paused = true
    cancelAnimationFrame(this.rafId)
  }

  resume(): void {
    if (!this.paused) return
    this.paused = false
    this.running = true
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.frame)
  }

  get isRunning(): boolean {
    return this.running
  }

  get isPaused(): boolean {
    return this.paused
  }

  private frame = (time: number): void => {
    if (!this.running) return
    // Cap delta at 100ms to prevent spiral of death after tab switch
    const rawDt = Math.min((time - this.lastTime) / 1000, 0.1)
    this.lastTime = time
    const dt = this.fixedDt ?? rawDt
    if (this.hitPauseTimer > 0) {
      // Use real wall-clock time so freeze duration is accurate in fixed-dt mode
      this.hitPauseTimer -= rawDt
      // Still render the frozen frame so the screen isn't blank
      this.onRender?.(0)
    } else {
      this.onTick(dt)
    }
    this.rafId = requestAnimationFrame(this.frame)
  }
}
