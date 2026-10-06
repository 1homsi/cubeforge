// Canvas2D paths for the Sprite `shape` presets, traced into a rect at (x, y) of size w x h.

function polygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sides: number): void {
  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const a = (i * 2 * Math.PI) / sides - Math.PI / 2
    const px = cx + r * Math.cos(a)
    const py = cy + r * Math.sin(a)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points: number, inner: number): void {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * inner
    const px = cx + rad * Math.cos(a)
    const py = cy + rad * Math.sin(a)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

/** Begin a path for `shape` filling the rect; the caller fills and/or strokes it. */
export function traceShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  x: number,
  y: number,
  w: number,
  h: number,
  borderRadius: number,
  starPoints: number,
  starInnerRadius: number,
): void {
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(Math.abs(w), Math.abs(h)) / 2
  switch (shape) {
    case 'circle':
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      break
    case 'ellipse':
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2)
      break
    case 'roundedRect':
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, Math.min(borderRadius, Math.abs(w) / 2, Math.abs(h) / 2))
      break
    case 'triangle':
      ctx.beginPath()
      ctx.moveTo(cx, y)
      ctx.lineTo(x + w, y + h)
      ctx.lineTo(x, y + h)
      ctx.closePath()
      break
    case 'pentagon':
      polygon(ctx, cx, cy, r, 5)
      break
    case 'hexagon':
      polygon(ctx, cx, cy, r, 6)
      break
    case 'star':
      star(ctx, cx, cy, r, starPoints, starInnerRadius)
      break
    default:
      ctx.beginPath()
      ctx.rect(x, y, w, h)
  }
}
