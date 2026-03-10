import { useEffect, useContext } from 'react'
import { createTriMeshCollider } from '@cubeforge/physics'
import type { CombineRule } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

interface TriMeshColliderProps {
  vertices: { x: number; y: number }[]
  indices: number[]
  layer?: string
  mask?: string | string[]
  friction?: number
  restitution?: number
  frictionCombineRule?: CombineRule
  restitutionCombineRule?: CombineRule
  enabled?: boolean
}

export function TriMeshCollider({
  vertices,
  indices,
  layer = 'default',
  mask = '*',
  friction = 0,
  restitution = 0,
  frictionCombineRule = 'average',
  restitutionCombineRule = 'average',
  enabled = true,
}: TriMeshColliderProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(
      entityId,
      createTriMeshCollider(vertices, indices, {
        layer,
        mask,
        friction,
        restitution,
        frictionCombineRule,
        restitutionCombineRule,
        enabled,
      }),
    )
    return () => engine.ecs.removeComponent(entityId, 'TriMeshCollider')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
