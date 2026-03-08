import { useSyncExternalStore, useCallback } from 'react'

type Listener = () => void

interface Store<T> {
  getState(): T
  setState(partial: Partial<T> | ((prev: T) => Partial<T>)): void
  subscribe(listener: Listener): () => void
}

function createStore<T extends Record<string, unknown>>(initialState: T): Store<T> {
  let state = { ...initialState }
  const listeners = new Set<Listener>()

  return {
    getState: () => state,
    setState: (partial) => {
      const updates = typeof partial === 'function' ? partial(state) : partial
      state = { ...state, ...updates }
      listeners.forEach(l => l())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

// Module-level store registry
const stores = new Map<string, Store<any>>()

export function useGameStore<T extends Record<string, unknown>>(
  key: string,
  initialState: T,
): [T, (partial: Partial<T> | ((prev: T) => Partial<T>)) => void] {
  if (!stores.has(key)) {
    stores.set(key, createStore(initialState))
  }
  const store = stores.get(key)! as Store<T>

  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
  )

  const setState = useCallback((partial: Partial<T> | ((prev: T) => Partial<T>)) => {
    store.setState(partial)
  }, [store])

  return [state, setState]
}
