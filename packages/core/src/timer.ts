/**
 * A lightweight game-loop timer for use inside Script update functions.
 *
 * @example
 * // Create once outside the update function (e.g. in playerInit):
 * const invincibleTimer = createTimer(2.0, () => { state.isInvincible = false })
 *
 * // Call update(dt) inside the Script update function each frame:
 * function playerUpdate(id, world, input, dt) {
 *   invincibleTimer.update(dt)
 *   if (someHitCondition) {
 *     state.isInvincible = true
 *     invincibleTimer.restart()
 *   }
 * }
 */
export interface GameTimer {
  /** Advance the timer by dt seconds. Calls onComplete when it reaches zero. */
  update(dt: number): void
  /** Start (or resume) counting down. */
  start(): void
  /** Pause counting without resetting. */
  stop(): void
  /** Reset elapsed time to 0 and stop. Optionally change the duration. */
  reset(newDuration?: number): void
  /** Reset elapsed time to 0 and immediately start. */
  restart(): void
  /** Whether the timer is currently counting. */
  readonly running: boolean
  /** Elapsed seconds since last reset/restart. */
  readonly elapsed: number
  /** Remaining seconds (clamped to 0). */
  readonly remaining: number
  /** Progress from 0 (just started) to 1 (complete). */
  readonly progress: number
}

export function createTimer(duration: number, onComplete?: () => void, autoStart = false): GameTimer {
  let _duration = duration
  let _elapsed  = 0
  let _running  = autoStart

  return {
    update(dt: number) {
      if (!_running) return
      _elapsed += dt
      if (_elapsed >= _duration) {
        _elapsed = _duration
        _running = false
        onComplete?.()
      }
    },
    start()   { _running = true },
    stop()    { _running = false },
    reset(d?: number) { _elapsed = 0; _running = false; if (d !== undefined) _duration = d },
    restart() { _elapsed = 0; _running = true },
    get running()   { return _running },
    get elapsed()   { return _elapsed },
    get remaining() { return Math.max(0, _duration - _elapsed) },
    get progress()  { return _duration > 0 ? Math.min(1, _elapsed / _duration) : 1 },
  }
}
