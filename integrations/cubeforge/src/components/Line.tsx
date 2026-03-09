import { useEffect, useContext } from 'react'
import type { LineShapeComponent } from '@cubeforge/renderer'
import { createLineShape } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

interface LineProps {
  endX: number
  endY: number
  color?: string
  lineWidth?: number
  zIndex?: number
  opacity?: number
  lineCap?: CanvasLineCap
}

export function Line({
  endX,
  endY,
  color = '#ffffff',
  lineWidth = 2,
  zIndex = 0,
  opacity = 1,
  lineCap = 'round',
}: LineProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    const comp = createLineShape({
      endX,
      endY,
      color,
      lineWidth,
      zIndex,
      opacity,
      lineCap,
    })
    engine.ecs.addComponent(entityId, comp)
    return () => engine.ecs.removeComponent(entityId, 'LineShape')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync mutable props each render
  useEffect(() => {
    const comp = engine.ecs.getComponent<LineShapeComponent>(entityId, 'LineShape')
    if (!comp) return
    comp.endX = endX
    comp.endY = endY
    comp.color = color
    comp.lineWidth = lineWidth
    comp.zIndex = zIndex
    comp.opacity = opacity
    comp.lineCap = lineCap
  }, [endX, endY, color, lineWidth, zIndex, opacity, lineCap, engine, entityId])

  return null
}
