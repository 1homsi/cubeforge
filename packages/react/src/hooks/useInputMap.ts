import { useMemo } from 'react'
import type { ActionBindings } from '@cubeforge/input'
import { createInputMap } from '@cubeforge/input'
import { useInput } from './useInput'

export interface BoundInputMap {
  /** True every frame any bound key is held. */
  isActionDown(action: string): boolean
  /** True only on the first frame any bound key was pressed. */
  isActionPressed(action: string): boolean
  /** True only on the frame any bound key was released. */
  isActionReleased(action: string): boolean
  /**
   * Returns -1..1 for axis bindings. For key bindings, 1 if down, 0 otherwise.
   * @see {@link AxisBinding}
   */
  getAxis(action: string): number
}

/**
 * React hook that returns a pre-bound action map for use inside `<Game>`.
 *
 * @example
 * ```tsx
 * function MyScript() {
 *   const actions = useInputMap({
 *     left:  ['ArrowLeft', 'KeyA'],
 *     right: ['ArrowRight', 'KeyD'],
 *     jump:  ['Space', 'ArrowUp', 'KeyW'],
 *   })
 *   // use actions.isActionDown('left') in a Script update or game loop callback
 * }
 * ```
 */
export function useInputMap(bindings: ActionBindings): BoundInputMap {
  const input = useInput()

  // Use JSON.stringify as the memo key so that: (a) inline literal objects
  // that are referentially new each render don't cause unnecessary work, and
  // (b) state-driven bindings (e.g. from usePersistedBindings) do re-normalize
  // when the actual content changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const map = useMemo(() => createInputMap(bindings), [JSON.stringify(bindings)]) // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => ({
    isActionDown:     (action: string) => map.isActionDown(input, action),
    isActionPressed:  (action: string) => map.isActionPressed(input, action),
    isActionReleased: (action: string) => map.isActionReleased(input, action),
    getAxis:          (action: string) => map.getAxis(input, action),
  }), [input, map])
}
