import { useEffect, useContext } from 'react'
import type { PolygonShapeComponent } from '@cubeforge/renderer'
import { createPolygonShape } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

interface PolygonProps {
  points: { x: number; y: number }[]
  color?: string
  strokeColor?: string
  strokeWidth?: number
  zIndex?: number
  opacity?: number
  closed?: boolean
}

export function Polygon({
  points,
  color = '#ffffff',
  strokeColor,
  strokeWidth,
  zIndex = 0,
  opacity = 1,
  closed = true,
}: PolygonProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    const comp = createPolygonShape({
      points,
      color,
      strokeColor,
      strokeWidth,
      zIndex,
      opacity,
      closed,
    })
    engine.ecs.addComponent(entityId, comp)
    return () => engine.ecs.removeComponent(entityId, 'PolygonShape')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync mutable props each render
  useEffect(() => {
    const comp = engine.ecs.getComponent<PolygonShapeComponent>(entityId, 'PolygonShape')
    if (!comp) return
    comp.points = points
    comp.color = color
    comp.strokeColor = strokeColor
    comp.strokeWidth = strokeWidth
    comp.zIndex = zIndex
    comp.opacity = opacity
    comp.closed = closed
  }, [points, color, strokeColor, strokeWidth, zIndex, opacity, closed, engine, entityId])

  return null
}
