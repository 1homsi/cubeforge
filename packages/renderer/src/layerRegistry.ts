import type { ECSWorld } from '@cubeforge/core'
import type { TileLayerRenderStats } from './tileLayerGL'
import type { SpriteLayerRenderer } from './spriteLayerGL'

export interface TileRenderer {
  readonly stats: TileLayerRenderStats
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
  contextRestored(): void
  dispose(): void
}

type Factory<T> = (gl: WebGL2RenderingContext) => T

// Layer GL code is registered by the layer data classes, so games that never
// create a tile or sprite layer don't bundle their renderers.
let tileFactory: Factory<TileRenderer> | null = null
let spriteFactory: Factory<SpriteLayerRenderer> | null = null

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
