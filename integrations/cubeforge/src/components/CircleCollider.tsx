import { useEffect, useContext } from 'react'
import { createCircleCollider } from '@cubeforge/physics'
import type { CombineRule } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

interface CircleColliderProps {
  radius: number
  offsetX?: number
  offsetY?: number
  isTrigger?: boolean
  layer?: string
  /** Which layers this collider interacts with. '*' = all (default). */
  mask?: string | string[]
  /** Per-collider friction coefficient (0–1). Default 0.5 */
  friction?: number
  /** Per-collider restitution (bounciness) coefficient (0–1). Default 0.0 */
  restitution?: number
  /** How to combine friction with the other collider. Default 'average' */
  frictionCombineRule?: CombineRule
  /** How to combine restitution with the other collider. Default 'average' */
  restitutionCombineRule?: CombineRule
  /** Whether this collider is enabled. Disabled colliders skip all detection */
  enabled?: boolean
}

export function CircleCollider({
  radius,
  offsetX = 0,
  offsetY = 0,
  isTrigger = false,
  layer = 'default',
  mask = '*',
  friction = 0.5,
  restitution = 0,
  frictionCombineRule = 'average',
  restitutionCombineRule = 'average',
  enabled = true,
}: CircleColliderProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(
      entityId,
      createCircleCollider(radius, {
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
    return () => engine.ecs.removeComponent(entityId, 'CircleCollider')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
