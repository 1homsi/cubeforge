import { useContext } from 'react'
import { RenderSystem3D } from '@cubeforge/renderer3d'
import { Engine3DContext } from '../context3d'

/**
 * Module-level registry mapping each Game3D canvas to the RenderSystem3D
 * created for it. Populated by registerRenderSystem3D(); read by useRenderSystem3D().
 */
const _registry = new WeakMap<HTMLCanvasElement, RenderSystem3D>()

/**
 * Register a RenderSystem3D with the canvas belonging to the current engine
 * instance. Call this once after constructing the system — typically inside a
 * useEffect in a component rendered inside <Game3D>.
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   if (!engine) return
 *   const sys = new RenderSystem3D({ renderer: engine.renderer, scene: engine.scene, camera: engine.camera })
 *   registerRenderSystem3D(engine.canvas, sys)
 *   return () => sys.dispose()
 * }, [engine])
 * ```
 */
export function registerRenderSystem3D(canvas: HTMLCanvasElement, system: RenderSystem3D): void {
  _registry.set(canvas, system)
}

/**
 * Returns the RenderSystem3D registered for the current Game3D engine, or
 * null if none has been registered yet.
 *
 * Useful for imperatively calling registerGeometry / registerMaterial from
 * child components.
 */
export function useRenderSystem3D(): RenderSystem3D | null {
  const engine = useContext(Engine3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] useRenderSystem3D must be called inside a <Game3D>.')
    }
  }

  if (!engine) return null
  return _registry.get(engine.canvas) ?? null
}
