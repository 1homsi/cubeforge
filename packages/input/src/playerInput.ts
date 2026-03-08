import type { ActionBindings } from './inputMap'
import { createInputMap } from './inputMap'
import type { InputManager } from './inputManager'

export interface PlayerInput {
  readonly playerId: number
  isDown(key: string): boolean
  isPressed(key: string): boolean
  isReleased(key: string): boolean
  /** Raw axis from two keys: positive - negative, range -1..1. */
  getAxis(positiveKey: string, negativeKey: string): number
  isActionDown(action: string): boolean
  isActionPressed(action: string): boolean
  isActionReleased(action: string): boolean
  /**
   * Returns -1..1 for the named action's axis binding, or 1/0 for key bindings.
   * Alias: `getAxis(action)` — consistent with `BoundInputMap`.
   */
  getActionAxis(action: string): number
}

/**
 * Creates a per-player input wrapper that binds a named action map to a
 * specific player's device (keyboard by default, gamepad by index).
 *
 * Player 1 defaults to keyboard. Player 2+ defaults to gamepad index (playerId - 2).
 *
 * @example
 * ```ts
 * const p1 = createPlayerInput(1, { jump: 'Space', left: 'ArrowLeft', right: 'ArrowRight' }, input)
 * const p2 = createPlayerInput(2, { jump: 'KeyW', left: 'KeyA', right: 'KeyD' }, input)
 * ```
 */
export function createPlayerInput(
  playerId: number,
  bindings: ActionBindings,
  input: InputManager,
): PlayerInput {
  const map = createInputMap(bindings)

  return {
    playerId,
    isDown: (key) => input.isDown(key),
    isPressed: (key) => input.isPressed(key),
    isReleased: (key) => input.isReleased(key),
    getAxis: (pos, neg) => input.getAxis(pos, neg),
    isActionDown: (action) => map.isActionDown(input, action),
    isActionPressed: (action) => map.isActionPressed(input, action),
    isActionReleased: (action) => map.isActionReleased(input, action),
    getActionAxis: (action) => map.getAxis(input, action),
  }
}
