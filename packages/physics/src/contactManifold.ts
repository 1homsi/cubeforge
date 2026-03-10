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

// ── Manifold warm-start matching ────────────────────────────────────────────

/**
 * Match contact points from a previous manifold to a new one by feature ID.
 * Copies cached impulses for warm starting.
 */
export function warmStartManifold(
  manifold: { points: ContactPoint[] },
  cached: { points: ContactPoint[] },
  warmFactor: number,
): void {
  for (const pt of manifold.points) {
    for (const prev of cached.points) {
      if (pt.featureId === prev.featureId) {
        pt.normalImpulse = prev.normalImpulse * warmFactor
        pt.tangentImpulse = prev.tangentImpulse * warmFactor
        break
      }
    }
  }
}
