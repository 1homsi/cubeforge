import { useEffect, useContext } from 'react'
import { createMask, type MaskComponent, type MaskShape } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

interface MaskProps {
  shape?: MaskShape
  width?: number
  height?: number
  radius?: number
  inverted?: boolean
}

/**
 * Clips the parent entity's sprite to a shape.
 *
 * @example
 * <Entity>
 *   <Transform x={100} y={100} />
 *   <Sprite src="/health-bar-bg.png" width={200} height={20} />
 *   <Mask shape="rect" width={120} height={20} />
 * </Entity>
 */
export function Mask({ shape = 'rect', width = 64, height = 64, radius = 32, inverted = false }: MaskProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    const comp = createMask({ shape, width, height, radius, inverted })
    engine.ecs.addComponent(entityId, comp)
    return () => engine.ecs.removeComponent(entityId, 'Mask')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync mutable props each render
  useEffect(() => {
    const comp = engine.ecs.getComponent<MaskComponent>(entityId, 'Mask')
    if (!comp) return
    comp.shape = shape
    comp.width = width
    comp.height = height
    comp.radius = radius
    comp.inverted = inverted
  }, [shape, width, height, radius, inverted, engine, entityId])

  return null
}
