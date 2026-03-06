import { useEffect, useContext } from 'react'
import { createCamera2D, type Camera2DComponent } from '@cubeforge/renderer'
import { EngineContext } from '../context'

interface Camera2DProps {
  /** String ID of entity to follow */
  followEntity?: string
  zoom?: number
  /** Lerp smoothing factor (0 = instant snap, 0.85 = smooth) */
  smoothing?: number
  background?: string
}

export function Camera2D({
  followEntity,
  zoom = 1,
  smoothing = 0,
  background = '#1a1a2e',
}: Camera2DProps) {
  const engine = useContext(EngineContext)!

  useEffect(() => {
    const entityId = engine.ecs.createEntity()
    engine.ecs.addComponent(entityId, createCamera2D({
      followEntityId: followEntity,
      zoom,
      smoothing,
      background,
    }))

    return () => engine.ecs.destroyEntity(entityId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync prop changes
  useEffect(() => {
    const camId = engine.ecs.queryOne('Camera2D')
    if (camId === undefined) return
    const cam = engine.ecs.getComponent<Camera2DComponent>(camId, 'Camera2D')!
    cam.followEntityId = followEntity
    cam.zoom = zoom
    cam.smoothing = smoothing
    cam.background = background
  }, [followEntity, zoom, smoothing, background, engine])

  return null
}
