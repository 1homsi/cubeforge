import { describe, it, expect } from 'vitest'
import { combineCoefficients, type CombineRule } from '../combineRules'

describe('combineCoefficients', () => {
  describe('average rule', () => {
    it('returns the arithmetic mean of both values', () => {
      expect(combineCoefficients(0.2, 'average', 0.8, 'average')).toBeCloseTo(0.5)
    })

    it('returns the same value when both are equal', () => {
      expect(combineCoefficients(0.6, 'average', 0.6, 'average')).toBeCloseTo(0.6)
    })

    it('handles zero values', () => {
      expect(combineCoefficients(0, 'average', 0, 'average')).toBeCloseTo(0)
      expect(combineCoefficients(0, 'average', 1, 'average')).toBeCloseTo(0.5)
    })
  })

  describe('min rule', () => {
    it('returns the smaller of both values', () => {
      expect(combineCoefficients(0.3, 'min', 0.7, 'min')).toBeCloseTo(0.3)
    })

    it('returns zero when one value is zero', () => {
      expect(combineCoefficients(0, 'min', 0.9, 'min')).toBeCloseTo(0)
    })
  })

  describe('max rule', () => {
    it('returns the larger of both values', () => {
      expect(combineCoefficients(0.3, 'max', 0.7, 'max')).toBeCloseTo(0.7)
    })

    it('returns 1 when one value is 1', () => {
      expect(combineCoefficients(0.1, 'max', 1, 'max')).toBeCloseTo(1)
    })
  })

  describe('multiply rule', () => {
    it('returns the product of both values', () => {
      expect(combineCoefficients(0.5, 'multiply', 0.4, 'multiply')).toBeCloseTo(0.2)
    })

    it('returns zero when one value is zero', () => {
      expect(combineCoefficients(0, 'multiply', 0.9, 'multiply')).toBeCloseTo(0)
    })

    it('returns 1 when both values are 1', () => {
      expect(combineCoefficients(1, 'multiply', 1, 'multiply')).toBeCloseTo(1)
    })
  })

  describe('priority: max > multiply > min > average', () => {
    it('max beats average', () => {
      // A=0.2 (average), B=0.8 (max) → max wins → result = max(0.2, 0.8) = 0.8
      expect(combineCoefficients(0.2, 'average', 0.8, 'max')).toBeCloseTo(0.8)
    })

    it('max beats multiply', () => {
      expect(combineCoefficients(0.5, 'multiply', 0.3, 'max')).toBeCloseTo(0.5)
    })

    it('max beats min', () => {
      expect(combineCoefficients(0.9, 'min', 0.1, 'max')).toBeCloseTo(0.9)
    })

    it('multiply beats average', () => {
      // A=0.5 (multiply), B=0.4 (average) → multiply wins → 0.5 * 0.4 = 0.2
      expect(combineCoefficients(0.5, 'multiply', 0.4, 'average')).toBeCloseTo(0.2)
    })

    it('multiply beats min', () => {
      // A=0.5 (multiply), B=0.4 (min) → multiply wins → 0.5 * 0.4 = 0.2
      expect(combineCoefficients(0.5, 'multiply', 0.4, 'min')).toBeCloseTo(0.2)
    })

    it('min beats average', () => {
      // A=0.3 (min), B=0.7 (average) → min wins → min(0.3, 0.7) = 0.3
      expect(combineCoefficients(0.3, 'min', 0.7, 'average')).toBeCloseTo(0.3)
    })

    it('priority is symmetric (order of A and B does not matter)', () => {
      const r1 = combineCoefficients(0.3, 'max', 0.7, 'average')
      const r2 = combineCoefficients(0.7, 'average', 0.3, 'max')
      // Both use max rule, but values are swapped: max(0.3,0.7)=0.7, max(0.7,0.3)=0.7
      expect(r1).toBeCloseTo(0.7)
      expect(r2).toBeCloseTo(0.7)
    })
  })

  describe('edge cases', () => {
    it('works with values > 1', () => {
      // Not typical for friction/restitution but should not crash
      expect(combineCoefficients(2, 'average', 4, 'average')).toBeCloseTo(3)
    })

    it('all four rules produce different results for (0.3, 0.7)', () => {
      const rules: CombineRule[] = ['average', 'min', 'max', 'multiply']
      const results = rules.map((r) => combineCoefficients(0.3, r, 0.7, r))
      // average=0.5, min=0.3, max=0.7, multiply=0.21
      expect(results[0]).toBeCloseTo(0.5)
      expect(results[1]).toBeCloseTo(0.3)
      expect(results[2]).toBeCloseTo(0.7)
      expect(results[3]).toBeCloseTo(0.21)
    })
  })
})
