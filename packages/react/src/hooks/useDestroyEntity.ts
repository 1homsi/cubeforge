import { useCallback, useContext } from 'react'
import type { EntityId } from '@cubeforge/core'
import { EngineContext, EntityContext } from '../context'

/**
 * Returns a function that destroys the current entity on the next ECS update.
 * Must be used inside `<Entity>`.
 *
 * Useful for collectibles, projectiles, or any entity that needs to destroy
 * itself in response to a collision or trigger event.
 *
 * @example
 * function CoinPickup() {
 *   const destroy = useDestroyEntity()
 *   useTriggerEnter(() => {
 *     collectCoin()
 *     destroy()
 *   }, { tag: 'player' })
 *   return null
 * }
 */
export function useDestroyEntity(): () => void {
  const engine = useContext(EngineContext)
  const entityId = useContext(EntityContext)

  if (!engine) throw new Error('useDestroyEntity must be used inside <Game>')
  if (entityId === null) throw new Error('useDestroyEntity must be used inside <Entity>')

  return useCallback(() => {
    if (engine.ecs.hasEntity(entityId as EntityId)) {
      engine.ecs.destroyEntity(entityId as EntityId)
    }
  }, [engine, entityId])
}
