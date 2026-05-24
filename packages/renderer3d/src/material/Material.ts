// Base Material class — all material types extend this

let _materialIdCounter = 0

export type BlendingMode = 'none' | 'normal' | 'additive' | 'multiply'
export type SideMode     = 'front' | 'back' | 'double'

export abstract class Material {
  /** Unique auto-incrementing id */
  readonly id: number

  /** Optional display name */
  name: string

  /** Type tag set by each subclass, used by the renderer for shader selection */
  abstract readonly type: string

  // ── Render state ────────────────────────────────────────────────────────────
  /** Whether this material uses alpha blending */
  transparent = false

  /** Alpha value (only meaningful when transparent = true) */
  opacity = 1

  /** Enable depth testing */
  depthTest = true

  /** Enable depth writing (disable for transparent objects) */
  depthWrite = true

  /** Which face(s) to render */
  side: SideMode = 'front'

  /** Blending equation used when transparent = true */
  blending: BlendingMode = 'normal'

  /** Render geometry as wireframe (lines) */
  wireframe = false

  /** Whether this material and its owner should be rendered at all */
  visible = true

  // ── Change tracking ──────────────────────────────────────────────────────────
  /** Incremented every time needsUpdate is set to true */
  version = 0

  private _needsUpdate = false

  /**
   * Set to true to signal the renderer to re-upload this material's data.
   * Automatically increments `version`.
   */
  set needsUpdate(value: boolean) {
    if (value) this.version++
    this._needsUpdate = value
  }

  get needsUpdate(): boolean {
    return this._needsUpdate
  }

  constructor(name = '') {
    this.id   = _materialIdCounter++
    this.name = name
  }

  /** Release any GPU resources held by this material */
  dispose(): void {
    // Base implementation is a no-op.
    // Subclasses that own textures they created may override.
  }

  /**
   * Shallow-clone this material.
   * Reference-type properties (textures, uniform objects) are shared by default.
   * Subclasses should override and deep-copy as needed.
   */
  clone(): this {
    const copy = Object.create(Object.getPrototypeOf(this)) as this
    Object.assign(copy, this)
    ;(copy as { id: number }).id = _materialIdCounter++
    copy.version      = 0
    copy._needsUpdate = false
    return copy
  }
}
