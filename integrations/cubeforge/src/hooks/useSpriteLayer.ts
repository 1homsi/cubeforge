import { useLayoutEffect, useState } from 'react'
import { SpriteLayer, type SpriteLayerOptions } from '@cubeforge/renderer'
import { useGame } from './useGame'

type SpriteLayerRenderer = {
  addSpriteLayer?: (layer: SpriteLayer) => void
  removeSpriteLayer?: (layer: SpriteLayer) => void
}

/**
 * A data-driven sprite batch: thousands of sprites from typed arrays with no
 * entity or React node per sprite. Mutate it from simulation code each frame.
 *
 * @example
 * ```tsx
 * const people = useSpriteLayer({ src: '/people.png', frameWidth: 16, frameHeight: 16, zIndex: 5 })
 * // in your simulation tick:
 * people.resize(sim.count)
 * for (let i = 0; i < sim.count; i++) people.set(i, sim.x[i], sim.y[i], sim.frame[i])
 * const hovered = people.pick(worldX, worldY)
 * ```
 */
export function useSpriteLayer(options: SpriteLayerOptions = {}): SpriteLayer {
  const engine = useGame()
  const [layer] = useState(() => new SpriteLayer(options))

  useLayoutEffect(() => {
    layer.src = options.src
    layer.image = options.image
    layer.dynamicSrc = options.dynamicSrc
    if (options.frameWidth !== undefined) layer.frameWidth = options.frameWidth
    if (options.frameHeight !== undefined) layer.frameHeight = options.frameHeight
    layer.frameColumns = options.frameColumns
    layer.layer = options.layer ?? 'default'
    layer.zIndex = options.zIndex ?? 0
    layer.sampling = options.sampling
    layer.anchorX = options.anchorX ?? 0.5
    layer.anchorY = options.anchorY ?? 0.5
    layer.visible = options.visible ?? true
    layer.touch()
  }, [
    layer,
    options.src,
    options.image,
    options.dynamicSrc,
    options.frameWidth,
    options.frameHeight,
    options.frameColumns,
    options.layer,
    options.zIndex,
    options.sampling,
    options.anchorX,
    options.anchorY,
    options.visible,
  ])

  useLayoutEffect(() => {
    const rs = engine.activeRenderSystem as SpriteLayerRenderer
    rs.addSpriteLayer?.(layer)
    engine.loop.markDirty()
    return () => rs.removeSpriteLayer?.(layer)
  }, [engine, layer])

  return layer
}
