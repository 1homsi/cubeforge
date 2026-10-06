import { useLayoutEffect, useState } from 'react'
import { TextLayer, type TextLayerOptions } from '@cubeforge/renderer'
import { useGame } from './useGame'

type TextLayerRenderer = {
  addTextLayer?: (layer: TextLayer) => void
  removeTextLayer?: (layer: TextLayer) => void
}

/**
 * Many labels in one draw call: a data-driven text batch with a shared glyph
 * atlas. Mutate it from your simulation code; it sorts with sprites by
 * `layer` + `zIndex`.
 *
 * @example
 * ```tsx
 * const names = useTextLayer({ fontFamily: 'sans-serif', fontSize: 12, outlineColor: '#000', outlineWidth: 3, zIndex: 20 })
 * // in your tick:
 * names.clear()
 * for (const p of people) names.add(p.name, p.x, p.y - 12, { color: 0xffffffff })
 * ```
 */
export function useTextLayer(options: TextLayerOptions = {}): TextLayer {
  const engine = useGame()
  const [layer] = useState(() => new TextLayer(options))

  useLayoutEffect(() => {
    layer.layer = options.layer ?? 'default'
    layer.zIndex = options.zIndex ?? 0
    layer.visible = options.visible ?? true
    layer.opacity = options.opacity ?? 1
    layer.tintColor = options.tintColor ?? 0xffffffff
    layer.blend = options.blend ?? 'normal'
    layer.touch()
  }, [layer, options.layer, options.zIndex, options.visible, options.opacity, options.tintColor, options.blend])

  useLayoutEffect(() => {
    const rs = engine.activeRenderSystem as TextLayerRenderer
    rs.addTextLayer?.(layer)
    engine.loop.markDirty()
    return () => rs.removeTextLayer?.(layer)
  }, [engine, layer])

  return layer
}
