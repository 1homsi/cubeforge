import { useCallback, useRef } from 'react'

export interface IDBSaveOptions<T> {
  version?: number
  migrate?: (oldData: unknown, savedVersion: number) => T
  validate?: (data: unknown) => data is T
}

export interface IDBSaveControls<T> {
  save(value: T): Promise<void>
  load(): Promise<T>
  clear(): Promise<void>
  exists(): Promise<boolean>
}

interface StoredSlot<T> {
  version: number
  data: T
}

const DB_NAME = 'cubeforge-saves'
const STORE_NAME = 'saves'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Async IndexedDB-backed save slot with version migration support.
 * Handles saves larger than localStorage's ~5 MB limit.
 *
 * The interface is async (Promise-based) unlike `useSave` which is synchronous.
 *
 * @example
 * ```tsx
 * const save = useIDBSave('myGame', { level: 1, score: 0 })
 *
 * // On save:
 * await save.save({ level: 2, score: 1500 })
 *
 * // On load:
 * const data = await save.load()
 * ```
 */
export function useIDBSave<T>(key: string, defaultValue: T, opts: IDBSaveOptions<T> = {}): IDBSaveControls<T> {
  const version = opts.version ?? 1
  const dbRef = useRef<Promise<IDBDatabase> | null>(null)

  const getDB = useCallback((): Promise<IDBDatabase> => {
    if (!dbRef.current) dbRef.current = openDB()
    return dbRef.current
  }, [])

  const save = useCallback(
    async (value: T): Promise<void> => {
      const db = await getDB()
      const slot: StoredSlot<T> = { version, data: value }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const req = tx.objectStore(STORE_NAME).put(slot, key)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    },
    [getDB, key, version],
  )

  const load = useCallback(async (): Promise<T> => {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => {
        const slot = req.result as StoredSlot<unknown> | undefined
        if (!slot) {
          resolve(defaultValue)
          return
        }
        let data: T
        if (opts.migrate && slot.version !== version) {
          data = opts.migrate(slot.data, slot.version)
        } else {
          data = slot.data as T
        }
        if (opts.validate && !opts.validate(data)) {
          resolve(defaultValue)
          return
        }
        resolve(data)
      }
      req.onerror = () => reject(req.error)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getDB, key, version])

  const clear = useCallback(async (): Promise<void> => {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }, [getDB, key])

  const exists = useCallback(async (): Promise<boolean> => {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).count(key)
      req.onsuccess = () => resolve(req.result > 0)
      req.onerror = () => reject(req.error)
    })
  }, [getDB, key])

  return { save, load, clear, exists }
}
