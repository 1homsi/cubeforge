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
  bounds?: { x: number; y: number; width: number; height: number }
  deadZone?: { w: number; h: number }
  /** World-space offset applied to the follow target (look-ahead, vertical bias, etc.) */
  followOffsetX?: number
  followOffsetY?: number
}

export function Camera2D({
  followEntity,
  zoom = 1,
  smoothing = 0,
  background = '#1a1a2e',
  bounds,
  deadZone,
  followOffsetX = 0,
  followOffsetY = 0,
}: Camera2DProps) {
  const engine = useContext(EngineContext)!

  useEffect(() => {
    const entityId = engine.ecs.createEntity()
    engine.ecs.addComponent(entityId, createCamera2D({
      followEntityId: followEntity,
      zoom,
      smoothing,
      background,
      bounds,
      deadZone,
      followOffsetX,
      followOffsetY,
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
    cam.bounds = bounds
    cam.deadZone = deadZone
    cam.followOffsetX = followOffsetX
    cam.followOffsetY = followOffsetY
  }, [followEntity, zoom, smoothing, background, bounds, deadZone, followOffsetX, followOffsetY, engine])

  return null
}
