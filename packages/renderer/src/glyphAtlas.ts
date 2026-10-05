/**
 * CPU-side glyph atlas: rasterises glyphs on demand with Canvas2D into shared
 * pages and hands out their UV rectangles. Text layers draw thousands of
 * glyphs from these pages in one instanced draw call.
 *
 * The atlas knows nothing about WebGL: the renderer uploads `pages[i].canvas`
 * (whole page the first time, then only the dirty rect when `rev` changes).
 */

export interface GlyphStyleOptions {
  /** CSS font family. Default 'sans-serif'. */
  fontFamily?: string
  /** Nominal font size in px (also the default run size). Default 16. */
  fontSize?: number
  /** CSS font weight ('normal', 'bold', 600...). Default 'normal'. */
  weight?: string | number
  italic?: boolean
  /** Fill colour baked into the glyphs. Default white; runs tint it by multiplication. */
  color?: string
  /** Outline colour and total stroke width in px (baked). */
  outlineColor?: string
  outlineWidth?: number
  /** Drop shadow baked into the glyphs. */
  shadowColor?: string
  shadowOffsetX?: number
  shadowOffsetY?: number
  shadowBlur?: number
}

export interface Glyph {
  page: number
  /** UV rectangle of the rasterised cell (padding included). */
  u0: number
  v0: number
  u1: number
  v1: number
  /** Cell size in raster pixels; 0 for glyphs with nothing to draw (spaces). */
  w: number
  h: number
  /** Cell left edge relative to the pen position, raster px. */
  ox: number
  /** Cell top edge above the baseline, raster px. */
  oy: number
  /** Pen advance, raster px. */
  advance: number
}

export interface AtlasStyle {
  readonly id: number
  readonly key: string
  readonly font: string
  /** Raster font size in px (nominal size x atlas resolution). */
  readonly rasterSize: number
  readonly ascent: number
  readonly descent: number
  readonly opts: Readonly<GlyphStyleOptions>
  /** @internal */
  glyphs: Map<number, Glyph>
  /** @internal */
  pad: number
  /** @internal */
  lineWidth: number
  /** @internal */
  shadow: [number, number, number]
}

export interface AtlasPage {
  canvas: HTMLCanvasElement | OffscreenCanvas
  readonly size: number
  /** Bumps whenever pixels change. */
  rev: number
  /** Bounding box of pixels changed since the renderer last uploaded (null = clean). */
  dirty: { x0: number; y0: number; x1: number; y1: number } | null
  /** @internal */
  rows: { y: number; h: number; x: number }[]
  /** @internal */
  nextY: number
}

export interface GlyphAtlasOptions {
  /** Page texture size in px (square). Default 1024. */
  pageSize?: number
  /** Pages before the atlas resets itself. Default 4. */
  maxPages?: number
  /** Raster pixels per nominal font px. Default 2 (crisp at 2x zoom/DPR, still fine at 1x). */
  resolution?: number
  /** Override canvas creation (tests, workers). */
  createCanvas?: (w: number, h: number) => HTMLCanvasElement | OffscreenCanvas
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

function defaultCreateCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  return new OffscreenCanvas(w, h)
}

/** Shelf-packed, on-demand glyph atlas. */
export class GlyphAtlas {
  readonly pages: AtlasPage[] = []
  /** Bumps when the atlas ran out of space and was cleared: cached layouts must be rebuilt. */
  generation = 0
  readonly pageSize: number
  readonly maxPages: number
  readonly resolution: number
  private readonly createCanvas: (w: number, h: number) => HTMLCanvasElement | OffscreenCanvas
  private readonly styles = new Map<string, AtlasStyle>()
  private measureCtx: Ctx2D | null = null
  private nextStyleId = 0
  private static _shared: GlyphAtlas | null = null

  constructor(opts: GlyphAtlasOptions = {}) {
    this.pageSize = opts.pageSize ?? 1024
    this.maxPages = Math.max(1, opts.maxPages ?? 4)
    this.resolution = opts.resolution ?? 2
    this.createCanvas = opts.createCanvas ?? defaultCreateCanvas
  }

  /** Process-wide atlas shared by every text layer that does not bring its own. */
  static get shared(): GlyphAtlas {
    return (GlyphAtlas._shared ??= new GlyphAtlas())
  }

  /** Intern a style (font + baked fill/outline/shadow). Cheap to call every frame. */
  style(o: GlyphStyleOptions = {}): AtlasStyle {
    const res = this.resolution
    const family = o.fontFamily ?? 'sans-serif'
    const size = o.fontSize ?? 16
    const weight = o.weight ?? 'normal'
    const key = [
      family,
      size,
      weight,
      o.italic ? 1 : 0,
      o.color ?? '',
      o.outlineColor ?? '',
      o.outlineWidth ?? 0,
      o.shadowColor ?? '',
      o.shadowOffsetX ?? 0,
      o.shadowOffsetY ?? 0,
      o.shadowBlur ?? 0,
    ].join('|')
    let s = this.styles.get(key)
    if (s) return s
    const rasterSize = Math.max(1, Math.round(size * res))
    const font = `${o.italic ? 'italic ' : ''}${weight} ${rasterSize}px ${family}`
    const lineWidth = (o.outlineColor && o.outlineWidth ? o.outlineWidth : 0) * res
    const shadow: [number, number, number] = o.shadowColor
      ? [(o.shadowOffsetX ?? 2) * res, (o.shadowOffsetY ?? 2) * res, (o.shadowBlur ?? 0) * res]
      : [0, 0, 0]
    const pad =
      Math.ceil(lineWidth / 2) +
      Math.ceil(shadow[2]) +
      Math.ceil(Math.max(Math.abs(shadow[0]), Math.abs(shadow[1]))) +
      1
    const m = this.measure(font, 'Hg')
    s = {
      id: this.nextStyleId++,
      key,
      font,
      rasterSize,
      ascent: m.fontAscent ?? rasterSize * 0.8,
      descent: m.fontDescent ?? rasterSize * 0.2,
      opts: { ...o },
      glyphs: new Map(),
      pad,
      lineWidth,
      shadow,
    }
    this.styles.set(key, s)
    return s
  }

  private measure(font: string, ch: string): TextMetrics & { fontAscent?: number; fontDescent?: number } {
    let c = this.measureCtx
    if (!c) {
      c = this.createCanvas(1, 1).getContext('2d') as Ctx2D
      this.measureCtx = c
    }
    c.font = font
    const m = c.measureText(ch) as TextMetrics & { fontAscent?: number; fontDescent?: number }
    m.fontAscent = (m as { fontBoundingBoxAscent?: number }).fontBoundingBoxAscent
    m.fontDescent = (m as { fontBoundingBoxDescent?: number }).fontBoundingBoxDescent
    return m
  }

  /** Glyph for a code point in a style; rasterises it into a page on first use. */
  glyph(style: AtlasStyle, cp: number): Glyph {
    const hit = style.glyphs.get(cp)
    if (hit) return hit
    const ch = String.fromCodePoint(cp)
    const m = this.measure(style.font, ch)
    const advance = m.width
    const left = Math.ceil(m.actualBoundingBoxLeft ?? 0)
    const right = Math.ceil(m.actualBoundingBoxRight ?? advance)
    const asc = Math.ceil(m.actualBoundingBoxAscent ?? style.ascent)
    const desc = Math.ceil(m.actualBoundingBoxDescent ?? style.descent)
    const bw = left + right
    const bh = asc + desc
    let g: Glyph
    if (bw <= 0 || bh <= 0 || ch.trim() === '') {
      g = { page: 0, u0: 0, v0: 0, u1: 0, v1: 0, w: 0, h: 0, ox: 0, oy: 0, advance }
    } else {
      const pad = style.pad
      const w = bw + pad * 2
      const h = bh + pad * 2
      const slot = w <= this.pageSize && h <= this.pageSize ? this.alloc(w, h) : null
      if (!slot) {
        g = { page: 0, u0: 0, v0: 0, u1: 0, v1: 0, w: 0, h: 0, ox: 0, oy: 0, advance }
      } else {
        const page = this.pages[slot.page]
        this.raster(page, style, ch, slot.x, slot.y, w, h, pad + left, pad + asc)
        const S = this.pageSize
        g = {
          page: slot.page,
          u0: slot.x / S,
          v0: slot.y / S,
          u1: (slot.x + w) / S,
          v1: (slot.y + h) / S,
          w,
          h,
          ox: -(left + pad),
          oy: asc + pad,
          advance,
        }
      }
    }
    // An atlas reset during alloc() cleared style.glyphs: store after it.
    style.glyphs.set(cp, g)
    return g
  }

  private raster(
    page: AtlasPage,
    s: AtlasStyle,
    ch: string,
    x: number,
    y: number,
    w: number,
    h: number,
    penX: number,
    baseY: number,
  ): void {
    const ctx = page.canvas.getContext('2d') as Ctx2D
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.clip()
    ctx.clearRect(x, y, w, h)
    ctx.font = s.font
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.lineJoin = 'round'
    const o = s.opts
    const [sx, sy, sb] = s.shadow
    const hasShadow = !!o.shadowColor
    if (s.lineWidth > 0) {
      if (hasShadow) {
        ctx.shadowColor = o.shadowColor!
        ctx.shadowOffsetX = sx
        ctx.shadowOffsetY = sy
        ctx.shadowBlur = sb
      }
      ctx.strokeStyle = o.outlineColor!
      ctx.lineWidth = s.lineWidth
      ctx.strokeText(ch, x + penX, y + baseY)
      ctx.shadowColor = 'rgba(0,0,0,0)'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
    } else if (hasShadow) {
      ctx.shadowColor = o.shadowColor!
      ctx.shadowOffsetX = sx
      ctx.shadowOffsetY = sy
      ctx.shadowBlur = sb
    }
    ctx.fillStyle = o.color ?? '#ffffff'
    ctx.fillText(ch, x + penX, y + baseY)
    ctx.restore()
    page.rev++
    const d = page.dirty
    if (d) {
      d.x0 = Math.min(d.x0, x)
      d.y0 = Math.min(d.y0, y)
      d.x1 = Math.max(d.x1, x + w)
      d.y1 = Math.max(d.y1, y + h)
    } else page.dirty = { x0: x, y0: y, x1: x + w, y1: y + h }
  }

  private alloc(w: number, h: number): { page: number; x: number; y: number } | null {
    const S = this.pageSize
    for (let attempt = 0; attempt < 2; attempt++) {
      for (let p = 0; p < this.pages.length; p++) {
        const page = this.pages[p]
        // First row that is tall enough without wasting more than half of it.
        for (const row of page.rows) {
          if (row.h >= h && row.h <= h * 2 && row.x + w <= S) {
            const x = row.x
            row.x += w
            return { page: p, x, y: row.y }
          }
        }
        if (page.nextY + h <= S) {
          const rowH = Math.min(S - page.nextY, Math.ceil(h * 1.25))
          const row = { y: page.nextY, h: rowH, x: w }
          page.rows.push(row)
          page.nextY += rowH
          return { page: p, x: 0, y: row.y }
        }
      }
      if (this.pages.length < this.maxPages) {
        const canvas = this.createCanvas(S, S)
        this.pages.push({ canvas, size: S, rev: 1, dirty: null, rows: [], nextY: 0 })
        continue
      }
      this.reset()
    }
    return null
  }

  /** Clear every page and glyph (used when full). Bumps `generation`. */
  reset(): void {
    this.generation++
    for (const page of this.pages) {
      const ctx = page.canvas.getContext('2d') as Ctx2D
      ctx.clearRect(0, 0, page.size, page.size)
      page.rows.length = 0
      page.nextY = 0
      page.rev++
      page.dirty = { x0: 0, y0: 0, x1: page.size, y1: page.size }
    }
    for (const s of this.styles.values()) s.glyphs.clear()
  }

  /** Total glyphs rasterised right now. */
  get glyphCount(): number {
    let n = 0
    for (const s of this.styles.values()) n += s.glyphs.size
    return n
  }
}
