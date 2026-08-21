/**
 * Axis binding — maps a logical axis to positive and negative key sets,
 * optionally blended with an analog gamepad stick.
 */
export interface AxisBinding {
  positive: string[]
  negative: string[]
  /** Values below this threshold are snapped to 0 (default 0.1) */
  deadZone?: number
  /**
   * Analog gamepad stick blended into this axis. Stick value (already
   * dead-zoned by the GamepadInput) is added on top of the digital keys and
   * clamped to −1..1, so keyboard and stick work simultaneously.
   * @example
   * { positive: ['ArrowRight'], negative: ['ArrowLeft'], stick: 'leftx' }
   */
  stick?: 'leftx' | 'lefty' | 'rightx' | 'righty'
}

/** A mapping of logical action names to one or more key codes or an axis binding. */
export type ActionBindings = Record<string, string | string[] | AxisBinding>

/** Structural input source — satisfied by InputManager. */
export interface InputSourceLike {
  isDown(key: string): boolean
  isPressed?(key: string): boolean
  isReleased?(key: string): boolean
  /** Present when the source can read analog sticks (InputManager). */
  gamepad?: {
    getStick(stick: 'left' | 'right', axis: 'x' | 'y', playerIndex?: number): number
    isConnected(playerIndex?: number): boolean
  }
}

function isAxisBinding(v: unknown): v is AxisBinding {
  return typeof v === 'object' && v !== null && 'positive' in v && 'negative' in v
}

export interface InputMap {
  /** True every frame any bound key is held. */
  isActionDown(input: InputSourceLike, action: string): boolean
  /** True only on the first frame any bound key was pressed. */
  isActionPressed(input: InputSourceLike, action: string): boolean
  /** True only on the frame any bound key was released. */
  isActionReleased(input: InputSourceLike, action: string): boolean
  /**
   * Returns −1..1 for axis bindings, blending digital keys with the bound
   * analog gamepad stick when present.
   */
  getAxis(input: InputSourceLike, action: string): number
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
const STICK_READERS: Record<string, { stick: 'left' | 'right'; axis: 'x' | 'y' }> = {
  leftx: { stick: 'left', axis: 'x' },
  lefty: { stick: 'left', axis: 'y' },
  rightx: { stick: 'right', axis: 'x' },
  righty: { stick: 'right', axis: 'y' },
}

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

  function readAxis(input: InputSourceLike, action: string): number {
    const ax = axes[action]
    if (!ax) return 0
    const deadZone = Math.abs(ax.deadZone ?? 0.1)
    let value = 0
    if (ax.positive.some((k) => input.isDown(k))) value += 1
    if (ax.negative.some((k) => input.isDown(k))) value -= 1
    if (ax.stick) {
      const reader = STICK_READERS[ax.stick]
      const gp = input.gamepad
      if (reader && gp?.isConnected()) value += gp.getStick(reader.stick, reader.axis)
    }
    const clamped = Math.min(1, Math.max(-1, value))
    return Math.abs(clamped) < deadZone ? 0 : clamped
  }

  return {
    isActionDown(input, action) {
      if (axes[action]) {
        const ax = axes[action]
        if (ax.positive.some((k) => input.isDown(k)) || ax.negative.some((k) => input.isDown(k))) return true
        if (ax.stick && input.gamepad?.isConnected()) {
          return readAxis(input, action) !== 0
        }
        return false
      }
      return (normalized[action] ?? []).some((k) => input.isDown(k))
    },
    isActionPressed(input, action) {
      const keys = normalized[action]
      if (!keys) return false
      return keys.some((k) => input.isPressed?.(k) ?? false)
    },
    isActionReleased(input, action) {
      const keys = normalized[action]
      if (!keys) return false
      return keys.some((k) => input.isReleased?.(k) ?? false)
    },
    getAxis(input, action) {
      if (axes[action]) return readAxis(input, action)
      // For key bindings, treat as digital axis
      const keys = normalized[action] ?? []
      return keys.some((k) => input.isDown(k)) ? 1 : 0
    },
  }
}
