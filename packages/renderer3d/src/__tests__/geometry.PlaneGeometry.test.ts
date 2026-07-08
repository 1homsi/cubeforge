import { describe, it, expect } from 'vitest'
import { PlaneGeometry } from '../geometry'

describe('PlaneGeometry', () => {
  it('produces (segX+1)*(segY+1) vertices', () => {
    const geo = new PlaneGeometry(1, 1, 1, 1)
    expect(geo.getAttribute('position')!.count).toBe(4)
    const seg = new PlaneGeometry(1, 1, 4, 3)
    expect(seg.getAttribute('position')!.count).toBe((4 + 1) * (3 + 1))
  })

  it('produces segX*segY*6 indices', () => {
    const geo = new PlaneGeometry(1, 1, 4, 3)
    expect(geo.index!.count).toBe(4 * 3 * 6)
  })

  it('has correct attribute item sizes', () => {
    const geo = new PlaneGeometry()
    expect(geo.getAttribute('position')!.itemSize).toBe(3)
    expect(geo.getAttribute('normal')!.itemSize).toBe(3)
    expect(geo.getAttribute('uv')!.itemSize).toBe(2)
  })

  it('lies flat in the XZ plane (y = 0)', () => {
    const geo = new PlaneGeometry(2, 2, 2, 2)
    const p = geo.getAttribute('position')!
    for (let i = 0; i < p.count; i++) {
      expect(p.getY(i)).toBe(0)
    }
  })

  it('all normals point up (0,1,0)', () => {
    const geo = new PlaneGeometry(2, 2, 3, 3)
    const n = geo.getAttribute('normal')!
    for (let i = 0; i < n.count; i++) {
      expect(n.getX(i)).toBe(0)
      expect(n.getY(i)).toBe(1)
      expect(n.getZ(i)).toBe(0)
    }
  })

  it('spans -w/2..w/2 in x and -h/2..h/2 in z', () => {
    const geo = new PlaneGeometry(4, 6)
    geo.computeBoundingBox()
    expect(geo.boundingBox!.min.x).toBeCloseTo(-2)
    expect(geo.boundingBox!.max.x).toBeCloseTo(2)
    expect(geo.boundingBox!.min.z).toBeCloseTo(-3)
    expect(geo.boundingBox!.max.z).toBeCloseTo(3)
    expect(geo.boundingBox!.min.y).toBe(0)
    expect(geo.boundingBox!.max.y).toBe(0)
  })

  it('references only valid vertex indices', () => {
    const geo = new PlaneGeometry(1, 1, 5, 5)
    const idx = geo.index!
    const count = geo.getAttribute('position')!.count
    for (let i = 0; i < idx.count; i++) {
      expect(idx.getX(i)).toBeLessThan(count)
    }
  })

  it('has corner UVs at 0 and 1', () => {
    const geo = new PlaneGeometry(1, 1, 1, 1)
    const uv = geo.getAttribute('uv')!
    // ix/widthSegments in {0,1}, 1 - iy/heightSegments in {0,1}
    for (let i = 0; i < uv.count; i++) {
      expect([0, 1]).toContain(uv.getX(i))
      expect([0, 1]).toContain(uv.getY(i))
    }
  })

  it('clone is independent', () => {
    const geo = new PlaneGeometry(2, 2, 2, 2)
    const copy = geo.clone()
    copy.getAttribute('position')!.setX(0, 123)
    expect(geo.getAttribute('position')!.getX(0)).not.toBe(123)
  })
})
