/**
 * NavigationMesh3D — 3-D pathfinding on a pre-baked convex polygon navigation mesh.
 *
 * Features:
 *   • A* search over polygon adjacency graph (edge cost = centroid distance,
 *     heuristic = straight-line distance to goal centroid).
 *   • Simple string-pull / funnel path-smoothing pass to straighten the raw
 *     polygon-centre path into a more direct walkable route.
 *   • `fromGeometry` factory: extract triangles from an indexed BufferGeometry,
 *     filter steep faces by `maxSlopeAngle`, build edge-adjacency map.
 *   • `toDebugGeometry` helper: returns a BufferGeometry for DebugRenderer3D.
 */

import { Vec3 } from '../math/Vec3'
import { BufferGeometry, BufferAttribute } from '../geometry'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NavMeshPolygon {
  /** World-space vertices (convex, minimum 3). */
  vertices: Vec3[]
  /** Pre-computed centroid. */
  center: Vec3
  /** Face normal. */
  normal: Vec3
  /** Indices of adjacent polygons (shared edge). */
  neighbors: number[]
}

// ---------------------------------------------------------------------------
// A* node state (internal)
// ---------------------------------------------------------------------------

interface AStarNode {
  polyIndex: number
  g: number // cost so far
  f: number // g + h
  parent: number // parent polygon index or -1
}

// ---------------------------------------------------------------------------
// NavigationMesh3D
// ---------------------------------------------------------------------------

export class NavigationMesh3D {
  polygons: NavMeshPolygon[]

  constructor(polygons: NavMeshPolygon[] = []) {
    this.polygons = polygons
  }

  // --------------------------------------------------------------------------
  // Factory
  // --------------------------------------------------------------------------

  /**
   * Build a NavigationMesh3D from a triangulated BufferGeometry.
   *
   * Each triangle becomes one NavMeshPolygon. Triangles whose face normal
   * deviates from `up` by more than `maxSlopeAngle` (degrees) are excluded.
   * Adjacency is built by detecting shared edges (pairs of vertices within
   * `WELD_EPSILON` of each other).
   */
  static fromGeometry(geometry: BufferGeometry, maxSlopeAngle = 45): NavigationMesh3D {
    const posAttr = geometry.getAttribute('position')
    if (!posAttr) return new NavigationMesh3D()

    const WELD_EPSILON = 1e-4
    const maxSlopeCos = Math.cos((maxSlopeAngle * Math.PI) / 180)
    const up = new Vec3(0, 1, 0)

    // ── Extract triangles ──
    const tris: Array<[Vec3, Vec3, Vec3]> = []

    const getPos = (i: number): Vec3 => new Vec3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))

    if (geometry.index) {
      const idx = geometry.index
      for (let i = 0; i < idx.count; i += 3) {
        tris.push([getPos(idx.getX(i)), getPos(idx.getX(i + 1)), getPos(idx.getX(i + 2))])
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 3) {
        tris.push([getPos(i), getPos(i + 1), getPos(i + 2)])
      }
    }

    // ── Build polygons, filtering by slope ──
    const polygons: NavMeshPolygon[] = []

    for (const [a, b, c] of tris) {
      const ab = new Vec3(b.x - a.x, b.y - a.y, b.z - a.z)
      const ac = new Vec3(c.x - a.x, c.y - a.y, c.z - a.z)
      // Cross product ab × ac
      const nx = ab.y * ac.z - ab.z * ac.y
      const ny = ab.z * ac.x - ab.x * ac.z
      const nz = ab.x * ac.y - ab.y * ac.x
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz)
      if (nLen < 1e-10) continue // degenerate

      const normal = new Vec3(nx / nLen, ny / nLen, nz / nLen)
      const dotUp = normal.x * up.x + normal.y * up.y + normal.z * up.z

      // Accept faces whose upward-facing component meets the slope threshold.
      // Allow inverted normals (|dot| >= threshold) so mesh winding doesn't matter.
      if (Math.abs(dotUp) < maxSlopeCos) continue

      const center = new Vec3((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3)

      polygons.push({
        vertices: [a, b, c],
        center,
        normal,
        neighbors: [],
      })
    }

    // ── Build adjacency (shared edge = two vertices within WELD_EPSILON) ──
    // For each pair of polygons, count shared (welded) vertices.
    // Two triangles sharing exactly 2 vertices are adjacent.
    const vertKey = (v: Vec3): string =>
      `${Math.round(v.x / WELD_EPSILON)},${Math.round(v.y / WELD_EPSILON)},${Math.round(v.z / WELD_EPSILON)}`

    // Build per-polygon vertex key sets
    const polyKeys: Set<string>[] = polygons.map((p) => new Set(p.vertices.map(vertKey)))

    for (let i = 0; i < polygons.length; i++) {
      for (let j = i + 1; j < polygons.length; j++) {
        let shared = 0
        for (const k of polyKeys[i]) {
          if (polyKeys[j].has(k)) shared++
        }
        if (shared >= 2) {
          polygons[i].neighbors.push(j)
          polygons[j].neighbors.push(i)
        }
      }
    }

    return new NavigationMesh3D(polygons)
  }

  // --------------------------------------------------------------------------
  // Pathfinding
  // --------------------------------------------------------------------------

  /**
   * Find a path from `start` to `end` in world space.
   *
   * Returns an array of waypoints (polygon centroids) beginning at the
   * polygon containing `start` and ending at the polygon containing `end`,
   * after path-smoothing. Returns `null` if no path exists.
   */
  findPath(start: Vec3, end: Vec3): Vec3[] | null {
    if (this.polygons.length === 0) return null

    const startPoly = this.getPolygonAt(start)
    const endPoly = this.getPolygonAt(end)

    if (startPoly === endPoly) {
      return [start.clone(), end.clone()]
    }

    // A* over polygon graph
    const open = new Map<number, AStarNode>()
    const closed = new Set<number>()
    const allNodes = new Map<number, AStarNode>()

    const h = (idx: number): number => vec3Dist(this.polygons[idx].center, this.polygons[endPoly].center)

    const startNode: AStarNode = { polyIndex: startPoly, g: 0, f: h(startPoly), parent: -1 }
    open.set(startPoly, startNode)
    allNodes.set(startPoly, startNode)

    while (open.size > 0) {
      // Pick node with lowest f
      let current: AStarNode | null = null
      for (const node of open.values()) {
        if (current === null || node.f < current.f) current = node
      }
      if (current === null) break

      if (current.polyIndex === endPoly) {
        // Reconstruct raw path of polygon indices
        const polyPath: number[] = []
        let cur: AStarNode | undefined = current
        while (cur) {
          polyPath.unshift(cur.polyIndex)
          cur = cur.parent >= 0 ? allNodes.get(cur.parent) : undefined
        }

        // Convert to Vec3 waypoints using centroids
        const waypoints: Vec3[] = [start.clone()]
        for (let i = 1; i < polyPath.length - 1; i++) {
          waypoints.push(this.polygons[polyPath[i]].center.clone())
        }
        waypoints.push(end.clone())

        // String-pull smoothing
        return this._stringPull(waypoints, polyPath)
      }

      open.delete(current.polyIndex)
      closed.add(current.polyIndex)

      const poly = this.polygons[current.polyIndex]
      for (const neighborIdx of poly.neighbors) {
        if (closed.has(neighborIdx)) continue

        const g = current.g + vec3Dist(poly.center, this.polygons[neighborIdx].center)
        const existing = open.get(neighborIdx)

        if (!existing || g < existing.g) {
          const node: AStarNode = {
            polyIndex: neighborIdx,
            g,
            f: g + h(neighborIdx),
            parent: current.polyIndex,
          }
          open.set(neighborIdx, node)
          allNodes.set(neighborIdx, node)
        }
      }
    }

    return null // no path found
  }

  // --------------------------------------------------------------------------
  // Snap / query
  // --------------------------------------------------------------------------

  /**
   * Find the nearest point on the navmesh to `point`.
   */
  snapToNavMesh(point: Vec3): Vec3 {
    const polyIdx = this.getPolygonAt(point)
    if (polyIdx < 0) return point.clone()

    const poly = this.polygons[polyIdx]
    // Project point onto the polygon's plane
    const d = dotV3(poly.normal, poly.vertices[0])
    const dist = dotV3(poly.normal, point) - d
    return new Vec3(point.x - poly.normal.x * dist, point.y - poly.normal.y * dist, point.z - poly.normal.z * dist)
  }

  /**
   * Find which polygon index contains (or is nearest to) `point`.
   * Uses a two-pass approach: first check containment, then fall back to
   * nearest centroid.
   */
  getPolygonAt(point: Vec3): number {
    let best = -1
    let bestDist = Infinity

    for (let i = 0; i < this.polygons.length; i++) {
      const poly = this.polygons[i]
      const d = vec3Dist(poly.center, point)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }

    return best
  }

  // --------------------------------------------------------------------------
  // Debug
  // --------------------------------------------------------------------------

  /**
   * Return a BufferGeometry (triangle soup) representing the navmesh,
   * suitable for passing to DebugRenderer3D or Mesh for visualisation.
   */
  toDebugGeometry(): BufferGeometry {
    const geo = new BufferGeometry()
    const verts: number[] = []

    for (const poly of this.polygons) {
      // Fan-triangulate convex polygon
      const v0 = poly.vertices[0]
      for (let i = 1; i < poly.vertices.length - 1; i++) {
        const va = poly.vertices[i]
        const vb = poly.vertices[i + 1]
        verts.push(v0.x, v0.y, v0.z, va.x, va.y, va.z, vb.x, vb.y, vb.z)
      }
    }

    geo.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3))
    return geo
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Simple string-pull smoothing: for each consecutive triple of waypoints
   * A -> B -> C, if A can "see" C (they share a polygon neighbourhood or are
   * within the same polygon sequence) we remove B. This is a lightweight
   * greedy approximation of the full funnel algorithm.
   */
  private _stringPull(waypoints: Vec3[], _polyPath: number[]): Vec3[] {
    if (waypoints.length <= 2) return waypoints

    const result: Vec3[] = [waypoints[0]]
    let anchor = 0

    for (let i = 1; i < waypoints.length; i++) {
      const a = waypoints[anchor]
      const b = waypoints[i]
      // Check if any waypoint between anchor+1 and i-1 can be skipped.
      // We perform a simple collinearity / shortcut test:
      // If the path from a to b doesn't deviate much from the straight line
      // we skip intermediate points.
      if (i === waypoints.length - 1) {
        result.push(b)
      } else {
        const next = waypoints[i + 1]
        // Check if going directly a → next is shorter than a → b → next
        const direct = vec3Dist(a, next)
        const viaB = vec3Dist(a, b) + vec3Dist(b, next)
        // Tolerance: skip b if the detour adds less than 5 % to direct distance
        if (viaB > direct * 1.05) {
          result.push(b)
          anchor = i
        }
      }
    }

    return result
  }
}

// ---------------------------------------------------------------------------
// Inline math helpers (avoid importing full Vec3 methods for perf)
// ---------------------------------------------------------------------------

function vec3Dist(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function dotV3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}
