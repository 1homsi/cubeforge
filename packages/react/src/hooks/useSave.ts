import { useCallback, useRef } from 'react'

export interface SaveOptions<T> {
  /** Data version number (default 1). Stored alongside saved data. */
  version?: number
  /**
   * Migration function called when the loaded data has an older version.
   * Return the migrated data.
   */
  migrate?: (oldData: unknown, savedVersion: number) => T
}

export interface SaveControls<T> {
  /** The in-memory data reference (same object you passed to `save`). Use `load()` to hydrate from storage. */
  readonly data: T
  /** Persist data to localStorage as JSON. */
  save(value: T): void
  /** Load data from localStorage. Returns the loaded value, or defaultValue if not found. */
  load(): T
  /** Remove the save slot from localStorage. */
  clear(): void
  /** Returns true if a save slot exists in localStorage. */
  exists(): boolean
}

interface StoredSlot<T> {
  version: number
  data: T
}

/**
 * Persistent save/load helper backed by localStorage and JSON serialization.
 *
 * Supports versioning + migration for evolving save formats.
 *
 * @example
 * ```tsx
 * const save = useSave('player-progress', { level: 1, score: 0 })
 *
 * // Load existing save on mount:
 * useEffect(() => { save.load() }, [])
 *
 * // Persist on checkpoint:
 * save.save({ level: 3, score: 4200 })
 * ```
 */
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
