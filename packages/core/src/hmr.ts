/**
 * Module-level state store that survives hot module replacement.
 * Uses a global variable to persist across module re-evaluations.
 *
 * This is the framework-agnostic foundation — React integration uses
 * these primitives via the `useHMR` hook.
 */

const HMR_STORE_KEY = '__CUBEFORGE_HMR_STORE__'

interface HMRStore {
  states: Map<string, unknown>
  version: number
}

function getStore(): HMRStore {
  const g = globalThis as Record<string, unknown>
  if (!g[HMR_STORE_KEY]) {
    g[HMR_STORE_KEY] = { states: new Map<string, unknown>(), version: 0 }
  }
  return g[HMR_STORE_KEY] as HMRStore
}

/** Persist a value under `key` so it survives the next hot update. */
export function hmrSaveState(key: string, state: unknown): void {
  const store = getStore()
  store.states.set(key, state)
  store.version++
}

/** Retrieve a previously saved value (returns `undefined` on first load). */
export function hmrLoadState<T>(key: string): T | undefined {
  return getStore().states.get(key) as T | undefined
}

/** Remove a single key from the HMR store. */
export function hmrClearState(key: string): void {
  getStore().states.delete(key)
}

/** Monotonically increasing counter — bumped on every `hmrSaveState` call. */
export function hmrGetVersion(): number {
  return getStore().version
}
