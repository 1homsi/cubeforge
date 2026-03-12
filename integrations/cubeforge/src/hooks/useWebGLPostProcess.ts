import { useEffect, useMemo } from 'react'
import type { PostProcessOptions } from '@cubeforge/renderer'
import { useGame } from './useGame'

/**
 * Configures native WebGL2 post-processing effects on the render system.
 * Effects run entirely on the GPU via a scene FBO + shader pipeline.
 *
 * Unlike `usePostProcess` (Canvas2D, deprecated for game use), these effects
 * work with the WebGL renderer and have no per-pixel CPU cost.
 *
 * @param opts - Post-process configuration. Wrap in `useMemo` for stability.
 *
 * @example
 * ```tsx
 * import { useMemo } from 'react'
 * import { useWebGLPostProcess } from 'cubeforge'
 *
 * function Atmosphere() {
 *   const pp = useMemo(() => ({
 *     bloom: { enabled: true, threshold: 0.6, intensity: 0.5 },
 *     vignette: { enabled: true, intensity: 0.35 },
 *   }), [])
 *   useWebGLPostProcess(pp)
 *   return null
 * }
 * ```
 */
export function useWebGLPostProcess(opts: PostProcessOptions): void {
  const engine = useGame()

  // Stable serialized key so the effect re-runs only when options actually change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const optsKey = useMemo(() => JSON.stringify(opts), [JSON.stringify(opts)])

  useEffect(() => {
    const rs = engine.activeRenderSystem as { setPostProcessOptions?: (o: PostProcessOptions) => void }
    rs.setPostProcessOptions?.(opts)
    return () => {
      rs.setPostProcessOptions?.({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, optsKey])
}
