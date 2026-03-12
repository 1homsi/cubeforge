// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  DEBUG OVERLAY RENDERER — NOT THE GAME RENDERER                         ║
// ║                                                                          ║
// ║  This file provides a minimal Canvas2D context used exclusively by the  ║
// ║  @cubeforge/devtools debug overlay (wireframes, FPS, physics shapes).    ║
// ║                                                                          ║
// ║  The production renderer is WebGL2: packages/renderer/src/              ║
// ║  webglRenderSystem.ts — exported as RenderSystem from @cubeforge/        ║
// ║  renderer.                                                               ║
// ║                                                                          ║
// ║  DO NOT add game features here. Any rendering code that end users can    ║
// ║  see belongs in webglRenderSystem.ts and shaders.ts.                     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Thin wrapper around a `CanvasRenderingContext2D` used solely for the
 * debug overlay drawn on top of the WebGL canvas in development mode.
 *
 * @internal — consumed by `@cubeforge/devtools`. Not part of the game rendering
 * pipeline. Do not use for game features.
 */
export class DebugOverlayRenderer {
  readonly ctx: CanvasRenderingContext2D

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context from canvas')
    this.ctx = ctx
  }

  clear(color?: string): void {
    if (color && color !== 'transparent') {
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

/** @deprecated Use {@link DebugOverlayRenderer} */
export { DebugOverlayRenderer as Canvas2DRenderer }
