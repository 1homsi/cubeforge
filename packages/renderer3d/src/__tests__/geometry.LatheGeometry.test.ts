import { describe, it, expect } from 'vitest'
import { LatheGeometry } from '../geometry'
import { Vec3 } from '../math'

// A vertical profile at radius 1 from y=0 to y=1 -> revolves into a cylinder shell.
function cylinderProfile(): Vec3[] {
  return [new Vec3(1, 0, 0), new Vec3(1, 0.5, 0), new Vec3(1, 1, 0)]
}

describe('LatheGeometry', () => {
  it('throws when given fewer than 2 profile points', () => {
    expect(() => new LatheGeometry([new Vec3(1, 0, 0)])).toThrow()
  })

  it('produces (segments+1)*profileCount vertices', () => {
    const segments = 12
    const profile = cylinderProfile()
    const geo = new LatheGeometry(profile, segments)
    expect(geo.getAttribute('position')!.count).toBe((segments + 1) * profile.length)
  })

  it('produces segments*(profileCount-1)*6 indices', () => {
    const segments = 8
    const profile = cylinderProfile()
    const geo = new LatheGeometry(profile, segments)
    expect(geo.index!.count).toBe(segments * (profile.length - 1) * 6)
  })

  it('has correct attribute item sizes', () => {
    const geo = new LatheGeometry(cylinderProfile())
    expect(geo.getAttribute('position')!.itemSize).toBe(3)
    expect(geo.getAttribute('normal')!.itemSize).toBe(3)
    expect(geo.getAttribute('uv')!.itemSize).toBe(2)
  })

  it('revolves the profile radius around the Y axis', () => {
    const geo = new LatheGeometry(cylinderProfile(), 16)
    const p = geo.getAttribute('position')!
    for (let i = 0; i < p.count; i++) {
      // radius is 1 for every profile point
      expect(Math.hypot(p.getX(i), p.getZ(i))).toBeCloseTo(1)
    }
  })

  it('spans the profile Y range', () => {
    const geo = new LatheGeometry(cylinderProfile(), 16)
    geo.computeBoundingBox()
    expect(geo.boundingBox!.min.y).toBeCloseTo(0)
    expect(geo.boundingBox!.max.y).toBeCloseTo(1)
  })

  it('has unit-length normals', () => {
    const geo = new LatheGeometry(cylinderProfile(), 16)
    const n = geo.getAttribute('normal')!
    for (let i = 0; i < n.count; i++) {
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1)
    }
  })

  it('references only valid vertex indices', () => {
    const geo = new LatheGeometry(cylinderProfile(), 10)
    const idx = geo.index!
    const count = geo.getAttribute('position')!.count
    for (let i = 0; i < idx.count; i++) {
      expect(idx.getX(i)).toBeLessThan(count)
    }
  })

  it('bounding box x/z span the profile radius', () => {
    const geo = new LatheGeometry(cylinderProfile(), 32)
    geo.computeBoundingBox()
    expect(geo.boundingBox!.max.x).toBeCloseTo(1)
    expect(geo.boundingBox!.min.x).toBeCloseTo(-1)
  })

  it('clone is independent', () => {
    const geo = new LatheGeometry(cylinderProfile(), 8)
    const copy = geo.clone()
    copy.getAttribute('position')!.setX(0, 999)
    expect(geo.getAttribute('position')!.getX(0)).not.toBe(999)
  })
})
