import type { Sampling } from './textureFilter'
import { registerSpriteLayerRenderer } from './layerRegistry'
import { SpriteLayerRenderer } from './spriteLayerGL'
import { SPRITE_HIDDEN } from './spriteLayerFlags'

export { MAX_LAYER_ATLASES, SPRITE_FLIP_X, SPRITE_FLIP_Y, SPRITE_HIDDEN, SPRITE_UNTEXTURED } from './spriteLayerFlags'

export type SpriteLayerImage = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas

/** One texture of a sprite layer, sliced into a grid of frames. */
export interface LayerAtlas {
  src?: string
  image?: SpriteLayerImage
  /** A dynamic canvas id from useDynamicCanvas. */
  dynamicSrc?: string
  /** Grid cell size in texture pixels; `frame` indexes cells row-major. Omit for one whole-texture frame. */
  frameWidth?: number
  frameHeight?: number
  frameColumns?: number
  /**
   * Bumped by {@link SpriteLayer.markAtlasDirty}: when it changes, an `image` that is a canvas
   * (or any mutable source) is uploaded to the GPU again. Ignored for `src` and `dynamicSrc`.
   */
  imageVersion?: number
}

export interface SpriteLayerOptions extends LayerAtlas {
  /** Initial capacity; grows automatically. */
  capacity?: number
  /**
   * Several textures drawn in one batch (up to 8); each sprite picks one with
   * `atlas[i]`. When omitted, `src`/`image`/`dynamicSrc` + frame size form atlas 0.
   */
  atlases?: LayerAtlas[]
  /** Draw (and pick) in ascending `sortKey[i]` order, e.g. y for depth. Default: insertion order. */
  sortByKey?: boolean
  /** Render layer name and z-index, sorted together with regular sprites. */
  layer?: string
  zIndex?: number
  sampling?: Sampling
  anchorX?: number
  anchorY?: number
  visible?: boolean
}

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
  /** Index into `atlases` per sprite. */
  atlas!: Uint8Array
  /** 0xRRGGBBAA tint multiplied with the texture (or the fill color without one). */
  color!: Uint32Array
  /** Bit flags: SPRITE_FLIP_X | SPRITE_FLIP_Y | SPRITE_HIDDEN | SPRITE_UNTEXTURED. */
  flags!: Uint8Array
  /** Draw order key when `sortByKey` is set (lower draws first). */
  sortKey!: Float32Array
  /** Caller ids returned by pick(); defaults to the index at insertion. */
  ids!: Int32Array

  atlases: LayerAtlas[]
  sortByKey: boolean
  layer: string
  zIndex: number
  sampling: Sampling | undefined
  anchorX: number
  anchorY: number
  visible: boolean

  /**
   * Called after any mutation through the layer's methods and `touch()`. The React hook uses it
   * to wake an `onDemand` loop. Direct typed-array writes are not seen: call `touch()` after them.
   */
  onChange: (() => void) | null = null

  private _order = new Int32Array(0)
  private _orderCount = -1
  private _structure = 0
  private _orderStructure = -1

  constructor(options: SpriteLayerOptions = {}) {
    registerSpriteLayerRenderer((gl) => new SpriteLayerRenderer(gl))
    const { src, image, dynamicSrc, frameWidth, frameHeight, frameColumns } = options
    this.atlases = options.atlases ?? [{ src, image, dynamicSrc, frameWidth, frameHeight, frameColumns }]
    this.sortByKey = options.sortByKey ?? false
    this.layer = options.layer ?? 'default'
    this.zIndex = options.zIndex ?? 0
    this.sampling = options.sampling
    this.anchorX = options.anchorX ?? 0.5
    this.anchorY = options.anchorY ?? 0.5
    this.visible = options.visible ?? true
    this.grow(Math.max(16, options.capacity ?? 256))
  }

  /** Atlas 0's url (single-atlas shorthand). */
  get src(): string | undefined {
    return this.atlases[0]?.src
  }
  set src(v: string | undefined) {
    this.atlas0().src = v
    this.touch()
  }
  get image(): SpriteLayerImage | undefined {
    return this.atlases[0]?.image
  }
  set image(v: SpriteLayerImage | undefined) {
    this.atlas0().image = v
    this.touch()
  }
  get dynamicSrc(): string | undefined {
    return this.atlases[0]?.dynamicSrc
  }
  set dynamicSrc(v: string | undefined) {
    this.atlas0().dynamicSrc = v
    this.touch()
  }
  get frameWidth(): number {
    return this.atlases[0]?.frameWidth ?? 0
  }
  set frameWidth(v: number) {
    this.atlas0().frameWidth = v
    this.touch()
  }
  get frameHeight(): number {
    return this.atlases[0]?.frameHeight ?? 0
  }
  set frameHeight(v: number) {
    this.atlas0().frameHeight = v
    this.touch()
  }
  get frameColumns(): number | undefined {
    return this.atlases[0]?.frameColumns
  }
  set frameColumns(v: number | undefined) {
    this.atlas0().frameColumns = v
    this.touch()
  }

  private atlas0(): LayerAtlas {
    if (this.atlases.length === 0) this.atlases.push({})
    return this.atlases[0]
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
    this.atlas = copy(this.atlas, Uint8Array)
    this.color = copy(this.color, Uint32Array)
    this.flags = copy(this.flags, Uint8Array)
    this.sortKey = copy(this.sortKey, Float32Array)
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
    for (let i = this.count; i < n; i++) this.reset(i, i)
    if (n !== this.count) this._structure++
    this.count = n
    this.changed()
  }

  private reset(i: number, id: number): void {
    this.rotation[i] = 0
    this.frame[i] = 0
    this.atlas[i] = 0
    this.color[i] = 0xffffffff
    this.flags[i] = 0
    this.sortKey[i] = 0
    this.ids[i] = id
  }

  add(x: number, y: number, w: number, h: number, frame = 0, id?: number): number {
    const i = this.count
    this.reserve(i + 1)
    this.count = i + 1
    this.reset(i, id ?? i)
    this.x[i] = x
    this.y[i] = y
    this.w[i] = w
    this.h[i] = h
    this.frame[i] = frame
    this._structure++
    this.changed()
    return i
  }

  set(i: number, x: number, y: number, frame?: number): void {
    this.x[i] = x
    this.y[i] = y
    if (frame !== undefined) this.frame[i] = frame
    this.changed()
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
      this.atlas[i] = this.atlas[last]
      this.color[i] = this.color[last]
      this.flags[i] = this.flags[last]
      this.sortKey[i] = this.sortKey[last]
      this.ids[i] = this.ids[last]
    }
    this._structure++
    this.changed()
  }

  clear(): void {
    this.count = 0
    this._structure++
    this.changed()
  }

  /** Call after writing the arrays directly so idle-frame skipping redraws. */
  touch(): void {
    this.changed()
  }

  /**
   * Re-upload atlas `i`'s `image` on the next frame. Call it after repainting a canvas that is
   * used as `image`; sources that never change need no call.
   */
  markAtlasDirty(i = 0): void {
    const a = this.atlases[i]
    if (!a) return
    a.imageVersion = (a.imageVersion ?? 0) + 1
    this.changed()
  }

  private changed(): void {
    this.version++
    this.onChange?.()
  }

  /**
   * Draw order (indices into the arrays), ascending `sortKey` when `sortByKey`
   * is set. Updated incrementally: keys that drift a little between frames
   * cost a near-linear insertion sort.
   */
  drawOrder(): Int32Array {
    const n = this.count
    if (this._order.length < n) this._order = new Int32Array(Math.max(n, this._order.length * 2))
    const order = this._order
    if (this._orderCount !== n || this._orderStructure !== this._structure || !this.sortByKey) {
      for (let i = 0; i < n; i++) order[i] = i
      this._orderCount = n
      this._orderStructure = this._structure
      if (this.sortByKey) {
        const K = this.sortKey
        order.subarray(0, n).sort((a, b) => K[a] - K[b] || a - b)
      }
      return order
    }
    const K = this.sortKey
    for (let i = 1; i < n; i++) {
      const v = order[i]
      const k = K[v]
      let j = i - 1
      while (j >= 0 && (K[order[j]] > k || (K[order[j]] === k && order[j] > v))) {
        order[j + 1] = order[j]
        j--
      }
      order[j + 1] = v
    }
    return order
  }

  /** Topmost sprite index containing the world point (rotation ignored), or -1. */
  pickIndex(wx: number, wy: number): number {
    const ax = this.anchorX
    const ay = this.anchorY
    const order = this.sortByKey ? this.drawOrder() : null
    for (let k = this.count - 1; k >= 0; k--) {
      const i = order ? order[k] : k
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
