import { describe, it, expect } from 'vitest'
import { boxMassProperties, circleMassProperties, capsuleMassProperties, parallelAxis } from '../massProperties'

// ── Box Mass Properties ──────────────────────────────────────────────────────

describe('boxMassProperties', () => {
  it('computes mass as density * width * height', () => {
    const { mass } = boxMassProperties(10, 20, 2)
    expect(mass).toBeCloseTo(10 * 20 * 2) // 400
  })

  it('computes inertia as (mass/12) * (w² + h²)', () => {
    const w = 10
    const h = 20
    const density = 2
    const { mass, inertia } = boxMassProperties(w, h, density)
    const expected = (mass / 12) * (w * w + h * h)
    expect(inertia).toBeCloseTo(expected)
  })

  it('returns zero mass and inertia for zero density', () => {
    const { mass, inertia } = boxMassProperties(10, 10, 0)
    expect(mass).toBe(0)
    expect(inertia).toBe(0)
  })

  it('handles unit square with unit density', () => {
    const { mass, inertia } = boxMassProperties(1, 1, 1)
    expect(mass).toBeCloseTo(1)
    // inertia = (1/12) * (1 + 1) = 1/6
    expect(inertia).toBeCloseTo(1 / 6)
  })

  it('inertia scales with the fourth power of size (double dimensions → 16x inertia)', () => {
    const { inertia: small } = boxMassProperties(5, 5, 1)
    const { inertia: big } = boxMassProperties(10, 10, 1)
    // mass doubles in each dim → 4x, (w²+h²) quadruples → 4x, total = 16x
    expect(big / small).toBeCloseTo(16)
  })

  it('larger density proportionally increases both mass and inertia', () => {
    const a = boxMassProperties(10, 10, 1)
    const b = boxMassProperties(10, 10, 3)
    expect(b.mass / a.mass).toBeCloseTo(3)
    expect(b.inertia / a.inertia).toBeCloseTo(3)
  })
})

// ── Circle Mass Properties ───────────────────────────────────────────────────

describe('circleMassProperties', () => {
  it('computes mass as density * π * r²', () => {
    const r = 5
    const density = 2
    const { mass } = circleMassProperties(r, density)
    expect(mass).toBeCloseTo(density * Math.PI * r * r)
  })

  it('computes inertia as (mass/2) * r²', () => {
    const r = 5
    const density = 2
    const { mass, inertia } = circleMassProperties(r, density)
    expect(inertia).toBeCloseTo((mass / 2) * r * r)
  })

  it('returns zero for zero density', () => {
    const { mass, inertia } = circleMassProperties(10, 0)
    expect(mass).toBe(0)
    expect(inertia).toBe(0)
  })

  it('unit circle with unit density has known values', () => {
    const { mass, inertia } = circleMassProperties(1, 1)
    expect(mass).toBeCloseTo(Math.PI)
    expect(inertia).toBeCloseTo(Math.PI / 2)
  })

  it('doubling radius gives 4x mass and 16x inertia', () => {
    const a = circleMassProperties(5, 1)
    const b = circleMassProperties(10, 1)
    expect(b.mass / a.mass).toBeCloseTo(4)
    // inertia = (density * π * r² / 2) * r² = density * π * r⁴ / 2
    // ratio = (10/5)^4 = 16
    expect(b.inertia / a.inertia).toBeCloseTo(16)
  })
})

// ── Capsule Mass Properties ──────────────────────────────────────────────────

describe('capsuleMassProperties', () => {
  it('degenerates to a circle when width == height', () => {
    const capsule = capsuleMassProperties(10, 10, 1)
    const circle = circleMassProperties(5, 1)
    expect(capsule.mass).toBeCloseTo(circle.mass)
    expect(capsule.inertia).toBeCloseTo(circle.inertia)
  })

  it('vertical capsule mass = rect mass + circle mass', () => {
    const width = 10
    const height = 30
    const density = 2
    const { mass } = capsuleMassProperties(width, height, density)

    const radius = width / 2 // 5
    const rectLength = height - width // 20
    const rectMass = density * width * rectLength // 2 * 10 * 20 = 400
    const circleMass = density * Math.PI * radius * radius // 2 * π * 25 ≈ 157.08
    expect(mass).toBeCloseTo(rectMass + circleMass)
  })

  it('horizontal capsule mass = rect mass + circle mass', () => {
    const width = 30
    const height = 10
    const density = 1.5
    const { mass } = capsuleMassProperties(width, height, density)

    const radius = height / 2 // 5
    const rectLength = width - height // 20
    const rectMass = density * rectLength * height // 1.5 * 20 * 10 = 300
    const circleMass = density * Math.PI * radius * radius
    expect(mass).toBeCloseTo(rectMass + circleMass)
  })

  it('capsule inertia includes parallel axis contribution for semicircles', () => {
    const width = 10
    const height = 40
    const density = 1
    const { inertia } = capsuleMassProperties(width, height, density)

    const radius = 5
    const rectLength = 30
    const rectW = width
    const rectH = rectLength
    const rectMass = density * rectW * rectH
    const rectInertia = (rectMass / 12) * (rectW * rectW + rectH * rectH)

    const circleArea = Math.PI * radius * radius
    const circleMass = density * circleArea
    const circleInertiaCenter = (circleMass / 2) * radius * radius
    const semiOffset = rectLength / 2
    const circleInertia = circleInertiaCenter + circleMass * semiOffset * semiOffset

    expect(inertia).toBeCloseTo(rectInertia + circleInertia)
  })

  it('capsule mass is always greater than a circle of the same minor dimension', () => {
    const capsule = capsuleMassProperties(10, 30, 1)
    const circle = circleMassProperties(5, 1)
    expect(capsule.mass).toBeGreaterThan(circle.mass)
  })
})

// ── Parallel Axis Theorem ────────────────────────────────────────────────────

describe('parallelAxis', () => {
  it('returns original inertia when offset is zero', () => {
    expect(parallelAxis(100, 5, 0, 0)).toBeCloseTo(100)
  })

  it('computes I + m*(dx² + dy²)', () => {
    const result = parallelAxis(100, 5, 3, 4)
    // 100 + 5 * (9 + 16) = 100 + 125 = 225
    expect(result).toBeCloseTo(225)
  })

  it('offset along single axis', () => {
    const result = parallelAxis(50, 10, 0, 5)
    // 50 + 10 * 25 = 300
    expect(result).toBeCloseTo(300)
  })

  it('always increases inertia for non-zero offset', () => {
    const base = 100
    const shifted = parallelAxis(base, 5, 2, 3)
    expect(shifted).toBeGreaterThan(base)
  })

  it('scales linearly with mass for fixed offset', () => {
    const a = parallelAxis(0, 1, 3, 4)
    const b = parallelAxis(0, 10, 3, 4)
    expect(b / a).toBeCloseTo(10)
  })
})
