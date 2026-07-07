import { describe, it, expect } from 'vitest'
import { CylinderGeometry } from '../geometry'

function forEachVertex(geo: CylinderGeometry, fn: (x: number, y: number, z: number) => void): void {
  const p = geo.getAttribute('position')!
  for (let i = 0; i < p.count; i++) fn(p.getX(i), p.getY(i), p.getZ(i))
}

describe('CylinderGeometry', () => {
  it('has correct attribute item sizes', () => {
    const geo = new CylinderGeometry()
    expect(geo.getAttribute('position')!.itemSize).toBe(3)
    expect(geo.getAttribute('normal')!.itemSize).toBe(3)
    expect(geo.getAttribute('uv')!.itemSize).toBe(2)
    expect(geo.index!.itemSize).toBe(1)
  })

  it('builds torso plus two caps by default (3 groups)', () => {
    const geo = new CylinderGeometry(1, 1, 2, 32, 1)
    expect(geo.groups).toHaveLength(3)
    const totalIndices = geo.groups.reduce((s, g) => s + g.count, 0)
    expect(totalIndices).toBe(geo.index!.count)
  })

  it('openEnded produces only the torso group', () => {
    const geo = new CylinderGeometry(1, 1, 2, 32, 1, true)
    expect(geo.groups).toHaveLength(1)
  })

  it('counts torso vertices as (heightSegments+1)*(radialSegments+1)', () => {
    const radial = 8
    const heightSeg = 2
    const open = new CylinderGeometry(1, 1, 2, radial, heightSeg, true)
    expect(open.getAttribute('position')!.count).toBe((heightSeg + 1) * (radial + 1))
  })

  it('spans -height/2..height/2 in y', () => {
    const geo = new CylinderGeometry(1, 1, 4, 16, 1)
    geo.computeBoundingBox()
    expect(geo.boundingBox!.min.y).toBeCloseTo(-2)
    expect(geo.boundingBox!.max.y).toBeCloseTo(2)
  })

  it('keeps torso radius within [radiusTop, radiusBottom]', () => {
    const geo = new CylinderGeometry(1, 3, 2, 32, 1, true)
    forEachVertex(geo, (x, _y, z) => {
      const r = Math.hypot(x, z)
      expect(r).toBeGreaterThanOrEqual(1 - 1e-5)
      expect(r).toBeLessThanOrEqual(3 + 1e-5)
    })
  })

  it('a cone (radiusTop=0) omits the top cap group', () => {
    const geo = new CylinderGeometry(0, 1, 2, 16, 1)
    // torso + bottom cap only
    expect(geo.groups).toHaveLength(2)
  })

  it('has unit-length normals', () => {
    const geo = new CylinderGeometry(1, 1, 2, 16, 1)
    const n = geo.getAttribute('normal')!
    for (let i = 0; i < n.count; i++) {
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1)
    }
  })

  it('references only valid vertex indices', () => {
    const geo = new CylinderGeometry(1, 1, 2, 12, 2)
    const idx = geo.index!
    const count = geo.getAttribute('position')!.count
    for (let i = 0; i < idx.count; i++) {
      expect(idx.getX(i)).toBeLessThan(count)
    }
  })

  it('bounding radius matches the outer radius for a straight cylinder', () => {
    const geo = new CylinderGeometry(2, 2, 2, 32, 1)
    geo.computeBoundingBox()
    expect(geo.boundingBox!.max.x).toBeCloseTo(2)
    expect(geo.boundingBox!.min.x).toBeCloseTo(-2)
  })

  it('clone is independent', () => {
    const geo = new CylinderGeometry()
    const copy = geo.clone()
    copy.getAttribute('position')!.setX(0, 999)
    expect(geo.getAttribute('position')!.getX(0)).not.toBe(999)
  })
})
