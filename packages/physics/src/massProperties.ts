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
export function boxMassProperties(
  width: number,
  height: number,
  density: number,
): { mass: number; inertia: number } {
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
export function circleMassProperties(
  radius: number,
  density: number,
): { mass: number; inertia: number } {
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
