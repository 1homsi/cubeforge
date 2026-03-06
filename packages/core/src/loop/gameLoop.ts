export class GameLoop {
  private rafId = 0
  private lastTime = 0
  private running = false
  private paused = false
  private hitPauseTimer = 0

  constructor(private readonly onTick: (dt: number) => void) {}

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
    const dt = Math.min((time - this.lastTime) / 1000, 0.1)
    this.lastTime = time
    if (this.hitPauseTimer > 0) {
      this.hitPauseTimer -= dt
    } else {
      this.onTick(dt)
    }
    this.rafId = requestAnimationFrame(this.frame)
  }
}
