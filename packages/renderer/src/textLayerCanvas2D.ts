import type { TextLayer } from './textLayer'
import type { GlyphAtlas } from './glyphAtlas'
import type { TintCache } from './canvas2dTint'
import type { LayerView, WorldBase } from './spriteLayerCanvas2D'

// Copies of the values in textLayer.ts (a test keeps them equal): importing them would put that
// module in a chunk shared with the main bundle.
const TEXT_HIDDEN = 1
const LAYOUT_GLYPH_FLOATS = 9

/**
 * Canvas2D drawer for {@link TextLayer}: the same layout, culling and colour/alpha
 * rules as the WebGL path, drawing glyph cells straight from the shared atlas pages.
 * A run whose colour is not white multiplies each glyph through a {@link TintCache}.
 */
export class TextLayerCanvasRenderer {
  /** Glyph cells drawn by the last `draw` call. */
  instances = 0
  private readonly generations = new WeakMap<GlyphAtlas, number>()

  constructor(private readonly tints: TintCache) {}

  draw(ctx: CanvasRenderingContext2D, layer: TextLayer, base: WorldBase, view: LayerView): void {
    this.instances = 0
    const count = layer.count
    if (!layer.visible || count === 0) return
    const atlas = layer.atlas
    // Glyph cells are reused after an atlas reset, so cached tinted copies would be stale.
    if (this.generations.get(atlas) !== atlas.generation) {
      this.generations.set(atlas, atlas.generation)
      this.tints.clear()
    }
    const { viewL, viewR, viewT, viewB } = view
    // Lay every candidate run out first: rasterising can reset the atlas, which
    // invalidates earlier layouts, so retry once from a clean atlas.
    for (let attempt = 0; attempt < 2; attempt++) {
      const gen = atlas.generation
      for (let i = 0; i < count; i++) {
        if (layer.flags[i] & TEXT_HIDDEN) continue
        if (this.far(layer, i, viewL, viewR, viewT, viewB)) continue
        layer.layout(i)
      }
      if (atlas.generation === gen) break
    }
    if (this.generations.get(atlas) !== atlas.generation) {
      this.generations.set(atlas, atlas.generation)
      this.tints.clear()
    }

    const { s, tx, ty } = base
    const order = layer.sortByKey ? layer.drawOrder() : null
    let drawn = 0
    let alpha = 1
    for (let q = 0; q < count; q++) {
      const i = order ? order[q] : q
      if (layer.flags[i] & TEXT_HIDDEN) continue
      const lay = layer.layoutIfCached(i)
      if (!lay || lay.n === 0 || lay.gen !== atlas.generation) continue
      const sc = layer.size[i] / layer.atlasStyle(layer.style[i]).rasterSize
      const w = lay.width * sc
      const h = lay.height * sc
      const ox = -layer.anchorX[i] * w
      const oy = -layer.anchorY[i] * h
      const px = layer.x[i]
      const py = layer.y[i]
      const rad = Math.abs(ox) + Math.abs(oy) + w + h
      if (px + rad < viewL || px - rad > viewR || py + rad < viewT || py - rad > viewB) continue
      const col = layer.color[i]
      const a = ((col & 255) / 255) * layer.alpha[i] * layer.opacity
      if (a <= 0) continue
      const cr = col >>> 24
      const cg = (col >>> 16) & 255
      const cb = (col >>> 8) & 255
      const white = cr === 255 && cg === 255 && cb === 255
      if (a !== alpha) {
        ctx.globalAlpha = a
        alpha = a
      }
      const rot = layer.rotation[i]
      const c = Math.cos(rot) * s
      const sn = Math.sin(rot) * s
      ctx.setTransform(c, sn, -sn, c, tx + s * px, ty + s * py)
      const G = lay.glyphs
      for (let k = 0, o = 0; k < lay.n; k++, o += LAYOUT_GLYPH_FLOATS) {
        const page = atlas.pages[G[o + 8]]
        if (!page) continue
        const size = page.size
        const sx = G[o + 4] * size
        const sy = G[o + 5] * size
        const sw = (G[o + 6] - G[o + 4]) * size
        const sh = (G[o + 7] - G[o + 5]) * size
        const dx = ox + G[o] * sc
        const dy = oy + G[o + 1] * sc
        if (white) {
          ctx.drawImage(page.canvas as CanvasImageSource, sx, sy, sw, sh, dx, dy, G[o + 2] * sc, G[o + 3] * sc)
        } else {
          const t = this.tints.get(page.canvas as CanvasImageSource, sx, sy, sw, sh, cr, cg, cb)
          ctx.drawImage(t as CanvasImageSource, 0, 0, t.width, t.height, dx, dy, G[o + 2] * sc, G[o + 3] * sc)
        }
        drawn++
      }
    }
    this.instances = drawn
    if (alpha !== 1) ctx.globalAlpha = 1
    ctx.setTransform(s, 0, 0, s, tx, ty)
  }

  /** True when run `i` is certainly off screen, judged without laying it out. */
  private far(layer: TextLayer, i: number, l: number, r: number, t: number, b: number): boolean {
    const cur = layer.layoutIfCached(i)
    const size = layer.size[i]
    let extent: number
    if (cur) extent = (cur.width + cur.height) * (size / layer.atlasStyle(layer.style[i]).rasterSize)
    else extent = layer.texts[i].length * size * 1.2 + size * 4
    extent *= 1.5
    const x = layer.x[i]
    const y = layer.y[i]
    return x + extent < l || x - extent > r || y + extent < t || y - extent > b
  }
}
