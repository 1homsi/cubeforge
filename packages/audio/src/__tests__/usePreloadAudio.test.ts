import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Web Audio mock ───────────────────────────────────────────────────────────

let mockCtx: any

function setupMocks() {
  mockCtx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn(),
    createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() })),
    decodeAudioData: vi.fn(async () => ({ duration: 1, length: 44100 })),
  }
  ;(globalThis as any).AudioContext = vi.fn(() => mockCtx)
  ;(globalThis as any).fetch = vi.fn(async () => ({
    arrayBuffer: async () => new ArrayBuffer(8),
  }))
}

// ─── Minimal React mock ──────────────────────────────────────────────────────

let effectCallbacks: (() => (() => void) | void)[]
let cleanupFns: (() => void)[]

// Track state calls
const stateSetters: ((v: any) => void)[] = []
const stateValues: any[] = []

vi.mock('react', () => ({
  useRef: (init: any) => ({ current: init }),
  useEffect: (cb: () => (() => void) | void) => {
    effectCallbacks.push(cb)
  },
  useState: (init: any) => {
    const idx = stateValues.length
    stateValues.push(init)
    const setter = vi.fn((val: any) => {
      stateValues[idx] = typeof val === 'function' ? val(stateValues[idx]) : val
    })
    stateSetters.push(setter)
    return [stateValues[idx], setter]
  },
}))

function flushEffects() {
  for (const cb of effectCallbacks) {
    const cleanup = cb()
    if (cleanup) cleanupFns.push(cleanup)
  }
  effectCallbacks = []
}

function runCleanups() {
  for (const fn of cleanupFns) fn()
  cleanupFns = []
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('usePreloadAudio', () => {
  beforeEach(() => {
    effectCallbacks = []
    cleanupFns = []
    stateValues.length = 0
    stateSetters.length = 0
    setupMocks()
  })

  afterEach(() => {
    runCleanups()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('fetches each unique src', async () => {
    const { usePreloadAudio } = await import('../usePreloadAudio')

    usePreloadAudio(['/sfx/a.wav', '/sfx/b.wav'])
    flushEffects()

    await vi.waitFor(() => (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length >= 2)

    expect(globalThis.fetch).toHaveBeenCalledWith('/sfx/a.wav')
    expect(globalThis.fetch).toHaveBeenCalledWith('/sfx/b.wav')
  })

  it('does not fetch the same src twice (deduplication)', async () => {
    const { usePreloadAudio } = await import('../usePreloadAudio')

    usePreloadAudio(['/sfx/jump.wav', '/sfx/jump.wav', '/sfx/jump.wav'])
    flushEffects()

    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('skips fetching a src already in the shared useSound cache', async () => {
    const { usePreloadAudio } = await import('../usePreloadAudio')
    const { _getBufferCache } = await import('../useSound')

    // Pre-populate the shared useSound buffer cache
    _getBufferCache().set('/sfx/cached.wav', {} as AudioBuffer)

    usePreloadAudio(['/sfx/cached.wav', '/sfx/new.wav'])
    flushEffects()

    await vi.waitFor(() => (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length >= 1)

    // Only the uncached src should be fetched
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('/sfx/new.wav')
  })

  it('returns progress 1 and isReady true for an empty src list', async () => {
    const { usePreloadAudio } = await import('../usePreloadAudio')

    const result = usePreloadAudio([])

    expect(result.total).toBe(0)
    expect(result.progress).toBe(1)
    expect(result.isReady).toBe(true)
    expect(result.errors).toEqual([])
  })
})
