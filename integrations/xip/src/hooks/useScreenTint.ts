import { useMemo } from 'react'
import { useGame } from './useGame'

export type ScreenTintMode = 'multiply' | 'normal' | 'additive' | 'screen'

export interface ScreenTintOptions {
  /**
   * Tint slot name. Tints with different names stack (e.g. 'night' and 'weather').
   * Default 'screen', the single legacy slot.
   */
  name?: string
  /**
   * Render layer / zIndex the tint sorts at: it only covers what is drawn before
   * that point (sprites, layers and text layers with a lower or equal layer + zIndex),
   * so text, UI and effects drawn later stay bright. Omit both to tint the whole
   * world after all sprites.
   */
  layer?: string
  zIndex?: number
}

export interface ScreenTintControls {
  /** Channels 0..1; `strength` 0..1 (0 = off). Cheap enough to call every frame. */
  set(r: number, g: number, b: number, strength: number, mode?: ScreenTintMode): void
  clear(): void
}

type TintRenderer = {
  setScreenTint?: (r: number, g: number, b: number, a: number, mode?: ScreenTintMode) => void
  setTint?: (
    name: string,
    r: number,
    g: number,
    b: number,
    a: number,
    opts?: { mode?: ScreenTintMode; layer?: string; zIndex?: number },
  ) => void
}

/**
 * Tint the world view. Use 'multiply' for a day/night cycle, 'normal' for fog or
 * weather, 'additive' for a lightning flash and 'screen' for a soft glow. By
 * default it is drawn after sprites and layers and before text; give `zIndex`
 * (and `layer`) to tint only what is drawn below that point, and a `name` to
 * stack several tints.
 *
 * @example
 * ```ts
 * const night = useScreenTint({ name: 'night', zIndex: 50 }) // dims ground + sprites <= 50, not the UI
 * night.set(0.25, 0.3, 0.6, strength) // strength in 0..1
 * const fog = useScreenTint({ name: 'fog' })
 * fog.set(0.8, 0.85, 0.9, 0.2, 'normal')
 * ```
 */
export function useScreenTint(options: ScreenTintOptions = {}): ScreenTintControls {
  const engine = useGame()
  const { name, layer, zIndex } = options
  return useMemo(() => {
    const rs = () => engine.activeRenderSystem as TintRenderer
    const named = name !== undefined || layer !== undefined || zIndex !== undefined
    const slot = name ?? 'screen'
    return {
      set(r, g, b, strength, mode = 'multiply') {
        if (named) rs().setTint?.(slot, r, g, b, strength, { mode, layer, zIndex })
        else rs().setScreenTint?.(r, g, b, strength, mode)
        engine.loop.markDirty()
      },
      clear() {
        if (named) rs().setTint?.(slot, 1, 1, 1, 0, { layer, zIndex })
        else rs().setScreenTint?.(1, 1, 1, 0)
        engine.loop.markDirty()
      },
    }
  }, [engine, name, layer, zIndex])
}
