/**
 * Post-processing effect pass system for the Canvas2D renderer.
 *
 * Effects are simple functions that receive the canvas 2D context after the
 * scene has been rendered and can draw overlays or manipulate pixel data.
 */

export type PostProcessEffect = (ctx: CanvasRenderingContext2D, width: number, height: number, dt: number) => void

export interface PostProcessStack {
  add(effect: PostProcessEffect): void
  remove(effect: PostProcessEffect): void
  apply(ctx: CanvasRenderingContext2D, width: number, height: number, dt: number): void
  clear(): void
}

export function createPostProcessStack(): PostProcessStack {
  const effects: PostProcessEffect[] = []

  return {
    add(effect: PostProcessEffect): void {
      if (!effects.includes(effect)) {
        effects.push(effect)
      }
    },

    remove(effect: PostProcessEffect): void {
      const idx = effects.indexOf(effect)
      if (idx !== -1) effects.splice(idx, 1)
    },

    apply(ctx: CanvasRenderingContext2D, width: number, height: number, dt: number): void {
      for (const effect of effects) {
        ctx.save()
        effect(ctx, width, height, dt)
        ctx.restore()
      }
    },

    clear(): void {
      effects.length = 0
    },
  }
}

// ── Built-in effects ──────────────────────────────────────────────────────────

/**
 * Draws a radial vignette overlay that darkens the edges of the screen.
 * @param intensity - Opacity of the vignette (0 = invisible, 1 = full black). Default 0.4.
 */
export function vignetteEffect(intensity = 0.4): PostProcessEffect {
  return (ctx, width, height) => {
    const cx = width / 2
    const cy = height / 2
    const radius = Math.sqrt(cx * cx + cy * cy)
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, `rgba(0,0,0,${intensity})`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }
}

/**
 * Draws horizontal scanlines across the screen.
 * @param gap - Pixel spacing between lines. Default 3.
 * @param opacity - Opacity of each scanline. Default 0.15.
 */
export function scanlineEffect(gap = 3, opacity = 0.15): PostProcessEffect {
  return (ctx, width, height) => {
    ctx.fillStyle = `rgba(0,0,0,${opacity})`
    for (let y = 0; y < height; y += gap) {
      ctx.fillRect(0, y, width, 1)
    }
  }
}

/**
 * Shifts the red channel left and the blue channel right by `offset` pixels,
 * producing a chromatic aberration / RGB split effect.
 * @param offset - Pixel shift amount. Default 2.
 */
export function chromaticAberrationEffect(offset = 2): PostProcessEffect {
  return (ctx, width, height) => {
    if (width === 0 || height === 0) return
    const imageData = ctx.getImageData(0, 0, width, height)
    const { data } = imageData
    const copy = new Uint8ClampedArray(data)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4

        // Red channel: sample from x + offset (shift left visually)
        const srcR = Math.min(x + offset, width - 1)
        const iR = (y * width + srcR) * 4
        data[i] = copy[iR] // R

        // Green channel: keep in place
        // data[i + 1] = copy[i + 1] // already correct

        // Blue channel: sample from x - offset (shift right visually)
        const srcB = Math.max(x - offset, 0)
        const iB = (y * width + srcB) * 4
        data[i + 2] = copy[iB + 2] // B
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }
}

/**
 * Bloom — extracts pixels above a luminance threshold, blurs them with a
 * multi-pass box blur, and blends the result back additively. Creates a
 * glowing halo around bright elements.
 *
 * Works with the Canvas2D renderer. For the WebGL renderer use the built-in
 * FBO bloom pipeline instead.
 *
 * @param threshold - Luminance cutoff 0–1 above which a pixel contributes to
 *   bloom (default 0.65). Lower values = more bloom.
 * @param intensity - Additive blend strength 0–1 (default 0.6).
 * @param radius - Box-blur radius in pixels — higher = wider glow (default 6).
 *   Internally runs two passes so the blur is approximately Gaussian.
 */
export function bloomEffect(threshold = 0.65, intensity = 0.6, radius = 6): PostProcessEffect {
  return (ctx, width, height) => {
    if (width === 0 || height === 0) return

    const src = ctx.getImageData(0, 0, width, height)
    const { data } = src
    const n = width * height

    // ── 1. Extract bright pixels ──────────────────────────────────────────────
    const bright = new Float32Array(n * 3) // r,g,b floats 0..1
    for (let i = 0; i < n; i++) {
      const r = data[i * 4] / 255
      const g = data[i * 4 + 1] / 255
      const b = data[i * 4 + 2] / 255
      // Perceptual luminance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      if (lum > threshold) {
        const factor = (lum - threshold) / (1 - threshold)
        bright[i * 3] = r * factor
        bright[i * 3 + 1] = g * factor
        bright[i * 3 + 2] = b * factor
      }
    }

    // ── 2. Horizontal box blur ────────────────────────────────────────────────
    const blurH = new Float32Array(n * 3)
    const inv = 1 / (radius * 2 + 1)
    for (let y = 0; y < height; y++) {
      let sr = 0, sg = 0, sb = 0
      for (let x = -radius; x <= radius; x++) {
        const cx = Math.max(0, Math.min(width - 1, x))
        const i = y * width + cx
        sr += bright[i * 3]
        sg += bright[i * 3 + 1]
        sb += bright[i * 3 + 2]
      }
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        blurH[i * 3] = sr * inv
        blurH[i * 3 + 1] = sg * inv
        blurH[i * 3 + 2] = sb * inv
        // Slide window
        const removeX = Math.max(0, x - radius)
        const addX = Math.min(width - 1, x + radius + 1)
        const ri = y * width + removeX
        const ai = y * width + addX
        sr += bright[ai * 3] - bright[ri * 3]
        sg += bright[ai * 3 + 1] - bright[ri * 3 + 1]
        sb += bright[ai * 3 + 2] - bright[ri * 3 + 2]
      }
    }

    // ── 3. Vertical box blur ──────────────────────────────────────────────────
    const blurV = new Float32Array(n * 3)
    for (let x = 0; x < width; x++) {
      let sr = 0, sg = 0, sb = 0
      for (let y = -radius; y <= radius; y++) {
        const cy = Math.max(0, Math.min(height - 1, y))
        const i = cy * width + x
        sr += blurH[i * 3]
        sg += blurH[i * 3 + 1]
        sb += blurH[i * 3 + 2]
      }
      for (let y = 0; y < height; y++) {
        const i = y * width + x
        blurV[i * 3] = sr * inv
        blurV[i * 3 + 1] = sg * inv
        blurV[i * 3 + 2] = sb * inv
        const removeY = Math.max(0, y - radius)
        const addY = Math.min(height - 1, y + radius + 1)
        const ri = removeY * width + x
        const ai = addY * width + x
        sr += blurH[ai * 3] - blurH[ri * 3]
        sg += blurH[ai * 3 + 1] - blurH[ri * 3 + 1]
        sb += blurH[ai * 3 + 2] - blurH[ri * 3 + 2]
      }
    }

    // ── 4. Additive blend back onto src ──────────────────────────────────────
    const out = ctx.getImageData(0, 0, width, height)
    const od = out.data
    for (let i = 0; i < n; i++) {
      od[i * 4] = Math.min(255, od[i * 4] + blurV[i * 3] * intensity * 255)
      od[i * 4 + 1] = Math.min(255, od[i * 4 + 1] + blurV[i * 3 + 1] * intensity * 255)
      od[i * 4 + 2] = Math.min(255, od[i * 4 + 2] + blurV[i * 3 + 2] * intensity * 255)
    }
    ctx.putImageData(out, 0, 0)
  }
}
