import { useEffect, useContext } from 'react'
import { createCompoundCollider } from '@cubeforge/physics'
import type { ColliderShape } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

interface CompoundColliderProps {
  shapes: ColliderShape[]
  isTrigger?: boolean
  layer?: string
  /** Which layers this collider interacts with. '*' = all (default). */
  mask?: string | string[]
}

export function CompoundCollider({ shapes, isTrigger = false, layer = 'default', mask = '*' }: CompoundColliderProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(entityId, createCompoundCollider(shapes, { isTrigger, layer, mask }))

    // Defer check so sibling components have had a chance to add their components
    const checkId = setTimeout(() => {
      if (engine.ecs.hasEntity(entityId) && !engine.ecs.hasComponent(entityId, 'Transform')) {
        console.warn(`[Cubeforge] CompoundCollider on entity ${entityId} has no Transform. Physics requires Transform.`)
      }
    }, 0)

    return () => {
      clearTimeout(checkId)
      engine.ecs.removeComponent(entityId, 'CompoundCollider')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
