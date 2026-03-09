import React, { useEffect, useContext } from 'react'
import { Entity } from './Entity'
import { Transform } from './Transform'
import type { ParallaxLayerComponent } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

interface ParallaxLayerInnerProps {
  src: string
  speedX: number
  speedY: number
  repeatX: boolean
  repeatY: boolean
  zIndex: number
  offsetX: number
  offsetY: number
}

function ParallaxLayerInner({
  src,
  speedX,
  speedY,
  repeatX,
  repeatY,
  zIndex,
  offsetX,
  offsetY,
}: ParallaxLayerInnerProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(entityId, {
      type: 'ParallaxLayer' as const,
      src,
      speedX,
      speedY,
      repeatX,
      repeatY,
      zIndex,
      offsetX,
      offsetY,
      imageWidth: 0,
      imageHeight: 0,
    } as ParallaxLayerComponent)

    return () => engine.ecs.removeComponent(entityId, 'ParallaxLayer')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync prop changes
  useEffect(() => {
    const layer = engine.ecs.getComponent<ParallaxLayerComponent>(entityId, 'ParallaxLayer')
    if (!layer) return
    layer.src = src
    layer.speedX = speedX
    layer.speedY = speedY
    layer.repeatX = repeatX
    layer.repeatY = repeatY
    layer.zIndex = zIndex
    layer.offsetX = offsetX
    layer.offsetY = offsetY
  }, [src, speedX, speedY, repeatX, repeatY, zIndex, offsetX, offsetY, engine, entityId])

  return null
}

interface ParallaxLayerProps {
  /** Image URL to use as the background layer */
  src: string
  /** Scroll speed relative to camera (0 = fixed, 1 = moves with camera, 0.3 = slow parallax). Default 0.5 */
  speedX?: number
  /** Vertical scroll speed relative to camera. Default 0 */
  speedY?: number
  /** Tile image horizontally. Default true */
  repeatX?: boolean
  /** Tile image vertically. Default false */
  repeatY?: boolean
  /** Render order — use negative values to render behind sprites. Default -10 */
  zIndex?: number
  /** Manual horizontal offset in pixels. Default 0 */
  offsetX?: number
  /** Manual vertical offset in pixels. Default 0 */
  offsetY?: number
}

/**
 * A background layer that scrolls at a fraction of the camera speed to create depth.
 *
 * @example
 * <ParallaxLayer src="/bg/sky.png" speedX={0.2} repeatX />
 * <ParallaxLayer src="/bg/mountains.png" speedX={0.5} repeatX zIndex={-5} />
 */
export function ParallaxLayer({
  src,
  speedX = 0.5,
  speedY = 0,
  repeatX = true,
  repeatY = false,
  zIndex = -10,
  offsetX = 0,
  offsetY = 0,
}: ParallaxLayerProps): React.ReactElement {
  return (
    <Entity>
      <Transform x={0} y={0} />
      <ParallaxLayerInner
        src={src}
        speedX={speedX}
        speedY={speedY}
        repeatX={repeatX}
        repeatY={repeatY}
        zIndex={zIndex}
        offsetX={offsetX}
        offsetY={offsetY}
      />
    </Entity>
  )
}
