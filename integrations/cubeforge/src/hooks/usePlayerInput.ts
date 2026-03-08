import { useMemo } from 'react'
import { createPlayerInput } from '@cubeforge/input'
import type { ActionBindings, PlayerInput } from '@cubeforge/input'
import { useInput } from './useInput'

/**
 * Returns a `PlayerInput` bound to the shared InputManager for the given player ID.
 *
 * @param playerId  - Player number (1-based).
 * @param bindings  - Action bindings for this player.
 *
 * @example
 * ```tsx
 * function P1({ x, y }: Props) {
 *   const p1 = usePlayerInput(1, { jump: 'Space', left: 'ArrowLeft', right: 'ArrowRight' })
 *   return (
 *     <Entity id="p1">
 *       <Script update={(id, world, input, dt) => {
 *         if (p1.isActionPressed('jump')) rb.vy = -400
 *       }} />
 *     </Entity>
 *   )
 * }
 * ```
 */
export function usePlayerInput(playerId: number, bindings: ActionBindings): PlayerInput {
  const input = useInput()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createPlayerInput(playerId, bindings, input), [playerId, input, JSON.stringify(bindings)])
}
