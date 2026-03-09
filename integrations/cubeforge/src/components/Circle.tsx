import { useEffect, useContext } from 'react'
import type { CircleShapeComponent } from '@cubeforge/renderer'
import { createCircleShape } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

interface CircleProps {
  radius?: number
  color?: string
  strokeColor?: string
  strokeWidth?: number
  zIndex?: number
  opacity?: number
}

export function Circle({
  radius = 16,
  color = '#ffffff',
  strokeColor,
  strokeWidth,
  zIndex = 0,
  opacity = 1,
}: CircleProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    const comp = createCircleShape({
      radius,
      color,
      strokeColor,
      strokeWidth,
      zIndex,
      opacity,
    })
    engine.ecs.addComponent(entityId, comp)
    return () => engine.ecs.removeComponent(entityId, 'CircleShape')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync mutable props each render
  useEffect(() => {
    const comp = engine.ecs.getComponent<CircleShapeComponent>(entityId, 'CircleShape')
    if (!comp) return
    comp.radius = radius
    comp.color = color
    comp.strokeColor = strokeColor
    comp.strokeWidth = strokeWidth
    comp.zIndex = zIndex
    comp.opacity = opacity
  }, [radius, color, strokeColor, strokeWidth, zIndex, opacity, engine, entityId])

  return null
}
