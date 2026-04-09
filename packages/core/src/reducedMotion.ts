/**
 * Reduced-motion support for tweens, timelines, and scene transitions.
 *
 * Respects the user's `prefers-reduced-motion: reduce` system setting. When the
 * user has that preference on, tweens jump to their end value on the first
 * frame, timelines snap every segment to completion, and scene transitions
 * render instantly.
 *
 * You can override the automatic detection for testing or for games that want
 * to always (or never) honor reduced motion regardless of the system setting.
 *
 * Individual tweens/timelines/transitions can opt out via their own
 * `ignoreReducedMotion` option.
 */

let override: boolean | null = null

/**
 * Returns true if motion should be reduced — either the user's system
 * preference is `prefers-reduced-motion: reduce`, or a manual override has
 * been set via {@link setReducedMotionOverride}.
 */
export function isReducedMotionPreferred(): boolean {
  if (override !== null) return override
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Override the reduced-motion preference. Passing `null` returns to automatic
 * detection via the media query. Passing `true` or `false` forces the value
 * regardless of the system setting.
 *
 * @example
 * ```ts
 * // During tests, disable reduced motion so animations play fully.
 * setReducedMotionOverride(false)
 * ```
 */
export function setReducedMotionOverride(value: boolean | null): void {
  override = value
}
