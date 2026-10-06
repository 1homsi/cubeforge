// Multiply-tinted copies of image regions for the Canvas2D renderer. A GPU
// multiplies every sprite by its colour for free; Canvas2D has no such blend,
// so each distinct (source region, colour) gets one cached tinted canvas.

type TintCanvas = HTMLCanvasElement | OffscreenCanvas
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export interface TintCacheOptions {
  /** Total pixels held by cached canvases before the oldest are dropped. Default 4M (16 MB). */
  maxPixels?: number
  /** Cached entries before the oldest are dropped. Default 1024. */
  maxEntries?: number
  createCanvas?: (w: number, h: number) => TintCanvas
}

function defaultCreateCanvas(w: number, h: number): TintCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** LRU cache of `source * (r, g, b)` canvases (alpha preserved). */
export class TintCache {
  private readonly map = new Map<string, TintCanvas>()
  private readonly ids = new WeakMap<object, number>()
  private nextId = 1
  private pixels = 0
  private readonly maxPixels: number
  private readonly maxEntries: number
  private readonly createCanvas: (w: number, h: number) => TintCanvas

  constructor(opts: TintCacheOptions = {}) {
    this.maxPixels = opts.maxPixels ?? 4_000_000
    this.maxEntries = opts.maxEntries ?? 1024
    this.createCanvas = opts.createCanvas ?? defaultCreateCanvas
  }

  get size(): number {
    return this.map.size
  }

  /** The `sw` x `sh` region of `src` at (`sx`, `sy`), multiplied by r, g, b in 0..255. */
  get(
    src: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    r: number,
    g: number,
    b: number,
  ): TintCanvas {
    let id = this.ids.get(src as object)
    if (id === undefined) {
      id = this.nextId++
      this.ids.set(src as object, id)
    }
    const key = `${id}|${sx}|${sy}|${sw}|${sh}|${r}|${g}|${b}`
    const hit = this.map.get(key)
    if (hit) {
      // Re-insert so Map order stays recency order.
      this.map.delete(key)
      this.map.set(key, hit)
      return hit
    }
    const w = Math.max(1, Math.ceil(sw))
    const h = Math.max(1, Math.ceil(sh))
    const canvas = this.createCanvas(w, h)
    const ctx = canvas.getContext('2d') as Ctx
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h)
    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, 0, w, h)
    // multiply also paints transparent pixels: put the source's own alpha back.
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'
    this.map.set(key, canvas)
    this.pixels += w * h
    while ((this.pixels > this.maxPixels || this.map.size > this.maxEntries) && this.map.size > 1) {
      const [oldKey, old] = this.map.entries().next().value as [string, TintCanvas]
      this.map.delete(oldKey)
      this.pixels -= old.width * old.height
    }
    return canvas
  }

  clear(): void {
    this.map.clear()
    this.pixels = 0
  }
}
