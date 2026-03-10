import { useEffect, useContext } from 'react'
import { createTriangleCollider } from '@cubeforge/physics'
import type { CombineRule } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

interface TriangleColliderProps {
  a: { x: number; y: number }
  b: { x: number; y: number }
  c: { x: number; y: number }
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

export function TriangleCollider({
  a,
  b,
  c,
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
}: TriangleColliderProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(
      entityId,
      createTriangleCollider(a, b, c, {
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
    return () => engine.ecs.removeComponent(entityId, 'TriangleCollider')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
