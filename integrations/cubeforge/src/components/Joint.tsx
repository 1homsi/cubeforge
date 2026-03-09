import { useEffect, useContext } from 'react'
import { createJoint } from '@cubeforge/physics'
import type { JointType } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

interface JointProps {
  type: JointType
  /** Entity ID of the connected entity */
  target: string
  anchorA?: { x: number; y: number }
  anchorB?: { x: number; y: number }
  length?: number
  stiffness?: number
  damping?: number
  maxLength?: number
}

export function Joint({ type, target, anchorA, anchorB, length, stiffness, damping, maxLength }: JointProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    // Defer so sibling components and target entity have mounted
    const checkId = setTimeout(() => {
      const targetEntityId = engine.entityIds.get(target)
      if (!targetEntityId) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[Cubeforge] Joint target "${target}" not found. Make sure the target entity has an id="${target}" prop.`,
          )
        }
        return
      }

      engine.ecs.addComponent(
        entityId,
        createJoint({
          jointType: type,
          entityA: entityId,
          entityB: targetEntityId,
          anchorA,
          anchorB,
          length,
          stiffness,
          damping,
          maxLength,
        }),
      )
    }, 0)

    return () => {
      clearTimeout(checkId)
      engine.ecs.removeComponent(entityId, 'Joint')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
