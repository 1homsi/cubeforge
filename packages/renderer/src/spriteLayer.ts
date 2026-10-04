import type { Sampling } from './textureFilter'

export interface SpriteLayerOptions {
  /** Initial capacity; grows automatically. */
  capacity?: number
  /** Image URL for the layer's texture (one texture per layer). */
  src?: string
  /** Or an already loaded image / canvas. */
  image?: SpriteLayerImage
  /** Or a dynamic canvas id from useDynamicCanvas. */
  dynamicSrc?: string
  /** Grid atlas cell size in texture pixels; `frame` indexes cells row-major. */
  frameWidth?: number
  frameHeight?: number
  frameColumns?: number
  /** Render layer name and z-index, sorted together with regular sprites. */
  layer?: string
  zIndex?: number
  sampling?: Sampling
  anchorX?: number
  anchorY?: number
  visible?: boolean
}

export type SpriteLayerImage = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas

export const SPRITE_FLIP_X = 1
export const SPRITE_FLIP_Y = 2
export const SPRITE_HIDDEN = 4

/**
 * Struct-of-arrays sprite batch for data-driven games: thousands of sprites
 * written straight from simulation data, no entity or React node per sprite.
 * Write the arrays directly and call `touch()`, or use `set()`.
 */
export class SpriteLayer {
  count = 0
  capacity = 0
  version = 0
  x!: Float32Array
  y!: Float32Array
  w!: Float32Array
  h!: Float32Array
  rotation!: Float32Array
  frame!: Uint32Array
  /** 0xRRGGBBAA tint multiplied with the texture (or the fill color without one). */
  color!: Uint32Array
  /** Bit flags: SPRITE_FLIP_X | SPRITE_FLIP_Y | SPRITE_HIDDEN. */
  flags!: Uint8Array
  /** Caller ids returned by pick(); defaults to the index at insertion. */
  ids!: Int32Array

  src: string | undefined
  image: SpriteLayerImage | undefined
  dynamicSrc: string | undefined
  frameWidth: number
  frameHeight: number
  frameColumns: number | undefined
  layer: string
  zIndex: number
  sampling: Sampling | undefined
  anchorX: number
  anchorY: number
  visible: boolean

  constructor(options: SpriteLayerOptions = {}) {
    this.src = options.src
    this.image = options.image
    this.dynamicSrc = options.dynamicSrc
    this.frameWidth = options.frameWidth ?? 0
    this.frameHeight = options.frameHeight ?? 0
    this.frameColumns = options.frameColumns
    this.layer = options.layer ?? 'default'
    this.zIndex = options.zIndex ?? 0
    this.sampling = options.sampling
    this.anchorX = options.anchorX ?? 0.5
    this.anchorY = options.anchorY ?? 0.5
    this.visible = options.visible ?? true
    this.grow(Math.max(16, options.capacity ?? 256))
  }

  private grow(capacity: number): void {
    const copy = <T extends Float32Array | Uint32Array | Uint8Array | Int32Array>(
      old: T | undefined,
      make: new (n: number) => T,
    ): T => {
      const next = new make(capacity)
      if (old) next.set(old.subarray(0, this.count))
      return next
    }
    this.x = copy(this.x, Float32Array)
    this.y = copy(this.y, Float32Array)
    this.w = copy(this.w, Float32Array)
    this.h = copy(this.h, Float32Array)
    this.rotation = copy(this.rotation, Float32Array)
    this.frame = copy(this.frame, Uint32Array)
    this.color = copy(this.color, Uint32Array)
    this.flags = copy(this.flags, Uint8Array)
    this.ids = copy(this.ids, Int32Array)
    this.capacity = capacity
  }

  /** Make room for `n` sprites, keeping existing data. */
  reserve(n: number): void {
    if (n > this.capacity) this.grow(Math.max(n, this.capacity * 2))
  }

  /** Set the sprite count (new slots are zeroed, white, visible). */
  resize(n: number): void {
    this.reserve(n)
    for (let i = this.count; i < n; i++) {
      this.rotation[i] = 0
      this.frame[i] = 0
      this.color[i] = 0xffffffff
      this.flags[i] = 0
      this.ids[i] = i
    }
    this.count = n
    this.version++
  }

  add(x: number, y: number, w: number, h: number, frame = 0, id?: number): number {
    const i = this.count
    this.reserve(i + 1)
    this.count = i + 1
    this.x[i] = x
    this.y[i] = y
    this.w[i] = w
    this.h[i] = h
    this.rotation[i] = 0
    this.frame[i] = frame
    this.color[i] = 0xffffffff
    this.flags[i] = 0
    this.ids[i] = id ?? i
    this.version++
    return i
  }

  set(i: number, x: number, y: number, frame?: number): void {
    this.x[i] = x
    this.y[i] = y
    if (frame !== undefined) this.frame[i] = frame
    this.version++
  }

  /** Swap-remove: the last sprite moves into slot `i`. */
  removeAt(i: number): void {
    const last = --this.count
    if (i !== last) {
      this.x[i] = this.x[last]
      this.y[i] = this.y[last]
      this.w[i] = this.w[last]
      this.h[i] = this.h[last]
      this.rotation[i] = this.rotation[last]
      this.frame[i] = this.frame[last]
      this.color[i] = this.color[last]
      this.flags[i] = this.flags[last]
      this.ids[i] = this.ids[last]
    }
    this.version++
  }

  clear(): void {
    this.count = 0
    this.version++
  }

  /** Call after writing the arrays directly so idle-frame skipping redraws. */
  touch(): void {
    this.version++
  }

  /** Topmost sprite index containing the world point (rotation ignored), or -1. */
  pickIndex(wx: number, wy: number): number {
    const ax = this.anchorX
    const ay = this.anchorY
    for (let i = this.count - 1; i >= 0; i--) {
      if (this.flags[i] & SPRITE_HIDDEN) continue
      const w = this.w[i]
      const h = this.h[i]
      const left = this.x[i] - ax * w
      const top = this.y[i] - ay * h
      if (wx >= left && wx < left + w && wy >= top && wy < top + h) return i
    }
    return -1
  }

  /** Id of the topmost sprite at the world point, or -1. */
  pick(wx: number, wy: number): number {
    const i = this.pickIndex(wx, wy)
    return i < 0 ? -1 : this.ids[i]
  }
}
