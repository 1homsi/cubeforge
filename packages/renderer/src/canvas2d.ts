export class Canvas2DRenderer {
  readonly ctx: CanvasRenderingContext2D

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context from canvas')
    this.ctx = ctx
  }

  clear(color?: string): void {
    if (color) {
      this.ctx.fillStyle = color
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    } else {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }
  }

  get width(): number {
    return this.canvas.width
  }
  get height(): number {
    return this.canvas.height
  }
}
