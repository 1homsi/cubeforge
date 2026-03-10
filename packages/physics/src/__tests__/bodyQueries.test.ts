import { describe, it, expect } from 'vitest'
import { velocityAtPoint, kineticEnergy, potentialEnergy, predictPosition } from '../bodyQueries'
import { createRigidBody } from '../components/rigidbody'

// ── velocityAtPoint ─────────────────────────────────────────────────────────

describe('velocityAtPoint', () => {
  it('returns linear velocity when angular velocity is zero', () => {
    const rb = createRigidBody()
    rb.vx = 10
    rb.vy = 20
    rb.angularVelocity = 0
    const v = velocityAtPoint(rb, 5, 5, 0, 0)
    expect(v.vx).toBeCloseTo(10)
    expect(v.vy).toBeCloseTo(20)
  })

  it('adds angular contribution at a point offset from center', () => {
    const rb = createRigidBody()
    rb.vx = 0
    rb.vy = 0
    rb.angularVelocity = 2 // rad/s
    // Point is 3 units to the right and 4 units above center
    const v = velocityAtPoint(rb, 3, -4, 0, 0)
    // vx = 0 - 2 * (-4 - 0) = 8
    // vy = 0 + 2 * (3 - 0) = 6
    expect(v.vx).toBeCloseTo(8)
    expect(v.vy).toBeCloseTo(6)
  })

  it('returns zero velocity for a stationary body at any point', () => {
    const rb = createRigidBody()
    const v = velocityAtPoint(rb, 100, 200, 50, 50)
    expect(v.vx).toBe(0)
    expect(v.vy).toBe(0)
  })

  it('velocity at center equals linear velocity regardless of angular velocity', () => {
    const rb = createRigidBody()
    rb.vx = 5
    rb.vy = -3
    rb.angularVelocity = 100
    const v = velocityAtPoint(rb, 10, 20, 10, 20) // point == center
    expect(v.vx).toBeCloseTo(5)
    expect(v.vy).toBeCloseTo(-3)
  })

  it('opposite points have opposite angular contributions', () => {
    const rb = createRigidBody()
    rb.vx = 0
    rb.vy = 0
    rb.angularVelocity = 1
    const v1 = velocityAtPoint(rb, 1, 0, 0, 0)
    const v2 = velocityAtPoint(rb, -1, 0, 0, 0)
    // vx should be same (both pointY=0), vy should be opposite
    expect(v1.vy).toBeCloseTo(-v2.vy)
  })
})

// ── kineticEnergy ───────────────────────────────────────────────────────────

describe('kineticEnergy', () => {
  it('computes linear kinetic energy for a body with no rotation', () => {
    const rb = createRigidBody({ mass: 4 })
    rb.vx = 3
    rb.vy = 4
    rb.angularVelocity = 0
    rb.inertia = 10
    // KE = 0.5 * 4 * (9 + 16) = 50
    expect(kineticEnergy(rb)).toBeCloseTo(50)
  })

  it('includes rotational kinetic energy', () => {
    const rb = createRigidBody({ mass: 2 })
    rb.vx = 0
    rb.vy = 0
    rb.angularVelocity = 3
    rb.inertia = 4
    // KE = 0 + 0.5 * 4 * 9 = 18
    expect(kineticEnergy(rb)).toBeCloseTo(18)
  })

  it('returns zero for a stationary body', () => {
    const rb = createRigidBody({ mass: 10 })
    rb.inertia = 50
    expect(kineticEnergy(rb)).toBe(0)
  })

  it('combines linear and rotational components', () => {
    const rb = createRigidBody({ mass: 2 })
    rb.vx = 1
    rb.vy = 0
    rb.angularVelocity = 2
    rb.inertia = 3
    // KE = 0.5*2*1 + 0.5*3*4 = 1 + 6 = 7
    expect(kineticEnergy(rb)).toBeCloseTo(7)
  })

  it('uses invMass fallback when mass is 0', () => {
    const rb = createRigidBody()
    rb.mass = 0
    rb.invMass = 0.5 // means effective mass = 2
    rb.vx = 1
    rb.vy = 0
    rb.angularVelocity = 0
    rb.inertia = 0
    // KE = 0.5 * 2 * 1 = 1
    expect(kineticEnergy(rb)).toBeCloseTo(1)
  })
})

// ── potentialEnergy ─────────────────────────────────────────────────────────

describe('potentialEnergy', () => {
  it('computes mass * gravity * height', () => {
    const rb = createRigidBody({ mass: 5 })
    expect(potentialEnergy(rb, 10, 20)).toBeCloseTo(1000)
  })

  it('returns zero at height zero', () => {
    const rb = createRigidBody({ mass: 5 })
    expect(potentialEnergy(rb, 980, 0)).toBe(0)
  })

  it('returns zero for zero mass', () => {
    const rb = createRigidBody()
    rb.mass = 0
    rb.invMass = 0
    expect(potentialEnergy(rb, 980, 100)).toBe(0)
  })

  it('negative height yields negative PE', () => {
    const rb = createRigidBody({ mass: 2 })
    expect(potentialEnergy(rb, 10, -5)).toBeCloseTo(-100)
  })
})

// ── predictPosition ─────────────────────────────────────────────────────────

describe('predictPosition', () => {
  it('extrapolates position using linear velocity', () => {
    const rb = createRigidBody()
    rb.vx = 100
    rb.vy = -50
    rb.angularVelocity = 0
    const result = predictPosition(rb, 10, 20, 0, 0.5)
    expect(result.x).toBeCloseTo(60) // 10 + 100 * 0.5
    expect(result.y).toBeCloseTo(-5) // 20 + (-50) * 0.5
    expect(result.rotation).toBe(0)
  })

  it('extrapolates rotation using angular velocity', () => {
    const rb = createRigidBody()
    rb.vx = 0
    rb.vy = 0
    rb.angularVelocity = Math.PI // half turn per second
    const result = predictPosition(rb, 0, 0, 0, 1)
    expect(result.rotation).toBeCloseTo(Math.PI)
  })

  it('returns same position for dt=0', () => {
    const rb = createRigidBody()
    rb.vx = 999
    rb.vy = 999
    rb.angularVelocity = 999
    const result = predictPosition(rb, 5, 10, 0.5, 0)
    expect(result.x).toBe(5)
    expect(result.y).toBe(10)
    expect(result.rotation).toBe(0.5)
  })

  it('handles negative dt (backward prediction)', () => {
    const rb = createRigidBody()
    rb.vx = 10
    rb.vy = 0
    rb.angularVelocity = 0
    const result = predictPosition(rb, 50, 0, 0, -1)
    expect(result.x).toBeCloseTo(40) // 50 - 10
  })

  it('combines linear and angular extrapolation', () => {
    const rb = createRigidBody()
    rb.vx = 10
    rb.vy = 20
    rb.angularVelocity = 2
    const dt = 0.1
    const result = predictPosition(rb, 0, 0, 0, dt)
    expect(result.x).toBeCloseTo(1)
    expect(result.y).toBeCloseTo(2)
    expect(result.rotation).toBeCloseTo(0.2)
  })
})
