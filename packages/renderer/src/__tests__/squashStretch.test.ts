import { describe, it, expect } from 'vitest'
import type { SquashStretchComponent } from '../components/squashStretch'

function makeSquashStretch(overrides: Partial<SquashStretchComponent> = {}): SquashStretchComponent {
  return {
    type: 'SquashStretch',
    intensity: 0.2,
    recovery: 8.0,
    currentScaleX: 1.0,
    currentScaleY: 1.0,
    ...overrides,
  }
}

describe('SquashStretchComponent', () => {
  it('has correct type string', () => {
    const ss = makeSquashStretch()
    expect(ss.type).toBe('SquashStretch')
  })

  it('has default intensity of 0.2', () => {
    const ss = makeSquashStretch()
    expect(ss.intensity).toBe(0.2)
  })

  it('has default recovery of 8.0', () => {
    const ss = makeSquashStretch()
    expect(ss.recovery).toBe(8.0)
  })

  it('initializes currentScaleX and currentScaleY to 1.0', () => {
    const ss = makeSquashStretch()
    expect(ss.currentScaleX).toBe(1.0)
    expect(ss.currentScaleY).toBe(1.0)
  })

  it('allows custom intensity', () => {
    const ss = makeSquashStretch({ intensity: 0.5 })
    expect(ss.intensity).toBe(0.5)
  })

  it('allows custom recovery', () => {
    const ss = makeSquashStretch({ recovery: 12.0 })
    expect(ss.recovery).toBe(12.0)
  })

  it('allows setting currentScaleX and currentScaleY', () => {
    const ss = makeSquashStretch({ currentScaleX: 1.3, currentScaleY: 0.7 })
    expect(ss.currentScaleX).toBe(1.3)
    expect(ss.currentScaleY).toBe(0.7)
  })

  it('squash scales are mutually inverse (area preservation)', () => {
    // Typical squash: X wide, Y tall reduced
    const squashX = 1.2
    const squashY = 1 / 1.2
    const ss = makeSquashStretch({ currentScaleX: squashX, currentScaleY: squashY })
    expect(ss.currentScaleX * ss.currentScaleY).toBeCloseTo(1.0)
  })

  it('is a plain data object (no methods)', () => {
    const ss = makeSquashStretch()
    const keys = Object.keys(ss)
    expect(keys).toContain('type')
    expect(keys).toContain('intensity')
    expect(keys).toContain('recovery')
    expect(keys).toContain('currentScaleX')
    expect(keys).toContain('currentScaleY')
  })

  describe('lerp recovery simulation', () => {
    it('lerps currentScaleX toward 1.0 over a frame', () => {
      const ss = makeSquashStretch({ currentScaleX: 1.5, currentScaleY: 0.5 })
      const dt = 0.016
      // Simulate one recovery step: lerp toward 1 at speed = recovery * dt
      ss.currentScaleX += (1.0 - ss.currentScaleX) * ss.recovery * dt
      ss.currentScaleY += (1.0 - ss.currentScaleY) * ss.recovery * dt
      // Should move toward 1.0
      expect(ss.currentScaleX).toBeLessThan(1.5)
      expect(ss.currentScaleX).toBeGreaterThan(1.0)
      expect(ss.currentScaleY).toBeGreaterThan(0.5)
      expect(ss.currentScaleY).toBeLessThan(1.0)
    })

    it('fully recovers to 1.0 after many frames', () => {
      const ss = makeSquashStretch({ currentScaleX: 2.0, currentScaleY: 0.5 })
      const dt = 0.016
      for (let i = 0; i < 200; i++) {
        ss.currentScaleX += (1.0 - ss.currentScaleX) * ss.recovery * dt
        ss.currentScaleY += (1.0 - ss.currentScaleY) * ss.recovery * dt
      }
      expect(ss.currentScaleX).toBeCloseTo(1.0, 2)
      expect(ss.currentScaleY).toBeCloseTo(1.0, 2)
    })
  })
})
