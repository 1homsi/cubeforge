import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Web Audio mock ───────────────────────────────────────────────────────────

let mockCtxTime = 0
let mockCtx: any

function setupMocks() {
  mockCtxTime = 0
  mockCtx = {
    state: 'running',
    get currentTime() {
      return mockCtxTime
    },
    resume: vi.fn(),
    createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() })),
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

describe('useAudioScheduler', () => {
  beforeEach(() => {
    effectCallbacks = []
    cleanupFns = []
    setupMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    runCleanups()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('fires onBeat handlers for each beat within the lookahead window', async () => {
    const { useAudioScheduler } = await import('../useAudioScheduler')
    flushEffects()

    // 120 BPM = 0.5 s/beat; lookahead 2 s = 4 beats scheduled immediately
    const scheduler = useAudioScheduler({ bpm: 120, beatsPerBar: 4, lookaheadSec: 2, intervalMs: 100 })
    const handler = vi.fn()
    scheduler.onBeat(handler)

    scheduler.start()

    // First schedule() fires immediately on start() — should see 4 beats (0–1.5 s within lookahead of 2 s)
    expect(handler).toHaveBeenCalledTimes(4)
    expect(handler.mock.calls[0][0]).toBe(0) // beat 0
    expect(handler.mock.calls[1][0]).toBe(1) // beat 1
    expect(handler.mock.calls[2][0]).toBe(2) // beat 2
    expect(handler.mock.calls[3][0]).toBe(3) // beat 3
  })

  it('passes correct bar numbers to onBeat', async () => {
    const { useAudioScheduler } = await import('../useAudioScheduler')
    flushEffects()

    const scheduler = useAudioScheduler({ bpm: 120, beatsPerBar: 4, lookaheadSec: 4 })
    const handler = vi.fn()
    scheduler.onBeat(handler)

    scheduler.start()

    // 4 s lookahead at 120 BPM = 8 beats = 2 bars
    expect(handler).toHaveBeenCalledTimes(8)
    // bar 0 for beats 0-3, bar 1 for beats 4-7
    expect(handler.mock.calls[0][1]).toBe(0)
    expect(handler.mock.calls[4][1]).toBe(1)
  })

  it('fires onBar only on beat 0 of each bar', async () => {
    const { useAudioScheduler } = await import('../useAudioScheduler')
    flushEffects()

    const scheduler = useAudioScheduler({ bpm: 120, beatsPerBar: 4, lookaheadSec: 4 })
    const barHandler = vi.fn()
    scheduler.onBar(barHandler)

    scheduler.start()

    // 8 beats = 2 bars → onBar fires twice
    expect(barHandler).toHaveBeenCalledTimes(2)
    expect(barHandler.mock.calls[0][0]).toBe(0) // bar 0
    expect(barHandler.mock.calls[1][0]).toBe(1) // bar 1
  })

  it('schedules more beats as AudioContext time advances', async () => {
    const { useAudioScheduler } = await import('../useAudioScheduler')
    flushEffects()

    // tight lookahead: only 1 beat at a time
    const scheduler = useAudioScheduler({ bpm: 120, beatsPerBar: 4, lookaheadSec: 0.1, intervalMs: 50 })
    const handler = vi.fn()
    scheduler.onBeat(handler)

    scheduler.start()
    const afterStart = handler.mock.calls.length

    // Advance AudioContext time by 2 beats (1 s at 120 BPM) and tick scheduler
    mockCtxTime = 1
    vi.advanceTimersByTime(50) // trigger next interval

    expect(handler.mock.calls.length).toBeGreaterThan(afterStart)
  })

  it('stop() prevents further beats after stopping', async () => {
    const { useAudioScheduler } = await import('../useAudioScheduler')
    flushEffects()

    const scheduler = useAudioScheduler({ bpm: 120, beatsPerBar: 4, lookaheadSec: 0.1, intervalMs: 50 })
    const handler = vi.fn()
    scheduler.onBeat(handler)

    scheduler.start()
    const countAfterStart = handler.mock.calls.length

    scheduler.stop()

    mockCtxTime = 10
    vi.advanceTimersByTime(200)

    // No new beats fired after stop
    expect(handler.mock.calls.length).toBe(countAfterStart)
  })

  it('isRunning reflects start/stop state', async () => {
    const { useAudioScheduler } = await import('../useAudioScheduler')
    flushEffects()

    const scheduler = useAudioScheduler({ bpm: 120, beatsPerBar: 4 })

    expect(scheduler.isRunning).toBe(false)
    scheduler.start()
    expect(scheduler.isRunning).toBe(true)
    scheduler.stop()
    expect(scheduler.isRunning).toBe(false)
  })

  it('onBeat unsubscribe removes the handler', async () => {
    const { useAudioScheduler } = await import('../useAudioScheduler')
    flushEffects()

    const scheduler = useAudioScheduler({ bpm: 120, beatsPerBar: 4, lookaheadSec: 2 })
    const handler = vi.fn()
    const unsub = scheduler.onBeat(handler)

    unsub()
    scheduler.start()

    expect(handler).not.toHaveBeenCalled()
  })

  it('double-calling start() is a no-op (isRunning stays true, no error)', async () => {
    const { useAudioScheduler } = await import('../useAudioScheduler')
    flushEffects()

    const scheduler = useAudioScheduler({ bpm: 120, beatsPerBar: 4, lookaheadSec: 0.1, intervalMs: 50 })

    scheduler.start()
    expect(scheduler.isRunning).toBe(true)

    // A second start() should not throw and should leave isRunning true
    expect(() => scheduler.start()).not.toThrow()
    expect(scheduler.isRunning).toBe(true)
  })
})
