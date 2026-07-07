import { describe, it, expect } from 'vitest'
import { TerrainGeometry } from '../geometry'

const OPTS = { width: 8, height: 8, widthSegments: 4, heightSegments: 4, maxElevation: 10 }

describe('TerrainGeometry', () => {
  it('produces (wSeg+1)*(hSeg+1) vertices and wSeg*hSeg*6 indices', () => {
    const geo = new TerrainGeometry(null, OPTS)
    expect(geo.getAttribute('position')!.count).toBe(5 * 5)
    expect(geo.getAttribute('uv')!.count).toBe(5 * 5)
    expect(geo.index!.count).toBe(4 * 4 * 6)
  })

  it('has correct attribute item sizes', () => {
    const geo = new TerrainGeometry(null, OPTS)
    expect(geo.getAttribute('position')!.itemSize).toBe(3)
    expect(geo.getAttribute('normal')!.itemSize).toBe(3)
    expect(geo.getAttribute('uv')!.itemSize).toBe(2)
    expect(geo.index!.itemSize).toBe(1)
  })

  it('throws when heightData length does not match the grid', () => {
    expect(() => new TerrainGeometry(new Float32Array(10), OPTS)).toThrow()
  })

  it('is flat (y = 0) when built from null height data', () => {
    const geo = new TerrainGeometry(null, OPTS)
    const p = geo.getAttribute('position')!
    for (let i = 0; i < p.count; i++) {
      expect(p.getY(i)).toBe(0)
    }
    expect(geo.getHeightAt(0, 0)).toBe(0)
  })

  it('flat terrain has all normals pointing up', () => {
    const geo = new TerrainGeometry(null, OPTS)
    const n = geo.getAttribute('normal')!
    for (let i = 0; i < n.count; i++) {
      expect(n.getX(i)).toBeCloseTo(0)
      expect(n.getY(i)).toBeCloseTo(1)
      expect(n.getZ(i)).toBeCloseTo(0)
    }
  })

  it('scales height data by maxElevation', () => {
    const data = new Float32Array(25).fill(1)
    const geo = new TerrainGeometry(data, OPTS)
    const p = geo.getAttribute('position')!
    for (let i = 0; i < p.count; i++) {
      expect(p.getY(i)).toBeCloseTo(10)
    }
    expect(geo.getHeightAt(0, 0)).toBeCloseTo(10)
  })

  it('spans -w/2..w/2 in x and -h/2..h/2 in z', () => {
    const geo = new TerrainGeometry(null, OPTS)
    geo.computeBoundingBox()
    expect(geo.boundingBox!.min.x).toBeCloseTo(-4)
    expect(geo.boundingBox!.max.x).toBeCloseTo(4)
    expect(geo.boundingBox!.min.z).toBeCloseTo(-4)
    expect(geo.boundingBox!.max.z).toBeCloseTo(4)
  })

  it('exposes its configured dimensions', () => {
    const geo = new TerrainGeometry(null, OPTS)
    expect(geo.terrainWidth).toBe(8)
    expect(geo.terrainHeight).toBe(8)
    expect(geo.widthSegments).toBe(4)
    expect(geo.heightSegments).toBe(4)
    expect(geo.maxElevation).toBe(10)
  })

  it('updateRegion changes the interpolated height', () => {
    const geo = new TerrainGeometry(null, OPTS)
    expect(geo.getHeightAt(0, 0)).toBe(0)
    // Raise the whole grid to full height
    geo.updateRegion(0, 0, 4, 4, new Float32Array(25).fill(1))
    expect(geo.getHeightAt(0, 0)).toBeCloseTo(10)
  })

  it('procedural terrain stays within [0, maxElevation] and is seed-deterministic', () => {
    const a = TerrainGeometry.procedural({ ...OPTS, seed: 7 })
    const b = TerrainGeometry.procedural({ ...OPTS, seed: 7 })
    const pa = a.getAttribute('position')!
    const pb = b.getAttribute('position')!
    for (let i = 0; i < pa.count; i++) {
      expect(pa.getY(i)).toBeGreaterThanOrEqual(-1e-5)
      expect(pa.getY(i)).toBeLessThanOrEqual(10 + 1e-5)
      expect(pa.getY(i)).toBeCloseTo(pb.getY(i)) // deterministic
    }
  })

  it('references only valid vertex indices', () => {
    const geo = new TerrainGeometry(null, OPTS)
    const idx = geo.index!
    const count = geo.getAttribute('position')!.count
    for (let i = 0; i < idx.count; i++) {
      expect(idx.getX(i)).toBeLessThan(count)
    }
  })
})
