import { isTilesetReady, tileHash, tileSourceX, tileSourceY, visibleChunkRange, type TileLayerData } from './tileLayer'

// A full copy of TileLayerCanvasRenderer plus tints, variants and jitter. It is not a subclass on
// purpose: sharing the base class would pull it into the main bundle, and this file loads lazily.

type ChunkCanvas = HTMLCanvasElement | OffscreenCanvas
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

interface ChunkEntry {
  canvas: ChunkCanvas
  ctx: Ctx2D
  version: number
  lutVersion: number
  /** Tint, variant and jitter state the chunk was drawn with. */
  style: string
  image: unknown
  animated: boolean
  usedFrame: number
}

export interface StyledTileLayerCanvasOptions {
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
export class StyledTileLayerCanvasRenderer {
  readonly stats = { chunkRedraws: 0, chunksDrawn: 0 }
  private readonly caches = new WeakMap<TileLayerData, Map<number, ChunkEntry>>()
  private readonly range = new Int32Array(4)
  private readonly maxCached: number
  private readonly createCanvas: (w: number, h: number) => ChunkCanvas
  private frame = 0
  private style = ''
  /** Pre-tinted copies of single tiles, keyed by tile id and multiplier. */
  private readonly tinted = new Map<string, ChunkCanvas>()
  private tintedFor: unknown = null

  constructor(opts: StyledTileLayerCanvasOptions = {}) {
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
    // Nearest keeps pixel art crisp; below ~half a device pixel per texel, smoothing avoids shimmer.
    ctx.imageSmoothingEnabled = Math.abs(m.a) * layer.tileWorldWidth < layer.tileset.tileWidth * 0.5

    this.style = `${layer.tints ? layer.tintVersion : -1}|${layer.variantVersion}|${layer.jitter}`
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
      e = { canvas, ctx, version: -1, lutVersion: -1, style: '', image: null, animated: false, usedFrame: 0 }
      cache.set(c, e)
    }
    const stale =
      e.version !== layer.chunkVersion[c] ||
      e.style !== this.style ||
      e.image !== ts.image ||
      (e.animated && e.lutVersion !== layer.lutVersion)
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
    const tints = layer.tints
    const jitter = layer.jitter
    const vtable = layer.variantTable
    const vsize = layer.variantSize
    ctx.clearRect(0, 0, e.canvas.width, e.canvas.height)
    let animated = false
    for (let y = y0; y < y1; y++) {
      const row = y * layer.width
      for (let x = x0; x < x1; x++) {
        let id = layer.tiles[row + x]
        if (id === 0) continue
        const varied = vtable !== null && id < vsize
        const h = jitter > 0 || varied ? tileHash(x, y) : 0
        if (varied) {
          const head = vtable[id]
          const n = head & 255
          if (n > 0) id = vtable[(head >>> 8) + (h % n)]
        }
        if (!animated && layer.isAnimated(id)) animated = true
        id = layer.resolveTile(id)
        if (id === 0) continue
        const t = id - 1
        const sx = tileSourceX(ts, t)
        const sy = tileSourceY(ts, t)
        const dx = (x - x0) * tw
        const dy = (y - y0) * th
        // Per-tile multiplier: the tint layer's RGB, scaled by hash-driven brightness jitter.
        let kr = 255
        let kg = 255
        let kb = 255
        let alpha = 1
        if (tints) {
          const o = (row + x) * 4
          kr = tints[o]
          kg = tints[o + 1]
          kb = tints[o + 2]
          alpha = tints[o + 3] / 255
        }
        let boost = 0
        if (jitter > 0) {
          // Same variation the GL shader applies, quantised so the tinted-tile cache stays small.
          const f = Math.round((1 + (((h >>> 8) & 255) / 255 - 0.5) * jitter) * 32) / 32
          if (f < 1) {
            kr = Math.round(kr * f)
            kg = Math.round(kg * f)
            kb = Math.round(kb * f)
          } else boost = f - 1
        }
        if (alpha <= 0) continue
        if (kr === 255 && kg === 255 && kb === 255 && boost === 0) {
          if (alpha !== 1) ctx.globalAlpha = alpha
          ctx.drawImage(img, sx, sy, tw, th, dx, dy, tw, th)
          if (alpha !== 1) ctx.globalAlpha = 1
          continue
        }
        const tile = this.tintedTile(img, id, sx, sy, tw, th, kr, kg, kb)
        ctx.globalAlpha = alpha
        ctx.drawImage(tile as CanvasImageSource, 0, 0, tw, th, dx, dy, tw, th)
        if (boost > 0) {
          // dst + tile * boost scales the tinted colour above 1; the canvas clamps it.
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = Math.min(1, boost) * alpha
          ctx.drawImage(tile as CanvasImageSource, 0, 0, tw, th, dx, dy, tw, th)
          ctx.globalCompositeOperation = 'source-over'
        }
        ctx.globalAlpha = 1
      }
    }
    e.version = layer.chunkVersion[c]
    e.lutVersion = layer.lutVersion
    e.style = this.style
    e.image = ts.image
    e.animated = animated
    this.stats.chunkRedraws++
  }

  /** One tile multiplied by (r, g, b) 0..255, alpha preserved. Cached per tile id and colour. */
  private tintedTile(
    img: CanvasImageSource,
    id: number,
    sx: number,
    sy: number,
    tw: number,
    th: number,
    r: number,
    g: number,
    b: number,
  ): ChunkCanvas {
    if (this.tintedFor !== img || this.tinted.size >= 2048) {
      this.tinted.clear()
      this.tintedFor = img
    }
    const key = `${id}|${r}|${g}|${b}`
    let t = this.tinted.get(key)
    if (t) return t
    t = this.createCanvas(tw, th)
    const c = t.getContext('2d') as Ctx2D
    c.drawImage(img, sx, sy, tw, th, 0, 0, tw, th)
    if (r !== 255 || g !== 255 || b !== 255) {
      c.globalCompositeOperation = 'multiply'
      c.fillStyle = `rgb(${r},${g},${b})`
      c.fillRect(0, 0, tw, th)
      // multiply paints over transparent pixels too: restore the tile's own alpha.
      c.globalCompositeOperation = 'destination-in'
      c.drawImage(img, sx, sy, tw, th, 0, 0, tw, th)
      c.globalCompositeOperation = 'source-over'
    }
    this.tinted.set(key, t)
    return t
  }
}
