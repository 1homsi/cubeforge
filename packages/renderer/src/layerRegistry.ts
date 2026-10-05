import type { ECSWorld } from '@cubeforge/core'
import type { TileLayerRenderStats } from './tileLayerGL'
import type { SpriteLayerRenderer } from './spriteLayerGL'
import type { TileLayerData } from './tileLayer'
import type { TextLayerRenderer } from './textLayerGL'

export interface TileRenderer {
  readonly stats: TileLayerRenderStats
  /** Layers with a `renderLayer`, drawn interleaved with sprites through {@link drawSorted}. */
  readonly sorted: readonly TileLayerData[]
  prepare(world: ECSWorld, dt: number): boolean
  render(
    camX: number,
    camY: number,
    zoom: number,
    w: number,
    h: number,
    shakeX: number,
    shakeY: number,
    dpr?: number,
  ): void
  /** Draw one of {@link sorted} using the camera of the last `render()`. */
  drawSorted(layer: TileLayerData): void
  contextRestored(): void
  dispose(): void
}

type Factory<T> = (gl: WebGL2RenderingContext) => T

// Layer GL code is registered by the layer data classes, so games that never
// create a tile or sprite layer don't bundle their renderers.
let tileFactory: Factory<TileRenderer> | null = null
let spriteFactory: Factory<SpriteLayerRenderer> | null = null
let textFactory: Factory<TextLayerRenderer> | null = null

export function registerTileRenderer(f: Factory<TileRenderer>): void {
  tileFactory ??= f
}
export function registerSpriteLayerRenderer(f: Factory<SpriteLayerRenderer>): void {
  spriteFactory ??= f
}
export function tileRendererFactory(): Factory<TileRenderer> | null {
  return tileFactory
}
export function spriteLayerRendererFactory(): Factory<SpriteLayerRenderer> | null {
  return spriteFactory
}

export function registerTextLayerRenderer(f: Factory<TextLayerRenderer>): void {
  textFactory ??= f
}
export function textLayerRendererFactory(): Factory<TextLayerRenderer> | null {
  return textFactory
}
