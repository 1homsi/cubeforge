import { isTilesetReady, tileSourceX, tileSourceY, visibleChunkRange, type TileLayerData } from './tileLayer'

type ChunkCanvas = HTMLCanvasElement | OffscreenCanvas
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

interface ChunkEntry {
  canvas: ChunkCanvas
  ctx: Ctx2D
  version: number
  lutVersion: number
  animated: boolean
  usedFrame: number
}

export interface TileLayerCanvasOptions {
  /** Chunk canvases kept beyond the visible set. Default 64. */
  maxCachedChunks?: number
  createCanvas?: (w: number, h: number) => ChunkCanvas
}

function defaultCreateCanvas(w: number, h: number): ChunkCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/**
 * Canvas2D fallback for {@link TileLayerData}: each chunk is rasterised once into a
 * cached canvas and redrawn only when its tiles (or a visible animation frame) change.
 */
export class TileLayerCanvasRenderer {
  readonly stats = { chunkRedraws: 0, chunksDrawn: 0 }
  private readonly caches = new WeakMap<TileLayerData, Map<number, ChunkEntry>>()
  private readonly range = new Int32Array(4)
  private readonly maxCached: number
  private readonly createCanvas: (w: number, h: number) => ChunkCanvas
  private frame = 0

  constructor(opts: TileLayerCanvasOptions = {}) {
    this.maxCached = opts.maxCachedChunks ?? 64
    this.createCanvas = opts.createCanvas ?? defaultCreateCanvas
  }

  /**
   * Draw the chunks of `layer` that overlap the world rect. `ctx`'s current
   * transform must map world units to device pixels (scale + translate only).
   * Chunk edges are snapped to whole device pixels so neighbours never seam.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    layer: TileLayerData,
    viewL: number,
    viewT: number,
    viewR: number,
    viewB: number,
    time?: number,
  ): void {
    this.stats.chunkRedraws = 0
    this.stats.chunksDrawn = 0
    this.frame++
    if (!layer.visible || layer.opacity <= 0 || !isTilesetReady(layer.tileset)) return
    if (time !== undefined) layer.updateAnimations(time)
    const r = this.range
    if (!visibleChunkRange(layer, viewL, viewT, viewR, viewB, r)) return

    let cache = this.caches.get(layer)
    if (!cache) {
      cache = new Map()
      this.caches.set(layer, cache)
    }
    const m = ctx.getTransform()
    const prevAlpha = ctx.globalAlpha
    const prevSmoothing = ctx.imageSmoothingEnabled
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = prevAlpha * layer.opacity
    ctx.imageSmoothingEnabled = false

    const cs = layer.chunkSize
    const cw = cs * layer.tileWorldWidth
    const ch = cs * layer.tileWorldHeight
    for (let cy = r[1]; cy < r[3]; cy++) {
      for (let cx = r[0]; cx < r[2]; cx++) {
        const c = cy * layer.chunksX + cx
        const e = this.ensureChunk(layer, cache, c, cx, cy)
        e.usedFrame = this.frame
        const tilesW = Math.min(cs, layer.width - cx * cs)
        const tilesH = Math.min(cs, layer.height - cy * cs)
        const wx0 = layer.x + cx * cw
        const wy0 = layer.y + cy * ch
        const dx0 = Math.round(m.a * wx0 + m.e)
        const dy0 = Math.round(m.d * wy0 + m.f)
        const dx1 = Math.round(m.a * (wx0 + tilesW * layer.tileWorldWidth) + m.e)
        const dy1 = Math.round(m.d * (wy0 + tilesH * layer.tileWorldHeight) + m.f)
        ctx.drawImage(e.canvas, dx0, dy0, dx1 - dx0, dy1 - dy0)
        this.stats.chunksDrawn++
      }
    }

    ctx.setTransform(m)
    ctx.globalAlpha = prevAlpha
    ctx.imageSmoothingEnabled = prevSmoothing

    if (cache.size > this.maxCached + this.stats.chunksDrawn) {
      for (const [k, e] of cache) if (e.usedFrame !== this.frame) cache.delete(k)
    }
  }

  /** Drop cached chunk canvases for a layer (e.g. on unmount). */
  release(layer: TileLayerData): void {
    this.caches.delete(layer)
  }

  private ensureChunk(
    layer: TileLayerData,
    cache: Map<number, ChunkEntry>,
    c: number,
    cx: number,
    cy: number,
  ): ChunkEntry {
    let e = cache.get(c)
    const ts = layer.tileset
    if (!e) {
      const cs = layer.chunkSize
      const w = Math.min(cs, layer.width - cx * cs) * ts.tileWidth
      const h = Math.min(cs, layer.height - cy * cs) * ts.tileHeight
      const canvas = this.createCanvas(w, h)
      const ctx = canvas.getContext('2d') as Ctx2D
      e = { canvas, ctx, version: -1, lutVersion: -1, animated: false, usedFrame: 0 }
      cache.set(c, e)
    }
    const stale = e.version !== layer.chunkVersion[c] || (e.animated && e.lutVersion !== layer.lutVersion)
    if (stale) this.redrawChunk(layer, e, c, cx, cy)
    return e
  }

  private redrawChunk(layer: TileLayerData, e: ChunkEntry, c: number, cx: number, cy: number): void {
    const ts = layer.tileset
    const img = ts.image as CanvasImageSource
    const cs = layer.chunkSize
    const tw = ts.tileWidth
    const th = ts.tileHeight
    const x0 = cx * cs
    const y0 = cy * cs
    const x1 = Math.min(layer.width, x0 + cs)
    const y1 = Math.min(layer.height, y0 + cs)
    const ctx = e.ctx
    ctx.clearRect(0, 0, e.canvas.width, e.canvas.height)
    let animated = false
    for (let y = y0; y < y1; y++) {
      const row = y * layer.width
      for (let x = x0; x < x1; x++) {
        const raw = layer.tiles[row + x]
        if (raw === 0) continue
        if (!animated && layer.isAnimated(raw)) animated = true
        const id = layer.resolveTile(raw)
        if (id === 0) continue
        const t = id - 1
        ctx.drawImage(img, tileSourceX(ts, t), tileSourceY(ts, t), tw, th, (x - x0) * tw, (y - y0) * th, tw, th)
      }
    }
    e.version = layer.chunkVersion[c]
    e.lutVersion = layer.lutVersion
    e.animated = animated
    this.stats.chunkRedraws++
  }
}
