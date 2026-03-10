/**
 * Rigid body state query functions.
 *
 * Standalone utility functions for querying derived properties of rigid bodies
 * such as velocity at a point, kinetic/potential energy, and position prediction.
 */

import type { RigidBodyComponent } from './components/rigidbody'

/**
 * Compute the velocity at a specific world-space point, accounting for
 * both linear velocity and angular velocity contribution.
 *
 * v_point = v_linear + ω × r
 * In 2D: vx = rb.vx - ω * (pointY - centerY)
 *         vy = rb.vy + ω * (pointX - centerX)
 */
export function velocityAtPoint(
  rb: RigidBodyComponent,
  pointX: number,
  pointY: number,
  centerX: number,
  centerY: number,
): { vx: number; vy: number } {
  return {
    vx: rb.vx - rb.angularVelocity * (pointY - centerY),
    vy: rb.vy + rb.angularVelocity * (pointX - centerX),
  }
}

/**
 * Compute the total kinetic energy of a rigid body.
 *
 * KE = 0.5 * mass * (vx² + vy²) + 0.5 * inertia * ω²
 */
export function kineticEnergy(rb: RigidBodyComponent): number {
  const mass = rb.mass > 0 ? rb.mass : rb.invMass > 0 ? 1 / rb.invMass : 0
  const inertia = rb.inertia > 0 ? rb.inertia : 0
  return 0.5 * mass * (rb.vx * rb.vx + rb.vy * rb.vy) + 0.5 * inertia * rb.angularVelocity * rb.angularVelocity
}

/**
 * Compute the gravitational potential energy of a rigid body.
 *
 * PE = mass * gravity * height
 */
export function potentialEnergy(rb: RigidBodyComponent, gravity: number, height: number): number {
  const mass = rb.mass > 0 ? rb.mass : rb.invMass > 0 ? 1 / rb.invMass : 0
  return mass * gravity * height
}

/**
 * Predict the position and rotation of a rigid body after a time step,
 * using its current velocity.
 *
 * x' = x + vx * dt
 * y' = y + vy * dt
 * rotation' = rotation + angularVelocity * dt
 */
export function predictPosition(
  rb: RigidBodyComponent,
  x: number,
  y: number,
  rotation: number,
  dt: number,
): { x: number; y: number; rotation: number } {
  return {
    x: x + rb.vx * dt,
    y: y + rb.vy * dt,
    rotation: rotation + rb.angularVelocity * dt,
  }
}
