import type { LayerAtlas, SpriteLayer } from './spriteLayer'
import type { TintCache } from './canvas2dTint'

// Copies of the flag values in spriteLayerFlags.ts (a test keeps them equal). Importing them would
// make this lazily loaded chunk share that module with the main bundle, and sharing costs bytes there.
const MAX_LAYER_ATLASES = 8
const SPRITE_FLIP_X = 1
const SPRITE_FLIP_Y = 2
const SPRITE_HIDDEN = 4
const SPRITE_UNTEXTURED = 8

/** A loaded atlas texture, or null while it is still loading. */
export interface LayerSource {
  image: CanvasImageSource
  width: number
  height: number
}

/** World-to-device transform: device = world * s + (tx, ty). */
export interface WorldBase {
  s: number
  tx: number
  ty: number
}

export interface LayerView {
  viewL: number
  viewR: number
  viewT: number
  viewB: number
}

/**
 * Canvas2D drawer for {@link SpriteLayer}: same data, order, culling, flags and
 * atlas frames as the WebGL path. Per-sprite colour multiplies the texture
 * through a {@link TintCache}; white sprites draw straight from the atlas.
 */
export class SpriteLayerCanvasRenderer {
  /** Sprites drawn by the last `draw` call. */
  instances = 0
  private readonly kind = new Uint8Array(MAX_LAYER_ATLASES)
  private readonly src: (LayerSource | null)[] = new Array(MAX_LAYER_ATLASES).fill(null)
  private readonly cols = new Int32Array(MAX_LAYER_ATLASES)
  private readonly fw = new Float32Array(MAX_LAYER_ATLASES)
  private readonly fh = new Float32Array(MAX_LAYER_ATLASES)

  constructor(private readonly tints: TintCache) {}

  /**
   * Draw `layer`. The caller has set `imageSmoothingEnabled`; global alpha and
   * composite operation are expected at their defaults and are restored.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    layer: SpriteLayer,
    base: WorldBase,
    view: LayerView,
    resolve: (atlas: LayerAtlas) => LayerSource | null,
  ): void {
    this.instances = 0
    const count = layer.count
    if (!layer.visible || count === 0) return
    const atlases = layer.atlases
    const na = Math.min(atlases.length, MAX_LAYER_ATLASES)
    for (let a = 0; a < na; a++) {
      const at = atlases[a]
      // 2: no source at all, its sprites draw as solid rects. 0: still loading. 1: ready.
      if (at.src === undefined && at.image === undefined && at.dynamicSrc === undefined) {
        this.kind[a] = 2
        this.src[a] = null
        continue
      }
      const r = resolve(at)
      this.src[a] = r
      this.kind[a] = r ? 1 : 0
      if (r) {
        const fw = at.frameWidth ?? 0
        const fh = at.frameHeight ?? 0
        if (fw > 0 && fh > 0) {
          this.fw[a] = fw
          this.fh[a] = fh
          this.cols[a] = at.frameColumns ?? Math.max(1, Math.floor(r.width / fw))
        } else {
          this.fw[a] = r.width
          this.fh[a] = r.height
          this.cols[a] = 1
        }
      }
    }

    const order = layer.sortByKey ? layer.drawOrder() : null
    const { viewL, viewR, viewT, viewB } = view
    const ax = layer.anchorX
    const ay = layer.anchorY
    const { s, tx, ty } = base
    const X = layer.x
    const Y = layer.y
    const Wd = layer.w
    const Ht = layer.h
    const R = layer.rotation
    const F = layer.frame
    const A = layer.atlas
    const C = layer.color
    const FL = layer.flags
    let identity = false
    let alpha = 1
    let drawn = 0
    let fill = ''
    for (let k = 0; k < count; k++) {
      const i = order ? order[k] : k
      const flags = FL[i]
      if (flags & SPRITE_HIDDEN) continue
      const x = X[i]
      const y = Y[i]
      const w = Wd[i]
      const h = Ht[i]
      const rad = (w < 0 ? -w : w) + (h < 0 ? -h : h)
      if (x + rad < viewL || x - rad > viewR || y + rad < viewT || y - rad > viewB) continue
      const a = A[i]
      const untextured = (flags & SPRITE_UNTEXTURED) !== 0 || a >= na || this.kind[a] === 2
      if (!untextured && this.kind[a] === 0) continue
      const c = C[i]
      const cr = c >>> 24
      const cg = (c >>> 16) & 255
      const cb = (c >>> 8) & 255
      const ca = (c & 255) / 255
      if (ca <= 0) continue

      const rot = R[i]
      const flip = flags & (SPRITE_FLIP_X | SPRITE_FLIP_Y)
      let dx: number
      let dy: number
      if (rot === 0 && flip === 0) {
        // Axis-aligned: one drawImage under the world transform.
        if (!identity) {
          ctx.setTransform(s, 0, 0, s, tx, ty)
          identity = true
        }
        dx = x - ax * w
        dy = y - ay * h
      } else {
        const fx = flip & SPRITE_FLIP_X ? -1 : 1
        const fy = flip & SPRITE_FLIP_Y ? -1 : 1
        const cs = Math.cos(rot) * s
        const sn = Math.sin(rot) * s
        ctx.setTransform(cs * fx, sn * fx, -sn * fy, cs * fy, tx + s * x, ty + s * y)
        identity = false
        dx = -ax * w
        dy = -ay * h
      }

      if (alpha !== ca) {
        ctx.globalAlpha = ca
        alpha = ca
      }
      if (untextured) {
        const style = `rgb(${cr},${cg},${cb})`
        if (style !== fill) {
          ctx.fillStyle = style
          fill = style
        }
        ctx.fillRect(dx, dy, w, h)
      } else {
        const src = this.src[a]!
        const fw = this.fw[a]
        const fh = this.fh[a]
        const cols = this.cols[a]
        const f = F[i]
        const sx = (f % cols) * fw
        const sy = Math.floor(f / cols) * fh
        if (cr === 255 && cg === 255 && cb === 255) {
          ctx.drawImage(src.image, sx, sy, fw, fh, dx, dy, w, h)
        } else {
          const t = this.tints.get(src.image, sx, sy, fw, fh, cr, cg, cb)
          ctx.drawImage(t as CanvasImageSource, 0, 0, t.width, t.height, dx, dy, w, h)
        }
      }
      drawn++
    }
    this.instances = drawn
    if (alpha !== 1) ctx.globalAlpha = 1
    ctx.setTransform(s, 0, 0, s, tx, ty)
  }
}
