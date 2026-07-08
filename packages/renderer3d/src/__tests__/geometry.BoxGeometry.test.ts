import { describe, it, expect } from 'vitest'
import { BoxGeometry } from '../geometry'

function maxIndex(geo: BoxGeometry): number {
  const idx = geo.index!
  let m = 0
  for (let i = 0; i < idx.count; i++) m = Math.max(m, idx.getX(i))
  return m
}

describe('BoxGeometry', () => {
  it('generates the expected attribute item sizes', () => {
    const geo = new BoxGeometry()
    expect(geo.getAttribute('position')!.itemSize).toBe(3)
    expect(geo.getAttribute('normal')!.itemSize).toBe(3)
    expect(geo.getAttribute('uv')!.itemSize).toBe(2)
    expect(geo.index!.itemSize).toBe(1)
  })

  it('produces 24 vertices and 36 indices for a unit box', () => {
    const geo = new BoxGeometry(1, 1, 1)
    // 6 faces * (1+1)*(1+1) verts = 24
    expect(geo.getAttribute('position')!.count).toBe(24)
    expect(geo.getAttribute('normal')!.count).toBe(24)
    expect(geo.getAttribute('uv')!.count).toBe(24)
    // 6 faces * 2 triangles * 3 = 36
    expect(geo.index!.count).toBe(36)
  })

  it('creates one draw group per face', () => {
    const geo = new BoxGeometry()
    expect(geo.groups).toHaveLength(6)
    const total = geo.groups.reduce((s, g) => s + g.count, 0)
    expect(total).toBe(geo.index!.count)
  })

  it('scales vertex/index counts predictably with segments', () => {
    const geo = new BoxGeometry(1, 1, 1, 2, 3, 4)
    // matches example from renderer3d.test.ts scaled: verts and indices grow
    const base = new BoxGeometry(1, 1, 1)
    expect(geo.getAttribute('position')!.count).toBeGreaterThan(base.getAttribute('position')!.count)
    expect(geo.index!.count).toBeGreaterThan(base.index!.count)
  })

  it('spans -w/2..w/2, -h/2..h/2, -d/2..d/2', () => {
    const geo = new BoxGeometry(2, 4, 6)
    geo.computeBoundingBox()
    expect(geo.boundingBox!.min.x).toBeCloseTo(-1)
    expect(geo.boundingBox!.max.x).toBeCloseTo(1)
    expect(geo.boundingBox!.min.y).toBeCloseTo(-2)
    expect(geo.boundingBox!.max.y).toBeCloseTo(2)
    expect(geo.boundingBox!.min.z).toBeCloseTo(-3)
    expect(geo.boundingBox!.max.z).toBeCloseTo(3)
  })

  it('has axis-aligned unit-length normals', () => {
    const geo = new BoxGeometry(2, 2, 2)
    const n = geo.getAttribute('normal')!
    for (let i = 0; i < n.count; i++) {
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1)
    }
  })

  it('references only valid vertex indices', () => {
    const geo = new BoxGeometry(1, 1, 1, 2, 2, 2)
    expect(maxIndex(geo)).toBeLessThan(geo.getAttribute('position')!.count)
  })

  it('computes a bounding sphere enclosing the corners', () => {
    const geo = new BoxGeometry(2, 2, 2)
    geo.computeBoundingSphere()
    // half-diagonal of a 2x2x2 cube = sqrt(3)
    expect(geo.boundingSphere!.radius).toBeCloseTo(Math.sqrt(3))
  })

  it('keeps all UVs within [0,1]', () => {
    const geo = new BoxGeometry(1, 1, 1, 3, 3, 3)
    const uv = geo.getAttribute('uv')!
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0)
      expect(uv.getX(i)).toBeLessThanOrEqual(1)
      expect(uv.getY(i)).toBeGreaterThanOrEqual(0)
      expect(uv.getY(i)).toBeLessThanOrEqual(1)
    }
  })

  it('clone produces an independent copy', () => {
    const geo = new BoxGeometry(2, 2, 2)
    const copy = geo.clone()
    expect(copy.getAttribute('position')!.count).toBe(geo.getAttribute('position')!.count)
    copy.getAttribute('position')!.setX(0, 999)
    expect(geo.getAttribute('position')!.getX(0)).not.toBe(999)
  })
})
