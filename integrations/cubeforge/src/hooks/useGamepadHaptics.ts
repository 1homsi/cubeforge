/**
 * useGamepadHaptics — triggers rumble/vibration on a connected gamepad.
 *
 * Uses the Gamepad `vibrationActuator` API (Chrome/Edge). No-ops gracefully
 * in browsers that don't support it (Firefox, Safari).
 *
 * @example
 * function Player() {
 *   const haptics = useGamepadHaptics()
 *   useCollisionEnter((other) => haptics.rumble(0.2, 0.5, 1.0))
 * }
 */
export function useGamepadHaptics(playerIndex = 0): {
  /**
   * Trigger a dual-rumble vibration.
   * @param duration - Duration in seconds.
   * @param weakMagnitude - High-frequency (right) motor strength 0–1. Default 0.5.
   * @param strongMagnitude - Low-frequency (left) motor strength 0–1. Default 1.0.
   */
  rumble(duration: number, weakMagnitude?: number, strongMagnitude?: number): void
  /** Whether the current browser/controller supports haptics. */
  isSupported(): boolean
} {
  function getActuator() {
    const gp = navigator.getGamepads?.()[playerIndex]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return gp ? (gp as any).vibrationActuator ?? null : null
  }

  return {
    rumble(duration, weakMagnitude = 0.5, strongMagnitude = 1.0) {
      const actuator = getActuator()
      if (!actuator) return
      try {
        actuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: duration * 1000,
          weakMagnitude: Math.max(0, Math.min(1, weakMagnitude)),
          strongMagnitude: Math.max(0, Math.min(1, strongMagnitude)),
        })
      } catch {
        // Silently ignore if the browser doesn't support dual-rumble
      }
    },

    isSupported() {
      return getActuator() !== null
    },
  }
}
