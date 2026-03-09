import { describe, it, expect, beforeEach } from 'vitest'

/**
 * Unit tests for the useSave hook logic.
 *
 * Since useSave is a React hook, we replicate its core save/load logic here
 * with a minimal localStorage mock to validate versioning, migration, and
 * validation behaviour without mounting React components.
 */

interface StoredSlot<T = unknown> {
  version: number
  data: T
}

interface SaveOptions<T> {
  version?: number
  migrate?: (oldData: unknown, savedVersion: number) => T
  validate?: (data: unknown) => data is T
}

// Minimal localStorage mock
const storage = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
}

/**
 * Mirrors the save/load logic from useSave without React dependencies.
 */
function createSave<T>(key: string, defaultValue: T, opts: SaveOptions<T> = {}) {
  const version = opts.version ?? 1

  function save(value: T): void {
    const slot: StoredSlot<T> = { version, data: value }
    mockLocalStorage.setItem(key, JSON.stringify(slot))
  }

  function load(): T {
    const raw = mockLocalStorage.getItem(key)
    if (!raw) return defaultValue
    try {
      const slot = JSON.parse(raw) as StoredSlot<unknown>
      let data: T
      if (opts.migrate && slot.version !== version) {
        data = opts.migrate(slot.data, slot.version)
      } else {
        data = slot.data as T
      }
      if (opts.validate && !opts.validate(data)) {
        return defaultValue
      }
      return data
    } catch {
      return defaultValue
    }
  }

  function clear(): void {
    mockLocalStorage.removeItem(key)
  }

  function exists(): boolean {
    return mockLocalStorage.getItem(key) !== null
  }

  return { save, load, clear, exists }
}

describe('useSave logic', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('round-trips save and load', () => {
    const s = createSave('test', { score: 0 })
    s.save({ score: 42 })
    expect(s.load()).toEqual({ score: 42 })
  })

  it('returns default value when nothing is stored', () => {
    const s = createSave('empty', { score: 0 })
    expect(s.load()).toEqual({ score: 0 })
  })

  it('stores version metadata in the slot', () => {
    const s = createSave('versioned', { x: 1 }, { version: 3 })
    s.save({ x: 10 })
    const raw = JSON.parse(mockLocalStorage.getItem('versioned')!) as StoredSlot
    expect(raw.version).toBe(3)
    expect(raw.data).toEqual({ x: 10 })
  })

  it('migrates data when version differs', () => {
    // Save with version 1
    const v1 = createSave<{ name: string }>('migr', { name: '' }, { version: 1 })
    v1.save({ name: 'Alice' })

    // Load with version 2 and a migrate function
    interface V2Data {
      name: string
      level: number
    }
    const v2 = createSave<V2Data>(
      'migr',
      { name: '', level: 1 },
      {
        version: 2,
        migrate: (old, savedVersion) => {
          expect(savedVersion).toBe(1)
          const prev = old as { name: string }
          return { name: prev.name, level: 1 }
        },
      },
    )

    const result = v2.load()
    expect(result).toEqual({ name: 'Alice', level: 1 })
  })

  it('does not migrate when version matches', () => {
    const s1 = createSave('same', { v: 1 }, { version: 2 })
    s1.save({ v: 99 })

    let migrateCalled = false
    const s2 = createSave(
      'same',
      { v: 0 },
      {
        version: 2,
        migrate: () => {
          migrateCalled = true
          return { v: -1 }
        },
      },
    )
    expect(s2.load()).toEqual({ v: 99 })
    expect(migrateCalled).toBe(false)
  })

  it('returns default value when validation fails', () => {
    const s1 = createSave('val', { score: 0, name: 'a' })
    s1.save({ score: 100, name: 'Bob' })

    const s2 = createSave(
      'val',
      { score: 0, name: '' },
      {
        validate: (data: unknown): data is { score: number; name: string } => {
          if (typeof data !== 'object' || data === null) return false
          const d = data as Record<string, unknown>
          return typeof d.score === 'number' && d.score <= 50
        },
      },
    )

    // score=100 fails validation (must be <= 50), so default is returned
    expect(s2.load()).toEqual({ score: 0, name: '' })
  })

  it('returns loaded data when validation passes', () => {
    const s1 = createSave('valok', { score: 0 })
    s1.save({ score: 30 })

    const s2 = createSave(
      'valok',
      { score: 0 },
      {
        validate: (data: unknown): data is { score: number } => {
          if (typeof data !== 'object' || data === null) return false
          return typeof (data as Record<string, unknown>).score === 'number'
        },
      },
    )

    expect(s2.load()).toEqual({ score: 30 })
  })

  it('returns default value for corrupted JSON', () => {
    mockLocalStorage.setItem('corrupt', '{bad json')
    const s = createSave('corrupt', { x: 0 })
    expect(s.load()).toEqual({ x: 0 })
  })

  it('clear removes stored data', () => {
    const s = createSave('cl', { a: 1 })
    s.save({ a: 2 })
    expect(s.exists()).toBe(true)
    s.clear()
    expect(s.exists()).toBe(false)
    expect(s.load()).toEqual({ a: 1 })
  })
})
