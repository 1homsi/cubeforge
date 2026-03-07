import { useEffect, useContext } from 'react'
import { createBoxCollider } from '@cubeforge/physics'
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
}: BoxColliderProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(entityId, createBoxCollider(width, height, { offsetX, offsetY, isTrigger, layer, mask, oneWay }))

    // Defer check so sibling components have had a chance to add their components
    const checkId = setTimeout(() => {
      if (engine.ecs.hasEntity(entityId) && !engine.ecs.hasComponent(entityId, 'Transform')) {
        console.warn(`[Cubeforge] BoxCollider on entity ${entityId} has no Transform. Physics requires Transform.`)
      }
    }, 0)

    return () => {
      clearTimeout(checkId)
      engine.ecs.removeComponent(entityId, 'BoxCollider')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
