import { useEffect, useRef, useMemo } from 'react'
import { hmrSaveState, hmrLoadState } from '@cubeforge/core'

/**
 * Controls returned by {@link useHMR}.
 */
export interface HMRControls {
  /** Register a handler that serializes state before hot update */
  onDispose(handler: () => unknown): void
  /** Register a handler that restores state after hot update */
  onAccept(handler: (prevState: unknown) => void): void
  /** Whether this is a hot reload (vs initial load) */
  isHotReload: boolean
}

// Unique counter so multiple useHMR calls in the same module get distinct keys.
let idCounter = 0

/**
 * Hook that enables HMR-aware game development.
 * When a module is hot-updated, preserves game state instead of full reload.
 *
 * Uses the Vite `import.meta.hot` API under the hood; in production builds
 * (or bundlers without HMR support) the hook is a harmless no-op.
 *
 * @param hmrKey Optional stable key to identify this HMR slot. When omitted an
 *               auto-incrementing id is used (stable across hot reloads because
 *               the counter resets with each module re-evaluation).
 *
 * @example
 * ```tsx
 * function PlayerScript({ x, y }) {
 *   const hmr = useHMR('player')
 *
 *   // Serialize state on HMR dispose
 *   hmr.onDispose(() => ({
 *     health: playerHealth,
 *     position: { x: transform.x, y: transform.y },
 *   }))
 *
 *   // Restore state on HMR accept
 *   hmr.onAccept((prevState) => {
 *     if (prevState) {
 *       const s = prevState as { health: number }
 *       playerHealth = s.health
 *     }
 *   })
 * }
 * ```
 */
export function useHMR(hmrKey?: string): HMRControls {
  // Stable id for the lifetime of this hook instance.
  const idRef = useRef<string | null>(null)
  if (idRef.current === null) {
    idRef.current = hmrKey ?? `__hmr_${idCounter++}`
  }
  const key = idRef.current

  // Check whether we have prior state (i.e. this is a hot reload).
  const isHotReload = hmrLoadState(key) !== undefined

  // Mutable refs so the latest handler versions are always called.
  const disposeRef = useRef<(() => unknown) | null>(null)
  const acceptRef = useRef<((prev: unknown) => void) | null>(null)

  // Wire up Vite HMR lifecycle when available.
  useEffect(() => {
    // Vite exposes import.meta.hot at dev time.
    const hot = (import.meta as unknown as { hot?: ViteHot }).hot
    if (!hot) return

    // On dispose (just before the old module is torn down) — serialize state.
    hot.dispose(() => {
      if (disposeRef.current) {
        const state = disposeRef.current()
        hmrSaveState(key, state)
      }
    })

    // On accept — the new module is now running. If there's a stored value and
    // the consumer registered an accept handler, call it.
    const prev = hmrLoadState(key)
    if (prev !== undefined && acceptRef.current) {
      acceptRef.current(prev)
    }
  }, [key])

  return useMemo(
    (): HMRControls => ({
      onDispose(handler: () => unknown) {
        disposeRef.current = handler
      },
      onAccept(handler: (prevState: unknown) => void) {
        acceptRef.current = handler
        // If state already exists when onAccept is called (late registration),
        // invoke immediately so the consumer can restore.
        const prev = hmrLoadState(key)
        if (prev !== undefined) {
          handler(prev)
        }
      },
      isHotReload,
    }),
    [key, isHotReload],
  )
}

/** Minimal subset of the Vite HMR API we rely on. */
interface ViteHot {
  dispose(cb: (data: unknown) => void): void
  accept(cb?: (mod: unknown) => void): void
}
