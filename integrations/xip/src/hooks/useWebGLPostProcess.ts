import { useEffect, useMemo } from 'react'
import type { PostProcessOptions } from '@xip/renderer'
import { useGame } from './useGame'

/**
 * Configures native WebGL2 post-processing effects on the render system.
 * Effects run entirely on the GPU via a scene FBO + shader pipeline.
 *
 * Unlike `usePostProcess` (arbitrary Canvas2D drawing, which costs a frame copy per frame),
 * these effects run as shaders and have no per-pixel CPU cost.
 *
 * @param opts - Post-process configuration. Wrap in `useMemo` for stability.
 *
 * @example
 * ```tsx
 * import { useMemo } from 'react'
 * import { useWebGLPostProcess } from 'xipjs'
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
