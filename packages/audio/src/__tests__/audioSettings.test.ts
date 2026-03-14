import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Web Audio mock ───────────────────────────────────────────────────────────

let mockCtx: any

function setupMocks() {
  mockCtx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createGain: vi.fn(() => ({
      gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    resume: vi.fn(),
  }
  ;(globalThis as any).AudioContext = vi.fn(() => mockCtx)
}

// ─── localStorage mock ────────────────────────────────────────────────────────

let store: Record<string, string> = {}

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key]
  }),
  clear: vi.fn(() => {
    store = {}
  }),
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Audio settings persistence', () => {
  beforeEach(() => {
    store = {}
    setupMocks()
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('saveAudioSettings persists master and group volumes to localStorage', async () => {
    const { setMasterVolume, setGroupVolume, saveAudioSettings } = await import('../audioContext')

    setMasterVolume(0.7)
    setGroupVolume('sfx', 0.5)
    setGroupVolume('music', 0.3)
    saveAudioSettings()

    expect(localStorageMock.setItem).toHaveBeenCalledWith('cubeforge:audio', expect.any(String))

    const saved = JSON.parse(store['cubeforge:audio'])
    expect(saved.master).toBeCloseTo(0.7)
    expect(saved.sfx).toBeCloseTo(0.5)
    expect(saved.music).toBeCloseTo(0.3)
  })

  it('loadAudioSettings restores previously saved volumes', async () => {
    store['cubeforge:audio'] = JSON.stringify({ master: 0.4, sfx: 0.6 })
    const { loadAudioSettings, getMasterVolume, getGroupVolume } = await import('../audioContext')

    loadAudioSettings()

    expect(getMasterVolume()).toBeCloseTo(0.4)
    expect(getGroupVolume('sfx')).toBeCloseTo(0.6)
  })

  it('loadAudioSettings is a no-op when nothing is stored', async () => {
    const { loadAudioSettings, getMasterVolume } = await import('../audioContext')

    expect(() => loadAudioSettings()).not.toThrow()
    expect(getMasterVolume()).toBe(1) // default unchanged
  })

  it('loadAudioSettings ignores corrupt JSON without throwing', async () => {
    store['cubeforge:audio'] = '{broken json'
    const { loadAudioSettings } = await import('../audioContext')

    expect(() => loadAudioSettings()).not.toThrow()
  })

  it('saveAudioSettings is a no-op when localStorage throws', async () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { setMasterVolume, saveAudioSettings } = await import('../audioContext')

    setMasterVolume(0.5)
    expect(() => saveAudioSettings()).not.toThrow()
  })

  it('loadAudioSettings skips non-numeric values', async () => {
    store['cubeforge:audio'] = JSON.stringify({ master: 'loud', sfx: 0.5 })
    const { loadAudioSettings, getMasterVolume, getGroupVolume } = await import('../audioContext')

    loadAudioSettings()

    expect(getMasterVolume()).toBe(1) // 'loud' is not a number, skipped → stays at default
    expect(getGroupVolume('sfx')).toBeCloseTo(0.5) // valid entry applied
  })
})
