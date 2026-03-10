/**
 * GJK (Gilbert-Johnson-Keerthi) + EPA (Expanding Polytope Algorithm) for 2D
 * convex shape collision detection and contact generation.
 *
 * GJK determines whether two convex shapes overlap by iteratively building a
 * simplex in Minkowski difference space. If a collision is detected, EPA
 * expands the simplex into a polytope to find the minimum penetration vector
 * and approximate contact points.
 *
 * Reference: Erin Catto (Box2D), dyn4j.org GJK/EPA tutorials, Casey Muratori's
 * GJK video series.
 */

// ── Constants ────────────────────────────────────────────────────────────────

const GJK_MAX_ITERATIONS = 64
const EPA_MAX_ITERATIONS = 64
const EPA_TOLERANCE = 1e-6

// ── Vec2 helpers (inlined for performance) ───────────────────────────────────

function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by
}

/** 2D cross product (scalar): a × b = ax*by - ay*bx */
function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx
}

/** Triple product: (a × b) × c — used to get perpendicular toward origin. */
function tripleProduct(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  // (a × b) × c = b(a·c) - a(b·c)  in 2D with z=0
  const ac = ax * cx + ay * cy
  const bc = bx * cx + by * cy
  return { x: bx * ac - ax * bc, y: by * ac - ay * bc }
}

// ── ConvexShape interface ────────────────────────────────────────────────────

/**
 * Any convex shape that can provide a support point — the point on the shape
 * furthest in a given direction.
 */
export interface ConvexShape {
  support(dirX: number, dirY: number): { x: number; y: number }
}

// ── Concrete shape helpers ───────────────────────────────────────────────────

/**
 * Circle centered at (cx, cy) with the given radius.
 * Support: center + radius * normalize(dir).
 */
export function circleShape(cx: number, cy: number, radius: number): ConvexShape {
  return {
    support(dirX: number, dirY: number): { x: number; y: number } {
      const len = Math.sqrt(dirX * dirX + dirY * dirY)
      if (len < 1e-12) return { x: cx, y: cy }
      const inv = radius / len
      return { x: cx + dirX * inv, y: cy + dirY * inv }
    },
  }
}

/**
 * Oriented bounding box centered at (cx, cy) with half-extents (hw, hh) and a
 * rotation angle in radians.
 *
 * Support: rotate dir into local space, pick the corner whose signs match the
 * local direction, rotate back to world space.
 */
export function boxShape(cx: number, cy: number, hw: number, hh: number, rotation: number): ConvexShape {
  const cosR = Math.cos(rotation)
  const sinR = Math.sin(rotation)

  return {
    support(dirX: number, dirY: number): { x: number; y: number } {
      // Rotate direction into local space (inverse rotation)
      const localDx = dirX * cosR + dirY * sinR
      const localDy = -dirX * sinR + dirY * cosR

      // Pick the corner furthest in the local direction
      const sx = localDx >= 0 ? hw : -hw
      const sy = localDy >= 0 ? hh : -hh

      // Rotate back to world space and translate
      return {
        x: cx + sx * cosR - sy * sinR,
        y: cy + sx * sinR + sy * cosR,
      }
    },
  }
}

/**
 * Vertical capsule centered at (cx, cy) with half-width hw (radius) and
 * half-height hh (distance from center to each hemisphere center + hw).
 *
 * Modeled as two circles at the top and bottom of the capsule body:
 * - Top center:    (cx, cy - (hh - hw))
 * - Bottom center: (cx, cy + (hh - hw))
 *
 * Support: pick whichever hemisphere center is further along dir, then add
 * radius * normalize(dir).
 */
export function capsuleShape(cx: number, cy: number, hw: number, hh: number): ConvexShape {
  // Half-height of the line segment connecting hemisphere centers
  const halfSegment = Math.max(hh - hw, 0)
  const topY = cy - halfSegment
  const botY = cy + halfSegment
  const radius = hw

  return {
    support(dirX: number, dirY: number): { x: number; y: number } {
      // Pick the hemisphere center furthest in the given direction
      // Top center: (cx, topY), Bottom center: (cx, botY)
      const dotTop = dirX * cx + dirY * topY
      const dotBot = dirX * cx + dirY * botY
      const bestCy = dotTop >= dotBot ? topY : botY

      const len = Math.sqrt(dirX * dirX + dirY * dirY)
      if (len < 1e-12) return { x: cx, y: bestCy }
      const inv = radius / len
      return { x: cx + dirX * inv, y: bestCy + dirY * inv }
    },
  }
}

/**
 * Convex polygon with vertices given in local space, centered at (cx, cy)
 * with a rotation angle in radians.
 *
 * Vertices are pre-transformed to world space at construction time. Support
 * is a simple linear scan (fast for typical low-vertex-count game shapes).
 */
export function polygonShape(
  cx: number,
  cy: number,
  vertices: { x: number; y: number }[],
  rotation: number,
): ConvexShape {
  const cosR = Math.cos(rotation)
  const sinR = Math.sin(rotation)

  // Pre-compute world-space vertices
  const worldVerts: { x: number; y: number }[] = new Array(vertices.length)
  for (let i = 0; i < vertices.length; i++) {
    const lx = vertices[i].x
    const ly = vertices[i].y
    worldVerts[i] = {
      x: cx + lx * cosR - ly * sinR,
      y: cy + lx * sinR + ly * cosR,
    }
  }

  return {
    support(dirX: number, dirY: number): { x: number; y: number } {
      let bestDot = -Infinity
      let bestIdx = 0
      for (let i = 0; i < worldVerts.length; i++) {
        const d = dirX * worldVerts[i].x + dirY * worldVerts[i].y
        if (d > bestDot) {
          bestDot = d
          bestIdx = i
        }
      }
      return worldVerts[bestIdx]
    },
  }
}

// ── Minkowski difference support ─────────────────────────────────────────────

/** Support point in the Minkowski difference A - B. */
function minkSupport(shapeA: ConvexShape, shapeB: ConvexShape, dirX: number, dirY: number): { x: number; y: number } {
  const a = shapeA.support(dirX, dirY)
  const b = shapeB.support(-dirX, -dirY)
  return { x: a.x - b.x, y: a.y - b.y }
}

// ── GJK ──────────────────────────────────────────────────────────────────────

export interface GJKResult {
  /** True if the shapes overlap. */
  collision: boolean
  /** The simplex vertices in Minkowski difference space. */
  simplex: { x: number; y: number }[]
  /** Distance between shapes (0 when colliding). */
  closestDistance: number
}

/**
 * GJK collision test for two convex shapes.
 *
 * Returns whether the shapes overlap, the final simplex (for EPA), and the
 * closest distance when not overlapping.
 */
export function gjk(shapeA: ConvexShape, shapeB: ConvexShape): GJKResult {
  // Initial direction: arbitrary, use x-axis
  let dirX = 1
  let dirY = 0

  // First support point
  const a = minkSupport(shapeA, shapeB, dirX, dirY)
  const simplex: { x: number; y: number }[] = [a]

  // Direction toward origin from first point
  dirX = -a.x
  dirY = -a.y

  // Handle degenerate case: first support is at origin
  if (dirX === 0 && dirY === 0) {
    return { collision: true, simplex, closestDistance: 0 }
  }

  for (let iter = 0; iter < GJK_MAX_ITERATIONS; iter++) {
    const newPoint = minkSupport(shapeA, shapeB, dirX, dirY)

    // If the new point didn't pass the origin, shapes don't overlap.
    // dot(newPoint, dir) < 0 means the support point is behind the search
    // direction, so the origin cannot be enclosed.
    if (dot(newPoint.x, newPoint.y, dirX, dirY) < 0) {
      return {
        collision: false,
        simplex,
        closestDistance: computeClosestDistance(simplex),
      }
    }

    simplex.push(newPoint)

    if (simplex.length === 2) {
      // ── Line case ────────────────────────────────────────────────
      const result = handleLine(simplex)
      if (result === null) {
        // Origin is on the line segment — collision
        return { collision: true, simplex, closestDistance: 0 }
      }
      dirX = result.x
      dirY = result.y
    } else {
      // ── Triangle case ────────────────────────────────────────────
      const result = handleTriangle(simplex)
      if (result === null) {
        // Origin is inside the triangle — collision
        return { collision: true, simplex, closestDistance: 0 }
      }
      dirX = result.x
      dirY = result.y
    }
  }

  // Max iterations reached — conservatively report no collision
  return {
    collision: false,
    simplex,
    closestDistance: computeClosestDistance(simplex),
  }
}

/**
 * Handle the line simplex case (2 points: B=simplex[0], A=simplex[1]).
 * A is the most recently added point.
 *
 * Returns the new search direction, or null if the origin lies on the line.
 */
function handleLine(simplex: { x: number; y: number }[]): { x: number; y: number } | null {
  const b = simplex[0]
  const a = simplex[1]

  const abX = b.x - a.x
  const abY = b.y - a.y
  const aoX = -a.x
  const aoY = -a.y

  // Is origin in the direction of AB from A?
  if (dot(abX, abY, aoX, aoY) > 0) {
    // Origin is in the Voronoi region of the line segment AB.
    // New direction: perpendicular to AB toward origin.
    const perp = tripleProduct(abX, abY, aoX, aoY, abX, abY)
    if (perp.x === 0 && perp.y === 0) {
      // Origin is exactly on the line — collision
      return null
    }
    return perp
  }

  // Origin is closest to A — simplex becomes just A
  simplex.length = 0
  simplex.push(a)
  return { x: aoX, y: aoY }
}

/**
 * Handle the triangle simplex case (3 points: C=simplex[0], B=simplex[1],
 * A=simplex[2]). A is the most recently added point.
 *
 * Returns the new search direction, or null if the origin is inside.
 */
function handleTriangle(simplex: { x: number; y: number }[]): { x: number; y: number } | null {
  const c = simplex[0]
  const b = simplex[1]
  const a = simplex[2]

  const abX = b.x - a.x
  const abY = b.y - a.y
  const acX = c.x - a.x
  const acY = c.y - a.y
  const aoX = -a.x
  const aoY = -a.y

  // Normal of AB edge pointing away from C
  const abPerp = tripleProduct(acX, acY, abX, abY, abX, abY)
  // Normal of AC edge pointing away from B
  const acPerp = tripleProduct(abX, abY, acX, acY, acX, acY)

  // Check if origin is outside edge AB
  if (dot(abPerp.x, abPerp.y, aoX, aoY) > 0) {
    // Remove C, simplex becomes line AB
    simplex.length = 0
    simplex.push(b, a)
    return abPerp
  }

  // Check if origin is outside edge AC
  if (dot(acPerp.x, acPerp.y, aoX, aoY) > 0) {
    // Remove B, simplex becomes line AC
    simplex.length = 0
    simplex.push(c, a)
    return acPerp
  }

  // Origin is inside the triangle
  return null
}

/** Compute the closest distance from the origin to the simplex. */
function computeClosestDistance(simplex: { x: number; y: number }[]): number {
  if (simplex.length === 1) {
    const p = simplex[0]
    return Math.sqrt(p.x * p.x + p.y * p.y)
  }

  if (simplex.length === 2) {
    return distancePointToSegment(0, 0, simplex[0], simplex[1])
  }

  // Triangle — shouldn't happen for non-colliding result, but handle it
  let minDist = Infinity
  for (let i = 0; i < simplex.length; i++) {
    const j = (i + 1) % simplex.length
    const d = distancePointToSegment(0, 0, simplex[i], simplex[j])
    if (d < minDist) minDist = d
  }
  return minDist
}

/** Distance from a point (px, py) to the closest point on segment (a, b). */
function distancePointToSegment(
  px: number,
  py: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const abX = b.x - a.x
  const abY = b.y - a.y
  const apX = px - a.x
  const apY = py - a.y
  const abLenSq = abX * abX + abY * abY

  if (abLenSq < 1e-12) {
    // Degenerate segment
    return Math.sqrt(apX * apX + apY * apY)
  }

  let t = (apX * abX + apY * abY) / abLenSq
  if (t < 0) t = 0
  if (t > 1) t = 1

  const closestX = a.x + t * abX
  const closestY = a.y + t * abY
  const dx = px - closestX
  const dy = py - closestY
  return Math.sqrt(dx * dx + dy * dy)
}

// ── EPA ──────────────────────────────────────────────────────────────────────

export interface EPAResult {
  /** Penetration normal X (points from B toward A). */
  normalX: number
  /** Penetration normal Y (points from B toward A). */
  normalY: number
  /** Penetration depth (positive). */
  penetration: number
  /** Approximate contact point on shape A. */
  contactAx: number
  contactAy: number
  /** Approximate contact point on shape B. */
  contactBx: number
  contactBy: number
}

/**
 * Expanding Polytope Algorithm — given a colliding simplex from GJK, expands
 * it into a polytope to find the minimum translation vector (penetration
 * normal + depth) and approximate contact points.
 *
 * The input simplex must be a triangle (3 vertices) enclosing the origin.
 */
export function epa(shapeA: ConvexShape, shapeB: ConvexShape, simplex: { x: number; y: number }[]): EPAResult {
  // Build the initial polytope from the simplex.
  // Ensure CCW winding so edge normals point outward.
  const polytope: { x: number; y: number }[] = [...simplex]
  ensureCCW(polytope)

  for (let iter = 0; iter < EPA_MAX_ITERATIONS; iter++) {
    // Find the edge closest to the origin
    const edge = findClosestEdge(polytope)

    // Get support point in the direction of the closest edge's normal
    const support = minkSupport(shapeA, shapeB, edge.normalX, edge.normalY)
    const d = dot(support.x, support.y, edge.normalX, edge.normalY)

    // Check convergence: if the new support point doesn't extend the
    // polytope significantly past the closest edge, we've found the MTV.
    if (d - edge.distance < EPA_TOLERANCE) {
      return buildEPAResult(shapeA, shapeB, edge.normalX, edge.normalY, edge.distance)
    }

    // Insert the new support point into the polytope between the edge vertices
    polytope.splice(edge.index + 1, 0, support)
  }

  // Max iterations — return best approximation from last closest edge
  const edge = findClosestEdge(polytope)
  return buildEPAResult(shapeA, shapeB, edge.normalX, edge.normalY, edge.distance)
}

/** Ensure the polygon winding is counter-clockwise. */
function ensureCCW(poly: { x: number; y: number }[]): void {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length
    area += poly[i].x * poly[j].y - poly[j].x * poly[i].y
  }
  // area > 0 => CCW, area < 0 => CW
  if (area < 0) {
    poly.reverse()
  }
}

interface ClosestEdge {
  /** Distance from origin to this edge. */
  distance: number
  /** Outward-pointing normal (unit length). */
  normalX: number
  normalY: number
  /** Index of the first vertex of the edge. */
  index: number
}

/** Find the polytope edge closest to the origin. */
function findClosestEdge(polytope: { x: number; y: number }[]): ClosestEdge {
  let minDist = Infinity
  let minNx = 0
  let minNy = 0
  let minIdx = 0

  for (let i = 0; i < polytope.length; i++) {
    const j = (i + 1) % polytope.length
    const a = polytope[i]
    const b = polytope[j]

    // Edge vector
    const ex = b.x - a.x
    const ey = b.y - a.y

    // Outward normal (left-hand normal for CCW winding)
    let nx = -ey
    let ny = ex

    // Normalize
    const len = Math.sqrt(nx * nx + ny * ny)
    if (len < 1e-12) continue
    nx /= len
    ny /= len

    // Distance from origin to this edge along the normal
    const dist = dot(a.x, a.y, nx, ny)

    if (dist < minDist) {
      minDist = dist
      minNx = nx
      minNy = ny
      minIdx = i
    }
  }

  return {
    distance: minDist,
    normalX: minNx,
    normalY: minNy,
    index: minIdx,
  }
}

/**
 * Build the final EPA result including contact point approximation.
 *
 * Contact points are found by querying each shape's support function in the
 * penetration normal direction. The contact point on A is the support of A
 * in the direction of -normal, and on B is the support of B in the direction
 * of +normal. This gives the deepest points on each shape along the
 * separation axis.
 */
function buildEPAResult(
  shapeA: ConvexShape,
  shapeB: ConvexShape,
  nx: number,
  ny: number,
  penetration: number,
): EPAResult {
  // Contact on A: furthest point on A in the direction of -normal
  // (the point on A that is most embedded into B)
  const contactA = shapeA.support(-nx, -ny)

  // Contact on B: furthest point on B in the direction of +normal
  // (the point on B that is most embedded into A)
  const contactB = shapeB.support(nx, ny)

  return {
    normalX: nx,
    normalY: ny,
    penetration: Math.abs(penetration),
    contactAx: contactA.x,
    contactAy: contactA.y,
    contactBx: contactB.x,
    contactBy: contactB.y,
  }
}

// ── High-level query ─────────────────────────────────────────────────────────

export interface GJKContactManifold {
  /** Penetration normal X (points from B toward A). */
  normalX: number
  /** Penetration normal Y (points from B toward A). */
  normalY: number
  /** Penetration depth (positive when overlapping). */
  penetration: number
  /** Approximate contact point on shape A. */
  contactAx: number
  contactAy: number
  /** Approximate contact point on shape B. */
  contactBx: number
  contactBy: number
}

/**
 * Combined GJK + EPA query. Returns a contact manifold if the shapes
 * overlap, or null if they are separated.
 *
 * Usage:
 * ```ts
 * const contact = gjkEpaQuery(
 *   boxShape(0, 0, 16, 16, 0),
 *   circleShape(20, 0, 10),
 * )
 * if (contact) {
 *   // Resolve penetration by pushing A along normal * penetration
 * }
 * ```
 */
export function gjkEpaQuery(shapeA: ConvexShape, shapeB: ConvexShape): GJKContactManifold | null {
  const gjkResult = gjk(shapeA, shapeB)

  if (!gjkResult.collision) {
    return null
  }

  // EPA requires a triangle simplex. If GJK converged with fewer than 3
  // points (e.g. degenerate shapes), we need to expand it.
  const simplex = gjkResult.simplex
  if (simplex.length < 3) {
    // Expand simplex to a triangle by adding support points in perpendicular
    // directions.
    if (simplex.length === 1) {
      // Single point — expand to a line, then to a triangle
      const p = simplex[0]
      const s1 = minkSupport(shapeA, shapeB, 1, 0)
      const s2 = minkSupport(shapeA, shapeB, -1, 0)
      // Pick the one farther from p
      const d1 = (s1.x - p.x) * (s1.x - p.x) + (s1.y - p.y) * (s1.y - p.y)
      const d2 = (s2.x - p.x) * (s2.x - p.x) + (s2.y - p.y) * (s2.y - p.y)
      simplex.push(d1 > d2 ? s1 : s2)
    }

    if (simplex.length === 2) {
      // Line — add a point perpendicular to it
      const a = simplex[0]
      const b = simplex[1]
      const edgeX = b.x - a.x
      const edgeY = b.y - a.y
      // Try both perpendicular directions, pick the one away from origin
      const perpX = -edgeY
      const perpY = edgeX
      const s1 = minkSupport(shapeA, shapeB, perpX, perpY)
      const s2 = minkSupport(shapeA, shapeB, -perpX, -perpY)
      // Pick whichever forms a triangle enclosing the origin (or larger area)
      const area1 = cross(b.x - a.x, b.y - a.y, s1.x - a.x, s1.y - a.y)
      const area2 = cross(b.x - a.x, b.y - a.y, s2.x - a.x, s2.y - a.y)
      simplex.push(Math.abs(area1) >= Math.abs(area2) ? s1 : s2)
    }
  }

  const epaResult = epa(shapeA, shapeB, simplex)

  return {
    normalX: epaResult.normalX,
    normalY: epaResult.normalY,
    penetration: epaResult.penetration,
    contactAx: epaResult.contactAx,
    contactAy: epaResult.contactAy,
    contactBx: epaResult.contactBx,
    contactBy: epaResult.contactBy,
  }
}
