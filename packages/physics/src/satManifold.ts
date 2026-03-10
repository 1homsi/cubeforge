/**
 * SAT-based contact manifold generation for convex polygons.
 *
 * Supports:
 * - Polygon vs polygon (SAT + reference/incident edge clipping)
 * - Polygon vs circle (closest edge/vertex to circle center)
 * - Polygon vs AABB (AABB treated as 4-vertex polygon)
 * - Triangle specializations
 *
 * Reference: Box2D b2CollidePolygons, Rapier's polygon-polygon contact generator.
 */

import type { ContactPoint } from './contactManifold'

// ── Vec2 helpers ─────────────────────────────────────────────────────────────

function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by
}

// cross2 reserved for future rotation support
// function cross2(ax: number, ay: number, bx: number, by: number): number {
//   return ax * by - ay * bx
// }

// ── Types ────────────────────────────────────────────────────────────────────

interface Polygon {
  /** Vertices in world space (CCW winding) */
  vertices: { x: number; y: number }[]
  /** Outward normals (one per edge) */
  normals: { x: number; y: number }[]
}

// ── Build polygon from vertices ──────────────────────────────────────────────

function buildPolygon(
  vertices: { x: number; y: number }[],
  cx: number,
  cy: number,
  offsetX: number,
  offsetY: number,
): Polygon {
  const worldVerts = vertices.map((v) => ({
    x: v.x + cx + offsetX,
    y: v.y + cy + offsetY,
  }))

  const normals: { x: number; y: number }[] = []
  const n = worldVerts.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const ex = worldVerts[j].x - worldVerts[i].x
    const ey = worldVerts[j].y - worldVerts[i].y
    // Outward normal (CCW winding → rotate edge 90° CW)
    const len = Math.sqrt(ex * ex + ey * ey)
    if (len < 1e-8) {
      normals.push({ x: 0, y: 0 })
    } else {
      normals.push({ x: ey / len, y: -ex / len })
    }
  }

  return { vertices: worldVerts, normals }
}

/** Build a polygon from an AABB (for polygon-AABB reuse) */
export function aabbToPolygon(cx: number, cy: number, hw: number, hh: number): Polygon {
  const vertices = [
    { x: cx - hw, y: cy - hh }, // top-left
    { x: cx + hw, y: cy - hh }, // top-right
    { x: cx + hw, y: cy + hh }, // bottom-right
    { x: cx - hw, y: cy + hh }, // bottom-left
  ]
  // CCW for our coordinate system (Y-down): TL → BL → BR → TR
  // Actually for Y-down, CCW is: TL → TR → BR → BL
  // The normals point outward. Let's just use the standard box and compute normals.
  const normals = [
    { x: 0, y: -1 }, // top edge
    { x: 1, y: 0 }, // right edge
    { x: 0, y: 1 }, // bottom edge
    { x: -1, y: 0 }, // left edge
  ]
  return { vertices, normals }
}

// ── SAT: find axis of minimum penetration ────────────────────────────────────

interface SATResult {
  /** Minimum penetration depth (positive = overlapping) */
  depth: number
  /** Index of the edge on the reference polygon that produced minimum penetration */
  edgeIndex: number
}

/**
 * For each edge of polygon A, compute how much the deepest vertex of B
 * penetrates past that face. Returns the face with minimum penetration.
 * Returns null if a separating axis is found (no collision).
 */
function findMinPenetration(a: Polygon, b: Polygon): SATResult | null {
  let maxSep = -Infinity
  let bestEdge = 0

  for (let i = 0; i < a.normals.length; i++) {
    const nx = a.normals[i].x
    const ny = a.normals[i].y

    // Face offset: position of this edge along its outward normal
    const faceOffset = dot(a.vertices[i].x, a.vertices[i].y, nx, ny)

    // Find the B vertex closest to (deepest into) A along this normal
    let minSep = Infinity
    for (const v of b.vertices) {
      const sep = dot(v.x, v.y, nx, ny) - faceOffset
      if (sep < minSep) minSep = sep
    }

    if (minSep > 0) return null // Separating axis — B is fully outside this face

    if (minSep > maxSep) {
      maxSep = minSep
      bestEdge = i
    }
  }

  return { depth: -maxSep, edgeIndex: bestEdge }
}

// ── Edge clipping for contact points ─────────────────────────────────────────

interface ClipVertex {
  x: number
  y: number
  featureId: number
}

/**
 * Clip segment (v0, v1) against a line defined by normal and offset.
 * Keeps vertices on the positive side (or on the line).
 */
function clipSegmentToLine(v0: ClipVertex, v1: ClipVertex, nx: number, ny: number, offset: number): ClipVertex[] {
  const result: ClipVertex[] = []
  const d0 = dot(v0.x, v0.y, nx, ny) - offset
  const d1 = dot(v1.x, v1.y, nx, ny) - offset

  if (d0 >= 0) result.push(v0)
  if (d1 >= 0) result.push(v1)

  // If they're on different sides, compute intersection
  if (d0 * d1 < 0) {
    const t = d0 / (d0 - d1)
    result.push({
      x: v0.x + t * (v1.x - v0.x),
      y: v0.y + t * (v1.y - v0.y),
      featureId: d0 < 0 ? v0.featureId : v1.featureId,
    })
  }

  return result
}

/**
 * Find the incident edge on polygon B that faces most against the reference normal.
 * The incident edge is the one whose normal has the smallest dot product with the reference normal.
 */
function findIncidentEdge(poly: Polygon, refNx: number, refNy: number): [ClipVertex, ClipVertex] {
  let minDot = Infinity
  let minIdx = 0

  for (let i = 0; i < poly.normals.length; i++) {
    const d = dot(poly.normals[i].x, poly.normals[i].y, refNx, refNy)
    if (d < minDot) {
      minDot = d
      minIdx = i
    }
  }

  const i1 = minIdx
  const i2 = (minIdx + 1) % poly.vertices.length
  return [
    { x: poly.vertices[i1].x, y: poly.vertices[i1].y, featureId: i1 },
    { x: poly.vertices[i2].x, y: poly.vertices[i2].y, featureId: i2 },
  ]
}

// ── Polygon vs Polygon manifold ──────────────────────────────────────────────

/**
 * Generate a contact manifold between two convex polygons using SAT.
 *
 * 1. Find axis of minimum penetration on each polygon
 * 2. Pick the reference face (least penetration wins)
 * 3. Clip the incident edge against the reference face's side planes
 * 4. Keep contact points that are behind the reference face
 *
 * Returns null if no overlap.
 */
export function generatePolygonPolygonManifold(
  aVerts: { x: number; y: number }[],
  aCx: number,
  aCy: number,
  aOffX: number,
  aOffY: number,
  bVerts: { x: number; y: number }[],
  bCx: number,
  bCy: number,
  bOffX: number,
  bOffY: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  const polyA = buildPolygon(aVerts, aCx, aCy, aOffX, aOffY)
  const polyB = buildPolygon(bVerts, bCx, bCy, bOffX, bOffY)
  return generatePolygonPolygonManifoldFromPolys(polyA, polyB)
}

export function generatePolygonPolygonManifoldFromPolys(
  polyA: Polygon,
  polyB: Polygon,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  const satA = findMinPenetration(polyA, polyB)
  if (!satA) return null
  const satB = findMinPenetration(polyB, polyA)
  if (!satB) return null

  // Choose reference polygon (the one with less penetration — more stable)
  let refPoly: Polygon
  let incPoly: Polygon
  let refEdge: number
  let flip: boolean

  if (satA.depth <= satB.depth) {
    refPoly = polyA
    incPoly = polyB
    refEdge = satA.edgeIndex
    flip = false
  } else {
    refPoly = polyB
    incPoly = polyA
    refEdge = satB.edgeIndex
    flip = true
  }

  // Reference face normal and vertices
  const refNx = refPoly.normals[refEdge].x
  const refNy = refPoly.normals[refEdge].y
  const refV1 = refPoly.vertices[refEdge]
  const refV2 = refPoly.vertices[(refEdge + 1) % refPoly.vertices.length]

  // Reference face tangent (along the edge)
  const refTx = refV2.x - refV1.x
  const refTy = refV2.y - refV1.y
  const refLen = Math.sqrt(refTx * refTx + refTy * refTy)
  if (refLen < 1e-8) return null
  const tangentX = refTx / refLen
  const tangentY = refTy / refLen

  // Find incident edge on the other polygon
  let [incV1, incV2] = findIncidentEdge(incPoly, refNx, refNy)

  // Clip incident edge against reference face's side planes
  // The slab is: sideOffset1 <= dot(v, tangent) <= sideOffset2
  // (or the reverse if sideOffset1 > sideOffset2)
  const sideOffset1 = dot(tangentX, tangentY, refV1.x, refV1.y)
  const sideOffset2 = dot(tangentX, tangentY, refV2.x, refV2.y)

  // Clip 1: keep vertices where dot(v, tangent) >= min(sideOffset1, sideOffset2)
  let clipPoints = clipSegmentToLine(incV1, incV2, tangentX, tangentY, Math.min(sideOffset1, sideOffset2))
  if (clipPoints.length < 2) return null

  // Clip 2: keep vertices where dot(v, -tangent) >= -max(sideOffset1, sideOffset2)
  clipPoints = clipSegmentToLine(
    clipPoints[0],
    clipPoints[1],
    -tangentX,
    -tangentY,
    -Math.max(sideOffset1, sideOffset2),
  )
  if (clipPoints.length < 2) return null

  // Reference face offset (how far along the normal the face is)
  const refFaceOffset = dot(refNx, refNy, refV1.x, refV1.y)

  // Keep only points that are behind or on the reference face
  const normalX = flip ? -refNx : refNx
  const normalY = flip ? -refNy : refNy

  // Compute center of each polygon for rA/rB offsets
  let aCx = 0,
    aCy = 0
  for (const v of polyA.vertices) {
    aCx += v.x
    aCy += v.y
  }
  aCx /= polyA.vertices.length
  aCy /= polyA.vertices.length

  let bCx = 0,
    bCy = 0
  for (const v of polyB.vertices) {
    bCx += v.x
    bCy += v.y
  }
  bCx /= polyB.vertices.length
  bCy /= polyB.vertices.length

  const contacts: ContactPoint[] = []
  for (const cp of clipPoints) {
    const separation = dot(refNx, refNy, cp.x, cp.y) - refFaceOffset
    if (separation > 0) continue // Behind the reference face = negative separation

    const penetration = -separation

    // Contact point is on the incident polygon's surface
    // worldA = point on A's surface, worldB = point on B's surface
    let worldAx: number, worldAy: number, worldBx: number, worldBy: number
    if (!flip) {
      // A is reference, B is incident
      worldBx = cp.x
      worldBy = cp.y
      worldAx = cp.x + refNx * penetration
      worldAy = cp.y + refNy * penetration
    } else {
      // B is reference, A is incident
      worldAx = cp.x
      worldAy = cp.y
      worldBx = cp.x - refNx * penetration
      worldBy = cp.y - refNy * penetration
    }

    contacts.push({
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
      featureId: 300 + cp.featureId,
    })
  }

  if (contacts.length === 0) return null

  return { normalX, normalY, points: contacts }
}

// ── Polygon vs Circle manifold ───────────────────────────────────────────────

/**
 * Generate a contact manifold between a convex polygon and a circle.
 *
 * Finds the closest edge or vertex on the polygon to the circle center,
 * then computes penetration and contact normal.
 */
export function generatePolygonCircleManifold(
  polyVerts: { x: number; y: number }[],
  polyCx: number,
  polyCy: number,
  polyOffX: number,
  polyOffY: number,
  circleCx: number,
  circleCy: number,
  circleR: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  const poly = buildPolygon(polyVerts, polyCx, polyCy, polyOffX, polyOffY)
  return generatePolygonCircleManifoldFromPoly(poly, polyCx + polyOffX, polyCy + polyOffY, circleCx, circleCy, circleR)
}

function generatePolygonCircleManifoldFromPoly(
  poly: Polygon,
  _polyCenterX: number,
  _polyCenterY: number,
  circleCx: number,
  circleCy: number,
  circleR: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  const verts = poly.vertices
  const n = verts.length

  // Find the closest edge to the circle center using SAT-style separation check
  let closestDist = -Infinity
  let closestEdge = 0

  for (let i = 0; i < n; i++) {
    const nx = poly.normals[i].x
    const ny = poly.normals[i].y
    const sep = dot(circleCx - verts[i].x, circleCy - verts[i].y, nx, ny)
    if (sep > circleR) return null // Circle is outside this edge by more than its radius
    if (sep > closestDist) {
      closestDist = sep
      closestEdge = i
    }
  }

  // Check if circle center is in the Voronoi region of a vertex or edge
  const v1 = verts[closestEdge]
  const v2 = verts[(closestEdge + 1) % n]
  const ex = v2.x - v1.x
  const ey = v2.y - v1.y

  // Project circle center onto edge
  const d1 = dot(circleCx - v1.x, circleCy - v1.y, ex, ey)
  const d2 = dot(circleCx - v2.x, circleCy - v2.y, -ex, -ey)

  let normalX: number, normalY: number, contactX: number, contactY: number, penetration: number

  if (d1 <= 0) {
    // Closest to vertex v1
    const dx = circleCx - v1.x
    const dy = circleCy - v1.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > circleR) return null
    if (dist < 1e-8) {
      normalX = poly.normals[closestEdge].x
      normalY = poly.normals[closestEdge].y
    } else {
      normalX = dx / dist
      normalY = dy / dist
    }
    penetration = circleR - dist
    contactX = v1.x
    contactY = v1.y
  } else if (d2 <= 0) {
    // Closest to vertex v2
    const dx = circleCx - v2.x
    const dy = circleCy - v2.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > circleR) return null
    if (dist < 1e-8) {
      normalX = poly.normals[closestEdge].x
      normalY = poly.normals[closestEdge].y
    } else {
      normalX = dx / dist
      normalY = dy / dist
    }
    penetration = circleR - dist
    contactX = v2.x
    contactY = v2.y
  } else {
    // Closest to edge face
    normalX = poly.normals[closestEdge].x
    normalY = poly.normals[closestEdge].y
    const sep = dot(circleCx - v1.x, circleCy - v1.y, normalX, normalY)
    if (sep > circleR) return null
    penetration = circleR - sep
    contactX = circleCx - normalX * sep
    contactY = circleCy - normalY * sep
  }

  // Normal points from polygon (A) toward circle (B)
  // Convention: normal from A→B, so polygon center to circle
  const circleContactX = circleCx - normalX * circleR
  const circleContactY = circleCy - normalY * circleR

  // Compute polygon centroid for rA
  let pCx = 0,
    pCy = 0
  for (const v of verts) {
    pCx += v.x
    pCy += v.y
  }
  pCx /= n
  pCy /= n

  return {
    normalX,
    normalY,
    points: [
      {
        worldAx: contactX,
        worldAy: contactY,
        worldBx: circleContactX,
        worldBy: circleContactY,
        rAx: contactX - pCx,
        rAy: contactY - pCy,
        rBx: circleContactX - circleCx,
        rBy: circleContactY - circleCy,
        penetration,
        normalImpulse: 0,
        tangentImpulse: 0,
        featureId: 310 + closestEdge,
      },
    ],
  }
}

// ── Polygon vs AABB manifold ─────────────────────────────────────────────────

/**
 * Generate a contact manifold between a convex polygon and an AABB.
 * Treats the AABB as a 4-vertex polygon and uses SAT.
 */
export function generatePolygonBoxManifold(
  polyVerts: { x: number; y: number }[],
  polyCx: number,
  polyCy: number,
  polyOffX: number,
  polyOffY: number,
  boxCx: number,
  boxCy: number,
  boxHw: number,
  boxHh: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  const polyA = buildPolygon(polyVerts, polyCx, polyCy, polyOffX, polyOffY)
  const polyB = aabbToPolygon(boxCx, boxCy, boxHw, boxHh)
  return generatePolygonPolygonManifoldFromPolys(polyA, polyB)
}

// ── Segment vs Circle manifold ───────────────────────────────────────────────

/**
 * Closest point on a line segment to a point.
 */
export function closestPointOnSegment(
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
  if (lengthSq < 1e-10) return { x: ax, y: ay }

  let t = dot(px - ax, py - ay, abx, aby) / lengthSq
  t = Math.max(0, Math.min(1, t))
  return { x: ax + t * abx, y: ay + t * aby }
}

/**
 * Generate a contact manifold between a line segment and a circle.
 * The segment is treated as a one-sided edge (normal points in the specified direction).
 */
export function generateSegmentCircleManifold(
  segAx: number,
  segAy: number,
  segBx: number,
  segBy: number,
  circleCx: number,
  circleCy: number,
  circleR: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  const closest = closestPointOnSegment(circleCx, circleCy, segAx, segAy, segBx, segBy)
  const dx = circleCx - closest.x
  const dy = circleCy - closest.y
  const distSq = dx * dx + dy * dy

  if (distSq >= circleR * circleR) return null

  const dist = Math.sqrt(distSq)
  let normalX: number, normalY: number
  if (dist < 1e-8) {
    // Circle center on segment — use segment perpendicular
    const ex = segBx - segAx
    const ey = segBy - segAy
    const len = Math.sqrt(ex * ex + ey * ey)
    if (len < 1e-8) {
      normalX = 0
      normalY = -1
    } else {
      normalX = ey / len
      normalY = -ex / len
    }
  } else {
    normalX = dx / dist
    normalY = dy / dist
  }

  const penetration = circleR - dist
  const contactOnCircleX = circleCx - normalX * circleR
  const contactOnCircleY = circleCy - normalY * circleR

  // Segment center for rA
  const segCx = (segAx + segBx) / 2
  const segCy = (segAy + segBy) / 2

  return {
    normalX: -normalX, // from segment toward circle → flip since segment is A
    normalY: -normalY,
    points: [
      {
        worldAx: closest.x,
        worldAy: closest.y,
        worldBx: contactOnCircleX,
        worldBy: contactOnCircleY,
        rAx: closest.x - segCx,
        rAy: closest.y - segCy,
        rBx: contactOnCircleX - circleCx,
        rBy: contactOnCircleY - circleCy,
        penetration,
        normalImpulse: 0,
        tangentImpulse: 0,
        featureId: 400,
      },
    ],
  }
}

// ── Segment vs AABB manifold ─────────────────────────────────────────────────

/**
 * Generate a contact manifold between a line segment (edge) and an AABB.
 * Treats the segment as a very thin polygon (two vertices on each side).
 */
export function generateSegmentBoxManifold(
  segAx: number,
  segAy: number,
  segBx: number,
  segBy: number,
  boxCx: number,
  boxCy: number,
  boxHw: number,
  boxHh: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  // Check if segment intersects or is close to the AABB
  // Use a thin-polygon approach: offset segment by a tiny epsilon to form a quad
  const ex = segBx - segAx
  const ey = segBy - segAy
  const len = Math.sqrt(ex * ex + ey * ey)
  if (len < 1e-8) return null

  // Normal to segment (perpendicular)
  const nx = ey / len
  const ny = -ex / len

  // Find closest point on AABB to segment
  // For each segment endpoint, clamp to AABB. Also check AABB corners against segment.
  const segCenter = closestPointOnSegment(boxCx, boxCy, segAx, segAy, segBx, segBy)

  // Nearest point on box to segment center point
  const nearX = Math.max(boxCx - boxHw, Math.min(segCenter.x, boxCx + boxHw))
  const nearY = Math.max(boxCy - boxHh, Math.min(segCenter.y, boxCy + boxHh))

  // Now find the closest point on segment to this nearest box point
  const closestOnSeg = closestPointOnSegment(nearX, nearY, segAx, segAy, segBx, segBy)

  // Nearest point on box to that segment point
  const nearX2 = Math.max(boxCx - boxHw, Math.min(closestOnSeg.x, boxCx + boxHw))
  const nearY2 = Math.max(boxCy - boxHh, Math.min(closestOnSeg.y, boxCy + boxHh))

  const dx = closestOnSeg.x - nearX2
  const dy = closestOnSeg.y - nearY2
  const distSq = dx * dx + dy * dy

  // Segment has zero thickness, so we need a small skin for detection
  const EDGE_SKIN = 1.0
  if (distSq > EDGE_SKIN * EDGE_SKIN) return null

  const dist = Math.sqrt(distSq)
  let contactNx: number, contactNy: number
  if (dist < 1e-8) {
    contactNx = nx
    contactNy = ny
  } else {
    contactNx = dx / dist
    contactNy = dy / dist
  }

  const penetration = EDGE_SKIN - dist
  const segCenterX = (segAx + segBx) / 2
  const segCenterY = (segAy + segBy) / 2

  return {
    normalX: -contactNx,
    normalY: -contactNy,
    points: [
      {
        worldAx: closestOnSeg.x,
        worldAy: closestOnSeg.y,
        worldBx: nearX2,
        worldBy: nearY2,
        rAx: closestOnSeg.x - segCenterX,
        rAy: closestOnSeg.y - segCenterY,
        rBx: nearX2 - boxCx,
        rBy: nearY2 - boxCy,
        penetration,
        normalImpulse: 0,
        tangentImpulse: 0,
        featureId: 410,
      },
    ],
  }
}

// ── HalfSpace manifolds ──────────────────────────────────────────────────────

/**
 * Generate a contact manifold between a half-space (infinite plane) and a circle.
 * The half-space is defined by a point on the plane and its outward normal.
 */
export function generateHalfSpaceCircleManifold(
  planeX: number,
  planeY: number,
  planeNx: number,
  planeNy: number,
  circleCx: number,
  circleCy: number,
  circleR: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  // Distance from circle center to plane
  const dist = dot(circleCx - planeX, circleCy - planeY, planeNx, planeNy)
  if (dist > circleR) return null

  const penetration = circleR - dist
  const contactX = circleCx - planeNx * circleR
  const contactY = circleCy - planeNy * circleR
  const planeContactX = circleCx - planeNx * dist
  const planeContactY = circleCy - planeNy * dist

  return {
    normalX: planeNx, // from plane (A) toward circle (B) — plane normal IS the direction toward the body
    normalY: planeNy,
    points: [
      {
        worldAx: planeContactX,
        worldAy: planeContactY,
        worldBx: contactX,
        worldBy: contactY,
        rAx: 0, // half-space has no meaningful center
        rAy: 0,
        rBx: contactX - circleCx,
        rBy: contactY - circleCy,
        penetration,
        normalImpulse: 0,
        tangentImpulse: 0,
        featureId: 500,
      },
    ],
  }
}

/**
 * Generate a contact manifold between a half-space and an AABB.
 * Projects all 4 box corners onto the plane normal, keeps those behind the plane.
 */
export function generateHalfSpaceBoxManifold(
  planeX: number,
  planeY: number,
  planeNx: number,
  planeNy: number,
  boxCx: number,
  boxCy: number,
  boxHw: number,
  boxHh: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  const corners = [
    { x: boxCx - boxHw, y: boxCy - boxHh },
    { x: boxCx + boxHw, y: boxCy - boxHh },
    { x: boxCx + boxHw, y: boxCy + boxHh },
    { x: boxCx - boxHw, y: boxCy + boxHh },
  ]

  const contacts: ContactPoint[] = []
  for (let i = 0; i < corners.length; i++) {
    const c = corners[i]
    const dist = dot(c.x - planeX, c.y - planeY, planeNx, planeNy)
    if (dist >= 0) continue

    const penetration = -dist
    const planeContactX = c.x - planeNx * dist
    const planeContactY = c.y - planeNy * dist

    contacts.push({
      worldAx: planeContactX,
      worldAy: planeContactY,
      worldBx: c.x,
      worldBy: c.y,
      rAx: 0,
      rAy: 0,
      rBx: c.x - boxCx,
      rBy: c.y - boxCy,
      penetration,
      normalImpulse: 0,
      tangentImpulse: 0,
      featureId: 510 + i,
    })
  }

  if (contacts.length === 0) return null

  // Keep at most 2 deepest contact points for stability
  if (contacts.length > 2) {
    contacts.sort((a, b) => b.penetration - a.penetration)
    contacts.length = 2
  }

  return {
    normalX: planeNx,
    normalY: planeNy,
    points: contacts,
  }
}

// ── HeightField manifolds ────────────────────────────────────────────────────

/**
 * Generate contact manifolds between a heightfield and a circle.
 * The heightfield is a series of connected segments at regular X intervals.
 */
export function generateHeightFieldCircleManifold(
  hfX: number,
  hfY: number,
  heights: number[],
  scaleX: number,
  scaleY: number,
  circleCx: number,
  circleCy: number,
  circleR: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  if (heights.length < 2) return null

  // Find which cell the circle overlaps
  const localX = circleCx - hfX
  const cellWidth = scaleX
  const startCell = Math.max(0, Math.floor((localX - circleR) / cellWidth))
  const endCell = Math.min(heights.length - 2, Math.floor((localX + circleR) / cellWidth))

  let bestResult: { normalX: number; normalY: number; points: ContactPoint[] } | null = null
  let bestPen = 0

  for (let i = startCell; i <= endCell; i++) {
    const segAx = hfX + i * cellWidth
    const segAy = hfY + heights[i] * scaleY
    const segBx = hfX + (i + 1) * cellWidth
    const segBy = hfY + heights[i + 1] * scaleY

    const result = generateSegmentCircleManifold(segAx, segAy, segBx, segBy, circleCx, circleCy, circleR)
    if (result && result.points[0].penetration > bestPen) {
      bestResult = result
      bestPen = result.points[0].penetration
    }
  }

  return bestResult
}

/**
 * Generate contact manifolds between a heightfield and an AABB.
 */
export function generateHeightFieldBoxManifold(
  hfX: number,
  hfY: number,
  heights: number[],
  scaleX: number,
  scaleY: number,
  boxCx: number,
  boxCy: number,
  boxHw: number,
  boxHh: number,
): { normalX: number; normalY: number; points: ContactPoint[] } | null {
  if (heights.length < 2) return null

  const localX = boxCx - hfX
  const cellWidth = scaleX
  const startCell = Math.max(0, Math.floor((localX - boxHw) / cellWidth))
  const endCell = Math.min(heights.length - 2, Math.floor((localX + boxHw) / cellWidth))

  let bestResult: { normalX: number; normalY: number; points: ContactPoint[] } | null = null
  let bestPen = 0

  for (let i = startCell; i <= endCell; i++) {
    const segAx = hfX + i * cellWidth
    const segAy = hfY + heights[i] * scaleY
    const segBx = hfX + (i + 1) * cellWidth
    const segBy = hfY + heights[i + 1] * scaleY

    const result = generateSegmentBoxManifold(segAx, segAy, segBx, segBy, boxCx, boxCy, boxHw, boxHh)
    if (result && result.points[0].penetration > bestPen) {
      bestResult = result
      bestPen = result.points[0].penetration
    }
  }

  return bestResult
}

// ── Exports for polygon building (used by physics system) ────────────────────

export { buildPolygon, type Polygon }
