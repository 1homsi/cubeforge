export class GameLoop {
  private rafId = 0
  private lastTime = 0
  private running = false

  constructor(private readonly onTick: (dt: number) => void) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.frame)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  get isRunning(): boolean {
    return this.running
  }

  private frame = (time: number): void => {
    if (!this.running) return
    // Cap delta at 100ms to prevent spiral of death after tab switch
    const dt = Math.min((time - this.lastTime) / 1000, 0.1)
    this.lastTime = time
    this.onTick(dt)
    this.rafId = requestAnimationFrame(this.frame)
  }
}
