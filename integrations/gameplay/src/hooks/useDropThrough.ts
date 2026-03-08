import { useContext, useCallback } from 'react'
import type { RigidBodyComponent } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '@cubeforge/context'

export function useDropThrough(frames = 8): { dropThrough(): void } {
  const engine   = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  const dropThrough = useCallback((): void => {
    const rb = engine.ecs.getComponent<RigidBodyComponent>(entityId, 'RigidBody')
    if (rb) rb.dropThrough = frames
  }, [engine.ecs, entityId, frames])

  return { dropThrough }
}
