import { useState, useCallback, useMemo, useContext } from 'react'
import type { ActionBindings } from '@cubeforge/input'
import { EngineContext } from '@cubeforge/context'

export interface BindingControls {
  readonly bindings: ActionBindings
  isActionDown(action: string): boolean
  isActionPressed(action: string): boolean
  isActionReleased(action: string): boolean
  rebind(action: string, keys: string | string[]): void
  reset(): void
}

export function usePersistedBindings(
  storageKey: string,
  defaults: ActionBindings,
): BindingControls {
  const engine = useContext(EngineContext)!
  const input = engine.input

  const [bindings, setBindings] = useState<ActionBindings>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) return { ...defaults, ...JSON.parse(stored) as ActionBindings }
    } catch { /* localStorage unavailable */ }
    return defaults
  })

  const normalized = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const [action, keys] of Object.entries(bindings)) {
      if (typeof keys === 'string') out[action] = [keys]
      else if (Array.isArray(keys)) out[action] = keys as string[]
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
  }, [storageKey])

  return useMemo(() => ({
    bindings,
    rebind,
    reset,
    isActionDown:     (action: string) => (normalized[action] ?? []).some(k => input.isDown(k)),
    isActionPressed:  (action: string) => (normalized[action] ?? []).some(k => input.isPressed(k)),
    isActionReleased: (action: string) => (normalized[action] ?? []).some(k => input.isReleased(k)),
  }), [bindings, normalized, rebind, reset, input])
}
