/**
 * Sequential impulse constraint solver.
 *
 * Implements the core velocity+position constraint solver loop used by
 * Rapier, Box2D, and most modern physics engines.
 *
 * Algorithm:
 * 1. Pre-step: compute effective mass for each contact point
 * 2. Warm start: apply cached impulses from previous frame
 * 3. Velocity iterations: solve normal + friction impulses
 * 4. Position iterations: Baumgarte correction for remaining penetration
 *
 * Reference: Rapier's `velocity_constraint.rs` and `contact_constraint.rs`
 * in src/dynamics/solver/
 */

import type { ContactManifold, ContactPoint } from './contactManifold'

// ── 2D cross product (scalar) ───────────────────────────────────────────────
// a × b = a.x * b.y - a.y * b.x
function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx
}

// ── Body state for the solver ───────────────────────────────────────────────

export interface SolverBody {
  /** Entity ID for lookup */
  entityId: number
  /** Position (mutable — updated by position solver) */
  x: number
  y: number
  /** Rotation angle */
  rotation: number
  /** Linear velocity (mutable — updated by velocity solver) */
  vx: number
  vy: number
  /** Angular velocity (mutable) */
  angVel: number
  /** Inverse mass (0 for static/kinematic) */
  invMass: number
  /** Inverse moment of inertia (0 for static/kinematic or locked rotation) */
  invInertia: number
  /** Dominance group (-127 to 127). Higher dominance = infinite mass in contacts */
  dominance: number
}

// ── Pre-computed constraint data ────────────────────────────────────────────

interface VelocityConstraint {
  manifold: ContactManifold
  bodyA: SolverBody
  bodyB: SolverBody
  /** Tangent direction (perpendicular to normal) */
  tangentX: number
  tangentY: number
  /** Per-point pre-computed effective masses */
  pointData: PointConstraintData[]
  /** Restitution velocity threshold — below this, no bounce */
  restitutionThreshold: number
}

interface PointConstraintData {
  point: ContactPoint
  /** Effective mass for normal impulse: 1 / (invMA + invMB + (rA×n)²·invIA + (rB×n)²·invIB) */
  normalMass: number
  /** Effective mass for tangent impulse */
  tangentMass: number
  /** Relative velocity along normal at pre-step (for restitution) */
  velocityBias: number
}

// ── Solver ──────────────────────────────────────────────────────────────────

/**
 * Pre-compute constraint data for all manifolds.
 *
 * Computes effective masses, restitution bias, and applies warm start impulses.
 */
export function initializeConstraints(
  manifolds: ContactManifold[],
  bodies: Map<number, SolverBody>,
  warmStarting: boolean,
  warmFactor: number,
  restitutionThreshold: number,
): VelocityConstraint[] {
  const constraints: VelocityConstraint[] = []

  for (const manifold of manifolds) {
    const bodyA = bodies.get(manifold.entityA)
    const bodyB = bodies.get(manifold.entityB)
    if (!bodyA || !bodyB) continue

    // Compute effective inverse masses considering dominance
    let invMA = bodyA.invMass
    let invMB = bodyB.invMass
    let invIA = bodyA.invInertia
    let invIB = bodyB.invInertia

    if (bodyA.dominance !== bodyB.dominance) {
      if (bodyA.dominance > bodyB.dominance) {
        // A dominates — treat A as infinite mass
        invMA = 0
        invIA = 0
      } else {
        invMB = 0
        invIB = 0
      }
    }

    // Tangent is perpendicular to normal (rotated 90° CCW)
    const tangentX = -manifold.normalY
    const tangentY = manifold.normalX

    const pointData: PointConstraintData[] = []

    for (const pt of manifold.points) {
      const rAx = pt.rAx
      const rAy = pt.rAy
      const rBx = pt.rBx
      const rBy = pt.rBy

      // Normal effective mass
      const rAxN = cross(rAx, rAy, manifold.normalX, manifold.normalY)
      const rBxN = cross(rBx, rBy, manifold.normalX, manifold.normalY)
      const normalMassInv = invMA + invMB + rAxN * rAxN * invIA + rBxN * rBxN * invIB
      const normalMass = normalMassInv > 0 ? 1 / normalMassInv : 0

      // Tangent effective mass
      const rAxT = cross(rAx, rAy, tangentX, tangentY)
      const rBxT = cross(rBx, rBy, tangentX, tangentY)
      const tangentMassInv = invMA + invMB + rAxT * rAxT * invIA + rBxT * rBxT * invIB
      const tangentMass = tangentMassInv > 0 ? 1 / tangentMassInv : 0

      // Relative velocity at contact point along normal (for restitution bias)
      const relVx = bodyB.vx + (-bodyB.angVel * rBy) - (bodyA.vx + (-bodyA.angVel * rAy))
      const relVy = bodyB.vy + (bodyB.angVel * rBx) - (bodyA.vy + (bodyA.angVel * rAx))
      const relVelNormal = relVx * manifold.normalX + relVy * manifold.normalY

      // Restitution bias: only apply bounce if closing velocity exceeds threshold
      const velocityBias = -relVelNormal > restitutionThreshold ? manifold.restitution * relVelNormal : 0

      pointData.push({ point: pt, normalMass, tangentMass, velocityBias })

      // Warm start: apply cached impulses
      if (warmStarting && (pt.normalImpulse !== 0 || pt.tangentImpulse !== 0)) {
        const warmN = pt.normalImpulse * warmFactor
        const warmT = pt.tangentImpulse * warmFactor
        const px = manifold.normalX * warmN + tangentX * warmT
        const py = manifold.normalY * warmN + tangentY * warmT

        bodyA.vx -= px * invMA
        bodyA.vy -= py * invMA
        bodyA.angVel -= cross(rAx, rAy, px, py) * invIA

        bodyB.vx += px * invMB
        bodyB.vy += py * invMB
        bodyB.angVel += cross(rBx, rBy, px, py) * invIB
      }
    }

    constraints.push({
      manifold,
      bodyA,
      bodyB,
      tangentX,
      tangentY,
      pointData,
      restitutionThreshold,
    })
  }

  return constraints
}

/**
 * Run velocity solver iterations.
 *
 * Each iteration resolves normal impulses (prevent penetration) and
 * tangent impulses (Coulomb friction) for all contact points.
 */
export function solveVelocities(constraints: VelocityConstraint[], iterations: number): void {
  for (let iter = 0; iter < iterations; iter++) {
    for (const c of constraints) {
      const { manifold, bodyA, bodyB, tangentX, tangentY, pointData } = c

      let invMA = bodyA.invMass
      let invMB = bodyB.invMass
      let invIA = bodyA.invInertia
      let invIB = bodyB.invInertia

      if (bodyA.dominance !== bodyB.dominance) {
        if (bodyA.dominance > bodyB.dominance) {
          invMA = 0
          invIA = 0
        } else {
          invMB = 0
          invIB = 0
        }
      }

      for (const pd of pointData) {
        const pt = pd.point
        const rAx = pt.rAx
        const rAy = pt.rAy
        const rBx = pt.rBx
        const rBy = pt.rBy

        // ── Normal impulse ────────────────────────────────────────────────
        // Compute relative velocity at contact point
        const relVx = bodyB.vx + (-bodyB.angVel * rBy) - (bodyA.vx + (-bodyA.angVel * rAy))
        const relVy = bodyB.vy + (bodyB.angVel * rBx) - (bodyA.vy + (bodyA.angVel * rAx))
        const relVelNormal = relVx * manifold.normalX + relVy * manifold.normalY

        // Impulse magnitude: j = -(1 + e) * vRel·n / effectiveMass
        // With accumulated impulse clamping (Rapier/Box2D style)
        let jn = -(relVelNormal + pd.velocityBias) * pd.normalMass

        // Accumulated impulse clamping — more stable than per-iteration clamping
        const oldImpulse = pt.normalImpulse
        pt.normalImpulse = Math.max(0, pt.normalImpulse + jn)
        jn = pt.normalImpulse - oldImpulse

        // Apply normal impulse
        const pnx = manifold.normalX * jn
        const pny = manifold.normalY * jn

        bodyA.vx -= pnx * invMA
        bodyA.vy -= pny * invMA
        bodyA.angVel -= cross(rAx, rAy, pnx, pny) * invIA

        bodyB.vx += pnx * invMB
        bodyB.vy += pny * invMB
        bodyB.angVel += cross(rBx, rBy, pnx, pny) * invIB

        // ── Tangent impulse (friction) ────────────────────────────────────
        const relVx2 = bodyB.vx + (-bodyB.angVel * rBy) - (bodyA.vx + (-bodyA.angVel * rAy))
        const relVy2 = bodyB.vy + (bodyB.angVel * rBx) - (bodyA.vy + (bodyA.angVel * rAx))
        const relVelTangent = relVx2 * tangentX + relVy2 * tangentY

        let jt = -relVelTangent * pd.tangentMass

        // Coulomb friction clamp: |tangentImpulse| ≤ μ × normalImpulse
        const maxFriction = manifold.friction * pt.normalImpulse
        const oldTangent = pt.tangentImpulse
        pt.tangentImpulse = Math.max(-maxFriction, Math.min(maxFriction, pt.tangentImpulse + jt))
        jt = pt.tangentImpulse - oldTangent

        const ptx = tangentX * jt
        const pty = tangentY * jt

        bodyA.vx -= ptx * invMA
        bodyA.vy -= pty * invMA
        bodyA.angVel -= cross(rAx, rAy, ptx, pty) * invIA

        bodyB.vx += ptx * invMB
        bodyB.vy += pty * invMB
        bodyB.angVel += cross(rBx, rBy, ptx, pty) * invIB
      }
    }
  }
}

/**
 * Run position solver iterations (Baumgarte stabilization).
 *
 * Pushes overlapping bodies apart to correct penetration that the
 * velocity solver couldn't fully resolve. Uses a fraction (beta) of
 * the remaining penetration to avoid over-correction.
 */
export function solvePositions(
  constraints: VelocityConstraint[],
  iterations: number,
  beta: number,
  slop: number,
): void {
  for (let iter = 0; iter < iterations; iter++) {
    for (const c of constraints) {
      const { bodyA, bodyB, manifold } = c

      let invMA = bodyA.invMass
      let invMB = bodyB.invMass

      if (bodyA.dominance !== bodyB.dominance) {
        if (bodyA.dominance > bodyB.dominance) {
          invMA = 0
        } else {
          invMB = 0
        }
      }

      for (const pd of c.pointData) {
        // Recompute penetration from current positions
        // Using the contact normal and the body positions
        const rAx = pd.point.worldAx - bodyA.x
        const rAy = pd.point.worldAy - bodyA.y
        const rBx = pd.point.worldBx - bodyB.x
        const rBy = pd.point.worldBy - bodyB.y

        // Current separation along normal
        const separation =
          (bodyB.x + rBx - (bodyA.x + rAx)) * manifold.normalX +
          (bodyB.y + rBy - (bodyA.y + rAy)) * manifold.normalY -
          pd.point.penetration

        // Only correct if penetrating beyond slop
        const correction = beta * Math.max(0, -separation - slop)
        if (correction <= 0) continue

        const totalInvMass = invMA + invMB
        if (totalInvMass <= 0) continue

        const corrX = manifold.normalX * correction
        const corrY = manifold.normalY * correction

        bodyA.x -= corrX * (invMA / totalInvMass)
        bodyA.y -= corrY * (invMA / totalInvMass)
        bodyB.x += corrX * (invMB / totalInvMass)
        bodyB.y += corrY * (invMB / totalInvMass)
      }
    }
  }
}
