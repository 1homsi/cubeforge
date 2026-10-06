// Dynamic-import target for <Game>: keeps the Canvas2D renderer out of the main bundle.
// Nothing in the renderer's index may import it statically, or it joins the shared chunk.
import { Canvas2DRenderSystem } from '@cubeforge/renderer/canvas2d'

let warned = false

/** Build the Canvas2D system. `fellBack` means WebGL2 failed first: say so once. */
export function createCanvas2D(canvas: HTMLCanvasElement, entityIds: Map<string, number>, fellBack: boolean) {
  if (fellBack && !warned) {
    warned = true
    console.warn('[Cubeforge] WebGL2 is unavailable; using the Canvas2D renderer (no post-process effects).')
  }
  return new Canvas2DRenderSystem(canvas, entityIds)
}
