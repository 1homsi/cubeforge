/**
 * Mass property computation from collider shapes.
 *
 * Reference: Rapier computes mass properties per-collider from density × area,
 * then sums them on the rigid body. Moment of inertia uses standard geometric
 * formulas + parallel axis theorem for offset shapes.
 */

/**
 * Compute mass and moment of inertia for a box collider.
 *
 * Box area = width × height
 * Box inertia about center = (1/12) × mass × (width² + height²)
 */
export function boxMassProperties(width: number, height: number, density: number): { mass: number; inertia: number } {
  const area = width * height
  const mass = density * area
  const inertia = (mass / 12) * (width * width + height * height)
  return { mass, inertia }
}

/**
 * Compute mass and moment of inertia for a circle collider.
 *
 * Circle area = π × r²
 * Circle inertia about center = (1/2) × mass × r²
 */
export function circleMassProperties(radius: number, density: number): { mass: number; inertia: number } {
  const area = Math.PI * radius * radius
  const mass = density * area
  const inertia = (mass / 2) * radius * radius
  return { mass, inertia }
}

/**
 * Compute mass and moment of inertia for a capsule collider.
 *
 * Capsule = rectangle + two semicircles (= one full circle).
 * Uses parallel axis theorem to combine.
 *
 * @param width - Total width of the capsule bounding box
 * @param height - Total height of the capsule bounding box
 * @param density - Mass per unit area
 */
export function capsuleMassProperties(
  width: number,
  height: number,
  density: number,
): { mass: number; inertia: number } {
  // Capsule orientation: taller = vertical capsule, wider = horizontal
  // Radius = half of the smaller dimension
  const isVertical = height >= width
  const radius = isVertical ? width / 2 : height / 2
  const rectLength = isVertical ? height - width : width - height
  if (rectLength <= 0) {
    // Degenerate capsule — it's just a circle
    return circleMassProperties(radius, density)
  }

  // Rectangle part
  const rectW = isVertical ? width : rectLength
  const rectH = isVertical ? rectLength : height
  const rectArea = rectW * rectH
  const rectMass = density * rectArea
  const rectInertia = (rectMass / 12) * (rectW * rectW + rectH * rectH)

  // Circle part (two semicircles = one full circle)
  const circleArea = Math.PI * radius * radius
  const circleMass = density * circleArea
  const circleInertiaCenter = (circleMass / 2) * radius * radius

  // Parallel axis theorem: each semicircle center is offset from capsule center
  const semiOffset = rectLength / 2
  const circleInertia = circleInertiaCenter + circleMass * semiOffset * semiOffset

  const totalMass = rectMass + circleMass
  const totalInertia = rectInertia + circleInertia

  return { mass: totalMass, inertia: totalInertia }
}

/**
 * Apply parallel axis theorem: shift inertia to a new center.
 *
 * I_new = I_center + mass × distance²
 */
export function parallelAxis(inertia: number, mass: number, offsetX: number, offsetY: number): number {
  return inertia + mass * (offsetX * offsetX + offsetY * offsetY)
}

// ── Area helpers ──────────────────────────────────────────────────────────

/** Area of a box collider: width × height */
export function boxArea(width: number, height: number): number {
  return width * height
}

/** Area of a circle collider: π × r² */
export function circleArea(radius: number): number {
  return Math.PI * radius * radius
}

/** Area of a capsule collider: rectangle area + circle area (two semicircles) */
export function capsuleArea(width: number, height: number): number {
  const isVertical = height >= width
  const radius = isVertical ? width / 2 : height / 2
  const rectLength = isVertical ? height - width : width - height
  if (rectLength <= 0) {
    // Degenerate capsule — just a circle
    return Math.PI * radius * radius
  }
  const rectW = isVertical ? width : rectLength
  const rectH = isVertical ? rectLength : height
  return rectW * rectH + Math.PI * radius * radius
}

// ── Mass property mutation helpers ────────────────────────────────────────

import type { RigidBodyComponent } from './components/rigidbody'
import type { BoxColliderComponent } from './components/boxCollider'
import type { CircleColliderComponent } from './components/circleCollider'
import type { CapsuleColliderComponent } from './components/capsuleCollider'

/**
 * Add extra mass on top of the current mass, recomputing invMass and invInertia.
 * The inertia is scaled proportionally to maintain the same shape distribution.
 */
export function setAdditionalMass(rb: RigidBodyComponent, additionalMass: number): void {
  const oldMass = rb.mass > 0 ? rb.mass : 1
  const newMass = oldMass + additionalMass
  if (newMass <= 0) return

  // Scale inertia proportionally
  rb.inertia = rb.inertia * (newMass / oldMass)
  rb.mass = newMass
  rb.invMass = 1 / newMass
  rb.invInertia = rb.lockRotation || rb.inertia <= 0 ? 0 : 1 / rb.inertia
}

/**
 * Override mass, inertia, and center of mass simultaneously.
 * centerOfMassX/Y are accepted for API completeness but not stored
 * (the engine uses collider offsets for center-of-mass shifting).
 */
export function setMassProperties(
  rb: RigidBodyComponent,
  mass: number,
  inertia: number,
  _centerOfMassX: number,
  _centerOfMassY: number,
): void {
  rb.mass = mass
  rb.inertia = inertia
  rb.invMass = mass > 0 ? 1 / mass : 0
  rb.invInertia = rb.lockRotation || inertia <= 0 ? 0 : 1 / inertia
  rb._massPropertiesDirty = false
}

/**
 * Recompute mass properties from attached colliders and mark the body's
 * cached inverse values as up-to-date.
 *
 * At least one collider should be provided; if none are, mass defaults to 1.
 */
export function recomputeMassFromColliders(
  rb: RigidBodyComponent,
  boxCol?: BoxColliderComponent,
  circleCol?: CircleColliderComponent,
  capsuleCol?: CapsuleColliderComponent,
): void {
  const density = rb.density > 0 ? rb.density : 1
  let mass: number
  let inertia: number

  if (boxCol) {
    const props = boxMassProperties(boxCol.width, boxCol.height, density)
    mass = props.mass
    inertia = props.inertia
    if (boxCol.offsetX !== 0 || boxCol.offsetY !== 0) {
      inertia = parallelAxis(inertia, mass, boxCol.offsetX, boxCol.offsetY)
    }
  } else if (circleCol) {
    const props = circleMassProperties(circleCol.radius, density)
    mass = props.mass
    inertia = props.inertia
    if (circleCol.offsetX !== 0 || circleCol.offsetY !== 0) {
      inertia = parallelAxis(inertia, mass, circleCol.offsetX, circleCol.offsetY)
    }
  } else if (capsuleCol) {
    const props = capsuleMassProperties(capsuleCol.width, capsuleCol.height, density)
    mass = props.mass
    inertia = props.inertia
    if (capsuleCol.offsetX !== 0 || capsuleCol.offsetY !== 0) {
      inertia = parallelAxis(inertia, mass, capsuleCol.offsetX, capsuleCol.offsetY)
    }
  } else {
    mass = 1
    inertia = 1
  }

  rb.mass = mass
  rb.inertia = inertia
  rb.invMass = mass > 0 ? 1 / mass : 0
  rb.invInertia = rb.lockRotation || inertia <= 0 ? 0 : 1 / inertia
  rb._massPropertiesDirty = false
}
