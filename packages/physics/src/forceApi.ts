/**
 * Force & impulse API for rigid bodies.
 *
 * Forces accumulate over a frame and are applied during velocity integration.
 * Impulses are instant velocity changes applied immediately.
 */

import type { RigidBodyComponent } from './components/rigidbody'

// ── Force accumulation (continuous — call every frame) ─────────────────

/** Add a force to the body's accumulator. Applied during velocity integration. */
export function addForce(rb: RigidBodyComponent, fx: number, fy: number): void {
  rb.forceX += fx
  rb.forceY += fy
}

/** Add torque to the body's accumulator. Applied during angular integration. */
export function addTorque(rb: RigidBodyComponent, t: number): void {
  rb.torque += t
}

/**
 * Add a force at a world-space point, decomposed into force + torque.
 *
 * torque += (p - center) × f   (2D cross product)
 *
 * @param fx - Force X component
 * @param fy - Force Y component
 * @param px - World-space point X where force is applied
 * @param py - World-space point Y where force is applied
 * @param cx - Body center of mass X (usually transform.x)
 * @param cy - Body center of mass Y (usually transform.y)
 */
export function addForceAtPoint(
  rb: RigidBodyComponent,
  fx: number,
  fy: number,
  px: number,
  py: number,
  cx: number,
  cy: number,
): void {
  rb.forceX += fx
  rb.forceY += fy
  // 2D cross: (p - c) × f = (px - cx) * fy - (py - cy) * fx
  rb.torque += (px - cx) * fy - (py - cy) * fx
}

// ── Impulse application (instant — one-time velocity change) ───────────

/** Apply an impulse: instant velocity change. v += impulse * invMass */
export function applyImpulse(rb: RigidBodyComponent, ix: number, iy: number): void {
  rb.vx += ix * rb.invMass
  rb.vy += iy * rb.invMass
}

/** Apply a torque impulse: instant angular velocity change. ω += t * invInertia */
export function applyTorqueImpulse(rb: RigidBodyComponent, t: number): void {
  rb.angularVelocity += t * rb.invInertia
}

/**
 * Apply an impulse at a world-space point, generating both linear and angular response.
 *
 * v += impulse * invMass
 * ω += ((p - c) × impulse) * invInertia
 *
 * @param ix - Impulse X component
 * @param iy - Impulse Y component
 * @param px - World-space point X where impulse is applied
 * @param py - World-space point Y where impulse is applied
 * @param cx - Body center of mass X
 * @param cy - Body center of mass Y
 */
export function applyImpulseAtPoint(
  rb: RigidBodyComponent,
  ix: number,
  iy: number,
  px: number,
  py: number,
  cx: number,
  cy: number,
): void {
  rb.vx += ix * rb.invMass
  rb.vy += iy * rb.invMass
  // 2D cross: (p - c) × impulse
  rb.angularVelocity += ((px - cx) * iy - (py - cy) * ix) * rb.invInertia
}

// ── Reset ──────────────────────────────────────────────────────────────

/** Zero the force accumulator. */
export function resetForces(rb: RigidBodyComponent): void {
  rb.forceX = 0
  rb.forceY = 0
}

/** Zero the torque accumulator. */
export function resetTorques(rb: RigidBodyComponent): void {
  rb.torque = 0
}

// ── Kinematic position-based mode ──────────────────────────────────────

/**
 * Set the next kinematic position target. The physics system will compute
 * velocity from the position delta: v = (target - current) / dt.
 * This enables kinematic bodies to push dynamic bodies via contacts.
 */
export function setNextKinematicPosition(rb: RigidBodyComponent, x: number, y: number): void {
  rb._nextKinematicX = x
  rb._nextKinematicY = y
}

/**
 * Set the next kinematic rotation target. The physics system will compute
 * angular velocity from the rotation delta: ω = (target - current) / dt.
 */
export function setNextKinematicRotation(rb: RigidBodyComponent, angle: number): void {
  rb._nextKinematicRotation = angle
}

// ── Active collision type constants ────────────────────────────────────

/** Dynamic-dynamic body pairs generate contacts */
export const COLLISION_DYNAMIC_DYNAMIC = 1 << 0
/** Dynamic-kinematic body pairs generate contacts */
export const COLLISION_DYNAMIC_KINEMATIC = 1 << 1
/** Dynamic-static body pairs generate contacts */
export const COLLISION_DYNAMIC_STATIC = 1 << 2
/** Kinematic-kinematic body pairs generate contacts */
export const COLLISION_KINEMATIC_KINEMATIC = 1 << 3
/** Kinematic-static body pairs generate contacts */
export const COLLISION_KINEMATIC_STATIC = 1 << 4

/** Default active collision types: dynamic vs all */
export const DEFAULT_ACTIVE_COLLISION_TYPES =
  COLLISION_DYNAMIC_DYNAMIC | COLLISION_DYNAMIC_KINEMATIC | COLLISION_DYNAMIC_STATIC
