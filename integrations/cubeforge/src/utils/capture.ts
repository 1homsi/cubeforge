import type { CaptureFrameOptions } from '@cubeforge/context'

/** What the engine hands the capture: the canvas and how to draw into it now. */
export interface CaptureTarget {
  canvas: HTMLCanvasElement
  /** Draws the current world into `canvas` at its current pixel size. */
  render(): void
}

function outputSize(canvas: HTMLCanvasElement, opts: CaptureFrameOptions): [number, number] {
  const sw = canvas.width
  const sh = canvas.height
  const { width, height } = opts
  for (const v of [width, height]) {
    if (v !== undefined && !(v >= 1 && Number.isFinite(v))) throw new RangeError(`captureFrame: invalid size ${v}`)
  }
  if (width !== undefined && height !== undefined) return [Math.round(width), Math.round(height)]
  if (width !== undefined) return [Math.round(width), Math.max(1, Math.round((width * sh) / sw))]
  if (height !== undefined) return [Math.max(1, Math.round((height * sw) / sh)), Math.round(height)]
  return [sw, sh]
}

function isContextLost(canvas: HTMLCanvasElement): boolean {
  try {
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null
    return !!gl && typeof gl.isContextLost === 'function' && gl.isContextLost()
  } catch {
    return false
  }
}

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/**
 * Renders a frame and reads it back as an image. The copy into a 2D canvas is
 * synchronous with the render, which is the only moment a WebGL canvas that is
 * not preserving its drawing buffer still holds the frame; encoding then runs
 * on that copy. A 2D-context canvas takes the same path.
 */
export async function captureFrame(
  target: CaptureTarget,
  opts: CaptureFrameOptions = {},
): Promise<Blob | ImageBitmap | HTMLCanvasElement> {
  const { canvas } = target
  const type = opts.type ?? 'blob'
  if (type !== 'blob' && type !== 'bitmap' && type !== 'canvas') {
    throw new TypeError(`captureFrame: unknown type "${String(type)}"`)
  }
  if (isContextLost(canvas)) throw new Error('captureFrame: the WebGL context is lost')
  const [dw, dh] = outputSize(canvas, opts)
  const natW = canvas.width
  const natH = canvas.height
  const draw = opts.render !== false
  const resize = draw && opts.renderAtSize === true && (dw !== natW || dh !== natH) && canvas.clientWidth > 0

  let copy: HTMLCanvasElement
  if (resize) {
    // Same view at another pixel density: the world maps through the canvas'
    // CSS size, so only the backing store changes.
    canvas.width = dw
    canvas.height = dh
    try {
      if (draw) target.render()
      copy = newCanvas(dw, dh)
      copy.getContext('2d')!.drawImage(canvas, 0, 0)
    } finally {
      canvas.width = natW
      canvas.height = natH
      // Resizing clears the buffer; repaint so the screen does not go blank
      // (matters in onDemand mode, where no frame follows).
      target.render()
    }
  } else {
    if (draw) target.render()
    copy = newCanvas(dw, dh)
    const ctx = copy.getContext('2d')!
    ctx.imageSmoothingEnabled = opts.smoothing ?? dw * dh < natW * natH
    ctx.drawImage(canvas, 0, 0, natW, natH, 0, 0, dw, dh)
  }

  if (type === 'canvas') return copy
  if (type === 'bitmap') return createImageBitmap(copy)
  const mime = opts.mimeType ?? 'image/png'
  return new Promise<Blob>((resolve, reject) => {
    copy.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`captureFrame: the browser could not encode ${mime}`))),
      mime,
      opts.quality ?? 0.92,
    )
  })
}
