import { describe, it, expect, beforeEach } from 'vitest'
import { GameLoop } from '../loop/gameLoop'

// Mock browser globals required by GameLoop
let rafCallback: ((time: number) => void) | null = null
let rafId = 0
const mockRaf = (cb: (time: number) => void): number => {
  rafCallback = cb
  return ++rafId
}
const mockCaf = (): void => {
  rafCallback = null
}

// @ts-ignore
globalThis.requestAnimationFrame = mockRaf
// @ts-ignore
globalThis.cancelAnimationFrame = mockCaf

let _now = 0
// @ts-ignore
globalThis.performance = { now: () => _now }

/** Simulate one rAF frame at the given timestamp */
function fireFrame(time: number): void {
  const cb = rafCallback
  rafCallback = null
  cb?.(time)
}

describe('GameLoop', () => {
  let ticks: number[]
  let loop: GameLoop

  beforeEach(() => {
    ticks = []
    rafCallback = null
    _now = 0
    loop = new GameLoop((dt) => { ticks.push(dt) })
  })

  describe('start / stop', () => {
    it('isRunning is false before start', () => {
      expect(loop.isRunning).toBe(false)
    })

    it('start() sets isRunning to true', () => {
      loop.start()
      expect(loop.isRunning).toBe(true)
      loop.stop()
    })

    it('stop() sets isRunning to false', () => {
      loop.start()
      loop.stop()
      expect(loop.isRunning).toBe(false)
    })

    it('calling start() twice does not double-run', () => {
      loop.start()
      const idBefore = rafId
      loop.start() // should be a no-op
      expect(rafId).toBe(idBefore)
      loop.stop()
    })
  })

  describe('pause / resume', () => {
    it('isPaused is false initially', () => {
      expect(loop.isPaused).toBe(false)
    })

    it('pause() sets isPaused to true and isRunning to false', () => {
      loop.start()
      loop.pause()
      expect(loop.isPaused).toBe(true)
      expect(loop.isRunning).toBe(false)
    })

    it('resume() clears isPaused and sets isRunning back to true', () => {
      loop.start()
      loop.pause()
      loop.resume()
      expect(loop.isPaused).toBe(false)
      expect(loop.isRunning).toBe(true)
      loop.stop()
    })

    it('resume() does nothing if not paused', () => {
      loop.resume() // not paused, should be no-op
      expect(loop.isRunning).toBe(false)
    })

    it('pause() does nothing if not running', () => {
      loop.pause() // not running
      expect(loop.isPaused).toBe(false)
    })
  })

  describe('onTick', () => {
    it('onTick is called with correct dt when rAF fires', () => {
      _now = 0
      loop.start()
      // first frame at t=16ms
      fireFrame(16)
      expect(ticks).toHaveLength(1)
      expect(ticks[0]).toBeCloseTo(0.016, 3)
      loop.stop()
    })

    it('dt is capped at 0.1 seconds', () => {
      _now = 0
      loop.start()
      // Simulate a very large gap (e.g. tab was hidden for 5 seconds)
      fireFrame(5000)
      expect(ticks[0]).toBe(0.1)
      loop.stop()
    })

    it('multiple frames accumulate correctly', () => {
      _now = 0
      loop.start()
      fireFrame(16)
      fireFrame(32)
      fireFrame(48)
      expect(ticks).toHaveLength(3)
      expect(ticks[0]).toBeCloseTo(0.016, 3)
      expect(ticks[1]).toBeCloseTo(0.016, 3)
      expect(ticks[2]).toBeCloseTo(0.016, 3)
      loop.stop()
    })

    it('onTick is NOT called after stop()', () => {
      _now = 0
      loop.start()
      loop.stop()
      fireFrame(16)
      expect(ticks).toHaveLength(0)
    })

    it('onTick is NOT called while paused', () => {
      _now = 0
      loop.start()
      loop.pause()
      fireFrame(16)
      expect(ticks).toHaveLength(0)
    })
  })
})
