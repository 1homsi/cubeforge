import { useMemo } from 'react'
import { useGame } from './useGame'

export type ScreenTintMode = 'multiply' | 'normal' | 'additive'

export interface ScreenTintControls {
  /** Channels 0..1; `strength` 0..1 (0 = off). Cheap enough to call every frame. */
  set(r: number, g: number, b: number, strength: number, mode?: ScreenTintMode): void
  clear(): void
}

type TintRenderer = {
  setScreenTint?: (r: number, g: number, b: number, a: number, mode?: ScreenTintMode) => void
}

/**
 * Tint the whole world view, drawn after sprites and layers and before text.
 * Use 'multiply' for a day/night cycle, 'normal' for fog or weather, and
 * 'additive' for a lightning flash.
 *
 * @example
 * ```ts
 * const tint = useScreenTint()
 * tint.set(0.25, 0.3, 0.6, night) // night in 0..1
 * ```
 */
export function useScreenTint(): ScreenTintControls {
  const engine = useGame()
  return useMemo(() => {
    const rs = () => engine.activeRenderSystem as TintRenderer
    return {
      set(r, g, b, strength, mode = 'multiply') {
        rs().setScreenTint?.(r, g, b, strength, mode)
        engine.loop.markDirty()
      },
      clear() {
        rs().setScreenTint?.(1, 1, 1, 0)
        engine.loop.markDirty()
      },
    }
  }, [engine])
}
