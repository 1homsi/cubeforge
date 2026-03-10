import { useContext, useMemo } from 'react'
import { CharacterController } from '@cubeforge/physics'
import type { CharacterControllerConfig, MoveResult } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '@cubeforge/context'

export interface CharacterControls {
  /** Move the character by desired translation. Returns actual movement + grounded state. */
  move(dx: number, dy: number): MoveResult
  /** The underlying CharacterController instance for advanced use. */
  controller: CharacterController
}

/**
 * Creates a character controller bound to the current entity.
 *
 * ```tsx
 * function Player() {
 *   const { move } = useCharacterController({
 *     maxSlopeClimbAngle: Math.PI / 4,
 *     snapToGroundDistance: 4,
 *   })
 *
 *   return <Script update={(id, world, input, dt) => {
 *     const speed = 200 * dt
 *     let dx = 0
 *     if (input.isDown('ArrowLeft')) dx = -speed
 *     if (input.isDown('ArrowRight')) dx = speed
 *     const { grounded } = move(dx, 10 * dt) // gravity
 *   }} />
 * }
 * ```
 */
export function useCharacterController(config: CharacterControllerConfig = {}): CharacterControls {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  return useMemo(() => {
    const controller = new CharacterController(config)
    return {
      move(dx: number, dy: number): MoveResult {
        return controller.move(engine.ecs, entityId, dx, dy)
      },
      controller,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.ecs, entityId])
}
