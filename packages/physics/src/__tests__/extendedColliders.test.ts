import { describe, it, expect } from 'vitest'
import { createConvexPolygonCollider } from '../components/convexPolygonCollider'
import { createSegmentCollider } from '../components/segmentCollider'
import { createHalfSpaceCollider } from '../components/halfSpaceCollider'
import { createTriangleCollider } from '../components/triangleCollider'
import { createHeightFieldCollider } from '../components/heightFieldCollider'

describe('createConvexPolygonCollider', () => {
  const triangle = [
    { x: 0, y: -10 },
    { x: 10, y: 10 },
    { x: -10, y: 10 },
  ]

  it('creates with correct type and vertices', () => {
    const c = createConvexPolygonCollider(triangle)
    expect(c.type).toBe('ConvexPolygonCollider')
    expect(c.vertices).toHaveLength(3)
    expect(c.vertices[0]).toEqual({ x: 0, y: -10 })
  })

  it('copies the vertices array', () => {
    const c = createConvexPolygonCollider(triangle)
    c.vertices.push({ x: 0, y: 0 })
    expect(triangle).toHaveLength(3)
  })

  it('has correct defaults', () => {
    const c = createConvexPolygonCollider(triangle)
    expect(c.offsetX).toBe(0)
    expect(c.offsetY).toBe(0)
    expect(c.isTrigger).toBe(false)
    expect(c.layer).toBe('default')
    expect(c.mask).toBe('*')
    expect(c.friction).toBe(0)
    expect(c.restitution).toBe(0)
    expect(c.enabled).toBe(true)
    expect(c.group).toBe('')
    expect(c.frictionCombineRule).toBe('average')
    expect(c.restitutionCombineRule).toBe('average')
  })

  it('accepts custom options', () => {
    const c = createConvexPolygonCollider(triangle, {
      isTrigger: true,
      layer: 'hazard',
      friction: 0.5,
    })
    expect(c.isTrigger).toBe(true)
    expect(c.layer).toBe('hazard')
    expect(c.friction).toBe(0.5)
  })
})

describe('createSegmentCollider', () => {
  const start = { x: 0, y: 0 }
  const end = { x: 100, y: 0 }

  it('creates with correct type and endpoints', () => {
    const c = createSegmentCollider(start, end)
    expect(c.type).toBe('SegmentCollider')
    expect(c.start).toEqual({ x: 0, y: 0 })
    expect(c.end).toEqual({ x: 100, y: 0 })
  })

  it('copies start and end points', () => {
    const s = { x: 0, y: 0 }
    const e = { x: 10, y: 10 }
    const c = createSegmentCollider(s, e)
    s.x = 999
    expect(c.start.x).toBe(0)
  })

  it('has correct defaults', () => {
    const c = createSegmentCollider(start, end)
    expect(c.offsetX).toBe(0)
    expect(c.offsetY).toBe(0)
    expect(c.isTrigger).toBe(false)
    expect(c.oneWay).toBe(false)
    expect(c.layer).toBe('default')
    expect(c.mask).toBe('*')
    expect(c.enabled).toBe(true)
    expect(c.group).toBe('')
  })

  it('accepts oneWay option', () => {
    const c = createSegmentCollider(start, end, { oneWay: true })
    expect(c.oneWay).toBe(true)
  })

  it('accepts offset options', () => {
    const c = createSegmentCollider(start, end, { offsetX: 5, offsetY: 10 })
    expect(c.offsetX).toBe(5)
    expect(c.offsetY).toBe(10)
  })
})

describe('createHalfSpaceCollider', () => {
  it('creates with correct type and default normal', () => {
    const c = createHalfSpaceCollider()
    expect(c.type).toBe('HalfSpaceCollider')
    expect(c.normalX).toBe(0)
    expect(c.normalY).toBe(-1)
  })

  it('has correct defaults', () => {
    const c = createHalfSpaceCollider()
    expect(c.layer).toBe('default')
    expect(c.mask).toBe('*')
    expect(c.friction).toBe(0)
    expect(c.restitution).toBe(0)
    expect(c.enabled).toBe(true)
    expect(c.group).toBe('')
  })

  it('accepts custom normal', () => {
    const c = createHalfSpaceCollider({ normalX: 1, normalY: 0 })
    expect(c.normalX).toBe(1)
    expect(c.normalY).toBe(0)
  })

  it('accepts custom layer and mask', () => {
    const c = createHalfSpaceCollider({ layer: 'walls', mask: ['player'] })
    expect(c.layer).toBe('walls')
    expect(c.mask).toEqual(['player'])
  })
})

describe('createTriangleCollider', () => {
  const a = { x: 0, y: -10 }
  const b = { x: 10, y: 10 }
  const c = { x: -10, y: 10 }

  it('creates with correct type and vertices', () => {
    const col = createTriangleCollider(a, b, c)
    expect(col.type).toBe('TriangleCollider')
    expect(col.a).toEqual({ x: 0, y: -10 })
    expect(col.b).toEqual({ x: 10, y: 10 })
    expect(col.c).toEqual({ x: -10, y: 10 })
  })

  it('copies vertex objects', () => {
    const p = { x: 5, y: 5 }
    const col = createTriangleCollider(p, { x: 0, y: 0 }, { x: 10, y: 0 })
    p.x = 999
    expect(col.a.x).toBe(5)
  })

  it('has correct defaults', () => {
    const col = createTriangleCollider(a, b, c)
    expect(col.offsetX).toBe(0)
    expect(col.offsetY).toBe(0)
    expect(col.isTrigger).toBe(false)
    expect(col.layer).toBe('default')
    expect(col.mask).toBe('*')
    expect(col.friction).toBe(0)
    expect(col.restitution).toBe(0)
    expect(col.enabled).toBe(true)
    expect(col.group).toBe('')
  })

  it('accepts custom options', () => {
    const col = createTriangleCollider(a, b, c, {
      isTrigger: true,
      friction: 0.8,
      restitution: 0.5,
    })
    expect(col.isTrigger).toBe(true)
    expect(col.friction).toBe(0.8)
    expect(col.restitution).toBe(0.5)
  })
})

describe('createHeightFieldCollider', () => {
  const heights = [0, 1, 2, 3, 2, 1, 0]

  it('creates with correct type and heights', () => {
    const c = createHeightFieldCollider(heights)
    expect(c.type).toBe('HeightFieldCollider')
    expect(c.heights).toEqual([0, 1, 2, 3, 2, 1, 0])
  })

  it('copies the heights array', () => {
    const h = [0, 1, 2]
    const c = createHeightFieldCollider(h)
    h.push(99)
    expect(c.heights).toHaveLength(3)
  })

  it('has correct defaults', () => {
    const c = createHeightFieldCollider(heights)
    expect(c.scaleX).toBe(1)
    expect(c.scaleY).toBe(1)
    expect(c.layer).toBe('default')
    expect(c.mask).toBe('*')
    expect(c.friction).toBe(0)
    expect(c.restitution).toBe(0)
    expect(c.enabled).toBe(true)
    expect(c.group).toBe('')
  })

  it('accepts custom scale', () => {
    const c = createHeightFieldCollider(heights, { scaleX: 16, scaleY: 2 })
    expect(c.scaleX).toBe(16)
    expect(c.scaleY).toBe(2)
  })

  it('accepts custom layer and friction', () => {
    const c = createHeightFieldCollider(heights, { layer: 'terrain', friction: 0.9 })
    expect(c.layer).toBe('terrain')
    expect(c.friction).toBe(0.9)
  })

  it('accepts empty heights array', () => {
    const c = createHeightFieldCollider([])
    expect(c.heights).toEqual([])
  })
})
