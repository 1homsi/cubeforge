import { describe, it, expect, vi } from 'vitest'
import { createTimer } from '../timer'

describe('createTimer', () => {
  it('creates a timer that is not running by default', () => {
    const timer = createTimer(1.0)
    expect(timer.running).toBe(false)
    expect(timer.elapsed).toBe(0)
  })

  it('creates a timer that auto-starts when autoStart is true', () => {
    const timer = createTimer(1.0, undefined, true)
    expect(timer.running).toBe(true)
  })

  it('does not advance when not running', () => {
    const timer = createTimer(1.0)
    timer.update(0.5)
    expect(timer.elapsed).toBe(0)
  })

  it('advances elapsed time when running', () => {
    const timer = createTimer(2.0)
    timer.start()
    timer.update(0.5)
    expect(timer.elapsed).toBe(0.5)
    expect(timer.running).toBe(true)
  })

  it('calls onComplete when timer expires', () => {
    const onComplete = vi.fn()
    const timer = createTimer(1.0, onComplete, true)
    timer.update(1.0)
    expect(onComplete).toHaveBeenCalledOnce()
    expect(timer.running).toBe(false)
  })

  it('calls onComplete when elapsed exceeds duration', () => {
    const onComplete = vi.fn()
    const timer = createTimer(1.0, onComplete, true)
    timer.update(2.0)
    expect(onComplete).toHaveBeenCalledOnce()
    expect(timer.elapsed).toBe(1.0)
  })

  it('does not call onComplete if not provided', () => {
    const timer = createTimer(1.0, undefined, true)
    expect(() => timer.update(2.0)).not.toThrow()
  })

  describe('start/stop', () => {
    it('start begins countdown', () => {
      const timer = createTimer(1.0)
      timer.start()
      expect(timer.running).toBe(true)
      timer.update(0.3)
      expect(timer.elapsed).toBe(0.3)
    })

    it('stop pauses without resetting', () => {
      const timer = createTimer(1.0, undefined, true)
      timer.update(0.3)
      timer.stop()
      expect(timer.running).toBe(false)
      expect(timer.elapsed).toBe(0.3)
      timer.update(0.5)
      expect(timer.elapsed).toBe(0.3) // unchanged
    })
  })

  describe('reset', () => {
    it('resets elapsed to 0 and stops', () => {
      const timer = createTimer(1.0, undefined, true)
      timer.update(0.5)
      timer.reset()
      expect(timer.elapsed).toBe(0)
      expect(timer.running).toBe(false)
    })

    it('can change duration on reset', () => {
      const onComplete = vi.fn()
      const timer = createTimer(1.0, onComplete, true)
      timer.reset(2.0)
      timer.start()
      timer.update(1.5)
      expect(onComplete).not.toHaveBeenCalled()
      timer.update(0.5)
      expect(onComplete).toHaveBeenCalledOnce()
    })
  })

  describe('restart', () => {
    it('resets and starts immediately', () => {
      const timer = createTimer(1.0)
      timer.start()
      timer.update(0.5)
      timer.restart()
      expect(timer.elapsed).toBe(0)
      expect(timer.running).toBe(true)
    })
  })

  describe('remaining', () => {
    it('returns full duration at start', () => {
      const timer = createTimer(2.0, undefined, true)
      expect(timer.remaining).toBe(2.0)
    })

    it('decreases as time passes', () => {
      const timer = createTimer(2.0, undefined, true)
      timer.update(0.5)
      expect(timer.remaining).toBeCloseTo(1.5)
    })

    it('is 0 when complete', () => {
      const timer = createTimer(1.0, undefined, true)
      timer.update(1.0)
      expect(timer.remaining).toBe(0)
    })

    it('is clamped to 0 (never negative)', () => {
      const timer = createTimer(1.0, undefined, true)
      timer.update(5.0)
      expect(timer.remaining).toBe(0)
    })
  })

  describe('progress', () => {
    it('returns 0 at start', () => {
      const timer = createTimer(2.0, undefined, true)
      expect(timer.progress).toBe(0)
    })

    it('returns 0.5 at halfway', () => {
      const timer = createTimer(2.0, undefined, true)
      timer.update(1.0)
      expect(timer.progress).toBeCloseTo(0.5)
    })

    it('returns 1 at completion', () => {
      const timer = createTimer(2.0, undefined, true)
      timer.update(2.0)
      expect(timer.progress).toBe(1)
    })

    it('is clamped to 1', () => {
      const timer = createTimer(1.0, undefined, true)
      timer.update(5.0)
      expect(timer.progress).toBe(1)
    })

    it('returns 1 when duration is 0', () => {
      const timer = createTimer(0)
      expect(timer.progress).toBe(1)
    })
  })
})
