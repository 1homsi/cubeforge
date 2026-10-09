import { useLayoutEffect, useState } from 'react'
import { SpriteLayer, type SpriteLayerOptions } from '@xip/renderer'
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
 *
 * // GPU sway for trees: flag the sprites, set a wind (no per-frame CPU writes)
 * const trees = useSpriteLayer({ src: '/trees.png', frameWidth: 32, frameHeight: 48, wind: { amplitude: 0.05, speed: 0.4 } })
 * trees.flags[i] |= SPRITE_SWAY
 * ```
 *
 * Mutating through the layer's methods (`set`, `add`, `touch()` ...) wakes an `onDemand` loop.
 * After writing the typed arrays directly call `layer.touch()`; after repainting a canvas used
 * as `image` call `layer.markAtlasDirty()`.
 */
export function useSpriteLayer(options: SpriteLayerOptions = {}): SpriteLayer {
  const engine = useGame()
  const [layer] = useState(() => new SpriteLayer(options))

  useLayoutEffect(() => {
    if (options.atlases) layer.atlases = options.atlases
    else {
      layer.src = options.src
      layer.image = options.image
      layer.dynamicSrc = options.dynamicSrc
      if (options.frameWidth !== undefined) layer.frameWidth = options.frameWidth
      if (options.frameHeight !== undefined) layer.frameHeight = options.frameHeight
      layer.frameColumns = options.frameColumns
    }
    layer.sortByKey = options.sortByKey ?? false
    layer.layer = options.layer ?? 'default'
    layer.zIndex = options.zIndex ?? 0
    layer.sampling = options.sampling
    layer.anchorX = options.anchorX ?? 0.5
    layer.anchorY = options.anchorY ?? 0.5
    layer.visible = options.visible ?? true
    layer.opacity = options.opacity ?? 1
    layer.wind = options.wind ?? null
    layer.tintColor = options.tintColor ?? 0xffffffff
    layer.blend = options.blend ?? 'normal'
    layer.touch()
  }, [
    layer,
    options.atlases,
    options.sortByKey,
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
    options.opacity,
    options.wind?.amplitude,
    options.wind?.speed,
    options.wind?.frequency,
    options.wind === undefined || options.wind === null,
    options.tintColor,
    options.blend,
  ])

  useLayoutEffect(() => {
    const rs = engine.activeRenderSystem as SpriteLayerRenderer
    rs.addSpriteLayer?.(layer)
    // touch(), set(), add() ... wake an onDemand loop; realtime loops ignore the call.
    layer.onChange = () => engine.loop.markDirty()
    engine.loop.markDirty()
    return () => {
      layer.onChange = null
      rs.removeSpriteLayer?.(layer)
    }
  }, [engine, layer])

  // Sway is time-driven: keep an onDemand loop rendering while a wind is set (realtime loops ignore this).
  const windOn = !!options.wind
  useLayoutEffect(() => {
    if (!windOn || typeof requestAnimationFrame === 'undefined') return
    let raf = 0
    const tick = () => {
      engine.loop.markDirty()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [engine, windOn])

  return layer
}
