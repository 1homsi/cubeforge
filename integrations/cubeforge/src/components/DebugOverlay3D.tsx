/**
 * DebugOverlay3D — React component that mounts a DebugRenderer3D inside a
 * <Game3D> and renders debug overlays every frame after the main render pass.
 *
 * @example
 * ```tsx
 * <Game3D>
 *   <DebugOverlay3D axes boundingBoxes grid />
 * </Game3D>
 * ```
 */

import { useContext, useEffect, useRef } from 'react'
import { DebugRenderer3D, type DebugOptions } from '@cubeforge/renderer3d'
import { Engine3DContext } from '../context3d'

export interface DebugOverlay3DProps extends DebugOptions {
  /** Master enable/disable switch (default true) */
  enabled?: boolean
}

/**
 * Mounts a DebugRenderer3D that is invoked on every frame after the main
 * render pass. Returns null (renders nothing into the DOM).
 */
export function DebugOverlay3D(props: DebugOverlay3DProps): null {
  const { enabled = true, ...opts } = props
  const engine = useContext(Engine3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <DebugOverlay3D> must be used inside a <Game3D>.')
    }
  }

  // Keep a stable ref to the DebugRenderer3D instance across re-renders.
  const debugRef = useRef<DebugRenderer3D | null>(null)

  // ── Initialise and register the frame listener ──────────────────────────────
  useEffect(() => {
    if (!engine) return

    const debug = new DebugRenderer3D(engine.renderer.gl, opts)
    debug.enabled = enabled
    debugRef.current = debug

    const frameListener = (_dt: number) => {
      debug.render(engine.scene, engine.camera)
    }
    engine._frameListeners.add(frameListener)

    return () => {
      engine._frameListeners.delete(frameListener)
      debug.dispose()
      debugRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  // ── Sync options and enabled flag on every render without remounting ─────────
  useEffect(() => {
    const debug = debugRef.current
    if (!debug) return
    debug.enabled = enabled
    debug.options = { ...opts }
  })

  return null
}
