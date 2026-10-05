import type { TextComponent } from './components/text'

/**
 * Canvas2D rasterisation of one `Text` component into a texture-sized canvas.
 * Used for text the glyph atlas cannot lay out faithfully (right-to-left and
 * complex scripts, `maxWidth` squeeze without `wordWrap`).
 */
export interface TextRaster {
  canvas: HTMLCanvasElement
  /** Canvas size in raster px. */
  w: number
  h: number
  /** Position of the text origin (the entity position) inside the canvas, raster px. */
  ax: number
  ay: number
  scale: number
}

const font = (t: TextComponent, scale: number): string =>
  `${t.fontStyle === 'italic' ? 'italic ' : ''}${t.fontWeight ?? 'normal'} ${(t.fontSize ?? 16) * scale}px ${t.fontFamily ?? 'monospace'}`

/** Everything that changes the pixels (opacity does not: it is a vertex colour). */
export function textRasterKey(t: TextComponent, scale: number): string {
  return [
    t.text,
    t.fontSize ?? 16,
    t.fontFamily ?? 'monospace',
    t.fontWeight ?? '',
    t.fontStyle ?? '',
    t.color ?? '#ffffff',
    t.align ?? 'center',
    t.baseline ?? 'middle',
    t.maxWidth ?? 0,
    t.wordWrap ? 1 : 0,
    t.lineHeight ?? 1.2,
    t.strokeColor ?? '',
    t.strokeWidth ?? 0,
    t.shadowColor ?? '',
    t.shadowOffsetX ?? 2,
    t.shadowOffsetY ?? 2,
    t.shadowBlur ?? 0,
    scale,
  ].join('|')
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line)
        line = word
      } else line = test
    }
    out.push(line)
  }
  return out
}

export function rasterizeText(t: TextComponent, scale: number): TextRaster {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const fs = (t.fontSize ?? 16) * scale
  ctx.font = font(t, scale)
  const maxW = t.maxWidth ? t.maxWidth * scale : 0
  const lines = t.wordWrap && maxW ? wrap(ctx, t.text, maxW) : t.text.split('\n')
  let textW = 0
  for (const l of lines) textW = Math.max(textW, ctx.measureText(l).width)
  if (maxW && !t.wordWrap) textW = Math.min(textW, maxW)
  const strokeW = t.strokeColor && t.strokeWidth ? t.strokeWidth * scale : 0
  const sx = (t.shadowOffsetX ?? 2) * scale
  const sy = (t.shadowOffsetY ?? 2) * scale
  const blur = (t.shadowBlur ?? 0) * scale
  const pad = Math.ceil(strokeW / 2 + (t.shadowColor ? blur + Math.max(Math.abs(sx), Math.abs(sy)) : 0)) + 2
  const lineH = fs * (t.lineHeight ?? 1.2)
  const align = t.align ?? 'center'
  const left = align === 'right' || align === 'end' ? textW : align === 'center' ? textW / 2 : 0
  const ax = pad + left
  const ay = pad + fs // room above the origin for 'bottom' / 'alphabetic' baselines
  const w = Math.ceil(textW + pad * 2)
  const h = Math.ceil(ay + (lines.length - 1) * lineH + fs * 1.5 + pad)
  canvas.width = Math.max(1, w)
  canvas.height = Math.max(1, h)
  // Resizing resets the context state.
  ctx.font = font(t, scale)
  ctx.textAlign = align
  ctx.textBaseline = t.baseline ?? 'middle'
  ctx.lineJoin = 'round'
  if (t.shadowColor) {
    ctx.shadowColor = t.shadowColor
    ctx.shadowOffsetX = sx
    ctx.shadowOffsetY = sy
    ctx.shadowBlur = blur
  }
  for (let i = 0; i < lines.length; i++) {
    const y = ay + i * lineH
    if (strokeW) {
      ctx.strokeStyle = t.strokeColor!
      ctx.lineWidth = strokeW
      if (maxW && !t.wordWrap) ctx.strokeText(lines[i], ax, y, maxW)
      else ctx.strokeText(lines[i], ax, y)
    }
    ctx.fillStyle = t.color ?? '#ffffff'
    if (maxW && !t.wordWrap) ctx.fillText(lines[i], ax, y, maxW)
    else ctx.fillText(lines[i], ax, y)
  }
  return { canvas, w: canvas.width, h: canvas.height, ax, ay, scale }
}
