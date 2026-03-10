import { useEffect, useContext } from 'react'
import { createSegmentCollider } from '@cubeforge/physics'
import type { CombineRule } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

interface SegmentColliderProps {
  start: { x: number; y: number }
  end: { x: number; y: number }
  isTrigger?: boolean
  layer?: string
  mask?: string | string[]
  oneWay?: boolean
  friction?: number
  restitution?: number
  frictionCombineRule?: CombineRule
  restitutionCombineRule?: CombineRule
  enabled?: boolean
}

export function SegmentCollider({
  start,
  end,
  isTrigger = false,
  layer = 'default',
  mask = '*',
  oneWay = false,
  friction = 0,
  restitution = 0,
  frictionCombineRule = 'average',
  restitutionCombineRule = 'average',
  enabled = true,
}: SegmentColliderProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(
      entityId,
      createSegmentCollider(start, end, {
        isTrigger,
        layer,
        mask,
        oneWay,
        friction,
        restitution,
        frictionCombineRule,
        restitutionCombineRule,
        enabled,
      }),
    )
    return () => engine.ecs.removeComponent(entityId, 'SegmentCollider')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
