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
}

export function BoxCollider({
  width,
  height,
  offsetX = 0,
  offsetY = 0,
  isTrigger = false,
  layer = 'default',
}: BoxColliderProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(entityId, createBoxCollider(width, height, { offsetX, offsetY, isTrigger, layer }))
    return () => engine.ecs.removeComponent(entityId, 'BoxCollider')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
