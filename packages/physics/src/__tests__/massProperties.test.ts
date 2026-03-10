import { describe, it, expect } from 'vitest'
import {
  boxMassProperties,
  circleMassProperties,
  capsuleMassProperties,
  parallelAxis,
  boxArea,
  circleArea,
  capsuleArea,
  setAdditionalMass,
  setMassProperties,
  recomputeMassFromColliders,
} from '../massProperties'
import { createRigidBody } from '../components/rigidbody'
import { createBoxCollider } from '../components/boxCollider'
import { createCircleCollider } from '../components/circleCollider'
import { createCapsuleCollider } from '../components/capsuleCollider'

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

// ── Area functions ──────────────────────────────────────────────────────────

describe('boxArea', () => {
  it('computes width * height', () => {
    expect(boxArea(10, 20)).toBe(200)
  })

  it('returns 0 for zero dimension', () => {
    expect(boxArea(0, 20)).toBe(0)
    expect(boxArea(10, 0)).toBe(0)
  })

  it('unit square has area 1', () => {
    expect(boxArea(1, 1)).toBe(1)
  })
})

describe('circleArea', () => {
  it('computes π * r²', () => {
    expect(circleArea(5)).toBeCloseTo(Math.PI * 25)
  })

  it('unit circle has area π', () => {
    expect(circleArea(1)).toBeCloseTo(Math.PI)
  })

  it('returns 0 for zero radius', () => {
    expect(circleArea(0)).toBe(0)
  })
})

describe('capsuleArea', () => {
  it('degenerates to circle area when width == height', () => {
    expect(capsuleArea(10, 10)).toBeCloseTo(circleArea(5))
  })

  it('vertical capsule area = rect area + circle area', () => {
    const w = 10
    const h = 30
    const radius = w / 2
    const rectArea = w * (h - w)
    const cArea = Math.PI * radius * radius
    expect(capsuleArea(w, h)).toBeCloseTo(rectArea + cArea)
  })

  it('horizontal capsule area = rect area + circle area', () => {
    const w = 30
    const h = 10
    const radius = h / 2
    const rectArea = (w - h) * h
    const cArea = Math.PI * radius * radius
    expect(capsuleArea(w, h)).toBeCloseTo(rectArea + cArea)
  })

  it('capsule area is always greater than circle area of same minor dimension', () => {
    expect(capsuleArea(10, 30)).toBeGreaterThan(circleArea(5))
  })
})

// ── setAdditionalMass ───────────────────────────────────────────────────────

describe('setAdditionalMass', () => {
  it('increases mass and recomputes invMass', () => {
    const rb = createRigidBody({ mass: 10, inertia: 50 })
    rb.invMass = 1 / 10
    rb.invInertia = 1 / 50
    setAdditionalMass(rb, 5)
    expect(rb.mass).toBeCloseTo(15)
    expect(rb.invMass).toBeCloseTo(1 / 15)
  })

  it('scales inertia proportionally', () => {
    const rb = createRigidBody({ mass: 10, inertia: 100, lockRotation: false })
    rb.invMass = 1 / 10
    rb.invInertia = 1 / 100
    setAdditionalMass(rb, 10) // mass doubles
    expect(rb.inertia).toBeCloseTo(200) // inertia also doubles
    expect(rb.invInertia).toBeCloseTo(1 / 200)
  })

  it('does nothing when resulting mass would be <= 0', () => {
    const rb = createRigidBody({ mass: 5, inertia: 50 })
    rb.invMass = 1 / 5
    setAdditionalMass(rb, -10) // would make mass -5
    expect(rb.mass).toBe(5) // unchanged
  })

  it('respects lockRotation (invInertia stays 0)', () => {
    const rb = createRigidBody({ mass: 10, inertia: 50, lockRotation: true })
    rb.invMass = 1 / 10
    rb.invInertia = 0
    setAdditionalMass(rb, 5)
    expect(rb.invInertia).toBe(0)
  })
})

// ── setMassProperties ───────────────────────────────────────────────────────

describe('setMassProperties', () => {
  it('overrides mass, inertia, and derived inverses', () => {
    const rb = createRigidBody({ lockRotation: false })
    setMassProperties(rb, 20, 100, 0, 0)
    expect(rb.mass).toBe(20)
    expect(rb.inertia).toBe(100)
    expect(rb.invMass).toBeCloseTo(1 / 20)
    expect(rb.invInertia).toBeCloseTo(1 / 100)
  })

  it('sets invMass to 0 for zero mass', () => {
    const rb = createRigidBody()
    setMassProperties(rb, 0, 0, 0, 0)
    expect(rb.invMass).toBe(0)
    expect(rb.invInertia).toBe(0)
  })

  it('clears dirty flag', () => {
    const rb = createRigidBody()
    expect(rb._massPropertiesDirty).toBe(true)
    setMassProperties(rb, 10, 50, 0, 0)
    expect(rb._massPropertiesDirty).toBe(false)
  })

  it('respects lockRotation', () => {
    const rb = createRigidBody({ lockRotation: true })
    setMassProperties(rb, 10, 50, 0, 0)
    expect(rb.invInertia).toBe(0)
  })
})

// ── recomputeMassFromColliders ───────────────────────────────────────────────

describe('recomputeMassFromColliders', () => {
  it('computes mass from box collider', () => {
    const rb = createRigidBody({ density: 2 })
    const col = createBoxCollider(10, 20)
    recomputeMassFromColliders(rb, col)
    expect(rb.mass).toBeCloseTo(2 * 10 * 20) // 400
    expect(rb.invMass).toBeCloseTo(1 / 400)
    expect(rb._massPropertiesDirty).toBe(false)
  })

  it('computes mass from circle collider', () => {
    const rb = createRigidBody({ density: 1 })
    const col = createCircleCollider(5)
    recomputeMassFromColliders(rb, undefined, col)
    expect(rb.mass).toBeCloseTo(Math.PI * 25)
  })

  it('computes mass from capsule collider', () => {
    const rb = createRigidBody({ density: 1 })
    const col = createCapsuleCollider(10, 30)
    recomputeMassFromColliders(rb, undefined, undefined, col)
    const expected = capsuleMassProperties(10, 30, 1)
    expect(rb.mass).toBeCloseTo(expected.mass)
    expect(rb.inertia).toBeCloseTo(expected.inertia)
  })

  it('applies parallel axis for offset box collider', () => {
    const rb = createRigidBody({ density: 1 })
    const col = createBoxCollider(10, 10, { offsetX: 5, offsetY: 0 })
    recomputeMassFromColliders(rb, col)
    const base = boxMassProperties(10, 10, 1)
    const expectedInertia = parallelAxis(base.inertia, base.mass, 5, 0)
    expect(rb.inertia).toBeCloseTo(expectedInertia)
  })

  it('defaults to mass=1 when no collider is provided', () => {
    const rb = createRigidBody({ density: 1 })
    recomputeMassFromColliders(rb)
    expect(rb.mass).toBe(1)
    expect(rb.inertia).toBe(1)
  })
})
