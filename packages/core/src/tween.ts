type EaseFn = (t: number) => number

export const Ease = {
  linear: (t: number) => t,

  // Quad
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  // Cubic
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => { const t1 = t - 1; return t1 * t1 * t1 + 1 },
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  // Quart
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => { const t1 = t - 1; return 1 - t1 * t1 * t1 * t1 },
  easeInOutQuart: (t: number) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (t - 1) * (t - 1) * (t - 1) * (t - 1),

  // Quint
  easeInQuint: (t: number) => t * t * t * t * t,
  easeOutQuint: (t: number) => { const t1 = t - 1; return 1 + t1 * t1 * t1 * t1 * t1 },
  easeInOutQuint: (t: number) => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (t - 1) * (t - 1) * (t - 1) * (t - 1) * (t - 1),

  // Sine
  easeInSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t: number) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,

  // Expo
  easeInExpo: (t: number) => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  easeOutExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: (t: number) => {
    if (t === 0) return 0
    if (t === 1) return 1
    return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2
  },

  // Circ
  easeInCirc: (t: number) => 1 - Math.sqrt(1 - t * t),
  easeOutCirc: (t: number) => Math.sqrt(1 - (t - 1) * (t - 1)),
  easeInOutCirc: (t: number) =>
    t < 0.5
      ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
      : (Math.sqrt(1 - (-2 * t + 2) * (-2 * t + 2)) + 1) / 2,

  // Back
  easeInBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return c3 * t * t * t - c1 * t * t
  },
  easeOutBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  easeInOutBack: (t: number) => {
    const c1 = 1.70158
    const c2 = c1 * 1.525
    return t < 0.5
      ? ((2 * t) * (2 * t) * ((c2 + 1) * 2 * t - c2)) / 2
      : ((2 * t - 2) * (2 * t - 2) * ((c2 + 1) * (2 * t - 2) + c2) + 2) / 2
  },

  // Elastic
  easeInElastic: (t: number) => {
    if (t === 0 || t === 1) return t
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3))
  },
  easeOutElastic: (t: number) => {
    if (t === 0 || t === 1) return t
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
  },
  easeInOutElastic: (t: number) => {
    if (t === 0 || t === 1) return t
    const c5 = (2 * Math.PI) / 4.5
    return t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1
  },

  // Bounce
  easeOutBounce: (t: number) => {
    const n1 = 7.5625
    const d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) { const t2 = t - 1.5 / d1; return n1 * t2 * t2 + 0.75 }
    if (t < 2.5 / d1) { const t2 = t - 2.25 / d1; return n1 * t2 * t2 + 0.9375 }
    const t2 = t - 2.625 / d1
    return n1 * t2 * t2 + 0.984375
  },
  easeInBounce: (t: number) => 1 - Ease.easeOutBounce(1 - t),
  easeInOutBounce: (t: number) =>
    t < 0.5
      ? (1 - Ease.easeOutBounce(1 - 2 * t)) / 2
      : (1 + Ease.easeOutBounce(2 * t - 1)) / 2,
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
