import type { AtlasFrame, LayerAtlas } from './spriteLayer'

/** Pixel source a hit mask can be read from (an image or canvas). */
export type PickSource = CanvasImageSource & { width: number; height: number }

/** Hit region of a frame in frame pixels, or `'opaque'` for the bounds of its non-transparent pixels. */
export type FrameHit = { x: number; y: number; w: number; h: number } | 'opaque'

/** Alpha channel of an atlas texture, read once on first use. */
export interface AtlasMask {
  source: unknown
  w: number
  h: number
  alpha: Uint8Array
  /** Opaque bounds per frame: [u0, v0, u1, v1] as fractions of the frame (null = fully transparent). */
  bounds: Map<number, Float32Array | null>
}

/** Read the alpha channel of `src` (null if unreadable, e.g. cross-origin or not loaded yet). */
export function readAtlasMask(src: PickSource): AtlasMask | null {
  try {
    const w = (src as HTMLImageElement).naturalWidth || src.width
    const h = (src as HTMLImageElement).naturalHeight || src.height
    if (!w || !h) return null
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null
    if (!ctx) return null
    ctx.drawImage(src, 0, 0)
    const px = ctx.getImageData(0, 0, w, h).data
    if (!px || px.length < w * h * 4) return null
    const alpha = new Uint8Array(w * h)
    for (let i = 0; i < alpha.length; i++) alpha[i] = px[i * 4 + 3]
    return { source: src, w, h, alpha, bounds: new Map() }
  } catch {
    return null
  }
}

/** Frame rect in texture pixels of frame `f` of `atlas` (texture size needed for default grid columns). */
export function frameRect(
  atlas: LayerAtlas,
  f: number,
  texW: number,
  texH: number,
  out: { x: number; y: number; w: number; h: number },
): boolean {
  const table = atlas.frames
  if (table !== undefined) {
    const fr: AtlasFrame | undefined = table[f]
    if (!fr) return false
    out.x = fr.x
    out.y = fr.y
    out.w = fr.w
    out.h = fr.h
    return true
  }
  const fw = atlas.frameWidth ?? 0
  const fh = atlas.frameHeight ?? 0
  if (!(fw > 0 && fh > 0)) {
    out.x = 0
    out.y = 0
    out.w = texW
    out.h = texH
    return true
  }
  const sp = atlas.frameSpacing ?? 0
  const mg = atlas.frameMargin ?? 0
  const cols = atlas.frameColumns ?? Math.max(1, Math.floor((texW - 2 * mg + sp) / (fw + sp)))
  out.x = mg + (f % cols) * (fw + sp)
  out.y = mg + Math.floor(f / cols) * (fh + sp)
  out.w = fw
  out.h = fh
  return true
}

/** Bounds of pixels with alpha above `threshold` inside a frame rect, as fractions of the frame; null if none. */
export function opaqueBounds(mask: AtlasMask, r: { x: number; y: number; w: number; h: number }, threshold: number) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -1,
    y1 = -1
  const xs = Math.max(0, Math.floor(r.x))
  const ys = Math.max(0, Math.floor(r.y))
  const xe = Math.min(mask.w, Math.ceil(r.x + r.w))
  const ye = Math.min(mask.h, Math.ceil(r.y + r.h))
  for (let y = ys; y < ye; y++) {
    for (let x = xs; x < xe; x++) {
      if (mask.alpha[y * mask.w + x] > threshold) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  return new Float32Array([(x0 - r.x) / r.w, (y0 - r.y) / r.h, (x1 + 1 - r.x) / r.w, (y1 + 1 - r.y) / r.h])
}
