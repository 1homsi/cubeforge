import { describe, it, expect } from 'vitest'
import { SphereGeometry } from '../geometry'

describe('SphereGeometry', () => {
  it('produces (widthSegments+1)*(heightSegments+1) vertices', () => {
    const geo = new SphereGeometry(1, 32, 16)
    expect(geo.getAttribute('position')!.count).toBe((32 + 1) * (16 + 1))
  })

  it('clamps segments to sane minimums', () => {
    const geo = new SphereGeometry(1, 1, 1)
    // widthSegments >= 3, heightSegments >= 2 -> (3+1)*(2+1) = 12
    expect(geo.getAttribute('position')!.count).toBe(4 * 3)
  })

  it('has correct attribute item sizes', () => {
    const geo = new SphereGeometry()
    expect(geo.getAttribute('position')!.itemSize).toBe(3)
    expect(geo.getAttribute('normal')!.itemSize).toBe(3)
    expect(geo.getAttribute('uv')!.itemSize).toBe(2)
    expect(geo.index!.itemSize).toBe(1)
  })

  it('places all vertices on the sphere surface (|p| = radius)', () => {
    const radius = 2.5
    const geo = new SphereGeometry(radius, 24, 12)
    const p = geo.getAttribute('position')!
    for (let i = 0; i < p.count; i++) {
      expect(Math.hypot(p.getX(i), p.getY(i), p.getZ(i))).toBeCloseTo(radius)
    }
  })

  it('has unit-length normals equal to normalized positions', () => {
    const radius = 3
    const geo = new SphereGeometry(radius, 16, 8)
    const n = geo.getAttribute('normal')!
    const p = geo.getAttribute('position')!
    for (let i = 0; i < n.count; i++) {
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1)
      // normal should be position/radius
      expect(n.getX(i)).toBeCloseTo(p.getX(i) / radius)
    }
  })

  it('bounding box spans -r..r on all axes', () => {
    const geo = new SphereGeometry(2, 32, 16)
    geo.computeBoundingBox()
    expect(geo.boundingBox!.min.x).toBeCloseTo(-2)
    expect(geo.boundingBox!.max.x).toBeCloseTo(2)
    expect(geo.boundingBox!.min.y).toBeCloseTo(-2)
    expect(geo.boundingBox!.max.y).toBeCloseTo(2)
  })

  it('bounding sphere radius equals the geometry radius', () => {
    const geo = new SphereGeometry(1.5, 32, 16)
    geo.computeBoundingSphere()
    expect(geo.boundingSphere!.radius).toBeCloseTo(1.5)
  })

  it('references only valid vertex indices', () => {
    const geo = new SphereGeometry(1, 12, 8)
    const idx = geo.index!
    const count = geo.getAttribute('position')!.count
    for (let i = 0; i < idx.count; i++) {
      expect(idx.getX(i)).toBeLessThan(count)
    }
  })

  it('increases vertex count with more segments', () => {
    const low = new SphereGeometry(1, 8, 6)
    const high = new SphereGeometry(1, 32, 16)
    expect(high.getAttribute('position')!.count).toBeGreaterThan(low.getAttribute('position')!.count)
  })

  it('clone is independent', () => {
    const geo = new SphereGeometry(1, 8, 6)
    const copy = geo.clone()
    copy.getAttribute('position')!.setX(0, 999)
    expect(geo.getAttribute('position')!.getX(0)).not.toBe(999)
  })
})
