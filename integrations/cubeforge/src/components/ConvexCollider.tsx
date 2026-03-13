import { useEffect, useContext } from 'react'
import { createConvexPolygonCollider } from '@cubeforge/physics'
import type { CombineRule } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

interface ConvexColliderProps {
  /** Vertices in CCW order (max 8 for performance). Positions relative to entity center. */
  vertices: { x: number; y: number }[]
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

/**
 * @experimental Physics response for convex polygons is not yet fully implemented.
 * This collider generates contact events but impulse resolution may be incomplete.
 */
export function ConvexCollider({
  vertices,
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
}: ConvexColliderProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(
      entityId,
      createConvexPolygonCollider(vertices, {
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
    return () => engine.ecs.removeComponent(entityId, 'ConvexPolygonCollider')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
