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

