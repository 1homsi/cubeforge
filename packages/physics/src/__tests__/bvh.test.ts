import { describe, it, expect } from 'vitest'
import { buildBVH, queryBVH, queryBVHCircle } from '../bvh'

const vertices = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 0, y: 10 },
  { x: 20, y: 0 },
  { x: 30, y: 0 },
  { x: 20, y: 10 },
  { x: -20, y: -20 },
  { x: -10, y: -20 },
  { x: -20, y: -10 },
] as const

describe('buildBVH', () => {
  it('returns an empty BVH for empty inputs', () => {
    const bvh = buildBVH([], [])

    expect(bvh.root).toBeNull()
    expect(bvh.triangles).toEqual([])
  })

  it('builds one triangle from a single valid index triplet', () => {
    const bvh = buildBVH(vertices, [0, 1, 2])

    expect(bvh.triangles).toHaveLength(1)
    expect(bvh.triangles[0]).toMatchObject({
      ax: 0,
      ay: 0,
      bx: 10,
      by: 0,
      cx: 0,
      cy: 10,
      index: 0,
    })
  })

  it('skips incomplete triangles when indices are invalid', () => {
    const bvh = buildBVH(vertices, [0, 1, 2, 99, 100, 101])

    expect(bvh.triangles).toHaveLength(1)
    expect(bvh.root).not.toBeNull()
  })

  it('applies positional offsets to triangle vertices', () => {
    const bvh = buildBVH(vertices, [0, 1, 2], 5, -3)

    expect(bvh.triangles[0]).toMatchObject({
      ax: 5,
      ay: -3,
      bx: 15,
      by: -3,
      cx: 5,
      cy: 7,
    })
  })

  it('builds an internal root node for multiple triangles', () => {
    const bvh = buildBVH(vertices, [0, 1, 2, 3, 4, 5])

    expect(bvh.root).not.toBeNull()
    expect(bvh.root!.triangleIndex).toBe(-1)
    expect(bvh.root!.left).not.toBeNull()
    expect(bvh.root!.right).not.toBeNull()
  })
})

describe('queryBVH', () => {
  it('returns an empty array when the BVH is empty', () => {
    const bvh = buildBVH([], [])

    expect(queryBVH(bvh, { minX: 0, minY: 0, maxX: 10, maxY: 10 })).toEqual([])
  })

  it('returns the matching triangle index for an overlapping AABB', () => {
    const bvh = buildBVH(vertices, [0, 1, 2, 3, 4, 5])

    expect(queryBVH(bvh, { minX: -1, minY: -1, maxX: 11, maxY: 11 })).toEqual([0])
  })

  it('returns multiple triangle indices when the query spans them', () => {
    const bvh = buildBVH(vertices, [0, 1, 2, 3, 4, 5])

    expect(queryBVH(bvh, { minX: 0, minY: -1, maxX: 30, maxY: 11 }).sort((a, b) => a - b)).toEqual([0, 1])
  })

  it('treats touching AABB edges as overlap', () => {
    const bvh = buildBVH(vertices, [0, 1, 2])

    expect(queryBVH(bvh, { minX: 10, minY: 0, maxX: 12, maxY: 4 })).toEqual([0])
  })

  it('returns no matches for a disjoint query', () => {
    const bvh = buildBVH(vertices, [0, 1, 2, 3, 4, 5])

    expect(queryBVH(bvh, { minX: 100, minY: 100, maxX: 110, maxY: 110 })).toEqual([])
  })

  it('returns the negative-space triangle when queried there', () => {
    const bvh = buildBVH(vertices, [0, 1, 2, 6, 7, 8])

    expect(queryBVH(bvh, { minX: -25, minY: -25, maxX: -5, maxY: -5 })).toEqual([1])
  })
})

describe('queryBVHCircle', () => {
  it('returns a triangle whose AABB overlaps the circle bounds', () => {
    const bvh = buildBVH(vertices, [0, 1, 2])

    expect(queryBVHCircle(bvh, 5, 5, 1)).toEqual([0])
  })

  it('returns no matches when the circle is far away', () => {
    const bvh = buildBVH(vertices, [0, 1, 2])

    expect(queryBVHCircle(bvh, 100, 100, 5)).toEqual([])
  })

  it('finds multiple triangles when the circle spans them', () => {
    const bvh = buildBVH(vertices, [0, 1, 2, 3, 4, 5])

    expect(queryBVHCircle(bvh, 15, 5, 15).sort((a, b) => a - b)).toEqual([0, 1])
  })

  it('treats a zero-radius circle as a point query', () => {
    const bvh = buildBVH(vertices, [0, 1, 2])

    expect(queryBVHCircle(bvh, 0, 0, 0)).toEqual([0])
  })
})
