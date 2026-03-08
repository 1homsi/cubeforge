/**
 * Axis binding — maps a logical axis to positive and negative key sets.
 * Returns a value in -1..1 (negative keys = -1, positive keys = +1, none = 0).
 */
export interface AxisBinding {
  positive: string[]
  negative: string[]
  /** Values below this threshold are snapped to 0 (default 0.1) */
  deadZone?: number
}

/** A mapping of logical action names to one or more key codes or an axis binding. */
export type ActionBindings = Record<string, string | string[] | AxisBinding>

function isAxisBinding(v: unknown): v is AxisBinding {
  return typeof v === 'object' && v !== null && 'positive' in v && 'negative' in v
}

export interface InputMap {
  /** True every frame any bound key is held. */
  isActionDown(input: { isDown(key: string): boolean }, action: string): boolean
  /** True only on the first frame any bound key was pressed. */
  isActionPressed(input: { isPressed(key: string): boolean }, action: string): boolean
  /** True only on the frame any bound key was released. */
  isActionReleased(input: { isReleased(key: string): boolean }, action: string): boolean
  /**
   * Returns -1..1 for axis bindings. For key bindings, returns 1 if positive
   * key is down, -1 if negative key is down, 0 otherwise.
   */
  getAxis(input: { isDown(key: string): boolean }, action: string): number
}

/**
 * Creates a named action → key binding map for use in Script update functions.
 *
 * Supports key bindings and axis bindings:
 * ```ts
 * const map = createInputMap({
 *   left:  ['ArrowLeft', 'KeyA'],
 *   right: ['ArrowRight', 'KeyD'],
 *   moveX: { positive: ['ArrowRight', 'KeyD'], negative: ['ArrowLeft', 'KeyA'] },
 * })
 * // in update:
 * const x = map.getAxis(input, 'moveX') // -1..1
 * ```
 */
export function createInputMap(bindings: ActionBindings): InputMap {
  const normalized: Record<string, string[]> = {}
  const axes: Record<string, AxisBinding> = {}
  for (const [action, value] of Object.entries(bindings)) {
    if (isAxisBinding(value)) {
      axes[action] = value
    } else {
      normalized[action] = Array.isArray(value) ? value : [value]
    }
  }

  return {
    isActionDown(input, action) {
      if (axes[action]) {
        const ax = axes[action]
        return ax.positive.some(k => input.isDown(k)) || ax.negative.some(k => input.isDown(k))
      }
      return (normalized[action] ?? []).some(k => input.isDown(k))
    },
    isActionPressed(input, action) {
      const keys = normalized[action]
      if (!keys) return false
      return keys.some(k => (input as { isPressed(k: string): boolean }).isPressed(k))
    },
    isActionReleased(input, action) {
      const keys = normalized[action]
      if (!keys) return false
      return keys.some(k => (input as { isReleased(k: string): boolean }).isReleased(k))
    },
    getAxis(input, action) {
      if (axes[action]) {
        const ax = axes[action]
        const deadZone = ax.deadZone ?? 0.1
        let value = 0
        if (ax.positive.some(k => input.isDown(k))) value += 1
        if (ax.negative.some(k => input.isDown(k))) value -= 1
        return Math.abs(value) < deadZone ? 0 : value
      }
      // For key bindings, treat as digital axis
      const keys = normalized[action] ?? []
      return keys.some(k => input.isDown(k)) ? 1 : 0
    },
  }
}
