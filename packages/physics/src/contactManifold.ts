/**
 * Contact manifold generation for the impulse solver.
 *
 * A ContactManifold describes the collision between two entities:
 * the contact normal, penetration depth, and 1-2 contact points
 * where impulses will be applied.
 *
 * Reference: Rapier's contact_generator module uses SAT for convex shapes
 * and generates clipped edge-edge contact points. For AABBs we simplify
 * since all normals are axis-aligned.
 */

export interface ContactPoint {
  /** World-space position on body A's surface */
  worldAx: number
  worldAy: number
  /** World-space position on body B's surface */
  worldBx: number
  worldBy: number
  /** Offset from body A center to contact point */
  rAx: number
  rAy: number
  /** Offset from body B center to contact point */
  rBx: number
  rBy: number
  /** Penetration depth (positive = overlapping) */
  penetration: number
  /** Accumulated normal impulse (for warm starting) */
  normalImpulse: number
  /** Accumulated tangent impulse (for warm starting) */
  tangentImpulse: number
  /** Feature ID for contact matching across frames */
  featureId: number
}

export interface ContactManifold {
  entityA: number
  entityB: number
  /** Contact normal pointing from A toward B */
  normalX: number
  normalY: number
  /** Contact points (1-2 for box-box, 1 for circle contacts) */
  points: ContactPoint[]
  /** Combined friction coefficient */
  friction: number
  /** Combined restitution coefficient */
  restitution: number
}

// ── Feature ID encoding ─────────────────────────────────────────────────────

// Feature IDs encode which geometric feature (edge/vertex) produced the contact.
// This enables matching contacts across frames for warm starting.
// Encoding: axis (0=X, 1=Y) in bit 0, sign in bit 1, corner index in bits 2-3.
function makeFeatureId(axis: number, sign: number, corner: number): number {
  return (axis << 0) | (sign << 1) | (corner << 2)
}

// ── AABB-AABB manifold ──────────────────────────────────────────────────────

/**
 * Generate a contact manifold between two AABBs.
 *
 * Finds the axis of minimum penetration (like SAT with axis-aligned normals),
 * then clips the overlapping edge to produce 1-2 contact points.
 *
 * Returns null if no overlap.
 */
export function generateBoxBoxManifold(
  aCx: number,
  aCy: number,
  aHw: number,
  aHh: number,
  bCx: number,
  bCy: number,
  bHw: number,
  bHh: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  const dx = bCx - aCx
  const dy = bCy - aCy
  const overlapX = aHw + bHw - Math.abs(dx)
  const overlapY = aHh + bHh - Math.abs(dy)

  if (overlapX <= 0 || overlapY <= 0) return null

  let normalX: number
  let normalY: number
  let penetration: number

  if (overlapX < overlapY) {
    // X is the separating axis
    normalX = dx >= 0 ? 1 : -1
    normalY = 0
    penetration = overlapX

    // Contact edge: the shared vertical edge
    // Find the Y overlap region for contact points
    const aTop = aCy - aHh
    const aBottom = aCy + aHh
    const bTop = bCy - bHh
    const bBottom = bCy + bHh

    const contactTop = Math.max(aTop, bTop)
    const contactBottom = Math.min(aBottom, bBottom)

    if (contactTop >= contactBottom) {
      // Single contact point
      const contactY = (contactTop + contactBottom) / 2
      const contactX = normalX > 0 ? aCx + aHw : aCx - aHw
      return {
        normalX,
        normalY,
        points: [
          {
            worldAx: contactX,
            worldAy: contactY,
            worldBx: contactX - normalX * penetration,
            worldBy: contactY,
            rAx: contactX - aCx,
            rAy: contactY - aCy,
            rBx: contactX - normalX * penetration - bCx,
            rBy: contactY - bCy,
            penetration,
            normalImpulse: 0,
            tangentImpulse: 0,
            featureId: makeFeatureId(0, normalX > 0 ? 1 : 0, 0),
          },
        ],
      }
    }

    // Two contact points at the top and bottom of the overlap region
    const contactX = normalX > 0 ? aCx + aHw : aCx - aHw
    const worldBx = contactX - normalX * penetration
    return {
      normalX,
      normalY,
      points: [
        {
          worldAx: contactX,
          worldAy: contactTop,
          worldBx,
          worldBy: contactTop,
          rAx: contactX - aCx,
          rAy: contactTop - aCy,
          rBx: worldBx - bCx,
          rBy: contactTop - bCy,
          penetration,
          normalImpulse: 0,
          tangentImpulse: 0,
          featureId: makeFeatureId(0, normalX > 0 ? 1 : 0, 0),
        },
        {
          worldAx: contactX,
          worldAy: contactBottom,
          worldBx,
          worldBy: contactBottom,
          rAx: contactX - aCx,
          rAy: contactBottom - aCy,
          rBx: worldBx - bCx,
          rBy: contactBottom - bCy,
          penetration,
          normalImpulse: 0,
          tangentImpulse: 0,
          featureId: makeFeatureId(0, normalX > 0 ? 1 : 0, 1),
        },
      ],
    }
  } else {
    // Y is the separating axis
    normalX = 0
    normalY = dy >= 0 ? 1 : -1
    penetration = overlapY

    // Contact edge: the shared horizontal edge
    const aLeft = aCx - aHw
    const aRight = aCx + aHw
    const bLeft = bCx - bHw
    const bRight = bCx + bHw

    const contactLeft = Math.max(aLeft, bLeft)
    const contactRight = Math.min(aRight, bRight)

    if (contactLeft >= contactRight) {
      const contactX = (contactLeft + contactRight) / 2
      const contactY = normalY > 0 ? aCy + aHh : aCy - aHh
      return {
        normalX,
        normalY,
        points: [
          {
            worldAx: contactX,
            worldAy: contactY,
            worldBx: contactX,
            worldBy: contactY - normalY * penetration,
            rAx: contactX - aCx,
            rAy: contactY - aCy,
            rBx: contactX - bCx,
            rBy: contactY - normalY * penetration - bCy,
            penetration,
            normalImpulse: 0,
            tangentImpulse: 0,
            featureId: makeFeatureId(1, normalY > 0 ? 1 : 0, 0),
          },
        ],
      }
    }

    const contactY = normalY > 0 ? aCy + aHh : aCy - aHh
    const worldBy = contactY - normalY * penetration
    return {
      normalX,
      normalY,
      points: [
        {
          worldAx: contactLeft,
          worldAy: contactY,
          worldBx: contactLeft,
          worldBy,
          rAx: contactLeft - aCx,
          rAy: contactY - aCy,
          rBx: contactLeft - bCx,
          rBy: worldBy - bCy,
          penetration,
          normalImpulse: 0,
          tangentImpulse: 0,
          featureId: makeFeatureId(1, normalY > 0 ? 1 : 0, 0),
        },
        {
          worldAx: contactRight,
          worldAy: contactY,
          worldBx: contactRight,
          worldBy,
          rAx: contactRight - aCx,
          rAy: contactY - aCy,
          rBx: contactRight - bCx,
          rBy: worldBy - bCy,
          penetration,
          normalImpulse: 0,
          tangentImpulse: 0,
          featureId: makeFeatureId(1, normalY > 0 ? 1 : 0, 1),
        },
      ],
    }
  }
}

// ── Circle-Circle manifold ──────────────────────────────────────────────────

export function generateCircleCircleManifold(
  aCx: number,
  aCy: number,
  aR: number,
  bCx: number,
  bCy: number,
  bR: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  const dx = bCx - aCx
  const dy = bCy - aCy
  const distSq = dx * dx + dy * dy
  const totalR = aR + bR

  if (distSq >= totalR * totalR) return null

  const dist = Math.sqrt(distSq)
  let normalX: number
  let normalY: number

  if (dist < 0.0001) {
    // Circles perfectly overlapping — pick arbitrary normal
    normalX = 0
    normalY = 1
  } else {
    normalX = dx / dist
    normalY = dy / dist
  }

  const penetration = totalR - dist
  const contactX = aCx + normalX * aR
  const contactY = aCy + normalY * aR

  return {
    normalX,
    normalY,
    points: [
      {
        worldAx: contactX,
        worldAy: contactY,
        worldBx: bCx - normalX * bR,
        worldBy: bCy - normalY * bR,
        rAx: contactX - aCx,
        rAy: contactY - aCy,
        rBx: bCx - normalX * bR - bCx,
        rBy: bCy - normalY * bR - bCy,
        penetration,
        normalImpulse: 0,
        tangentImpulse: 0,
        featureId: 0,
      },
    ],
  }
}

// ── Circle-AABB manifold ────────────────────────────────────────────────────

export function generateCircleBoxManifold(
  circleCx: number,
  circleCy: number,
  circleR: number,
  boxCx: number,
  boxCy: number,
  boxHw: number,
  boxHh: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  // Find nearest point on box to circle center
  const nearX = Math.max(boxCx - boxHw, Math.min(circleCx, boxCx + boxHw))
  const nearY = Math.max(boxCy - boxHh, Math.min(circleCy, boxCy + boxHh))

  const dx = circleCx - nearX
  const dy = circleCy - nearY
  const distSq = dx * dx + dy * dy

  if (distSq >= circleR * circleR) return null

  const dist = Math.sqrt(distSq)
  let normalX: number
  let normalY: number

  if (dist < 0.0001) {
    // Circle center is inside the box — find closest edge
    const left = circleCx - (boxCx - boxHw)
    const right = boxCx + boxHw - circleCx
    const top = circleCy - (boxCy - boxHh)
    const bottom = boxCy + boxHh - circleCy
    const minDist = Math.min(left, right, top, bottom)

    if (minDist === left) {
      normalX = -1
      normalY = 0
    } else if (minDist === right) {
      normalX = 1
      normalY = 0
    } else if (minDist === top) {
      normalX = 0
      normalY = -1
    } else {
      normalX = 0
      normalY = 1
    }
  } else {
    // Normal points from box surface toward circle center
    normalX = dx / dist
    normalY = dy / dist
  }

  const penetration = circleR - dist
  // Contact point on circle surface (closest to box)
  const contactOnCircleX = circleCx - normalX * circleR
  const contactOnCircleY = circleCy - normalY * circleR

  return {
    // Normal from circle (A) toward box (B) — flip since we found normal from box to circle
    normalX: -normalX,
    normalY: -normalY,
    points: [
      {
        worldAx: contactOnCircleX,
        worldAy: contactOnCircleY,
        worldBx: nearX,
        worldBy: nearY,
        rAx: contactOnCircleX - circleCx,
        rAy: contactOnCircleY - circleCy,
        rBx: nearX - boxCx,
        rBy: nearY - boxCy,
        penetration,
        normalImpulse: 0,
        tangentImpulse: 0,
        featureId: 0,
      },
    ],
  }
}

// ── Capsule helpers ────────────────────────────────────────────────────────

/**
 * Extract capsule segment endpoints and radius from center + half-extents.
 * Vertical if height >= width, horizontal otherwise.
 */
function capsuleSegment(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
): { ax: number; ay: number; bx: number; by: number; radius: number } {
  const width = hw * 2
  const height = hh * 2
  if (height >= width) {
    // Vertical capsule
    const radius = hw // half the smaller dim (width/2)
    return {
      ax: cx,
      ay: cy - hh + radius,
      bx: cx,
      by: cy + hh - radius,
      radius,
    }
  } else {
    // Horizontal capsule
    const radius = hh // half the smaller dim (height/2)
    return {
      ax: cx - hw + radius,
      ay: cy,
      bx: cx + hw - radius,
      by: cy,
      radius,
    }
  }
}

/**
 * Project point (px, py) onto segment (ax, ay)-(bx, by).
 * Returns the closest point on the segment.
 */
function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { x: number; y: number } {
  const abx = bx - ax
  const aby = by - ay
  const lengthSq = abx * abx + aby * aby
  if (lengthSq < 0.00001) {
    // Degenerate segment (a == b)
    return { x: ax, y: ay }
  }
  let t = ((px - ax) * abx + (py - ay) * aby) / lengthSq
  if (t < 0) t = 0
  if (t > 1) t = 1
  return { x: ax + t * abx, y: ay + t * aby }
}

/**
 * Find the closest point on an AABB to a given point.
 */
function closestPointOnAABB(
  px: number,
  py: number,
  boxCx: number,
  boxCy: number,
  boxHw: number,
  boxHh: number,
): { x: number; y: number } {
  return {
    x: Math.max(boxCx - boxHw, Math.min(px, boxCx + boxHw)),
    y: Math.max(boxCy - boxHh, Math.min(py, boxCy + boxHh)),
  }
}

/**
 * Find the closest points between two line segments.
 * Returns points on segment 1 and segment 2 respectively.
 */
function closestPointsBetweenSegments(
  a1x: number,
  a1y: number,
  a2x: number,
  a2y: number,
  b1x: number,
  b1y: number,
  b2x: number,
  b2y: number,
): { p1x: number; p1y: number; p2x: number; p2y: number } {
  const d1x = a2x - a1x
  const d1y = a2y - a1y
  const d2x = b2x - b1x
  const d2y = b2y - b1y
  const rx = a1x - b1x
  const ry = a1y - b1y

  const a = d1x * d1x + d1y * d1y // |d1|^2
  const e = d2x * d2x + d2y * d2y // |d2|^2
  const f = d2x * rx + d2y * ry

  let s: number
  let t: number

  if (a < 0.00001 && e < 0.00001) {
    // Both segments degenerate to points
    return { p1x: a1x, p1y: a1y, p2x: b1x, p2y: b1y }
  }

  if (a < 0.00001) {
    // First segment degenerates to a point
    s = 0
    t = Math.max(0, Math.min(f / e, 1))
  } else {
    const c = d1x * rx + d1y * ry
    if (e < 0.00001) {
      // Second segment degenerates to a point
      t = 0
      s = Math.max(0, Math.min(-c / a, 1))
    } else {
      const b = d1x * d2x + d1y * d2y
      const denom = a * e - b * b
      if (denom > 0.00001) {
        s = Math.max(0, Math.min((b * f - c * e) / denom, 1))
      } else {
        s = 0
      }
      t = (b * s + f) / e
      if (t < 0) {
        t = 0
        s = Math.max(0, Math.min(-c / a, 1))
      } else if (t > 1) {
        t = 1
        s = Math.max(0, Math.min((b - c) / a, 1))
      }
    }
  }

  return {
    p1x: a1x + s * d1x,
    p1y: a1y + s * d1y,
    p2x: b1x + t * d2x,
    p2y: b1y + t * d2y,
  }
}

// ── Capsule-AABB manifold ──────────────────────────────────────────────────

/**
 * Generate a contact manifold between a capsule and an AABB.
 *
 * Strategy: find the point on the capsule segment closest to the box,
 * then treat it as a circle-box test with the capsule radius.
 * Normal points from capsule (A) toward box (B).
 */
export function generateCapsuleBoxManifold(
  capCx: number,
  capCy: number,
  capHw: number,
  capHh: number,
  boxCx: number,
  boxCy: number,
  boxHw: number,
  boxHh: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  const seg = capsuleSegment(capCx, capCy, capHw, capHh)
  const { ax, ay, bx, by, radius } = seg

  // For each endpoint of the capsule segment, find the closest point on the box,
  // then pick the segment point that is closest to the box overall.
  // More accurate: iterate — find closest on segment to box center, then closest
  // on box to that, then closest on segment to that box point, converging quickly.
  // Two iterations suffice for AABBs.
  let segPt = closestPointOnSegment(boxCx, boxCy, ax, ay, bx, by)
  let boxPt = closestPointOnAABB(segPt.x, segPt.y, boxCx, boxCy, boxHw, boxHh)
  segPt = closestPointOnSegment(boxPt.x, boxPt.y, ax, ay, bx, by)
  boxPt = closestPointOnAABB(segPt.x, segPt.y, boxCx, boxCy, boxHw, boxHh)

  const dx = boxPt.x - segPt.x
  const dy = boxPt.y - segPt.y
  const distSq = dx * dx + dy * dy

  if (distSq >= radius * radius) return null

  const dist = Math.sqrt(distSq)
  let normalX: number
  let normalY: number

  if (dist < 0.0001) {
    // Segment point is inside the box — find closest edge to push out
    const left = segPt.x - (boxCx - boxHw)
    const right = boxCx + boxHw - segPt.x
    const top = segPt.y - (boxCy - boxHh)
    const bottom = boxCy + boxHh - segPt.y
    const minDist = Math.min(left, right, top, bottom)

    if (minDist === left) {
      normalX = -1
      normalY = 0
    } else if (minDist === right) {
      normalX = 1
      normalY = 0
    } else if (minDist === top) {
      normalX = 0
      normalY = -1
    } else {
      normalX = 0
      normalY = 1
    }
  } else {
    // Normal from segment point toward box surface point
    normalX = dx / dist
    normalY = dy / dist
  }

  const penetration = radius - dist

  // Contact on capsule surface (A side)
  const worldAx = segPt.x + normalX * radius
  const worldAy = segPt.y + normalY * radius

  return {
    normalX,
    normalY,
    points: [
      {
        worldAx,
        worldAy,
        worldBx: boxPt.x,
        worldBy: boxPt.y,
        rAx: worldAx - capCx,
        rAy: worldAy - capCy,
        rBx: boxPt.x - boxCx,
        rBy: boxPt.y - boxCy,
        penetration,
        normalImpulse: 0,
        tangentImpulse: 0,
        featureId: 200,
      },
    ],
  }
}

// ── Capsule-Circle manifold ────────────────────────────────────────────────

/**
 * Generate a contact manifold between a capsule and a circle.
 *
 * Strategy: find the closest point on the capsule segment to the circle center,
 * then do a circle-circle test between that point (with capsule radius) and the
 * circle. Normal points from capsule (A) toward circle (B).
 */
export function generateCapsuleCircleManifold(
  capCx: number,
  capCy: number,
  capHw: number,
  capHh: number,
  circleCx: number,
  circleCy: number,
  circleR: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  const seg = capsuleSegment(capCx, capCy, capHw, capHh)
  const segPt = closestPointOnSegment(circleCx, circleCy, seg.ax, seg.ay, seg.bx, seg.by)

  const dx = circleCx - segPt.x
  const dy = circleCy - segPt.y
  const distSq = dx * dx + dy * dy
  const totalR = seg.radius + circleR

  if (distSq >= totalR * totalR) return null

  const dist = Math.sqrt(distSq)
  let normalX: number
  let normalY: number

  if (dist < 0.0001) {
    normalX = 0
    normalY = 1
  } else {
    normalX = dx / dist
    normalY = dy / dist
  }

  const penetration = totalR - dist
  const worldAx = segPt.x + normalX * seg.radius
  const worldAy = segPt.y + normalY * seg.radius
  const worldBx = circleCx - normalX * circleR
  const worldBy = circleCy - normalY * circleR

  return {
    normalX,
    normalY,
    points: [
      {
        worldAx,
        worldAy,
        worldBx,
        worldBy,
        rAx: worldAx - capCx,
        rAy: worldAy - capCy,
        rBx: worldBx - circleCx,
        rBy: worldBy - circleCy,
        penetration,
        normalImpulse: 0,
        tangentImpulse: 0,
        featureId: 201,
      },
    ],
  }
}

// ── Capsule-Capsule manifold ───────────────────────────────────────────────

/**
 * Generate a contact manifold between two capsules.
 *
 * Strategy: find the closest points between the two capsule segments,
 * then do a circle-circle test with the two capsule radii.
 * Normal points from capsule A toward capsule B.
 */
export function generateCapsuleCapsuleManifold(
  aCx: number,
  aCy: number,
  aHw: number,
  aHh: number,
  bCx: number,
  bCy: number,
  bHw: number,
  bHh: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  const segA = capsuleSegment(aCx, aCy, aHw, aHh)
  const segB = capsuleSegment(bCx, bCy, bHw, bHh)

  const closest = closestPointsBetweenSegments(segA.ax, segA.ay, segA.bx, segA.by, segB.ax, segB.ay, segB.bx, segB.by)

  const dx = closest.p2x - closest.p1x
  const dy = closest.p2y - closest.p1y
  const distSq = dx * dx + dy * dy
  const totalR = segA.radius + segB.radius

  if (distSq >= totalR * totalR) return null

  const dist = Math.sqrt(distSq)
  let normalX: number
  let normalY: number

  if (dist < 0.0001) {
    normalX = 0
    normalY = 1
  } else {
    normalX = dx / dist
    normalY = dy / dist
  }

  const penetration = totalR - dist
  const worldAx = closest.p1x + normalX * segA.radius
  const worldAy = closest.p1y + normalY * segA.radius
  const worldBx = closest.p2x - normalX * segB.radius
  const worldBy = closest.p2y - normalY * segB.radius

  return {
    normalX,
    normalY,
    points: [
      {
        worldAx,
        worldAy,
        worldBx,
        worldBy,
        rAx: worldAx - aCx,
        rAy: worldAy - aCy,
        rBx: worldBx - bCx,
        rBy: worldBy - bCy,
        penetration,
        normalImpulse: 0,
        tangentImpulse: 0,
        featureId: 202,
      },
    ],
  }
}

// ── Manifold warm-start matching ────────────────────────────────────────────

/** Distance squared threshold for positional contact matching fallback. */
const POSITION_MATCH_THRESHOLD_SQ = 4.0 // 2 px

/**
 * Match contact points from a previous manifold to a new one.
 *
 * Uses a two-tier matching strategy:
 * 1. **Feature ID match** — exact geometric feature identity (most robust).
 * 2. **Positional fallback** — if no feature ID match, find the closest
 *    previous contact point within a distance threshold. This handles cases
 *    where feature IDs change due to rounding or edge-case geometry while
 *    the contact point hasn't moved significantly.
 *
 * Copies cached impulses scaled by `warmFactor` for warm starting.
 */
export function warmStartManifold(
  manifold: { points: ContactPoint[] },
  cached: { points: ContactPoint[] },
  warmFactor: number,
): void {
  // Track which cached points have already been consumed.
  const used = new Uint8Array(cached.points.length)

  for (const pt of manifold.points) {
    let matched = false

    // Tier 1: Feature ID match (preferred).
    for (let i = 0; i < cached.points.length; i++) {
      if (used[i]) continue
      if (pt.featureId === cached.points[i].featureId) {
        pt.normalImpulse = cached.points[i].normalImpulse * warmFactor
        pt.tangentImpulse = cached.points[i].tangentImpulse * warmFactor
        used[i] = 1
        matched = true
        break
      }
    }
    if (matched) continue

    // Tier 2: Positional proximity fallback.
    let bestIdx = -1
    let bestDistSq = POSITION_MATCH_THRESHOLD_SQ
    for (let i = 0; i < cached.points.length; i++) {
      if (used[i]) continue
      const dxA = pt.worldAx - cached.points[i].worldAx
      const dyA = pt.worldAy - cached.points[i].worldAy
      const distSq = dxA * dxA + dyA * dyA
      if (distSq < bestDistSq) {
        bestDistSq = distSq
        bestIdx = i
      }
    }
    if (bestIdx >= 0) {
      pt.normalImpulse = cached.points[bestIdx].normalImpulse * warmFactor
      pt.tangentImpulse = cached.points[bestIdx].tangentImpulse * warmFactor
      used[bestIdx] = 1
    }
  }
}
