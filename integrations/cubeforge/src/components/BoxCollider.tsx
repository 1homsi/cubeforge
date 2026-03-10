import { useEffect, useContext } from 'react'
import { createBoxCollider } from '@cubeforge/physics'
import type { CombineRule } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

interface BoxColliderProps {
  width: number
  height: number
  offsetX?: number
  offsetY?: number
  isTrigger?: boolean
  layer?: string
  /** Which layers this collider interacts with. '*' = all (default). */
  mask?: string | string[]
  /**
   * One-way platform: only blocks entities falling onto the top surface.
   * Entities below pass through freely (useful for jump-through ledges).
   */
  oneWay?: boolean
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

export function BoxCollider({
  width,
  height,
  offsetX = 0,
  offsetY = 0,
  isTrigger = false,
  layer = 'default',
  mask = '*',
  oneWay = false,
  friction = 0.5,
  restitution = 0,
  frictionCombineRule = 'average',
  restitutionCombineRule = 'average',
  enabled = true,
}: BoxColliderProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(
      entityId,
      createBoxCollider(width, height, {
        offsetX,
        offsetY,
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

    // Defer check so sibling components have had a chance to add their components
    const checkId = setTimeout(() => {
      if (process.env.NODE_ENV !== 'production') {
        if (engine.ecs.hasEntity(entityId) && !engine.ecs.hasComponent(entityId, 'Transform')) {
          console.warn(`[Cubeforge] BoxCollider on entity ${entityId} has no Transform. Physics requires Transform.`)
        }
        if (engine.ecs.hasEntity(entityId) && !engine.ecs.hasComponent(entityId, 'RigidBody')) {
          console.warn(
            `[Cubeforge] BoxCollider on entity ${entityId} has no RigidBody. Add a <RigidBody> sibling for physics to work.`,
          )
        }
      }
    }, 0)

    return () => {
      clearTimeout(checkId)
      engine.ecs.removeComponent(entityId, 'BoxCollider')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
