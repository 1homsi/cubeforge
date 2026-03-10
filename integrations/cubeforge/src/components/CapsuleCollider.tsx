import { useEffect, useContext } from 'react'
import { createCapsuleCollider } from '@cubeforge/physics'
import type { CombineRule } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

interface CapsuleColliderProps {
  width: number
  height: number
  offsetX?: number
  offsetY?: number
  isTrigger?: boolean
  layer?: string
  mask?: string | string[]
  friction?: number
  restitution?: number
  frictionCombineRule?: CombineRule
  restitutionCombineRule?: CombineRule
  enabled?: boolean
}

export function CapsuleCollider({
  width,
  height,
  offsetX = 0,
  offsetY = 0,
  isTrigger = false,
  layer = 'default',
  mask = '*',
  friction = 0,
  restitution = 0,
  frictionCombineRule = 'average',
  restitutionCombineRule = 'average',
  enabled = true,
}: CapsuleColliderProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(
      entityId,
      createCapsuleCollider(width, height, {
        offsetX,
        offsetY,
        isTrigger,
        layer,
        mask,
        friction,
        restitution,
        frictionCombineRule,
        restitutionCombineRule,
        enabled,
      }),
    )
    return () => engine.ecs.removeComponent(entityId, 'CapsuleCollider')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
