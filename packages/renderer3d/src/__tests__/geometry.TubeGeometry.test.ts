import { describe, it, expect } from 'vitest'
import { TubeGeometry } from '../geometry'
import { Vec3 } from '../math'

// A straight path along +Z.
function straightPath(): Vec3[] {
  return [new Vec3(0, 0, 0), new Vec3(0, 0, 1), new Vec3(0, 0, 2), new Vec3(0, 0, 3)]
}

describe('TubeGeometry', () => {
  it('throws when given fewer than 2 path points', () => {
    expect(() => new TubeGeometry([new Vec3(0, 0, 0)])).toThrow()
  })

  it('produces (tubularSegments+1)*(radialSegments+1) vertices', () => {
    const tub = 16
    const rad = 8
    const geo = new TubeGeometry(straightPath(), tub, 1, rad)
    expect(geo.getAttribute('position')!.count).toBe((tub + 1) * (rad + 1))
  })

  it('produces tubularSegments*radialSegments*6 indices', () => {
    const tub = 16
    const rad = 8
    const geo = new TubeGeometry(straightPath(), tub, 1, rad)
    expect(geo.index!.count).toBe(tub * rad * 6)
  })

  it('has correct attribute item sizes', () => {
    const geo = new TubeGeometry(straightPath())
    expect(geo.getAttribute('position')!.itemSize).toBe(3)
    expect(geo.getAttribute('normal')!.itemSize).toBe(3)
    expect(geo.getAttribute('uv')!.itemSize).toBe(2)
  })

  it('keeps every vertex at tube radius from its path centerline (straight tube)', () => {
    const radius = 0.5
    const tub = 12
    const rad = 8
    const geo = new TubeGeometry(straightPath(), tub, radius, rad)
    const p = geo.getAttribute('position')!
    // For a straight tube along Z, the centerline for a ring is at the same z as the ring.
    for (let i = 0; i < p.count; i++) {
      const radialDist = Math.hypot(p.getX(i), p.getY(i)) // x,y offset from centerline on Z axis
      expect(radialDist).toBeCloseTo(radius)
    }
  })

  it('has unit-length cross-section normals', () => {
    const geo = new TubeGeometry(straightPath(), 12, 0.5, 8)
    const n = geo.getAttribute('normal')!
    for (let i = 0; i < n.count; i++) {
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1)
    }
  })

  it('references only valid vertex indices', () => {
    const geo = new TubeGeometry(straightPath(), 10, 0.5, 6)
    const idx = geo.index!
    const count = geo.getAttribute('position')!.count
    for (let i = 0; i < idx.count; i++) {
      expect(idx.getX(i)).toBeLessThan(count)
    }
  })

  it('spans the path length in z plus the tube radius', () => {
    const radius = 0.5
    const geo = new TubeGeometry(straightPath(), 16, radius, 8)
    geo.computeBoundingBox()
    expect(geo.boundingBox!.min.z).toBeCloseTo(0)
    expect(geo.boundingBox!.max.z).toBeCloseTo(3)
    // radial extent
    expect(geo.boundingBox!.max.x).toBeCloseTo(radius)
    expect(geo.boundingBox!.min.x).toBeCloseTo(-radius)
  })

  it('UVs stay within [0,1]', () => {
    const geo = new TubeGeometry(straightPath(), 8, 0.5, 6)
    const uv = geo.getAttribute('uv')!
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0)
      expect(uv.getX(i)).toBeLessThanOrEqual(1)
      expect(uv.getY(i)).toBeGreaterThanOrEqual(0)
      expect(uv.getY(i)).toBeLessThanOrEqual(1)
    }
  })

  it('clone is independent', () => {
    const geo = new TubeGeometry(straightPath(), 8, 0.5, 6)
    const copy = geo.clone()
    copy.getAttribute('position')!.setX(0, 999)
    expect(geo.getAttribute('position')!.getX(0)).not.toBe(999)
  })
})
