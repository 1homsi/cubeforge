/**
 * Imperative dynamic canvases: create, resize and free CPU-painted textures by
 * id at runtime (texture atlases that grow, per-biome overlays, ...). The React
 * hook `useDynamicCanvas(w, h)` stays the right tool for a fixed canvas owned by
 * one component; this is the same texture path without React.
 */

export type DynamicCanvasSource = HTMLCanvasElement | OffscreenCanvas

export interface DynamicCanvasOptions {
  /** Texture id for `dynamicSrc`. Default: a unique `__dynamic__:` id. Must not be registered already. */
  id?: string
  width: number
  height: number
  /** Paint on your own canvas instead of a new one (its size is taken as is). */
  canvas?: DynamicCanvasSource
  /**
   * Free the 2D canvas' pixel memory (set it to 0 x 0) right after its first upload, so a
   * write-once atlas lives only on the GPU instead of twice (a 4800 x 2400 canvas is 46 MB of CPU
   * backing). Paint, `markDirty()`, and the canvas is released after the upload. To change the
   * pixels later call `acquireBacking()`, repaint everything you need and `markDirty()` again
   * (the old pixels are not kept). Default false.
   */
  releaseAfterUpload?: boolean
  /**
   * Called after a lost WebGL context was restored while the backing is released, so the app can
   * `acquireBacking()`, repaint and `markDirty()`. Without it the texture is blank after a restore.
   */
  onRestore?: () => void
  /** Called after create / resize / dispose / markDirty (the engine wires it to wake an on-demand loop). */
  onChange?: () => void
}

export interface ResizeDynamicCanvasOptions {
  /** Keep the current pixels, anchored top-left and unscaled. Default true. */
  preserve?: boolean
}

/** What a dynamic canvas needs from the render system. */
export interface DynamicCanvasHost {
  hasDynamicCanvas(id: string): boolean
  registerDynamicCanvas(id: string, canvas: DynamicCanvasSource): void
  markDynamicCanvasDirty(id: string, x?: number, y?: number, w?: number, h?: number): void
  unregisterDynamicCanvas(id: string): void
  /** Optional: enable releasing the CPU backing after each upload. */
  setDynamicCanvasRelease?(id: string, release: boolean, onRestore?: () => void): void
}

/** Same shape the `useDynamicCanvas` hook returns (id, canvas, ctx, markDirty). */
export interface DynamicCanvasHandleBase {
  /** Unique ID: pass to `<Sprite dynamicSrc>` or a SpriteLayer atlas `dynamicSrc`. */
  readonly id: string
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  /** Schedule a GPU upload before the next frame; pass the changed rect to upload only that region. */
  markDirty(x?: number, y?: number, width?: number, height?: number): void
}

/** A handle created at runtime: the hook's handle plus size and lifetime control. */
export interface ManagedDynamicCanvas extends DynamicCanvasHandleBase {
  readonly width: number
  readonly height: number
  readonly disposed: boolean
  /**
   * Change the size in place (the `canvas` and `ctx` objects stay the same).
   * The GPU texture is re-created at the new size on the next frame, so texture
   * dimensions and atlas UVs follow. Existing pixels are kept top-left unless
   * `preserve: false`. Free of charge when the size is unchanged.
   */
  resize(width: number, height: number, options?: ResizeDynamicCanvasOptions): void
  /**
   * Give the canvas its pixel memory back at the texture's size (blank), to repaint a canvas
   * created with `releaseAfterUpload`. Call `markDirty()` after painting.
   */
  acquireBacking(): void
  /** True while the canvas' pixel memory is released (it is 0 x 0). */
  readonly backingReleased: boolean
  /** Free the GPU texture and forget the id. Safe to call twice. */
  dispose(): void
}

let counter = 0

export function createDynamicCanvasHandle(host: DynamicCanvasHost, opts: DynamicCanvasOptions): ManagedDynamicCanvas {
  const { width, height } = opts
  if (!opts.canvas && !(width > 0 && height > 0)) {
    throw new Error('[DynamicCanvas] width and height must be positive')
  }
  const id = opts.id ?? `__dynamic__:${(++counter).toString(36)}:${Math.random().toString(36).slice(2, 8)}`
  if (host.hasDynamicCanvas(id)) throw new Error(`[DynamicCanvas] id "${id}" is already registered`)
  let canvas = opts.canvas as HTMLCanvasElement | undefined
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
  }
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const notify = opts.onChange
  let disposed = false
  host.registerDynamicCanvas(id, canvas)
  if (opts.releaseAfterUpload) host.setDynamicCanvasRelease?.(id, true, opts.onRestore)
  else if (opts.onRestore) host.setDynamicCanvasRelease?.(id, false, opts.onRestore)
  let texW = canvas.width
  let texH = canvas.height
  notify?.()
  const c = canvas
  return {
    id,
    canvas: c,
    ctx,
    get width() {
      return c.width
    },
    get height() {
      return c.height
    },
    get disposed() {
      return disposed
    },
    get backingReleased() {
      return c.width === 0 && texW > 0
    },
    acquireBacking() {
      if (disposed || c.width > 0) return
      c.width = texW
      c.height = texH
    },
    markDirty(x, y, w, h) {
      if (disposed) return
      if (c.width > 0) {
        texW = c.width
        texH = c.height
      }
      host.markDynamicCanvasDirty(id, x, y, w, h)
      notify?.()
    },
    resize(w, h, o) {
      if (disposed) return
      w = Math.max(1, Math.floor(w))
      h = Math.max(1, Math.floor(h))
      if (w === c.width && h === c.height) return
      let backup: HTMLCanvasElement | null = null
      if (o?.preserve !== false && c.width > 0 && c.height > 0) {
        backup = document.createElement('canvas')
        backup.width = c.width
        backup.height = c.height
        backup.getContext('2d')!.drawImage(c, 0, 0)
      }
      texW = w
      texH = h
      c.width = w
      c.height = h // clears the canvas and resets ctx state
      if (backup) ctx.drawImage(backup, 0, 0)
      host.markDynamicCanvasDirty(id)
      notify?.()
    },
    dispose() {
      if (disposed) return
      disposed = true
      host.unregisterDynamicCanvas(id)
      notify?.()
    },
  }
}
