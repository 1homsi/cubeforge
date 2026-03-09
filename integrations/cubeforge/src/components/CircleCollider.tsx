import { useEffect, useContext } from 'react'
import { createCircleCollider } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

interface CircleColliderProps {
  radius: number
  offsetX?: number
  offsetY?: number
  isTrigger?: boolean
  layer?: string
  /** Which layers this collider interacts with. '*' = all (default). */
  mask?: string | string[]
}

export function CircleCollider({
  radius,
  offsetX = 0,
  offsetY = 0,
  isTrigger = false,
  layer = 'default',
  mask = '*',
}: CircleColliderProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(entityId, createCircleCollider(radius, { offsetX, offsetY, isTrigger, layer, mask }))
    return () => engine.ecs.removeComponent(entityId, 'CircleCollider')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
