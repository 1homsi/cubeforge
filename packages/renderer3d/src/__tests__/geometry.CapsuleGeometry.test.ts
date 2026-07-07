import { describe, it, expect } from 'vitest'
import { CapsuleGeometry } from '../geometry'

// vertexCount = 2 poles + (2*capSegments + 2 equator rings) * (radialSegments + 1)
function expectedVertexCount(capSegments: number, radialSegments: number): number {
  return 2 + (2 * capSegments + 2) * (radialSegments + 1)
}

describe('CapsuleGeometry', () => {
  it('produces the expected vertex count', () => {
    const geo = new CapsuleGeometry(0.5, 1, 4, 8)
    expect(geo.getAttribute('position')!.count).toBe(expectedVertexCount(4, 8))
  })

  it('has correct attribute item sizes', () => {
    const geo = new CapsuleGeometry()
    expect(geo.getAttribute('position')!.itemSize).toBe(3)
    expect(geo.getAttribute('normal')!.itemSize).toBe(3)
    expect(geo.getAttribute('uv')!.itemSize).toBe(2)
    expect(geo.index!.itemSize).toBe(1)
  })

  it('spans -(length/2 + radius)..(length/2 + radius) in y', () => {
    const radius = 0.5
    const length = 2
    const geo = new CapsuleGeometry(radius, length, 4, 8)
    geo.computeBoundingBox()
    expect(geo.boundingBox!.min.y).toBeCloseTo(-(length / 2 + radius))
    expect(geo.boundingBox!.max.y).toBeCloseTo(length / 2 + radius)
  })

  it('keeps all vertices within radius of the central Y axis', () => {
    const radius = 0.75
    const geo = new CapsuleGeometry(radius, 1.5, 5, 10)
    const p = geo.getAttribute('position')!
    for (let i = 0; i < p.count; i++) {
      expect(Math.hypot(p.getX(i), p.getZ(i))).toBeLessThanOrEqual(radius + 1e-5)
    }
  })

  it('has unit-length normals', () => {
    const geo = new CapsuleGeometry(0.5, 1, 4, 8)
    const n = geo.getAttribute('normal')!
    for (let i = 0; i < n.count; i++) {
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1)
    }
  })

  it('places the poles on the Y axis at the extremes', () => {
    const radius = 0.5
    const length = 1
    const geo = new CapsuleGeometry(radius, length, 4, 8)
    const p = geo.getAttribute('position')!
    // First vertex is the bottom pole
    expect(p.getX(0)).toBeCloseTo(0)
    expect(p.getY(0)).toBeCloseTo(-(length / 2 + radius))
    expect(p.getZ(0)).toBeCloseTo(0)
    // Last vertex is the top pole
    const last = p.count - 1
    expect(p.getY(last)).toBeCloseTo(length / 2 + radius)
  })

  it('references only valid vertex indices', () => {
    const geo = new CapsuleGeometry(0.5, 1, 4, 8)
    const idx = geo.index!
    const count = geo.getAttribute('position')!.count
    for (let i = 0; i < idx.count; i++) {
      expect(idx.getX(i)).toBeLessThan(count)
    }
  })

  it('produces indices in multiples of 3 (whole triangles)', () => {
    const geo = new CapsuleGeometry(0.5, 1, 4, 8)
    expect(geo.index!.count % 3).toBe(0)
  })

  it('increases vertex count with more segments', () => {
    const low = new CapsuleGeometry(0.5, 1, 2, 4)
    const high = new CapsuleGeometry(0.5, 1, 6, 12)
    expect(high.getAttribute('position')!.count).toBeGreaterThan(low.getAttribute('position')!.count)
  })

  it('clone is independent', () => {
    const geo = new CapsuleGeometry()
    const copy = geo.clone()
    copy.getAttribute('position')!.setX(0, 999)
    expect(geo.getAttribute('position')!.getX(0)).not.toBe(999)
  })
})
