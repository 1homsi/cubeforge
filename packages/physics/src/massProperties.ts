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

// ── Polygon & triangle area helpers ───────────────────────────────────────

/**
 * Signed area of a simple polygon using the shoelace formula.
 * Returns the absolute (unsigned) area.
 */
export function polygonArea(vertices: { x: number; y: number }[]): number {
  const n = vertices.length
  if (n < 3) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const curr = vertices[i]
    const next = vertices[(i + 1) % n]
    sum += curr.x * next.y - next.x * curr.y
  }
  return Math.abs(sum) / 2
}

/**
 * Area of a triangle from three vertices.
 * Uses 0.5 × |cross(b - a, c - a)|.
 */
export function triangleArea(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2
}

// ── Polygon & triangle mass properties ───────────────────────────────────

/**
 * Mass and moment of inertia for a convex polygon.
 *
 * Uses the shoelace formula for area and a fan-triangulation from
 * vertex 0 to compute the second moment of area, then converts to
 * moment of inertia about the polygon centroid.
 *
 * Reference: https://en.wikipedia.org/wiki/Second_moment_of_area#Any_polygon
 */
export function polygonMassProperties(
  vertices: { x: number; y: number }[],
  density: number,
): { mass: number; inertia: number } {
  const n = vertices.length
  if (n < 3) return { mass: 0, inertia: 0 }

  // Compute area and centroid using shoelace
  let signedArea2 = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < n; i++) {
    const v0 = vertices[i]
    const v1 = vertices[(i + 1) % n]
    const cross = v0.x * v1.y - v1.x * v0.y
    signedArea2 += cross
    cx += (v0.x + v1.x) * cross
    cy += (v0.y + v1.y) * cross
  }

  const area = Math.abs(signedArea2) / 2
  if (area === 0) return { mass: 0, inertia: 0 }

  const mass = density * area

  cx /= 3 * signedArea2
  cy /= 3 * signedArea2

  // Moment of inertia about the centroid via fan-triangulation from vertex 0.
  // For each triangle (v0, vi, vi+1), accumulate using the triangle inertia
  // formula about the centroid and the parallel axis theorem.
  let totalInertia = 0
  const p0 = vertices[0]
  for (let i = 1; i < n - 1; i++) {
    const p1 = vertices[i]
    const p2 = vertices[i + 1]

    // Triangle area (signed)
    const triArea = ((p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y)) / 2
    const triMass = density * Math.abs(triArea)
    if (triMass === 0) continue

    // Triangle centroid
    const tcx = (p0.x + p1.x + p2.x) / 3
    const tcy = (p0.y + p1.y + p2.y) / 3

    // Moment of inertia of triangle about its own centroid:
    // I = (mass/18) * (dot(a,a) + dot(b,b) + dot(c,c) - a·b - a·c - b·c)
    // where a, b, c are vertex positions relative to the triangle
    const ax = p0.x - tcx,
      ay = p0.y - tcy
    const bx = p1.x - tcx,
      by = p1.y - tcy
    const cxx = p2.x - tcx,
      cyy = p2.y - tcy
    const triInertia =
      ((triMass / 6) *
        (ax * ax +
          ay * ay +
          bx * bx +
          by * by +
          cxx * cxx +
          cyy * cyy +
          ax * bx +
          ay * by +
          ax * cxx +
          ay * cyy +
          bx * cxx +
          by * cyy)) /
      6

    // Shift to polygon centroid via parallel axis theorem
    const dx = tcx - cx
    const dy = tcy - cy
    totalInertia += triInertia + triMass * (dx * dx + dy * dy)
  }

  return { mass, inertia: totalInertia }
}

/**
 * Mass and moment of inertia for a triangle collider.
 *
 * Area = 0.5 × |cross(b - a, c - a)|
 * Inertia about centroid = (mass / 18) × (|a'|² + |b'|² + |c'|² + a'·b' + a'·c' + b'·c')
 * where a', b', c' are positions relative to the triangle centroid.
 *
 * Simplified standard form:
 * I = (mass / 6) × (a'·a' + b'·b' + c'·c') / 6, but using the full formula:
 * I = (mass / 18) × Σ(vi · vi + vi · vi+1) summed cyclically.
 */
export function triangleMassProperties(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  density: number,
): { mass: number; inertia: number } {
  const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2
  if (area === 0) return { mass: 0, inertia: 0 }

  const mass = density * area

  // Centroid
  const cx = (a.x + b.x + c.x) / 3
  const cy = (a.y + b.y + c.y) / 3

  // Vertices relative to centroid
  const ax = a.x - cx,
    ay = a.y - cy
  const bx = b.x - cx,
    by = b.y - cy
  const ccx = c.x - cx,
    ccy = c.y - cy

  // Inertia about centroid:
  // I = (mass / 6) × (a'² + b'² + c'² + a'·b' + a'·c' + b'·c') / 6
  // This is the standard triangle inertia formula.
  const dotAA = ax * ax + ay * ay
  const dotBB = bx * bx + by * by
  const dotCC = ccx * ccx + ccy * ccy
  const dotAB = ax * bx + ay * by
  const dotAC = ax * ccx + ay * ccy
  const dotBC = bx * ccx + by * ccy

  const inertia = ((mass / 6) * (dotAA + dotBB + dotCC + dotAB + dotAC + dotBC)) / 6

  return { mass, inertia }
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
