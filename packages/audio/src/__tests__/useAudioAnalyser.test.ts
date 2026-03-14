import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Web Audio mocks ──────────────────────────────────────────────────────────

function makeGain() {
  return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }
}

function makeAnalyser(fftSize = 2048) {
  const binCount = fftSize / 2
  return {
    fftSize,
    smoothingTimeConstant: 0.8,
    frequencyBinCount: binCount,
    getByteFrequencyData: vi.fn((arr: Uint8Array) => {
      // Fill lower quarter with high values to simulate a beat
      const bassEnd = Math.floor(arr.length / 4)
      for (let i = 0; i < bassEnd; i++) arr[i] = 200
      for (let i = bassEnd; i < arr.length; i++) arr[i] = 0
    }),
    getByteTimeDomainData: vi.fn((arr: Uint8Array) => {
      arr.fill(128)
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

let mockCtx: any
let createdAnalysers: ReturnType<typeof makeAnalyser>[]
let createdGains: ReturnType<typeof makeGain>[]

function setupMocks() {
  createdAnalysers = []
  createdGains = []

  mockCtx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn(),
    createGain: vi.fn(() => {
      const g = makeGain()
      createdGains.push(g)
      return g
    }),
    createAnalyser: vi.fn(() => {
      const a = makeAnalyser()
      createdAnalysers.push(a)
      return a
    }),
  }
  ;(globalThis as any).AudioContext = vi.fn(() => mockCtx)
}

// ─── Minimal React mock ──────────────────────────────────────────────────────

let effectCallbacks: (() => (() => void) | void)[]
let cleanupFns: (() => void)[]

vi.mock('react', () => ({
  useRef: (init: any) => ({ current: init }),
  useEffect: (cb: () => (() => void) | void) => {
    effectCallbacks.push(cb)
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

describe('useAudioAnalyser', () => {
  beforeEach(() => {
    effectCallbacks = []
    cleanupFns = []
    setupMocks()
  })

  afterEach(() => {
    runCleanups()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('creates an AnalyserNode and taps the group gain node', async () => {
    const { useAudioAnalyser } = await import('../useAudioAnalyser')

    useAudioAnalyser({ group: 'sfx', fftSize: 512 })
    flushEffects()

    expect(mockCtx.createAnalyser).toHaveBeenCalledTimes(1)
    const analyser = createdAnalysers[0]
    expect(analyser.fftSize).toBe(512)
    // The group gain node should have connected to the analyser (fan-out)
    const sfxGain = createdGains.find((g) => g.connect.mock.calls.some((c: any[]) => c[0] === analyser))
    expect(sfxGain).toBeDefined()
  })

  it('getFrequencyData calls getByteFrequencyData and returns the buffer', async () => {
    const { useAudioAnalyser } = await import('../useAudioAnalyser')

    const controls = useAudioAnalyser({ group: 'sfx' })
    flushEffects()

    const data = controls.getFrequencyData()

    expect(createdAnalysers[0].getByteFrequencyData).toHaveBeenCalled()
    expect(data).toBeInstanceOf(Uint8Array)
    expect(data.length).toBe(1024) // fftSize 2048 / 2
  })

  it('getWaveformData calls getByteTimeDomainData and returns the buffer', async () => {
    const { useAudioAnalyser } = await import('../useAudioAnalyser')

    const controls = useAudioAnalyser({ group: 'sfx' })
    flushEffects()

    const data = controls.getWaveformData()

    expect(createdAnalysers[0].getByteTimeDomainData).toHaveBeenCalled()
    expect(data).toBeInstanceOf(Uint8Array)
    // All values should be 128 (silence) from our mock
    expect(data[0]).toBe(128)
  })

  it('getAverageFrequency returns a numeric average', async () => {
    const { useAudioAnalyser } = await import('../useAudioAnalyser')

    const controls = useAudioAnalyser({ group: 'sfx' })
    flushEffects()

    const avg = controls.getAverageFrequency()

    expect(typeof avg).toBe('number')
    expect(avg).toBeGreaterThanOrEqual(0)
    expect(avg).toBeLessThanOrEqual(255)
  })

  it('isBeat returns true when bass average exceeds threshold', async () => {
    const { useAudioAnalyser } = await import('../useAudioAnalyser')

    const controls = useAudioAnalyser({ group: 'sfx' })
    flushEffects()

    // Our mock fills the bass range with 200 — default threshold is 180
    expect(controls.isBeat(180)).toBe(true)
  })

  it('isBeat returns false when bass average is below threshold', async () => {
    const { useAudioAnalyser } = await import('../useAudioAnalyser')

    const controls = useAudioAnalyser({ group: 'sfx' })
    flushEffects()

    // Threshold above the 200 our mock returns
    expect(controls.isBeat(220)).toBe(false)
  })

  it('returns empty arrays and false before effect mounts', async () => {
    const { useAudioAnalyser } = await import('../useAudioAnalyser')

    const controls = useAudioAnalyser({ group: 'sfx' })
    // Do NOT flush effects

    expect(controls.getFrequencyData().length).toBe(0)
    expect(controls.getWaveformData().length).toBe(0)
    expect(controls.getAverageFrequency()).toBe(0)
    expect(controls.isBeat()).toBe(false)
    expect(controls.analyserNode).toBeNull()
  })

  it('cleanup disconnects the analyser from the group gain', async () => {
    const { useAudioAnalyser } = await import('../useAudioAnalyser')

    useAudioAnalyser({ group: 'sfx' })
    flushEffects()

    const analyser = createdAnalysers[0]
    // Find the gain node that was connected to the analyser
    const gainWithAnalyser = createdGains.find((g) => g.connect.mock.calls.some((c: any[]) => c[0] === analyser))

    runCleanups()

    expect(gainWithAnalyser?.disconnect).toHaveBeenCalledWith(analyser)
  })
})
