import { useEffect, useContext } from 'react'
import { createHalfSpaceCollider } from '@cubeforge/physics'
import type { CombineRule } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

interface HalfSpaceColliderProps {
  normalX?: number
  normalY?: number
  layer?: string
  mask?: string | string[]
  friction?: number
  restitution?: number
  frictionCombineRule?: CombineRule
  restitutionCombineRule?: CombineRule
  enabled?: boolean
}

/**
 * @experimental Infinite half-space collider is not yet fully implemented.
 * Useful as a static world boundary; dynamic body response may be incomplete.
 */
export function HalfSpaceCollider({
  normalX = 0,
  normalY = -1,
  layer = 'default',
  mask = '*',
  friction = 0,
  restitution = 0,
  frictionCombineRule = 'average',
  restitutionCombineRule = 'average',
  enabled = true,
}: HalfSpaceColliderProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(
      entityId,
      createHalfSpaceCollider({
        normalX,
        normalY,
        layer,
        mask,
        friction,
        restitution,
        frictionCombineRule,
        restitutionCombineRule,
        enabled,
      }),
    )
    return () => engine.ecs.removeComponent(entityId, 'HalfSpaceCollider')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
