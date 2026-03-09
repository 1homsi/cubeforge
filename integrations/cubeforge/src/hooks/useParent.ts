import { useEffect, useContext } from 'react'
import type { EntityId } from '@cubeforge/core'
import { setParent, removeParent } from '@cubeforge/core'
import { EngineContext } from '../context'

/**
 * Establishes a parent-child hierarchy relationship between two entities.
 * On mount: calls setParent(world, child, parent).
 * On unmount: calls removeParent(world, child).
 *
 * Usage inside an <Entity> script or component:
 * ```tsx
 * const entityId = useEntity()
 * const engine = useGame()
 * const parentId = engine.entityIds.get('player')!
 * useParent(entityId, parentId)
 * ```
 */
export function useParent(childEntityId: EntityId, parentEntityId: EntityId): void {
  const engine = useContext(EngineContext)
  if (!engine) throw new Error('useParent must be used inside <Game>')

  useEffect(() => {
    setParent(engine.ecs, childEntityId, parentEntityId)
    return () => {
      removeParent(engine.ecs, childEntityId)
    }
  }, [engine.ecs, childEntityId, parentEntityId])
}
