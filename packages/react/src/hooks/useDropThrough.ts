import { useContext, useCallback } from 'react'
import type { RigidBodyComponent } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

/**
 * Allows an entity to temporarily pass through one-way platforms.
 *
 * Call `dropThrough()` to set `rb.dropThrough = 8` (8 fixed steps ≈ 133ms).
 * The physics system skips one-way blocking while `dropThrough > 0`.
 *
 * Must be used inside an `<Entity>` that has a `<RigidBody>` and `<BoxCollider>`.
 *
 * @example
 * ```tsx
 * function Player() {
 *   const { dropThrough } = useDropThrough()
 *   return (
 *     <Script update={(id, world, input, dt) => {
 *       if (input.isPressed('ArrowDown')) dropThrough()
 *     }} />
 *   )
 * }
 * ```
 */
export function useDropThrough(frames = 8): { dropThrough(): void } {
  const engine   = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  const dropThrough = useCallback((): void => {
    const rb = engine.ecs.getComponent<RigidBodyComponent>(entityId, 'RigidBody')
    if (rb) rb.dropThrough = frames
  }, [engine.ecs, entityId, frames])

  return { dropThrough }
}
