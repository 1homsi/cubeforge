import { useEffect, useContext } from 'react'
import { createTrail } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

interface TrailProps {
  /** Maximum number of trail points (default 20) */
  length?: number
  /** CSS color string (default '#ffffff') */
  color?: string
  /** Trail width in pixels (default 3) */
  width?: number
}

/**
 * Renders a fading polyline that follows the entity's position.
 *
 * The trail is drawn in the render pass — it uses the entity's Transform
 * history collected each frame.
 *
 * Must be used inside an `<Entity>` with a `<Transform>`.
 *
 * @example
 * ```tsx
 * <Entity id="bullet">
 *   <Transform x={x} y={y} />
 *   <Sprite width={6} height={6} color="#ff0" />
 *   <Trail length={15} color="#ff0" width={2} />
 * </Entity>
 * ```
 */
export function Trail({ length = 20, color = '#ffffff', width = 3 }: TrailProps) {
  const engine   = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(entityId, createTrail({ length, color, width }))
    return () => engine.ecs.removeComponent(entityId, 'Trail')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
