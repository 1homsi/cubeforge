/** A mapping of logical action names to one or more key codes. */
export type ActionBindings = Record<string, string | string[]>

export interface InputMap {
  /** True every frame any bound key is held. */
  isActionDown(input: { isDown(key: string): boolean }, action: string): boolean
  /** True only on the first frame any bound key was pressed. */
  isActionPressed(input: { isPressed(key: string): boolean }, action: string): boolean
  /** True only on the frame any bound key was released. */
  isActionReleased(input: { isReleased(key: string): boolean }, action: string): boolean
}

/**
 * Creates a named action → key binding map for use in Script update functions.
 *
 * Replaces verbose multi-key checks like:
 * ```ts
 * const left = input.isDown('ArrowLeft') || input.isDown('KeyA')
 * ```
 * with:
 * ```ts
 * const map = createInputMap({ left: ['ArrowLeft', 'KeyA'] })
 * // in update:
 * if (map.isActionDown(input, 'left')) { ... }
 * ```
 *
 * @param bindings - Object mapping action names to a key code or array of key codes.
 */
export function createInputMap(bindings: ActionBindings): InputMap {
  const normalized: Record<string, string[]> = {}
  for (const [action, keys] of Object.entries(bindings)) {
    normalized[action] = Array.isArray(keys) ? keys : [keys]
  }

  return {
    isActionDown(input, action) {
      return (normalized[action] ?? []).some(k => input.isDown(k))
    },
    isActionPressed(input, action) {
      return (normalized[action] ?? []).some(k => input.isPressed(k))
    },
    isActionReleased(input, action) {
      return (normalized[action] ?? []).some(k => input.isReleased(k))
    },
  }
}
