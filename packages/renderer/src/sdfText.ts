/**
 * SDF (Signed Distance Field) text generation for Canvas2D.
 *
 * Generates a signed distance field texture from a text string at a given font.
 * The SDF encodes distance from the nearest glyph edge at each pixel:
 *   - 0.5  = exactly on the edge
 *   - > 0.5 = inside the glyph
 *   - < 0.5 = outside the glyph
 *
 * Rendering the SDF at any scale with `imageSmoothingEnabled = true` produces
 * smooth, anti-aliased text without pixelation. The threshold can be adjusted
 * post-render to produce outlined or shadowed glyphs.
 *
 * Uses a fast 8-SED (8-directional Sequential Euclidean Distance) approximation.
 */

// ── Cache ────────────────────────────────────────────────────────────────────

interface SdfCacheEntry {
  canvas: HTMLCanvasElement
  /** Render width of the SDF canvas (at sdfScale × target size) */
  width: number
  height: number
}

const sdfCache = new Map<string, SdfCacheEntry>()

function makeCacheKey(text: string, font: string, spread: number, scale: number): string {
  return `${font}|${text}|${spread}|${scale}`
}

/**
 * Clear all cached SDF textures (e.g. after a font load or memory pressure).
 */
export function clearSdfCache(): void {
  sdfCache.clear()
}

// ── SDF generation ───────────────────────────────────────────────────────────

/**
 * Run a 2-pass sequential EDT approximation on a binary grid.
 * Returns distance values (squared) for each pixel.
 *
 * Based on the 8-SED algorithm — fast O(n) approximation, not exact EDT.
 */
function buildDistField(binary: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e8
  const dist = new Float32Array(w * h).fill(INF)

  // Forward pass: top-left to bottom-right
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (binary[i]) {
        dist[i] = 0
        continue
      }
      let d = INF
      if (x > 0) d = Math.min(d, dist[i - 1] + 1)
      if (y > 0) d = Math.min(d, dist[i - w] + 1)
      if (x > 0 && y > 0) d = Math.min(d, dist[i - w - 1] + 1.4142)
      if (x < w - 1 && y > 0) d = Math.min(d, dist[i - w + 1] + 1.4142)
      dist[i] = d
    }
  }

  // Backward pass: bottom-right to top-left
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      let d = dist[i]
      if (x < w - 1) d = Math.min(d, dist[i + 1] + 1)
      if (y < h - 1) d = Math.min(d, dist[i + w] + 1)
      if (x < w - 1 && y < h - 1) d = Math.min(d, dist[i + w + 1] + 1.4142)
      if (x > 0 && y < h - 1) d = Math.min(d, dist[i + w - 1] + 1.4142)
      dist[i] = d
    }
  }

  return dist
}

/**
 * Generate a signed distance field canvas for the given text.
 *
 * @param text - The string to render.
 * @param font - CSS font string (e.g. `"bold 48px monospace"`).
 * @param spread - Pixel distance encoded in each direction from the edge.
 *   Larger spread = softer glow / wider outline range. Default 8.
 * @param sdfScale - Resolution multiplier (render at this × target size). Default 4.
 * @returns An HTMLCanvasElement containing the SDF as a greyscale image in the R channel.
 */
export function generateSdfText(
  text: string,
  font: string,
  spread = 8,
  sdfScale = 4,
): HTMLCanvasElement {
  const key = makeCacheKey(text, font, spread, sdfScale)
  const cached = sdfCache.get(key)
  if (cached) return cached.canvas

  // ── 1. Measure and render text at high resolution ─────────────────────────

  const measureCanvas = document.createElement('canvas')
  const mctx = measureCanvas.getContext('2d')!
  mctx.font = font
  const metrics = mctx.measureText(text)

  const padding = Math.ceil(spread * sdfScale * 2)
  const tw = Math.ceil(metrics.width * sdfScale) + padding * 2
  const th = Math.ceil(
    ((metrics.actualBoundingBoxAscent ?? 0) + (metrics.actualBoundingBoxDescent ?? 0)) * sdfScale ||
      parseInt(font) * sdfScale * 1.4,
  ) + padding * 2

  const hiCanvas = document.createElement('canvas')
  hiCanvas.width = tw
  hiCanvas.height = th
  const hctx = hiCanvas.getContext('2d')!
  hctx.font = font.replace(/(\d+)px/, (_, n) => `${Math.round(parseInt(n) * sdfScale)}px`)
  hctx.fillStyle = '#fff'
  hctx.textBaseline = 'middle'
  hctx.fillText(text, padding, th / 2)

  // ── 2. Extract binary alpha map ───────────────────────────────────────────

  const imgData = hctx.getImageData(0, 0, tw, th)
  const alpha = imgData.data
  const inside = new Uint8Array(tw * th)
  const outside = new Uint8Array(tw * th)
  for (let i = 0; i < tw * th; i++) {
    const a = alpha[i * 4 + 3]
    inside[i] = a > 127 ? 1 : 0
    outside[i] = a <= 127 ? 1 : 0
  }

  // ── 3. Build distance fields for inside and outside ───────────────────────

  const distIn = buildDistField(inside, tw, th)
  const distOut = buildDistField(outside, tw, th)

  // ── 4. Combine: 0.5 + (distOut - distIn) / (2 * spread * sdfScale) ───────

  const sdfCanvas = document.createElement('canvas')
  sdfCanvas.width = tw
  sdfCanvas.height = th
  const sctx = sdfCanvas.getContext('2d')!
  const sdfImg = sctx.createImageData(tw, th)
  const range = spread * sdfScale

  for (let i = 0; i < tw * th; i++) {
    const dIn = Math.sqrt(distIn[i])
    const dOut = Math.sqrt(distOut[i])
    const sdf = 0.5 + (dOut - dIn) / (2 * range)
    const v = Math.max(0, Math.min(255, Math.round(sdf * 255)))
    sdfImg.data[i * 4 + 0] = v
    sdfImg.data[i * 4 + 1] = v
    sdfImg.data[i * 4 + 2] = v
    sdfImg.data[i * 4 + 3] = 255
  }
  sctx.putImageData(sdfImg, 0, 0)

  sdfCache.set(key, { canvas: sdfCanvas, width: tw, height: th })
  return sdfCanvas
}

/**
 * Render SDF text onto a Canvas2D context.
 *
 * Retrieves or generates the SDF texture for `text` / `font`, then draws it
 * at `targetWidth × targetHeight` using bilinear scaling for smooth edges at
 * any zoom level.
 *
 * @param ctx - Target Canvas2D rendering context.
 * @param text - The string to render.
 * @param font - CSS font string (e.g. `"bold 32px monospace"`).
 * @param x - Draw X position.
 * @param y - Draw Y position.
 * @param color - Fill color (applied as a composite tint). Default '#ffffff'.
 * @param spread - SDF spread passed to `generateSdfText`. Default 8.
 */
export function renderSdfText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  x: number,
  y: number,
  color = '#ffffff',
  spread = 8,
): void {
  if (!text) return
  const sdfCanvas = generateSdfText(text, font, spread)

  ctx.save()
  // Use screen compositing: multiply SDF (greyscale) with fill color
  ctx.globalCompositeOperation = 'source-over'
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Measure target draw size using standard canvas metrics
  ctx.font = font
  const metrics = ctx.measureText(text)
  const targetW = metrics.width
  const ascent = metrics.actualBoundingBoxAscent ?? parseInt(font) * 0.8
  const descent = metrics.actualBoundingBoxDescent ?? parseInt(font) * 0.2
  const targetH = ascent + descent

  // Tint: draw greyscale SDF, then multiply with color using destination-in trick
  const tmp = document.createElement('canvas')
  tmp.width = Math.ceil(targetW)
  tmp.height = Math.ceil(targetH)
  const tctx = tmp.getContext('2d')!

  // Scale the SDF canvas down to target dimensions
  tctx.drawImage(sdfCanvas, 0, 0, sdfCanvas.width, sdfCanvas.height, 0, 0, tmp.width, tmp.height)

  // Apply threshold: pixels with SDF > 0.5 are inside the glyph
  // We approximate this by using a CSS filter if available, or just draw as-is
  // For true SDF threshold, we convert the greyscale SDF to alpha
  const id = tctx.getImageData(0, 0, tmp.width, tmp.height)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const sdf = d[i] / 255 // 0..1
    const alpha = Math.max(0, Math.min(1, (sdf - 0.5) * 8 + 0.5)) // smooth threshold
    d[i] = 255
    d[i + 1] = 255
    d[i + 2] = 255
    d[i + 3] = Math.round(alpha * 255)
  }
  tctx.putImageData(id, 0, 0)

  // Color the result
  tctx.globalCompositeOperation = 'source-in'
  tctx.fillStyle = color
  tctx.fillRect(0, 0, tmp.width, tmp.height)

  ctx.drawImage(tmp, x - targetW / 2, y - ascent / 2)
  ctx.restore()
}
