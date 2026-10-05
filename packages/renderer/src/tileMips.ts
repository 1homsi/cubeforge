import type { Tileset } from './tileLayer'

/** One level of a tile mip pyramid: `cols * (tw >> L)` x `rows * (th >> L)` RGBA bytes. */
export interface TileMipLevel {
  w: number
  h: number
  data: Uint8Array
}

/**
 * Per-tile mip pyramid from raw RGBA pixels of the atlas image. Level 0 is the
 * tiles repacked tightly (no spacing or margin); each next level box-filters
 * every tile on its own, weighting colour by alpha, so tiles never bleed into
 * each other. Tile t at level L sits at ((t % cols) * (tw >> L), floor(t / cols) * (th >> L)).
 * Returns null when the tiles are too small to have a second level.
 */
export function downsampleTileMips(
  px: ArrayLike<number>,
  iw: number,
  ih: number,
  ts: Pick<Tileset, 'tileWidth' | 'tileHeight' | 'columns' | 'spacing' | 'margin'>,
): TileMipLevel[] | null {
  const tw = ts.tileWidth
  const th = ts.tileHeight
  const maxLod = Math.floor(Math.log2(Math.min(tw, th)))
  if (maxLod < 1) return null
  const sp = ts.spacing ?? 0
  const mg = ts.margin ?? 0
  const cols = ts.columns
  const rows = Math.max(1, Math.floor((ih - 2 * mg + sp) / (th + sp)))
  const levels: TileMipLevel[] = []

  const l0 = new Uint8Array(cols * tw * rows * th * 4)
  const w0 = cols * tw
  for (let t = 0; t < cols * rows; t++) {
    const ox = mg + (t % cols) * (tw + sp)
    const oy = mg + Math.floor(t / cols) * (th + sp)
    const dx = (t % cols) * tw
    const dy = Math.floor(t / cols) * th
    for (let y = 0; y < th; y++) {
      if (oy + y >= ih) break
      for (let x = 0; x < tw; x++) {
        if (ox + x >= iw) break
        const si = ((oy + y) * iw + ox + x) * 4
        const di = ((dy + y) * w0 + dx + x) * 4
        l0[di] = px[si]
        l0[di + 1] = px[si + 1]
        l0[di + 2] = px[si + 2]
        l0[di + 3] = px[si + 3]
      }
    }
  }
  levels.push({ w: w0, h: rows * th, data: l0 })

  for (let L = 1; L <= maxLod; L++) {
    const sw = tw >> (L - 1)
    const sh = th >> (L - 1)
    const bw = tw >> L
    const bh = th >> L
    const prev = levels[L - 1]
    const w = cols * bw
    const h = rows * bh
    const data = new Uint8Array(w * h * 4)
    for (let t = 0; t < cols * rows; t++) {
      const tc = t % cols
      const tr = Math.floor(t / cols)
      for (let y = 0; y < bh; y++) {
        const y0 = Math.floor((y * sh) / bh)
        const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / bh))
        for (let x = 0; x < bw; x++) {
          const x0 = Math.floor((x * sw) / bw)
          const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / bw))
          let r = 0,
            g = 0,
            b = 0,
            a = 0
          for (let yy = y0; yy < y1; yy++) {
            for (let xx = x0; xx < x1; xx++) {
              const si = ((tr * sh + yy) * prev.w + tc * sw + xx) * 4
              const al = prev.data[si + 3]
              r += prev.data[si] * al
              g += prev.data[si + 1] * al
              b += prev.data[si + 2] * al
              a += al
            }
          }
          const di = ((tr * bh + y) * w + tc * bw + x) * 4
          if (a > 0) {
            data[di] = Math.round(r / a)
            data[di + 1] = Math.round(g / a)
            data[di + 2] = Math.round(b / a)
          }
          data[di + 3] = Math.round(a / ((x1 - x0) * (y1 - y0)))
        }
      }
    }
    levels.push({ w, h, data })
  }
  return levels
}

/** Reads the tileset image on a 2D canvas and builds its mip pyramid; null if unreadable (e.g. cross-origin). */
export function buildTileMips(ts: Tileset): TileMipLevel[] | null {
  const img = ts.image as (CanvasImageSource & { width: number; height: number; naturalWidth?: number }) | undefined
  if (!img) return null
  try {
    const iw = img.naturalWidth || img.width
    const ih = (img as { naturalHeight?: number }).naturalHeight || img.height
    const c = document.createElement('canvas')
    c.width = iw
    c.height = ih
    const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    const px = ctx.getImageData(0, 0, iw, ih).data
    if (!px || px.length < iw * ih * 4) return null
    return downsampleTileMips(px, iw, ih, ts)
  } catch {
    return null
  }
}
