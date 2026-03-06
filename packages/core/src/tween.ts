type EaseFn = (t: number) => number

export const Ease = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOutBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
}

export interface TweenHandle {
  stop(): void
  readonly isComplete: boolean
}

/**
 * Create a tween that calls `onUpdate` with interpolated values from `from` to `to`
 * over `duration` seconds. Call the returned handle's `update(dt)` each frame.
 *
 * @example
 * const t = tween(0, 100, 1.0, Ease.easeOutQuad, v => entity.x = v)
 * // In your update loop:
 * t.update(dt)
 */
export function tween(
  from: number,
  to: number,
  duration: number,
  ease: EaseFn = Ease.linear,
  onUpdate: (value: number) => void,
  onComplete?: () => void,
): TweenHandle & { update(dt: number): void } {
  let elapsed = 0
  let stopped = false
  let complete = false

  return {
    get isComplete() { return complete },
    stop() { stopped = true },
    update(dt: number) {
      if (stopped || complete) return
      elapsed = Math.min(elapsed + dt, duration)
      const t = duration > 0 ? elapsed / duration : 1
      onUpdate(from + (to - from) * ease(t))
      if (elapsed >= duration) {
        complete = true
        onComplete?.()
      }
    },
  }
}
