import { useMemo } from 'react'
import type { ActionBindings } from '@cubeforge/input'
import { useInput } from './useInput'

export interface BoundInputMap {
  /** True every frame any bound key is held. */
  isActionDown(action: string): boolean
  /** True only on the first frame any bound key was pressed. */
  isActionPressed(action: string): boolean
  /** True only on the frame any bound key was released. */
  isActionReleased(action: string): boolean
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
  const normalized = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const [action, keys] of Object.entries(bindings)) {
      out[action] = Array.isArray(keys) ? keys : [keys]
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(bindings)])

  return useMemo(() => ({
    isActionDown: (action: string) =>
      (normalized[action] ?? []).some(k => input.isDown(k)),
    isActionPressed: (action: string) =>
      (normalized[action] ?? []).some(k => input.isPressed(k)),
    isActionReleased: (action: string) =>
      (normalized[action] ?? []).some(k => input.isReleased(k)),
  }), [input, normalized])
}
