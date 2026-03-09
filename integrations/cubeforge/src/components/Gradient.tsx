import { useEffect, useContext } from 'react'
import { createGradient, type GradientComponent, type GradientStop, type GradientType } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

interface GradientProps {
  gradientType?: GradientType
  stops: GradientStop[]
  /** For linear: angle in radians (0 = left to right) */
  angle?: number
  /** For radial: inner radius ratio (0-1) */
  innerRadius?: number
  width: number
  height: number
  zIndex?: number
  visible?: boolean
  anchorX?: number
  anchorY?: number
}

export function Gradient({
  gradientType = 'linear',
  stops,
  angle = 0,
  innerRadius = 0,
  width,
  height,
  zIndex = 0,
  visible = true,
  anchorX = 0.5,
  anchorY = 0.5,
}: GradientProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    const comp = createGradient({
      gradientType,
      stops,
      angle,
      innerRadius,
      width,
      height,
      zIndex,
      visible,
      anchorX,
      anchorY,
    })
    engine.ecs.addComponent(entityId, comp)
    return () => engine.ecs.removeComponent(entityId, 'Gradient')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync mutable props each render
  useEffect(() => {
    const comp = engine.ecs.getComponent<GradientComponent>(entityId, 'Gradient')
    if (!comp) return
    comp.gradientType = gradientType
    comp.stops = stops
    comp.angle = angle
    comp.innerRadius = innerRadius
    comp.visible = visible
    comp.zIndex = zIndex
  }, [gradientType, stops, angle, innerRadius, visible, zIndex, engine, entityId])

  return null
}
