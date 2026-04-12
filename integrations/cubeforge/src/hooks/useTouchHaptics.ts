/**
 * Touch/mobile haptic feedback via the Web Vibration API.
 *
 * Falls back silently on desktop browsers and iOS (Safari does not support
 * the Vibration API as of 2025).
 *
 * @example
 * ```tsx
 * function Player() {
 *   const haptics = useTouchHaptics()
 *
 *   useCollisionEnter(() => haptics.impact())
 *   // Or with a pattern:
 *   haptics.pattern([50, 30, 50])  // vibrate-pause-vibrate
 * }
 * ```
 */
export function useTouchHaptics(): TouchHapticsControls {
  return touchHapticsControls
}

export interface TouchHapticsControls {
  /**
   * Short impact pulse — good for collisions, button taps.
   * @param duration Vibration duration in ms. Default 30.
   */
  impact(duration?: number): void

  /**
   * Medium notification pulse — good for pickups, level-up, checkpoint.
   * Produces two short pulses separated by a brief pause.
   */
  notification(): void

  /**
   * Heavy feedback burst — explosions, deaths, critical hits.
   * @param duration Vibration duration in ms. Default 80.
   */
  heavy(duration?: number): void

  /**
   * Custom vibration pattern: alternating vibrate/pause durations in ms.
   * @param pattern Array of durations: [vibrate, pause, vibrate, ...].
   *                A single number vibrates for that duration.
   */
  pattern(pattern: number | number[]): void

  /**
   * Stop any in-progress vibration immediately.
   */
  cancel(): void

  /**
   * Whether the current browser supports the Vibration API.
   */
  isSupported(): boolean
}

const touchHapticsControls: TouchHapticsControls = {
  impact(duration = 30) {
    navigator.vibrate?.(duration)
  },

  notification() {
    navigator.vibrate?.([40, 30, 40])
  },

  heavy(duration = 80) {
    navigator.vibrate?.(duration)
  },

  pattern(pattern) {
    navigator.vibrate?.(pattern)
  },

  cancel() {
    navigator.vibrate?.(0)
  },

  isSupported() {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator
  },
}
