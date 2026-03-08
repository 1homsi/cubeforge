import { useEffect } from 'react'
import type { PostProcessEffect } from '@cubeforge/renderer'
import { useGame } from './useGame'

/**
 * Registers a post-processing effect for the lifetime of the component.
 * The effect runs in screen space after all scene rendering is complete.
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
