/**
 * Render layer groups — allows sprites to be grouped into named layers
 * with configurable draw order.
 *
 * Sprites are sorted by layer order first, then by zIndex within the same layer.
 */

export interface RenderLayer {
  name: string
  /** Lower values are drawn first (behind). */
  order: number
}

export const defaultLayers: RenderLayer[] = [
  { name: 'background', order: -100 },
  { name: 'default', order: 0 },
  { name: 'foreground', order: 100 },
  { name: 'ui', order: 200 },
]

export interface RenderLayerManager {
  /** Register a new layer (or update an existing one). */
  addLayer(name: string, order: number): void
  /** Get the numeric order for a layer name. Returns 0 if unknown. */
  getOrder(name: string): number
}

export function createRenderLayerManager(
  layers: RenderLayer[] = defaultLayers,
): RenderLayerManager {
  const map = new Map<string, number>()
  for (const l of layers) map.set(l.name, l.order)

  return {
    addLayer(name: string, order: number): void {
      map.set(name, order)
    },
    getOrder(name: string): number {
      return map.get(name) ?? 0
    },
  }
}
