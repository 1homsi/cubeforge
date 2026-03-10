/**
 * Simple 2D AABB BVH (Bounding Volume Hierarchy) for triangle meshes.
 *
 * Builds a binary tree over a set of triangles, where each node has an AABB
 * that tightly bounds its children. Queries against a test AABB or circle
 * return only the subset of triangles whose bounding boxes overlap.
 *
 * Reference: Rapier's `SimdAabb` broad-phase tree.
 */

interface AABB {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface BVHNode {
  aabb: AABB
  /** If leaf, the triangle index. -1 for internal nodes. */
  triangleIndex: number
  left: BVHNode | null
  right: BVHNode | null
}

export interface Triangle2D {
  ax: number
  ay: number
  bx: number
  by: number
  cx: number
  cy: number
  index: number
}

export interface BVH {
  root: BVHNode | null
  triangles: Triangle2D[]
}

function triangleAABB(tri: Triangle2D): AABB {
  return {
    minX: Math.min(tri.ax, tri.bx, tri.cx),
    minY: Math.min(tri.ay, tri.by, tri.cy),
    maxX: Math.max(tri.ax, tri.bx, tri.cx),
    maxY: Math.max(tri.ay, tri.by, tri.cy),
  }
}

function mergeAABB(a: AABB, b: AABB): AABB {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}

function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

function buildNode(items: { aabb: AABB; index: number }[]): BVHNode | null {
  if (items.length === 0) return null
  if (items.length === 1) {
    return {
      aabb: items[0].aabb,
      triangleIndex: items[0].index,
      left: null,
      right: null,
    }
  }

  // Compute combined AABB
  let combined = items[0].aabb
  for (let i = 1; i < items.length; i++) {
    combined = mergeAABB(combined, items[i].aabb)
  }

  // Split along the longest axis
  const extentX = combined.maxX - combined.minX
  const extentY = combined.maxY - combined.minY
  const useX = extentX >= extentY

  // Sort by centroid along the split axis
  items.sort((a, b) => {
    if (useX) {
      return (a.aabb.minX + a.aabb.maxX) / 2 - (b.aabb.minX + b.aabb.maxX) / 2
    }
    return (a.aabb.minY + a.aabb.maxY) / 2 - (b.aabb.minY + b.aabb.maxY) / 2
  })

  const mid = Math.floor(items.length / 2)
  const left = buildNode(items.slice(0, mid))
  const right = buildNode(items.slice(mid))

  return {
    aabb: combined,
    triangleIndex: -1,
    left,
    right,
  }
}

/**
 * Build a BVH from a set of triangles defined by vertices and indices.
 */
export function buildBVH(
  vertices: { x: number; y: number }[],
  indices: number[],
  offsetX: number = 0,
  offsetY: number = 0,
): BVH {
  const triangles: Triangle2D[] = []

  for (let i = 0; i < indices.length; i += 3) {
    const a = vertices[indices[i]]
    const b = vertices[indices[i + 1]]
    const c = vertices[indices[i + 2]]
    if (!a || !b || !c) continue

    triangles.push({
      ax: a.x + offsetX,
      ay: a.y + offsetY,
      bx: b.x + offsetX,
      by: b.y + offsetY,
      cx: c.x + offsetX,
      cy: c.y + offsetY,
      index: i / 3,
    })
  }

  const items = triangles.map((tri) => ({
    aabb: triangleAABB(tri),
    index: tri.index,
  }))

  return {
    root: buildNode(items),
    triangles,
  }
}

/**
 * Query the BVH for triangles whose AABB overlaps the given test AABB.
 * Returns indices into the triangles array.
 */
export function queryBVH(bvh: BVH, testAABB: AABB): number[] {
  const results: number[] = []
  if (!bvh.root) return results

  const stack: BVHNode[] = [bvh.root]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (!aabbOverlap(node.aabb, testAABB)) continue

    if (node.triangleIndex >= 0) {
      results.push(node.triangleIndex)
    } else {
      if (node.left) stack.push(node.left)
      if (node.right) stack.push(node.right)
    }
  }

  return results
}

/**
 * Query the BVH for triangles overlapping a circle.
 */
export function queryBVHCircle(bvh: BVH, cx: number, cy: number, radius: number): number[] {
  return queryBVH(bvh, {
    minX: cx - radius,
    minY: cy - radius,
    maxX: cx + radius,
    maxY: cy + radius,
  })
}
