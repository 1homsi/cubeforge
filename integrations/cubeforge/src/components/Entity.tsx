import { useEffect, useContext, useState, type ReactNode } from 'react'
import { createTag } from '@cubeforge/core'
import type { EntityId } from '@cubeforge/core'
import { EngineContext, EntityContext } from '../context'

interface EntityProps {
  /** Optional string ID for cross-entity lookups (e.g. camera follow) */
  id?: string
  /** Tags for grouping / querying (e.g. ['enemy', 'damageable']) */
  tags?: string[]
  children?: ReactNode
}

export function Entity({ id, tags = [], children }: EntityProps) {
  const engine = useContext(EngineContext)!
  const [entityId, setEntityId] = useState<EntityId | null>(null)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[Cubeforge] <Entity> must be inside a <World>. No EngineContext found.')
    }
  }

  useEffect(() => {
    const eid = engine.ecs.createEntity()

    if (id) {
      if (engine.entityIds.has(id)) {
        console.warn(
          `[Cubeforge] Duplicate entity ID "${id}". Entity IDs must be unique — the previous entity with this ID will be replaced.`,
        )
      }
      engine.entityIds.set(id, eid)
    }
    if (tags.length > 0) engine.ecs.addComponent(eid, createTag(...tags))

    setEntityId(eid)

    return () => {
      engine.ecs.destroyEntity(eid)
      // Only remove the ID mapping if it still points to this entity —
      // a duplicate mount may have already overwritten it.
      if (id && engine.entityIds.get(id) === eid) engine.entityIds.delete(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (entityId === null) return null

  return <EntityContext.Provider value={entityId}>{children}</EntityContext.Provider>
}
