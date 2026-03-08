import { useState, useCallback, useMemo } from 'react'
import type { ActionBindings } from '@cubeforge/input'
import { useInput } from './useInput'

export interface BindingControls {
  /** Current bindings (may differ from defaults if the user has rebound keys) */
  readonly bindings: ActionBindings
  /** True every frame any bound key is held */
  isActionDown(action: string): boolean
  /** True only on the first frame any bound key was pressed */
  isActionPressed(action: string): boolean
  /** True only on the frame any bound key was released */
  isActionReleased(action: string): boolean
  /** Rebind an action to a new set of keys. Persists to localStorage. */
  rebind(action: string, keys: string | string[]): void
  /** Reset all bindings to the defaults passed to the hook. Clears localStorage. */
  reset(): void
}

/**
 * Like `useInputMap` but persists key bindings to `localStorage` so they
 * survive page reloads. Provides `rebind` / `reset` for a settings screen.
 *
 * @param storageKey  localStorage key to read/write bindings under
 * @param defaults    Default bindings used when nothing is stored
 *
 * @example
 * const actions = usePersistedBindings('my-game-bindings', {
 *   left:  ['ArrowLeft', 'KeyA'],
 *   right: ['ArrowRight', 'KeyD'],
 *   jump:  ['Space', 'KeyW'],
 * })
 *
 * // Rebind jump to a new key (e.g. from a settings UI):
 * actions.rebind('jump', ['KeyZ', 'Space'])
 *
 * // Reset everything to defaults:
 * actions.reset()
 */
export function usePersistedBindings(
  storageKey: string,
  defaults: ActionBindings,
): BindingControls {
  const [bindings, setBindings] = useState<ActionBindings>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) return { ...defaults, ...JSON.parse(stored) as ActionBindings }
    } catch { /* localStorage unavailable */ }
    return defaults
  })

  const input = useInput()

  // Normalize: ensure every action maps to string[] (skip AxisBinding entries)
  const normalized = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const [action, keys] of Object.entries(bindings)) {
      if (typeof keys === 'string') out[action] = [keys]
      else if (Array.isArray(keys)) out[action] = keys as string[]
      // AxisBinding entries are not supported for isActionDown etc.
    }
    return out
  }, [bindings])

  const rebind = useCallback((action: string, keys: string | string[]) => {
    setBindings(prev => {
      const next = { ...prev, [action]: Array.isArray(keys) ? keys : [keys] }
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [storageKey])

  const reset = useCallback(() => {
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
    setBindings(defaults)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]) // defaults is expected to be a stable literal

  return useMemo(() => ({
    bindings,
    rebind,
    reset,
    isActionDown:     (action: string) => (normalized[action] ?? []).some(k => input.isDown(k)),
    isActionPressed:  (action: string) => (normalized[action] ?? []).some(k => input.isPressed(k)),
    isActionReleased: (action: string) => (normalized[action] ?? []).some(k => input.isReleased(k)),
  }), [bindings, normalized, rebind, reset, input])
}
