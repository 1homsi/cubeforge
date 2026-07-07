import { describe, it, expect } from 'vitest'
import { TorusGeometry } from '../geometry'

describe('TorusGeometry', () => {
  it('produces (radialSegments+1)*(tubularSegments+1) vertices', () => {
    const geo = new TorusGeometry(1, 0.4, 12, 48)
    expect(geo.getAttribute('position')!.count).toBe((12 + 1) * (48 + 1))
  })

  it('produces radialSegments*tubularSegments*6 indices', () => {
    const geo = new TorusGeometry(1, 0.4, 12, 48)
    expect(geo.index!.count).toBe(12 * 48 * 6)
  })

  it('has correct attribute item sizes', () => {
    const geo = new TorusGeometry()
    expect(geo.getAttribute('position')!.itemSize).toBe(3)
    expect(geo.getAttribute('normal')!.itemSize).toBe(3)
    expect(geo.getAttribute('uv')!.itemSize).toBe(2)
  })

  it('keeps every vertex within tube distance of the ring', () => {
    const radius = 2
    const tube = 0.5
    const geo = new TorusGeometry(radius, tube, 16, 32)
    const p = geo.getAttribute('position')!
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      const z = p.getZ(i)
      // distance from the central ring in the XY plane
      const ringDist = Math.hypot(x, y) - radius
      const d = Math.hypot(ringDist, z)
      expect(d).toBeCloseTo(tube)
    }
  })

  it('bounding box spans +-(radius+tube) in x/y and +-tube in z', () => {
    const radius = 2
    const tube = 0.5
    const geo = new TorusGeometry(radius, tube, 16, 32)
    geo.computeBoundingBox()
    expect(geo.boundingBox!.max.x).toBeCloseTo(radius + tube)
    expect(geo.boundingBox!.min.x).toBeCloseTo(-(radius + tube))
    expect(geo.boundingBox!.max.z).toBeCloseTo(tube)
    expect(geo.boundingBox!.min.z).toBeCloseTo(-tube)
  })

  it('has unit-length normals', () => {
    const geo = new TorusGeometry(1, 0.4, 12, 24)
    const n = geo.getAttribute('normal')!
    for (let i = 0; i < n.count; i++) {
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1)
    }
  })

  it('references only valid vertex indices', () => {
    const geo = new TorusGeometry(1, 0.4, 8, 16)
    const idx = geo.index!
    const count = geo.getAttribute('position')!.count
    for (let i = 0; i < idx.count; i++) {
      expect(idx.getX(i)).toBeLessThan(count)
    }
  })

  it('UVs stay within [0,1]', () => {
    const geo = new TorusGeometry(1, 0.4, 8, 16)
    const uv = geo.getAttribute('uv')!
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0)
      expect(uv.getX(i)).toBeLessThanOrEqual(1)
      expect(uv.getY(i)).toBeGreaterThanOrEqual(0)
      expect(uv.getY(i)).toBeLessThanOrEqual(1)
    }
  })

  it('scales counts with segment parameters', () => {
    const low = new TorusGeometry(1, 0.4, 6, 12)
    const high = new TorusGeometry(1, 0.4, 12, 48)
    expect(high.getAttribute('position')!.count).toBeGreaterThan(low.getAttribute('position')!.count)
  })

  it('clone is independent', () => {
    const geo = new TorusGeometry()
    const copy = geo.clone()
    copy.getAttribute('position')!.setX(0, 999)
    expect(geo.getAttribute('position')!.getX(0)).not.toBe(999)
  })
})
