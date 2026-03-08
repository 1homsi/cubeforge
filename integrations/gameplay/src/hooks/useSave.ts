import { useCallback, useRef } from 'react'

export interface SaveOptions<T> {
  version?: number
  migrate?: (oldData: unknown, savedVersion: number) => T
}

export interface SaveControls<T> {
  readonly data: T
  save(value: T): void
  load(): T
  clear(): void
  exists(): boolean
}

interface StoredSlot<T> {
  version: number
  data: T
}

export function useSave<T>(
  key: string,
  defaultValue: T,
  opts: SaveOptions<T> = {},
): SaveControls<T> {
  const version = opts.version ?? 1
  const dataRef = useRef<T>(defaultValue)

  const save = useCallback((value: T): void => {
    dataRef.current = value
    const slot: StoredSlot<T> = { version, data: value }
    try {
      localStorage.setItem(key, JSON.stringify(slot))
    } catch (err) {
      console.warn('[Cubeforge] useSave: failed to write to localStorage', err)
    }
  }, [key, version])

  const load = useCallback((): T => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return defaultValue
      const slot = JSON.parse(raw) as StoredSlot<unknown>
      let data: T
      if (opts.migrate && slot.version < version) {
        data = opts.migrate(slot.data, slot.version)
      } else {
        data = slot.data as T
      }
      dataRef.current = data
      return data
    } catch {
      return defaultValue
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version])

  const clear = useCallback((): void => {
    localStorage.removeItem(key)
    dataRef.current = defaultValue
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const exists = useCallback((): boolean => {
    return localStorage.getItem(key) !== null
  }, [key])

  return {
    get data() { return dataRef.current },
    save,
    load,
    clear,
    exists,
  }
}
