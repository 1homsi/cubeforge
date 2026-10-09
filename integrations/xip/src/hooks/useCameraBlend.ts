import { useMemo } from 'react'
import { useGame } from './useGame'
import { getRegistry } from '../components/VirtualCamera'

export interface CameraBlendControls {
  /**
   * Activate a registered virtual camera by id.
   * If the camera has a lower priority than the current one, raising its
   * priority temporarily is more ergonomic — but activating it is the
   * simplest way to hand off control from code.
   */
  activate(id: string): void

  /**
   * Deactivate a registered virtual camera by id.
   * The next highest-priority active camera takes over automatically.
   */
  deactivate(id: string): void

  /**
   * Force a specific virtual camera to take over immediately, regardless of
   * priority, by temporarily setting its priority to a very high value and
   * activating it. Call `restore()` to return to normal priority-based control.
   */
  override(id: string): void

  /**
   * Remove any priority override set by `override()`, restoring the camera's
   * original priority.
   */
  restore(id: string): void

  /**
   * Returns the id of the virtual camera currently in control, or null if
   * no virtual cameras are active.
   */
  getActiveId(): string | null
}

const OVERRIDE_PRIORITY = 999_999
const originalPriorities = new WeakMap<WeakKey, Map<string, number>>()

/**
 * Imperative controls for the virtual camera system. Lets you activate,
 * deactivate, and force-override virtual cameras from game logic.
 *
 * Must be used inside `<Game>`.
 *
 * @example
 * ```tsx
 * function BossEncounter() {
 *   const cam = useCameraBlend()
 *
 *   useEffect(() => {
 *     cam.override('bossArena')
 *     return () => cam.restore('bossArena')
 *   }, [])
 * }
 * ```
 */
export function useCameraBlend(): CameraBlendControls {
  const engine = useGame()

  return useMemo((): CameraBlendControls => {
    function getOverrides(): Map<string, number> {
      if (!originalPriorities.has(engine)) originalPriorities.set(engine, new Map())
      return originalPriorities.get(engine)!
    }

    return {
      activate(id) {
        const entry = getRegistry(engine).get(id)
        if (entry) entry.active = true
      },

      deactivate(id) {
        const entry = getRegistry(engine).get(id)
        if (entry) entry.active = false
      },

      override(id) {
        const entry = getRegistry(engine).get(id)
        if (!entry) return
        const overrides = getOverrides()
        if (!overrides.has(id)) overrides.set(id, entry.priority)
        entry.priority = OVERRIDE_PRIORITY
        entry.active = true
      },

      restore(id) {
        const entry = getRegistry(engine).get(id)
        if (!entry) return
        const overrides = getOverrides()
        const original = overrides.get(id)
        if (original !== undefined) {
          entry.priority = original
          overrides.delete(id)
        }
      },

      getActiveId() {
        const registry = getRegistry(engine)
        let best: { id: string; priority: number } | null = null
        for (const vc of registry.values()) {
          if (!vc.active) continue
          if (!best || vc.priority > best.priority) best = vc
        }
        return best?.id ?? null
      },
    }
  }, [engine])
}
