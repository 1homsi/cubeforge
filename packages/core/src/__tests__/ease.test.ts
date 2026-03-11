import { describe, it, expect } from 'vitest'
import { Ease } from '../tween'

// Helper: test that an easing function starts at 0 and ends at 1
function testBoundaries(name: string, fn: (t: number) => number) {
  it(`${name} returns ~0 at t=0`, () => {
    expect(fn(0)).toBeCloseTo(0, 4)
  })
  it(`${name} returns ~1 at t=1`, () => {
    expect(fn(1)).toBeCloseTo(1, 4)
  })
}

// Helper: test monotonicity for well-behaved easing functions (no overshoot)
function testMonotonic(name: string, fn: (t: number) => number) {
  it(`${name} is monotonically increasing (no overshoot)`, () => {
    let prev = fn(0)
    for (let i = 1; i <= 10; i++) {
      const t = i / 10
      const val = fn(t)
      expect(val).toBeGreaterThanOrEqual(prev - 0.001)
      prev = val
    }
  })
}

describe('Ease — all easing functions', () => {
  describe('Cubic', () => {
    testBoundaries('easeInCubic', Ease.easeInCubic)
    testBoundaries('easeOutCubic', Ease.easeOutCubic)
    testBoundaries('easeInOutCubic', Ease.easeInOutCubic)

    it('easeInCubic is slower at start', () => {
      expect(Ease.easeInCubic(0.5)).toBeLessThan(0.5)
    })

    it('easeOutCubic is faster at start', () => {
      expect(Ease.easeOutCubic(0.5)).toBeGreaterThan(0.5)
    })

    it('easeInOutCubic passes through 0.5 at t=0.5', () => {
      expect(Ease.easeInOutCubic(0.5)).toBeCloseTo(0.5, 4)
    })
  })

  describe('Quart', () => {
    testBoundaries('easeInQuart', Ease.easeInQuart)
    testBoundaries('easeOutQuart', Ease.easeOutQuart)
    testBoundaries('easeInOutQuart', Ease.easeInOutQuart)

    it('easeInQuart(0.5) = 0.0625', () => {
      expect(Ease.easeInQuart(0.5)).toBeCloseTo(0.0625)
    })
  })

  describe('Quint', () => {
    testBoundaries('easeInQuint', Ease.easeInQuint)
    testBoundaries('easeOutQuint', Ease.easeOutQuint)
    testBoundaries('easeInOutQuint', Ease.easeInOutQuint)
  })

  describe('Sine', () => {
    testBoundaries('easeInSine', Ease.easeInSine)
    testBoundaries('easeOutSine', Ease.easeOutSine)
    testBoundaries('easeInOutSine', Ease.easeInOutSine)
    testMonotonic('easeInSine', Ease.easeInSine)
    testMonotonic('easeOutSine', Ease.easeOutSine)
    testMonotonic('easeInOutSine', Ease.easeInOutSine)
  })

  describe('Expo', () => {
    testBoundaries('easeInExpo', Ease.easeInExpo)
    testBoundaries('easeOutExpo', Ease.easeOutExpo)
    testBoundaries('easeInOutExpo', Ease.easeInOutExpo)
  })

  describe('Circ', () => {
    testBoundaries('easeInCirc', Ease.easeInCirc)
    testBoundaries('easeOutCirc', Ease.easeOutCirc)
    testBoundaries('easeInOutCirc', Ease.easeInOutCirc)
    testMonotonic('easeInCirc', Ease.easeInCirc)
    testMonotonic('easeOutCirc', Ease.easeOutCirc)
  })

  describe('Back', () => {
    testBoundaries('easeInBack', Ease.easeInBack)
    testBoundaries('easeOutBack', Ease.easeOutBack)
    testBoundaries('easeInOutBack', Ease.easeInOutBack)

    it('easeInBack overshoots below 0 at small t', () => {
      expect(Ease.easeInBack(0.2)).toBeLessThan(0)
    })

    it('easeOutBack overshoots above 1 before settling', () => {
      // At t=0.5, easeOutBack should be > 1
      expect(Ease.easeOutBack(0.5)).toBeGreaterThan(1)
    })
  })

  describe('Elastic', () => {
    testBoundaries('easeInElastic', Ease.easeInElastic)
    testBoundaries('easeOutElastic', Ease.easeOutElastic)
    testBoundaries('easeInOutElastic', Ease.easeInOutElastic)

    it('easeInElastic oscillates (can go negative)', () => {
      // At some intermediate point, elastic goes below 0
      let hasNegative = false
      for (let i = 1; i < 10; i++) {
        if (Ease.easeInElastic(i / 10) < 0) hasNegative = true
      }
      expect(hasNegative).toBe(true)
    })

    it('easeOutElastic oscillates (can exceed 1)', () => {
      let hasExceeded = false
      for (let i = 1; i < 10; i++) {
        if (Ease.easeOutElastic(i / 10) > 1) hasExceeded = true
      }
      expect(hasExceeded).toBe(true)
    })
  })

  describe('Bounce', () => {
    testBoundaries('easeOutBounce', Ease.easeOutBounce)
    testBoundaries('easeInBounce', Ease.easeInBounce)
    testBoundaries('easeInOutBounce', Ease.easeInOutBounce)

    it('easeOutBounce has characteristic bounce values', () => {
      // At t=1/2.75, it should be at a local max
      const v = Ease.easeOutBounce(1 / 2.75)
      expect(v).toBeCloseTo(7.5625 * (1 / 2.75) * (1 / 2.75))
    })

    it('easeInBounce is complement of easeOutBounce', () => {
      expect(Ease.easeInBounce(0.3)).toBeCloseTo(1 - Ease.easeOutBounce(0.7), 5)
    })

    it('easeInOutBounce midpoint', () => {
      expect(Ease.easeInOutBounce(0.5)).toBeCloseTo(0.5, 4)
    })
  })
})
