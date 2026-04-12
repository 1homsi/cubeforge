import { useCallback, useState } from 'react'

export interface SaveSlotMeta {
  /** Slot identifier (e.g. 'slot-1', 'autosave'). */
  id: string
  /** ISO timestamp of when the slot was last written. */
  savedAt: string
  /** Optional human-readable label (e.g. player name, level name). */
  label?: string
  /** Optional thumbnail data-URL or path stored alongside the save. */
  thumbnail?: string
}

export interface SaveSlot<T> extends SaveSlotMeta {
  /** The saved game data. */
  data: T
}

interface StoredSlot<T> {
  meta: SaveSlotMeta
  data: T
}

export interface SaveSlotsOptions<T> {
  /** Schema version — used for migration. Default 1. */
  version?: number
  /** Called when loading a slot with a different version. */
  migrate?: (oldData: unknown, savedVersion: number) => T
  /** Validate data after load/migrate. Return false to treat as corrupt. */
  validate?: (data: unknown) => data is T
  /** Maximum number of slots to allow. Default unlimited. */
  maxSlots?: number
}

export interface SaveSlotsControls<T> {
  /**
   * Write data to a named slot. Creates the slot if it doesn't exist.
   * @param id      Slot identifier.
   * @param data    Game data to store.
   * @param label   Optional human-readable label.
   * @param thumbnail Optional data-URL thumbnail.
   */
  save(id: string, data: T, label?: string, thumbnail?: string): void

  /**
   * Load data from a named slot.
   * Returns `null` if the slot does not exist or data is corrupt.
   */
  load(id: string): SaveSlot<T> | null

  /**
   * Delete a save slot.
   */
  delete(id: string): void

  /**
   * Copy the contents of one slot to another.
   * Returns false if the source slot does not exist.
   */
  copy(fromId: string, toId: string): boolean

  /**
   * Rename (update the label of) a slot without changing its data.
   */
  rename(id: string, label: string): void

  /**
   * List all saved slots, sorted by `savedAt` descending (most recent first).
   */
  listSlots(): SaveSlotMeta[]

  /**
   * Whether a slot with the given id exists.
   */
  exists(id: string): boolean

  /**
   * Reactive list of slot metadata — updates after every mutation.
   * Use this in JSX to drive a save/load screen.
   */
  readonly slots: SaveSlotMeta[]
}

/**
 * Multi-slot save system backed by `localStorage`. Supports named slots,
 * timestamps, labels, thumbnails, versioned migration, and slot listing.
 *
 * Use `useIDBSave` for saves larger than 5 MB.
 *
 * @example
 * ```tsx
 * const saves = useSaveSlots<GameState>('myGame', {
 *   version: 2,
 *   migrate: (old, v) => v === 1 ? { ...old as any, newField: 0 } : old as GameState,
 * })
 *
 * // Save to a slot:
 * saves.save('slot-1', gameState, 'Level 3 — Forest')
 *
 * // Load from a slot:
 * const slot = saves.load('slot-1')
 * if (slot) setGameState(slot.data)
 *
 * // Render a save screen:
 * saves.slots.map(s => <SaveCard key={s.id} meta={s} />)
 * ```
 */
export function useSaveSlots<T>(namespace: string, opts: SaveSlotsOptions<T> = {}): SaveSlotsControls<T> {
  const version = opts.version ?? 1

  // Index key stores an array of all slot ids for this namespace
  const indexKey = `cubeforge-saves:${namespace}:__index`

  function slotKey(id: string): string {
    return `cubeforge-saves:${namespace}:${id}`
  }

  function readIndex(): string[] {
    try {
      const raw = localStorage.getItem(indexKey)
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      return []
    }
  }

  function writeIndex(ids: string[]): void {
    try {
      localStorage.setItem(indexKey, JSON.stringify(ids))
    } catch {
      // localStorage quota exceeded or unavailable
    }
  }

  function addToIndex(id: string): void {
    const ids = readIndex()
    if (!ids.includes(id)) {
      ids.push(id)
      writeIndex(ids)
    }
  }

  function removeFromIndex(id: string): void {
    writeIndex(readIndex().filter((x) => x !== id))
  }

  function readSlot(id: string): (StoredSlot<T> & { version: number }) | null {
    try {
      const raw = localStorage.getItem(slotKey(id))
      if (!raw) return null
      return JSON.parse(raw) as StoredSlot<T> & { version: number }
    } catch {
      return null
    }
  }

  function writeSlot(id: string, entry: StoredSlot<T> & { version: number }): void {
    try {
      localStorage.setItem(slotKey(id), JSON.stringify(entry))
    } catch {
      console.warn('[CubeForge] useSaveSlots: failed to write slot', id)
    }
  }

  // Reactive slot list
  const [slots, setSlots] = useState<SaveSlotMeta[]>(() => {
    return readIndex()
      .map((id) => readSlot(id)?.meta)
      .filter((m): m is SaveSlotMeta => m !== undefined)
      .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
  })

  function refreshSlots(): void {
    const metas = readIndex()
      .map((id) => readSlot(id)?.meta)
      .filter((m): m is SaveSlotMeta => m !== undefined)
      .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
    setSlots(metas)
  }

  const save = useCallback(
    (id: string, data: T, label?: string, thumbnail?: string): void => {
      const meta: SaveSlotMeta = {
        id,
        savedAt: new Date().toISOString(),
        label,
        thumbnail,
      }
      writeSlot(id, { version, meta, data })
      addToIndex(id)
      refreshSlots()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namespace, version],
  )

  const load = useCallback(
    (id: string): SaveSlot<T> | null => {
      const entry = readSlot(id)
      if (!entry) return null
      let data: T
      if (opts.migrate && entry.version !== version) {
        data = opts.migrate(entry.data, entry.version)
      } else {
        data = entry.data as T
      }
      if (opts.validate && !opts.validate(data)) return null
      return { ...entry.meta, data }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namespace, version],
  )

  const deleteFn = useCallback(
    (id: string): void => {
      try {
        localStorage.removeItem(slotKey(id))
      } catch {
        // ignore
      }
      removeFromIndex(id)
      refreshSlots()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namespace],
  )

  const copy = useCallback(
    (fromId: string, toId: string): boolean => {
      const entry = readSlot(fromId)
      if (!entry) return false
      const newMeta: SaveSlotMeta = { ...entry.meta, id: toId, savedAt: new Date().toISOString() }
      writeSlot(toId, { ...entry, meta: newMeta })
      addToIndex(toId)
      refreshSlots()
      return true
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namespace, version],
  )

  const rename = useCallback(
    (id: string, label: string): void => {
      const entry = readSlot(id)
      if (!entry) return
      writeSlot(id, { ...entry, meta: { ...entry.meta, label } })
      refreshSlots()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namespace],
  )

  const listSlots = useCallback((): SaveSlotMeta[] => {
    return readIndex()
      .map((id) => readSlot(id)?.meta)
      .filter((m): m is SaveSlotMeta => m !== undefined)
      .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace])

  const exists = useCallback(
    (id: string): boolean => {
      return readSlot(id) !== null
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namespace],
  )

  return {
    save,
    load,
    delete: deleteFn,
    copy,
    rename,
    listSlots,
    exists,
    get slots() {
      return slots
    },
  }
}
