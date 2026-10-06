import { useEffect } from 'react'
import type { PostProcessEffect } from '@cubeforge/renderer'
import { useGame } from './useGame'

/**
 * Registers a post-processing effect for the lifetime of the component.
 * The effect runs in screen space after all scene rendering is complete. On WebGL the finished
 * frame is copied to a 2D canvas, the effects draw on it, and the result is drawn back: that
 * costs a canvas copy and upload per frame while any effect is registered, so prefer
 * `useWebGLPostProcess` (GPU shaders) for the effects it covers.
 *
 * @example
 * ```tsx
 * import { vignetteEffect } from 'cubeforge'
 *
 * function Atmosphere() {
 *   usePostProcess(vignetteEffect(0.5))
 *   return null
 * }
 * ```
 */
export function usePostProcess(effect: PostProcessEffect): void {
  const engine = useGame()

  useEffect(() => {
    engine.postProcessStack.add(effect)
    return () => {
      engine.postProcessStack.remove(effect)
    }
  }, [engine, effect])
}
