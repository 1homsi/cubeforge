// Dynamic-import target for <Game>: keeps the Canvas2D renderer out of the main bundle.
// Nothing in the renderer's index may import it statically, or it joins the shared chunk.
export { Canvas2DRenderSystem } from '@cubeforge/renderer/canvas2d'
