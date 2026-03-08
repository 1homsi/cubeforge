import { useEffect, useContext } from 'react'
import { createNineSlice } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

interface NineSliceProps {
  /** Image source URL */
  src: string
  /** Rendered width in pixels */
  width: number
  /** Rendered height in pixels */
  height: number
  /** Top border inset in source pixels (default 8) */
  borderTop?: number
  /** Right border inset in source pixels (default 8) */
  borderRight?: number
  /** Bottom border inset in source pixels (default 8) */
  borderBottom?: number
  /** Left border inset in source pixels (default 8) */
  borderLeft?: number
  /** Draw order (default 0) */
  zIndex?: number
}

/**
 * Renders a 9-slice sprite that scales while preserving its border regions.
 *
 * Must be used inside an `<Entity>` with a `<Transform>`.
 *
 * @example
 * ```tsx
 * <Entity id="panel">
 *   <Transform x={200} y={150} />
 *   <NineSlice
 *     src="/ui/panel.png"
 *     width={300}
 *     height={200}
 *     borderTop={12}
 *     borderRight={12}
 *     borderBottom={12}
 *     borderLeft={12}
 *   />
 * </Entity>
 * ```
 */
export function NineSlice({
  src,
  width,
  height,
  borderTop = 8,
  borderRight = 8,
  borderBottom = 8,
  borderLeft = 8,
  zIndex = 0,
}: NineSliceProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(
      entityId,
      createNineSlice(src, width, height, {
        borderTop,
        borderRight,
        borderBottom,
        borderLeft,
        zIndex,
      }),
    )
    return () => engine.ecs.removeComponent(entityId, 'NineSlice')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
