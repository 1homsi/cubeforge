import { describe, it, expect } from 'vitest'
import {
  initializeConstraints,
  solveVelocities,
  solvePositions,
  type SolverBody,
} from '../impulseSolver'
import type { ContactManifold, ContactPoint } from '../contactManifold'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSolverBody(overrides: Partial<SolverBody> = {}): SolverBody {
  return {
    entityId: 0,
    x: 0,
    y: 0,
    rotation: 0,
    vx: 0,
    vy: 0,
    angVel: 0,
    invMass: 1,
    invInertia: 0,
    dominance: 0,
    ...overrides,
  }
}

function makeContactPoint(overrides: Partial<ContactPoint> = {}): ContactPoint {
  return {
    worldAx: 0,
    worldAy: 0,
    worldBx: 0,
    worldBy: 0,
    rAx: 0,
    rAy: 0,
    rBx: 0,
    rBy: 0,
    penetration: 1,
    normalImpulse: 0,
    tangentImpulse: 0,
    featureId: 0,
    ...overrides,
  }
}

function makeManifold(overrides: Partial<ContactManifold> = {}): ContactManifold {
  return {
    entityA: 1,
    entityB: 2,
    normalX: 1,
    normalY: 0,
    points: [makeContactPoint()],
    friction: 0.5,
    restitution: 0,
    ...overrides,
  }
}

/**
 * Set up a 1D head-on collision between two equal-mass bodies along the X axis.
 * Body A moves right (+vx), body B moves left (-vx), contacting with normal (1,0).
 */
function setupHeadOnCollision(speed: number, restitution = 0) {
  const bodyA = makeSolverBody({ entityId: 1, x: -10, vx: speed, invMass: 1 })
  const bodyB = makeSolverBody({ entityId: 2, x: 10, vx: -speed, invMass: 1 })

  const bodies = new Map<number, SolverBody>()
  bodies.set(1, bodyA)
  bodies.set(2, bodyB)

  const manifold = makeManifold({
    entityA: 1,
    entityB: 2,
    normalX: 1,
    normalY: 0,
    restitution,
    friction: 0,
    points: [
      makeContactPoint({
        rAx: 10,
        rAy: 0,
        rBx: -10,
        rBy: 0,
        penetration: 1,
      }),
    ],
  })

  return { bodyA, bodyB, bodies, manifold }
}

// ── initializeConstraints + solveVelocities ──────────────────────────────────

describe('initializeConstraints + solveVelocities', () => {
  it('two equal-mass head-on bodies exchange velocities (elastic collision, e=1)', () => {
    const { bodyA, bodyB, bodies, manifold } = setupHeadOnCollision(10, 1)
    const constraints = initializeConstraints([manifold], bodies, false, 0, 0.5)
    solveVelocities(constraints, 10)

    // With restitution = 1 and equal masses, bodies should swap velocities
    // A was +10, B was -10 → A becomes -10, B becomes +10
    expect(bodyA.vx).toBeCloseTo(-10, 0)
    expect(bodyB.vx).toBeCloseTo(10, 0)
  })

  it('two equal-mass head-on bodies stop (perfectly inelastic, e=0)', () => {
    const { bodyA, bodyB, bodies, manifold } = setupHeadOnCollision(10, 0)
    const constraints = initializeConstraints([manifold], bodies, false, 0, 0)
    solveVelocities(constraints, 10)

    // With e=0 and equal masses, both bodies should roughly stop
    // The solver resolves closing velocity to zero
    expect(bodyA.vx).toBeCloseTo(0, 0)
    expect(bodyB.vx).toBeCloseTo(0, 0)
  })

  it('momentum is conserved: sum of momentum before = after', () => {
    const bodyA = makeSolverBody({ entityId: 1, vx: 20, invMass: 1 })    // mass 1
    const bodyB = makeSolverBody({ entityId: 2, vx: -5, invMass: 0.5 })  // mass 2

    const bodies = new Map<number, SolverBody>()
    bodies.set(1, bodyA)
    bodies.set(2, bodyB)

    const manifold = makeManifold({
      entityA: 1,
      entityB: 2,
      normalX: 1,
      normalY: 0,
      restitution: 0.5,
      friction: 0,
      points: [makeContactPoint({ rAx: 0, rAy: 0, rBx: 0, rBy: 0 })],
    })

    const massA = 1 / bodyA.invMass
    const massB = 1 / bodyB.invMass
    const momentumBefore = massA * bodyA.vx + massB * bodyB.vx

    const constraints = initializeConstraints([manifold], bodies, false, 0, 0)
    solveVelocities(constraints, 20)

    const momentumAfter = massA * bodyA.vx + massB * bodyB.vx
    expect(momentumAfter).toBeCloseTo(momentumBefore, 1)
  })

  it('heavier body pushes lighter body more', () => {
    // Body A: mass=10 (invMass=0.1), moving right at 5
    // Body B: mass=1 (invMass=1), stationary
    const bodyA = makeSolverBody({ entityId: 1, vx: 5, invMass: 0.1 })
    const bodyB = makeSolverBody({ entityId: 2, vx: 0, invMass: 1 })

    const bodies = new Map<number, SolverBody>()
    bodies.set(1, bodyA)
    bodies.set(2, bodyB)

    const manifold = makeManifold({
      entityA: 1,
      entityB: 2,
      normalX: 1,
      normalY: 0,
      restitution: 0.8,
      friction: 0,
      points: [makeContactPoint({ rAx: 0, rAy: 0, rBx: 0, rBy: 0 })],
    })

    const constraints = initializeConstraints([manifold], bodies, false, 0, 0)
    solveVelocities(constraints, 20)

    // Heavy body barely slows, light body gets pushed fast
    expect(bodyB.vx).toBeGreaterThan(bodyA.vx)
  })

  it('static body (invMass=0) does not change velocity', () => {
    const bodyA = makeSolverBody({ entityId: 1, vx: 10, invMass: 1 })
    const bodyB = makeSolverBody({ entityId: 2, vx: 0, invMass: 0 }) // static

    const bodies = new Map<number, SolverBody>()
    bodies.set(1, bodyA)
    bodies.set(2, bodyB)

    const manifold = makeManifold({
      entityA: 1,
      entityB: 2,
      normalX: 1,
      normalY: 0,
      restitution: 0,
      friction: 0,
      points: [makeContactPoint({ rAx: 0, rAy: 0, rBx: 0, rBy: 0 })],
    })

    const constraints = initializeConstraints([manifold], bodies, false, 0, 0)
    solveVelocities(constraints, 10)

    expect(bodyB.vx).toBe(0)
    expect(bodyB.vy).toBe(0)
  })

  it('skips manifolds with missing body references', () => {
    const bodies = new Map<number, SolverBody>()
    // Only body 1 exists, body 2 is missing
    bodies.set(1, makeSolverBody({ entityId: 1 }))

    const manifold = makeManifold({ entityA: 1, entityB: 999 })
    const constraints = initializeConstraints([manifold], bodies, false, 0, 0)
    expect(constraints).toHaveLength(0)
  })
})

// ── Restitution ──────────────────────────────────────────────────────────────

describe('restitution', () => {
  it('higher restitution preserves more kinetic energy in head-on collision', () => {
    function totalKE(a: SolverBody, b: SolverBody): number {
      const massA = a.invMass > 0 ? 1 / a.invMass : 0
      const massB = b.invMass > 0 ? 1 / b.invMass : 0
      return 0.5 * massA * (a.vx * a.vx + a.vy * a.vy) + 0.5 * massB * (b.vx * b.vx + b.vy * b.vy)
    }

    // Low restitution
    const low = setupHeadOnCollision(10, 0.2)
    const lowConstraints = initializeConstraints([low.manifold], low.bodies, false, 0, 0)
    solveVelocities(lowConstraints, 20)
    const keLow = totalKE(low.bodyA, low.bodyB)

    // High restitution
    const high = setupHeadOnCollision(10, 0.9)
    const highConstraints = initializeConstraints([high.manifold], high.bodies, false, 0, 0)
    solveVelocities(highConstraints, 20)
    const keHigh = totalKE(high.bodyA, high.bodyB)

    expect(keHigh).toBeGreaterThan(keLow)
  })

  it('restitution below threshold does not produce bounce', () => {
    // Use a very high threshold so restitution is suppressed
    const { bodyA, bodyB, bodies, manifold } = setupHeadOnCollision(10, 1)
    const constraints = initializeConstraints([manifold], bodies, false, 0, 999)
    solveVelocities(constraints, 10)

    // Without restitution bias, closing velocity is zeroed out
    // Both should stop rather than bounce
    expect(bodyA.vx).toBeCloseTo(0, 0)
    expect(bodyB.vx).toBeCloseTo(0, 0)
  })
})

// ── Friction ─────────────────────────────────────────────────────────────────

describe('friction', () => {
  it('tangential velocity is reduced by friction', () => {
    // Body A slides along a static floor (body B).
    // Normal points from A toward B: (0, 1) — A is above, B is below.
    // Body A has tangential velocity along X and closing velocity along Y.
    const bodyA = makeSolverBody({ entityId: 1, x: 0, y: -10, vx: 10, vy: 5, invMass: 1 })
    const bodyB = makeSolverBody({ entityId: 2, x: 0, y: 10, vx: 0, vy: 0, invMass: 0 }) // static floor

    const bodies = new Map<number, SolverBody>()
    bodies.set(1, bodyA)
    bodies.set(2, bodyB)

    const manifold = makeManifold({
      entityA: 1,
      entityB: 2,
      normalX: 0,
      normalY: 1, // normal from A toward B (downward)
      friction: 1.0,
      restitution: 0,
      points: [
        makeContactPoint({
          rAx: 0,
          rAy: 0,
          rBx: 0,
          rBy: 0,
          penetration: 1,
        }),
      ],
    })

    const vxBefore = bodyA.vx

    const constraints = initializeConstraints([manifold], bodies, false, 0, 0)
    solveVelocities(constraints, 20)

    // Tangential velocity (vx) should be reduced by friction
    expect(Math.abs(bodyA.vx)).toBeLessThan(Math.abs(vxBefore))
  })

  it('zero friction does not reduce tangential velocity', () => {
    const bodyA = makeSolverBody({ entityId: 1, vx: 10, vy: 5, invMass: 1 })
    const bodyB = makeSolverBody({ entityId: 2, vx: 0, vy: 0, invMass: 0 })

    const bodies = new Map<number, SolverBody>()
    bodies.set(1, bodyA)
    bodies.set(2, bodyB)

    const manifold = makeManifold({
      entityA: 1,
      entityB: 2,
      normalX: 0,
      normalY: -1,
      friction: 0,
      restitution: 0,
      points: [
        makeContactPoint({
          rAx: 0,
          rAy: 0,
          rBx: 0,
          rBy: 0,
          penetration: 1,
        }),
      ],
    })

    const constraints = initializeConstraints([manifold], bodies, false, 0, 0)
    solveVelocities(constraints, 20)

    // With zero friction, tangential velocity (vx) should be preserved
    expect(bodyA.vx).toBeCloseTo(10, 0)
  })
})

// ── Warm Starting ────────────────────────────────────────────────────────────

describe('warm starting', () => {
  it('applies cached impulses when warm starting is enabled', () => {
    const bodyA = makeSolverBody({ entityId: 1, vx: 0, vy: 0, invMass: 1 })
    const bodyB = makeSolverBody({ entityId: 2, vx: 0, vy: 0, invMass: 1 })

    const bodies = new Map<number, SolverBody>()
    bodies.set(1, bodyA)
    bodies.set(2, bodyB)

    const manifold = makeManifold({
      entityA: 1,
      entityB: 2,
      normalX: 1,
      normalY: 0,
      friction: 0,
      restitution: 0,
      points: [
        makeContactPoint({
          normalImpulse: 50,
          tangentImpulse: 0,
          rAx: 0,
          rAy: 0,
          rBx: 0,
          rBy: 0,
        }),
      ],
    })

    initializeConstraints([manifold], bodies, true, 0.8, 0)

    // Warm start should have applied impulse along normalX (1,0)
    // bodyA.vx -= px * invMA = -(50*0.8) * 1 = -40
    // bodyB.vx += px * invMB = +(50*0.8) * 1 = +40
    expect(bodyA.vx).toBeCloseTo(-40)
    expect(bodyB.vx).toBeCloseTo(40)
  })

  it('does not apply cached impulses when warm starting is disabled', () => {
    const bodyA = makeSolverBody({ entityId: 1, vx: 0, invMass: 1 })
    const bodyB = makeSolverBody({ entityId: 2, vx: 0, invMass: 1 })

    const bodies = new Map<number, SolverBody>()
    bodies.set(1, bodyA)
    bodies.set(2, bodyB)

    const manifold = makeManifold({
      entityA: 1,
      entityB: 2,
      points: [makeContactPoint({ normalImpulse: 50, rAx: 0, rAy: 0, rBx: 0, rBy: 0 })],
    })

    initializeConstraints([manifold], bodies, false, 0.8, 0)

    expect(bodyA.vx).toBe(0)
    expect(bodyB.vx).toBe(0)
  })
})

// ── Dominance ────────────────────────────────────────────────────────────────

describe('dominance', () => {
  it('higher dominance body acts as infinite mass and is not pushed', () => {
    const bodyA = makeSolverBody({ entityId: 1, vx: 10, invMass: 1, dominance: 10 })
    const bodyB = makeSolverBody({ entityId: 2, vx: -10, invMass: 1, dominance: 0 })

    const bodies = new Map<number, SolverBody>()
    bodies.set(1, bodyA)
    bodies.set(2, bodyB)

    const manifold = makeManifold({
      entityA: 1,
      entityB: 2,
      normalX: 1,
      normalY: 0,
      restitution: 0,
      friction: 0,
      points: [makeContactPoint({ rAx: 0, rAy: 0, rBx: 0, rBy: 0 })],
    })

    const vxABefore = bodyA.vx
    const constraints = initializeConstraints([manifold], bodies, false, 0, 0)
    solveVelocities(constraints, 10)

    // A (dominant) should keep its velocity, B should be pushed away
    expect(bodyA.vx).toBeCloseTo(vxABefore, 0)
    expect(bodyB.vx).toBeGreaterThanOrEqual(0) // no longer moving toward A
  })
})

// ── solvePositions ───────────────────────────────────────────────────────────

describe('solvePositions', () => {
  it('pushes overlapping bodies apart', () => {
    const bodyA = makeSolverBody({ entityId: 1, x: 0, y: 0, invMass: 1 })
    const bodyB = makeSolverBody({ entityId: 2, x: 5, y: 0, invMass: 1 })

    const bodies = new Map<number, SolverBody>()
    bodies.set(1, bodyA)
    bodies.set(2, bodyB)

    const manifold = makeManifold({
      entityA: 1,
      entityB: 2,
      normalX: 1,
      normalY: 0,
      restitution: 0,
      friction: 0,
      points: [
        makeContactPoint({
          worldAx: 5,
          worldAy: 0,
          worldBx: 0,
          worldBy: 0,
          rAx: 5,
          rAy: 0,
          rBx: -5,
          rBy: 0,
          penetration: 5,
        }),
      ],
    })

    const constraints = initializeConstraints([manifold], bodies, false, 0, 0)
    const xABefore = bodyA.x
    const xBBefore = bodyB.x

    solvePositions(constraints, 10, 0.2, 0.01)

    // Bodies should have been pushed apart
    expect(bodyA.x).toBeLessThan(xABefore)
    expect(bodyB.x).toBeGreaterThan(xBBefore)
  })

  it('does not correct when penetration is within slop', () => {
    const bodyA = makeSolverBody({ entityId: 1, x: 0, y: 0, invMass: 1 })
    const bodyB = makeSolverBody({ entityId: 2, x: 1, y: 0, invMass: 1 })

    const bodies = new Map<number, SolverBody>()
    bodies.set(1, bodyA)
    bodies.set(2, bodyB)

    const manifold = makeManifold({
      entityA: 1,
      entityB: 2,
      normalX: 1,
      normalY: 0,
      points: [
        makeContactPoint({
          worldAx: 0.5,
          worldAy: 0,
          worldBx: 0.5,
          worldBy: 0,
          rAx: 0.5,
          rAy: 0,
          rBx: -0.5,
          rBy: 0,
          penetration: 0.001, // tiny penetration
        }),
      ],
    })

    const constraints = initializeConstraints([manifold], bodies, false, 0, 0)
    solvePositions(constraints, 10, 0.2, 1.0) // large slop

    // No correction should happen
    expect(bodyA.x).toBeCloseTo(0)
    expect(bodyB.x).toBeCloseTo(1)
  })

  it('distributes correction proportionally to inverse mass', () => {
    // A: mass 1 (invMass=1), B: mass 10 (invMass=0.1)
    const bodyA = makeSolverBody({ entityId: 1, x: 0, y: 0, invMass: 1 })
    const bodyB = makeSolverBody({ entityId: 2, x: 1, y: 0, invMass: 0.1 })

    const bodies = new Map<number, SolverBody>()
    bodies.set(1, bodyA)
    bodies.set(2, bodyB)

    const manifold = makeManifold({
      entityA: 1,
      entityB: 2,
      normalX: 1,
      normalY: 0,
      points: [
        makeContactPoint({
          worldAx: 1,
          worldAy: 0,
          worldBx: 0,
          worldBy: 0,
          rAx: 1,
          rAy: 0,
          rBx: -1,
          rBy: 0,
          penetration: 5,
        }),
      ],
    })

    const constraints = initializeConstraints([manifold], bodies, false, 0, 0)
    solvePositions(constraints, 10, 0.2, 0)

    // A (lighter) should move more than B (heavier)
    const aMoved = Math.abs(bodyA.x - 0)
    const bMoved = Math.abs(bodyB.x - 1)
    expect(aMoved).toBeGreaterThan(bMoved)
  })

  it('static body (invMass=0) is not displaced', () => {
    const bodyA = makeSolverBody({ entityId: 1, x: 0, y: 0, invMass: 1 })
    const bodyB = makeSolverBody({ entityId: 2, x: 1, y: 0, invMass: 0 }) // static

    const bodies = new Map<number, SolverBody>()
    bodies.set(1, bodyA)
    bodies.set(2, bodyB)

    const manifold = makeManifold({
      entityA: 1,
      entityB: 2,
      normalX: 1,
      normalY: 0,
      points: [
        makeContactPoint({
          worldAx: 1,
          worldAy: 0,
          worldBx: 0,
          worldBy: 0,
          rAx: 1,
          rAy: 0,
          rBx: -1,
          rBy: 0,
          penetration: 5,
        }),
      ],
    })

    const constraints = initializeConstraints([manifold], bodies, false, 0, 0)
    solvePositions(constraints, 10, 0.2, 0)

    expect(bodyB.x).toBeCloseTo(1)
    // Only bodyA should be pushed
    expect(bodyA.x).toBeLessThan(0)
  })
})

// ── Angular Velocity ─────────────────────────────────────────────────────────

describe('angular velocity', () => {
  it('off-center impulse generates angular velocity when invInertia > 0', () => {
    const bodyA = makeSolverBody({ entityId: 1, vx: 10, invMass: 1, invInertia: 0.1 })
    const bodyB = makeSolverBody({ entityId: 2, vx: 0, invMass: 0 }) // static wall

    const bodies = new Map<number, SolverBody>()
    bodies.set(1, bodyA)
    bodies.set(2, bodyB)

    // Contact at an offset from center: rAy = 5 (above center)
    const manifold = makeManifold({
      entityA: 1,
      entityB: 2,
      normalX: 1,
      normalY: 0,
      friction: 0,
      restitution: 0,
      points: [
        makeContactPoint({
          rAx: 10,
          rAy: -5, // contact above body center
          rBx: 0,
          rBy: 0,
          penetration: 1,
        }),
      ],
    })

    const constraints = initializeConstraints([manifold], bodies, false, 0, 0)
    solveVelocities(constraints, 10)

    // Off-center normal impulse should produce angular velocity
    expect(bodyA.angVel).not.toBeCloseTo(0)
  })

  it('centered impulse does not generate angular velocity', () => {
    const bodyA = makeSolverBody({ entityId: 1, vx: 10, invMass: 1, invInertia: 0.1 })
    const bodyB = makeSolverBody({ entityId: 2, vx: 0, invMass: 0 })

    const bodies = new Map<number, SolverBody>()
    bodies.set(1, bodyA)
    bodies.set(2, bodyB)

    // Contact exactly at center: rA = (0,0) → cross product = 0 → no torque
    const manifold = makeManifold({
      entityA: 1,
      entityB: 2,
      normalX: 1,
      normalY: 0,
      friction: 0,
      restitution: 0,
      points: [makeContactPoint({ rAx: 0, rAy: 0, rBx: 0, rBy: 0, penetration: 1 })],
    })

    const constraints = initializeConstraints([manifold], bodies, false, 0, 0)
    solveVelocities(constraints, 10)

    expect(bodyA.angVel).toBeCloseTo(0)
  })
})
