import { useMemo } from 'react'
import { createPlayerInput } from '@cubeforge/input'
import type { ActionBindings, PlayerInput } from '@cubeforge/input'
import { useInput } from './useInput'

/**
 * Returns an array of `PlayerInput` objects for local multiplayer.
 * Each player gets their own action bindings.
 *
 * @param bindingsPerPlayer - Array of binding objects, one per player.
 *
 * @example
 * ```tsx
 * const [p1, p2] = useLocalMultiplayer([
 *   { jump: 'Space', left: 'ArrowLeft', right: 'ArrowRight' },
 *   { jump: 'KeyW',  left: 'KeyA',      right: 'KeyD' },
 * ])
 * ```
 */
export function useLocalMultiplayer(bindingsPerPlayer: ActionBindings[]): PlayerInput[] {
  const input = useInput()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => bindingsPerPlayer.map((bindings, i) => createPlayerInput(i + 1, bindings, input)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, JSON.stringify(bindingsPerPlayer)],
  )
}
