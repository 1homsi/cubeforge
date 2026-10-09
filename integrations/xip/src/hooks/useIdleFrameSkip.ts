import { useEffect } from 'react'
import { useGame } from './useGame'

/**
 * Enables the WebGL renderer's idle frame skip optimisation.
 *
 * When enabled the renderer hashes visible entity positions, animation frame
 * indices, and camera state every tick. If the hash matches the previous frame
 * the GPU draw calls are skipped entirely and the cached scene is blitted to
 * screen instead — saving significant CPU/GPU work in static or low-motion
 * scenes (pause screens, dialogue boxes, turn-based games).
 *
 * Active particle systems and playing animations automatically force a redraw
 * even when the rest of the scene is unchanged.
 *
 * Call this once at the game or scene root level:
 *
 * @example
 * ```tsx
 * function GameScene() {
 *   useIdleFrameSkip()
 *   return <>{children}</>
 * }
 * ```
 *
 * Pass `false` to disable it (e.g. in a child component that needs full
 * redraws while a cutscene plays):
 * ```tsx
 * useIdleFrameSkip(false)
 * ```
 */
export function useIdleFrameSkip(enabled = true): void {
  const engine = useGame()

  useEffect(() => {
    const rs = engine.activeRenderSystem as { setIdleFrameSkip?: (v: boolean) => void }
    rs.setIdleFrameSkip?.(enabled)
    return () => {
      rs.setIdleFrameSkip?.(false)
    }
  }, [engine, enabled])
}
