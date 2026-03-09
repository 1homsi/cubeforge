import { describe, it, expect, beforeEach } from 'vitest'
import { hmrSaveState, hmrLoadState, hmrClearState, hmrGetVersion } from '../hmr'

const HMR_STORE_KEY = '__CUBEFORGE_HMR_STORE__'

describe('hmr', () => {
  beforeEach(() => {
    // Reset the global store between tests.
    delete (globalThis as Record<string, unknown>)[HMR_STORE_KEY]
  })

  it('round-trips state via save/load', () => {
    hmrSaveState('player', { health: 100, x: 42 })
    expect(hmrLoadState<{ health: number; x: number }>('player')).toEqual({
      health: 100,
      x: 42,
    })
  })

  it('returns undefined for keys that were never saved', () => {
    expect(hmrLoadState('nonexistent')).toBeUndefined()
  })

  it('clears a specific key', () => {
    hmrSaveState('a', 1)
    hmrSaveState('b', 2)
    hmrClearState('a')
    expect(hmrLoadState('a')).toBeUndefined()
    expect(hmrLoadState('b')).toBe(2)
  })

  it('increments version on each save', () => {
    const v0 = hmrGetVersion()
    hmrSaveState('x', 'hello')
    expect(hmrGetVersion()).toBe(v0 + 1)
    hmrSaveState('y', 'world')
    expect(hmrGetVersion()).toBe(v0 + 2)
  })

  it('stores multiple keys independently', () => {
    hmrSaveState('k1', { a: 1 })
    hmrSaveState('k2', [1, 2, 3])
    hmrSaveState('k3', 'text')

    expect(hmrLoadState('k1')).toEqual({ a: 1 })
    expect(hmrLoadState('k2')).toEqual([1, 2, 3])
    expect(hmrLoadState('k3')).toBe('text')
  })

  it('overwrites existing key on re-save', () => {
    hmrSaveState('s', 'first')
    hmrSaveState('s', 'second')
    expect(hmrLoadState('s')).toBe('second')
  })

  it('version starts at 0 on a fresh store', () => {
    expect(hmrGetVersion()).toBe(0)
  })
})
