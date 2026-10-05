import { useContext, useEffect, useMemo, useRef } from 'react'
import {
  TileLayerData,
  createTileLayerComponent,
  type TileAnimation,
  type TileLayerOptions,
  type Tileset,
} from '@cubeforge/renderer'
import { EngineContext } from '../context'

/**
 * Create a stable {@link TileLayerData} for `<TileLayer layer={...} />`.
 * Mutate it imperatively (`setTile`, `setTiles`) from simulation code; no React
 * re-render is involved. A new layer is created only if the size, id width or
 * chunk size change. `tileset`, `animations` and `variants` are synced by identity.
 */
export function useTileLayer(options: TileLayerOptions): TileLayerData {
  const { width, height, wideIds, chunkSize, tileset, animations, variants, jitter } = options
  const optsRef = useRef(options)
  optsRef.current = options
  const layer = useMemo(
    () => new TileLayerData(optsRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height, wideIds, chunkSize],
  )
  const syncedTileset = useRef<Tileset>(tileset)
  const syncedAnims = useRef<Record<number, TileAnimation> | undefined>(animations)
  if (syncedTileset.current !== tileset) {
    syncedTileset.current = tileset
    layer.tileset = tileset
  }
  if (syncedAnims.current !== animations) {
    syncedAnims.current = animations
    layer.setAnimations(animations ?? {})
  }
  const syncedVariants = useRef(variants)
  if (syncedVariants.current !== variants) {
    syncedVariants.current = variants
    layer.setVariants(variants ?? {})
  }
  layer.jitter = jitter ?? 0
  layer.minFilter = options.minFilter ?? 'nearest'
  layer.farZoomPx = options.farZoomPx ?? 2
  return layer
}

export interface TileLayerProps {
  layer: TileLayerData
  x?: number
  y?: number
  /** Draw order among tile layers; with `renderLayer`, the shared sprite z-order. */
  zIndex?: number
  /**
   * Take part in the shared draw order with sprites and sprite layers: the render
   * layer name (same names as `<Sprite layer>`), sorted by (layer order, zIndex).
   * Omit to draw beneath all sprites (the default).
   */
  renderLayer?: string
  opacity?: number
  visible?: boolean
}

/** Mounts a {@link TileLayerData} into the world. Renders one quad per visible page, never one entity per tile. */
export function TileLayer({ layer, x, y, zIndex, renderLayer, opacity, visible }: TileLayerProps): null {
  const engine = useContext(EngineContext)!

  useEffect(() => {
    const eid = engine.ecs.createEntity()
    engine.ecs.addComponent(eid, createTileLayerComponent(layer))
    layer.onChange = () => engine.loop.markDirty()
    engine.loop.markDirty()
    return () => {
      layer.onChange = null
      if (engine.ecs.hasEntity(eid)) engine.ecs.destroyEntity(eid)
    }
  }, [engine, layer])

  const src = layer.tileset.src
  const hasImage = !!layer.tileset.image
  useEffect(() => {
    if (!src || hasImage) return
    let cancelled = false
    engine.assets
      .loadImage(src)
      .then((img) => {
        if (cancelled || layer.tileset.src !== src) return
        layer.tileset.image = img
        layer.revision++
        engine.loop.markDirty()
      })
      .catch((error: unknown) => engine.events.emit('asset:error', { type: 'tileset', src, error }))
    return () => {
      cancelled = true
    }
  }, [engine, layer, src, hasImage])

  useEffect(() => {
    if (x !== undefined) layer.x = x
    if (y !== undefined) layer.y = y
    if (zIndex !== undefined) layer.zIndex = zIndex
    if (renderLayer !== undefined) layer.renderLayer = renderLayer
    if (opacity !== undefined) layer.opacity = opacity
    if (visible !== undefined) layer.visible = visible
    engine.loop.markDirty()
  }, [engine, layer, x, y, zIndex, renderLayer, opacity, visible])

  return null
}
