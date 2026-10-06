import type { Sampling } from './textureFilter'
import { registerSpriteLayerRenderer } from './layerRegistry'
import { SpriteLayerRenderer } from './spriteLayerGL'
import { SPRITE_HIDDEN } from './spriteLayerFlags'

export {
  ATLASES_PER_DRAW,
  MAX_LAYER_ATLASES,
  SPRITE_FLIP_X,
  SPRITE_FLIP_Y,
  SPRITE_HIDDEN,
  SPRITE_UNTEXTURED,
} from './spriteLayerFlags'

export type SpriteLayerImage = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas

/** One frame of an atlas frame table, in texture pixels (origin top-left). */
export interface AtlasFrame {
  x: number
  y: number
  w: number
  h: number
}

/** One texture of a sprite layer, sliced into a uniform grid or an explicit frame table. */
export interface LayerAtlas {
  src?: string
  image?: SpriteLayerImage
  /** A dynamic canvas id from useDynamicCanvas or `engine.createDynamicCanvas`. */
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
  /** Grid only: pixels between cells. Default 0. */
  frameSpacing?: number
  /** Grid only: pixels around the atlas edge before the first cell. Default 0. */
  frameMargin?: number
  /**
   * Explicit frame rects in texture pixels, indexed by the sprite's `frame`
   * (irregular atlases, no repacking). When set it replaces the grid. Sprites whose
   * `frame` is out of range are not drawn. Replace the array (or call
   * `layer.touch()`) after editing it.
   */
  frames?: AtlasFrame[]
  /**
   * Shrink every frame's UV rect by this many texture pixels on each side
   * (grid and frame table) so linear filtering and mipmaps do not bleed in
   * neighbouring cells. Default 0.
   */
  inset?: number
  /** Texture filtering for this atlas; falls back to the layer's `sampling`, then the engine default. */
  sampling?: Sampling
}

export interface SpriteLayerOptions extends LayerAtlas {
  /** Initial capacity; grows automatically. */
  capacity?: number
  /**
   * Several textures (up to {@link MAX_LAYER_ATLASES}); each sprite picks one with
   * `atlas[i]`. Atlases are bound in groups of {@link ATLASES_PER_DRAW}: sprites whose
   * atlases share a group (`atlas >> 3`) draw in one call, a change of group in draw
   * order starts a new one. When omitted, `src`/`image`/`dynamicSrc` + frame
   * size form atlas 0.
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
  /**
   * Draw order key when `sortByKey` is set (lower draws first). Float64: depths
   * 0.0001 apart stay distinct at y = 4000 (a float32 key collapses them).
   */
  sortKey!: Float64Array
  /**
   * Optional secondary key (allocate with {@link enableSortKey2}): sprites with an
   * equal `sortKey` draw in ascending `sortKey2`, then in slot order.
   */
  sortKey2: Float64Array | null = null
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
  private _inOrder = new Uint8Array(0)
  private _orderCount = 0
  /** Sprites in the last {@link drawOrder} (visible ones only when `sortByKey`). */
  orderCount = 0

  constructor(options: SpriteLayerOptions = {}) {
    registerSpriteLayerRenderer((gl) => new SpriteLayerRenderer(gl))
    const { src, image, dynamicSrc, frameWidth, frameHeight, frameColumns, frameSpacing, frameMargin, frames, inset } =
      options
    this.atlases = options.atlases ?? [
      { src, image, dynamicSrc, frameWidth, frameHeight, frameColumns, frameSpacing, frameMargin, frames, inset },
    ]
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
    const copy = <T extends Float32Array | Float64Array | Uint32Array | Uint8Array | Int32Array>(
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
    this.sortKey = copy(this.sortKey, Float64Array)
    if (this.sortKey2) this.sortKey2 = copy(this.sortKey2, Float64Array)
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
    if (this.sortKey2) this.sortKey2[i] = 0
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
      if (this.sortKey2) this.sortKey2[i] = this.sortKey2[last]
      this.ids[i] = this.ids[last]
    }
    this.changed()
  }

  clear(): void {
    this.count = 0
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

  /** Allocate the secondary sort key (zeros). Ties on `sortKey` break on it, then on slot order. */
  enableSortKey2(): Float64Array {
    if (!this.sortKey2) this.sortKey2 = new Float64Array(this.capacity)
    return this.sortKey2
  }

  /**
   * Draw order (indices into the arrays): ascending `sortKey`, then `sortKey2`,
   * then slot, over the first {@link orderCount} entries. With `sortByKey` hidden
   * sprites are left out; without it this is slot order. Updated incrementally from
   * the previous order whatever changed in between (keys drifting, `clear()` + `add()`
   * rebuilds, swap-removes, flag toggles): near-linear when the order is mostly kept,
   * with a fallback to a full sort when it is not.
   */
  drawOrder(): Int32Array {
    const n = this.count
    if (this._order.length < n) {
      const cap = Math.max(n, this._order.length * 2)
      const next = new Int32Array(cap)
      next.set(this._order.subarray(0, this._orderCount))
      this._order = next
      const inOrder = new Uint8Array(cap)
      inOrder.set(this._inOrder)
      this._inOrder = inOrder
    }
    const order = this._order
    if (!this.sortByKey) {
      for (let i = 0; i < n; i++) order[i] = i
      this.orderCount = n
      if (this._orderCount !== 0) {
        this._inOrder.fill(0)
        this._orderCount = 0
      }
      return order
    }
    const inOrder = this._inOrder
    const flags = this.flags
    // Keep the previous order minus sprites that are gone or hidden now ...
    let m = 0
    for (let k = 0; k < this._orderCount; k++) {
      const i = order[k]
      if (i < n && (flags[i] & SPRITE_HIDDEN) === 0) order[m++] = i
      else inOrder[i] = 0
    }
    // ... then append visible sprites that were not in it (new slots, shown again).
    for (let i = 0; i < n; i++) {
      if (inOrder[i] === 0 && (flags[i] & SPRITE_HIDDEN) === 0) {
        order[m++] = i
        inOrder[i] = 1
      }
    }
    this._orderCount = m
    this.orderCount = m
    const K = this.sortKey
    const K2 = this.sortKey2
    // Insertion sort is O(m) for an almost-sorted order; bail out to a full sort if it is not.
    let budget = 8 * m + 256
    for (let i = 1; i < m; i++) {
      const v = order[i]
      const k = K[v]
      let j = i - 1
      while (j >= 0) {
        const a = order[j]
        const ka = K[a]
        if (ka < k || (ka === k && !this.after(a, v, K2))) break
        order[j + 1] = a
        j--
        if (--budget < 0) {
          order[j + 1] = v
          this.fullSort(order, m, K, K2)
          return order
        }
      }
      order[j + 1] = v
    }
    return order
  }

  /** Whether slot `a` sorts after slot `v` when their primary keys are equal. */
  private after(a: number, v: number, K2: Float64Array | null): boolean {
    if (K2 !== null) {
      const x = K2[a]
      const y = K2[v]
      if (x !== y) return x > y
    }
    return a > v
  }

  private fullSort(order: Int32Array, m: number, K: Float64Array, K2: Float64Array | null): void {
    order.subarray(0, m).sort((a, b) => {
      const d = K[a] - K[b]
      if (d !== 0 && d === d) return d
      if (K2 !== null) {
        const e = K2[a] - K2[b]
        if (e !== 0 && e === e) return e
      }
      return a - b
    })
  }

  /** Topmost sprite index containing the world point (rotation ignored), or -1. */
  pickIndex(wx: number, wy: number): number {
    const ax = this.anchorX
    const ay = this.anchorY
    const order = this.sortByKey ? this.drawOrder() : null
    for (let k = (order ? this.orderCount : this.count) - 1; k >= 0; k--) {
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
