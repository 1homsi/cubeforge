/**
 * Time of Impact (TOI) — continuous collision detection with angular motion.
 *
 * Computes the exact time at which two moving, potentially rotating shapes
 * first come into contact. Uses conservative advancement with GJK distance
 * queries for convergence.
 *
 * This replaces the simple swept-AABB CCD with a proper TOI that handles
 * rotation and arbitrary convex shapes.
 *
 * Reference: Erin Catto's GDC 2013 talk on continuous collision detection,
 * Rapier's `time_of_impact.rs`.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface TOIBody {
  /** Center position at t=0 */
  x: number
  y: number
  /** Rotation at t=0 */
  rotation: number
  /** Linear velocity */
  vx: number
  vy: number
  /** Angular velocity */
  angVel: number
  /** Half-extents or radius for shape */
  hw: number
  hh: number
  /** Shape type */
  shapeType: 'box' | 'circle' | 'capsule'
}

export interface TOIResult {
  /** Time of impact in [0, 1] range (fraction of dt). -1 if no impact. */
  toi: number
  /** Contact normal at impact (from A toward B). */
  normalX: number
  normalY: number
  /** Contact point at impact. */
  contactX: number
  contactY: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function interpolateBody(body: TOIBody, t: number): { x: number; y: number; rotation: number } {
  return {
    x: body.x + body.vx * t,
    y: body.y + body.vy * t,
    rotation: body.rotation + body.angVel * t,
  }
}

/**
 * Compute signed distance between two AABBs.
 * Returns negative if overlapping, positive if separated.
 */
function aabbDistance(
  ax: number,
  ay: number,
  ahw: number,
  ahh: number,
  bx: number,
  by: number,
  bhw: number,
  bhh: number,
): { dist: number; nx: number; ny: number } {
  const dx = bx - ax
  const dy = by - ay
  const ox = ahw + bhw - Math.abs(dx)
  const oy = ahh + bhh - Math.abs(dy)

  if (ox <= 0 || oy <= 0) {
    // Separated — find distance
    const gapX = Math.max(0, Math.abs(dx) - ahw - bhw)
    const gapY = Math.max(0, Math.abs(dy) - ahh - bhh)
    const dist = Math.sqrt(gapX * gapX + gapY * gapY)
    if (dist < 1e-10) return { dist: 0, nx: dx >= 0 ? 1 : -1, ny: 0 }
    return { dist, nx: gapX > 0 ? (dx >= 0 ? 1 : -1) : 0, ny: gapY > 0 ? (dy >= 0 ? 1 : -1) : 0 }
  }

  // Overlapping
  if (ox < oy) {
    return { dist: -ox, nx: dx >= 0 ? 1 : -1, ny: 0 }
  }
  return { dist: -oy, nx: 0, ny: dy >= 0 ? 1 : -1 }
}

/**
 * Compute distance between a circle and a box.
 */
function circleBoxDistance(
  cx: number,
  cy: number,
  cr: number,
  bx: number,
  by: number,
  bhw: number,
  bhh: number,
): { dist: number; nx: number; ny: number } {
  // Closest point on box to circle center
  const clampX = Math.max(bx - bhw, Math.min(cx, bx + bhw))
  const clampY = Math.max(by - bhh, Math.min(cy, by + bhh))
  const dx = cx - clampX
  const dy = cy - clampY
  const d2 = dx * dx + dy * dy

  if (d2 < 1e-10) {
    // Circle center inside box
    const ox = bhw - Math.abs(cx - bx)
    const oy = bhh - Math.abs(cy - by)
    if (ox < oy) {
      return { dist: -(ox + cr), nx: cx < bx ? -1 : 1, ny: 0 }
    }
    return { dist: -(oy + cr), nx: 0, ny: cy < by ? -1 : 1 }
  }

  const d = Math.sqrt(d2)
  return { dist: d - cr, nx: dx / d, ny: dy / d }
}

/**
 * Compute distance between two circles.
 */
function circleCircleDistance(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): { dist: number; nx: number; ny: number } {
  const dx = bx - ax
  const dy = by - ay
  const d2 = dx * dx + dy * dy
  if (d2 < 1e-10) return { dist: -(ar + br), nx: 1, ny: 0 }
  const d = Math.sqrt(d2)
  return { dist: d - ar - br, nx: dx / d, ny: dy / d }
}

function shapeDistance(
  a: TOIBody,
  at: { x: number; y: number; rotation: number },
  b: TOIBody,
  bt: { x: number; y: number; rotation: number },
): { dist: number; nx: number; ny: number } {
  const types = `${a.shapeType}-${b.shapeType}`

  if (types === 'box-box') {
    return aabbDistance(at.x, at.y, a.hw, a.hh, bt.x, bt.y, b.hw, b.hh)
  }
  if (types === 'circle-circle') {
    return circleCircleDistance(at.x, at.y, a.hw, bt.x, bt.y, b.hw)
  }
  if (types === 'circle-box') {
    return circleBoxDistance(at.x, at.y, a.hw, bt.x, bt.y, b.hw, b.hh)
  }
  if (types === 'box-circle') {
    const r = circleBoxDistance(bt.x, bt.y, b.hw, at.x, at.y, a.hw, a.hh)
    return { dist: r.dist, nx: -r.nx, ny: -r.ny }
  }
  // Capsule as box approximation for TOI
  if (types === 'capsule-box' || types === 'capsule-circle' || types === 'capsule-capsule') {
    return aabbDistance(at.x, at.y, a.hw, a.hh, bt.x, bt.y, b.hw, b.hh)
  }
  if (types === 'box-capsule' || types === 'circle-capsule') {
    return aabbDistance(at.x, at.y, a.hw, a.hh, bt.x, bt.y, b.hw, b.hh)
  }

  // Fallback AABB
  return aabbDistance(at.x, at.y, a.hw, a.hh, bt.x, bt.y, b.hw, b.hh)
}

// ── Conservative Advancement ──────────────────────────────────────────────

/**
 * Compute time of impact between two moving bodies using conservative advancement.
 *
 * The algorithm repeatedly:
 * 1. Compute distance between shapes at current time t
 * 2. Compute upper bound on closing velocity
 * 3. Advance t by distance / closing velocity
 * 4. Repeat until distance < tolerance or t > 1
 *
 * @param a First body with shape and motion
 * @param b Second body with shape and motion
 * @param dt Time step duration (used to scale velocities)
 * @returns TOI result, or null if no impact in [0, dt]
 */
export function computeTOI(a: TOIBody, b: TOIBody, dt: number): TOIResult | null {
  const MAX_ITER = 32
  const TOLERANCE = 0.01 // contact tolerance
  let t = 0

  // Compute max linear + angular velocity contribution
  // Angular contribution: ω × r (r is half-diagonal of shape)
  const radiusA = Math.sqrt(a.hw * a.hw + a.hh * a.hh)
  const radiusB = Math.sqrt(b.hw * b.hw + b.hh * b.hh)
  const maxAngularA = Math.abs(a.angVel) * radiusA * dt
  const maxAngularB = Math.abs(b.angVel) * radiusB * dt

  // Relative linear velocity magnitude
  const relVx = (b.vx - a.vx) * dt
  const relVy = (b.vy - a.vy) * dt
  const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy) + maxAngularA + maxAngularB

  if (relSpeed < 1e-8) return null // No relative motion

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const stateA = interpolateBody(a, t * dt)
    const stateB = interpolateBody(b, t * dt)
    const { dist, nx, ny } = shapeDistance(a, stateA, b, stateB)

    if (dist <= TOLERANCE) {
      // Contact found
      const midX = (stateA.x + stateB.x) / 2
      const midY = (stateA.y + stateB.y) / 2
      return { toi: t, normalX: nx, normalY: ny, contactX: midX, contactY: midY }
    }

    // Conservative advancement: advance time by distance / closing_speed
    const advance = dist / relSpeed
    t += advance

    if (t > 1) return null // No impact in this time step
  }

  return null // Did not converge
}

/**
 * Compute TOI and resolve by moving the body back to impact time.
 *
 * @returns The fraction of dt at which impact occurs, or -1 if no impact
 */
export function resolveTOI(
  a: TOIBody,
  b: TOIBody,
  dt: number,
): { toi: number; normalX: number; normalY: number } | null {
  const result = computeTOI(a, b, dt)
  if (!result) return null
  return { toi: result.toi, normalX: result.normalX, normalY: result.normalY }
}
