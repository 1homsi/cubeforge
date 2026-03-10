import { useEffect, useContext } from 'react'
import { createHeightFieldCollider } from '@cubeforge/physics'
import type { CombineRule } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

interface HeightFieldColliderProps {
  heights: number[]
  scaleX?: number
  scaleY?: number
  layer?: string
  mask?: string | string[]
  friction?: number
  restitution?: number
  frictionCombineRule?: CombineRule
  restitutionCombineRule?: CombineRule
  enabled?: boolean
}

export function HeightFieldCollider({
  heights,
  scaleX = 1,
  scaleY = 1,
  layer = 'default',
  mask = '*',
  friction = 0,
  restitution = 0,
  frictionCombineRule = 'average',
  restitutionCombineRule = 'average',
  enabled = true,
}: HeightFieldColliderProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(
      entityId,
      createHeightFieldCollider(heights, {
        scaleX,
        scaleY,
        layer,
        mask,
        friction,
        restitution,
        frictionCombineRule,
        restitutionCombineRule,
        enabled,
      }),
    )
    return () => engine.ecs.removeComponent(entityId, 'HeightFieldCollider')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
