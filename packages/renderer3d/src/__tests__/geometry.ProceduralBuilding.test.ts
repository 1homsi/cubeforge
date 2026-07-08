import { describe, it, expect } from 'vitest'
import { ProceduralBuilding } from '../geometry'

function allIndicesValid(geo: ProceduralBuilding): boolean {
  const idx = geo.index!
  const count = geo.getAttribute('position')!.count
  for (let i = 0; i < idx.count; i++) {
    if (idx.getX(i) >= count) return false
  }
  return true
}

describe('ProceduralBuilding', () => {
  it('generates position, normal, uv attributes and an index', () => {
    const b = new ProceduralBuilding()
    expect(b.getAttribute('position')!.itemSize).toBe(3)
    expect(b.getAttribute('normal')!.itemSize).toBe(3)
    expect(b.getAttribute('uv')!.itemSize).toBe(2)
    expect(b.index).not.toBeNull()
    expect(b.getAttribute('position')!.count).toBeGreaterThan(0)
  })

  it('has matching normal and position counts', () => {
    const b = new ProceduralBuilding()
    expect(b.getAttribute('normal')!.count).toBe(b.getAttribute('position')!.count)
    expect(b.getAttribute('uv')!.count).toBe(b.getAttribute('position')!.count)
  })

  it('references only valid vertex indices', () => {
    const b = new ProceduralBuilding({ width: 10, depth: 8, numFloors: 3, roofStyle: 'gabled' })
    expect(allIndicesValid(b)).toBe(true)
  })

  it('creates draw groups by material index', () => {
    const b = new ProceduralBuilding({ addWindows: true, addDoor: true, roofStyle: 'flat' })
    expect(b.groups.length).toBeGreaterThan(0)
    const materials = new Set(b.groups.map((g) => g.materialIndex))
    // walls (0), roof (1), windows (2), door (3) should be present
    expect(materials.has(0)).toBe(true)
    expect(materials.has(1)).toBe(true)
    expect(materials.has(2)).toBe(true)
    expect(materials.has(3)).toBe(true)
  })

  it('group index ranges sum to the total index count', () => {
    const b = new ProceduralBuilding()
    const total = b.groups.reduce((s, g) => s + g.count, 0)
    expect(total).toBe(b.index!.count)
  })

  it('taller buildings (more floors) produce more geometry', () => {
    const small = new ProceduralBuilding({ numFloors: 1, addWindows: false })
    const big = new ProceduralBuilding({ numFloors: 5, addWindows: false })
    expect(big.getAttribute('position')!.count).toBeGreaterThan(small.getAttribute('position')!.count)
  })

  it('rebuild replaces geometry and keeps indices valid', () => {
    const b = new ProceduralBuilding({ numFloors: 1, roofStyle: 'flat' })
    const before = b.getAttribute('position')!.count
    b.rebuild({ numFloors: 4, roofStyle: 'pyramid' })
    expect(b.getAttribute('position')!.count).not.toBe(before)
    expect(allIndicesValid(b)).toBe(true)
  })

  it('supports all roof styles without producing invalid geometry', () => {
    for (const roofStyle of ['flat', 'gabled', 'hipped', 'dome', 'pyramid'] as const) {
      const b = new ProceduralBuilding({ roofStyle, numFloors: 2 })
      expect(b.getAttribute('position')!.count).toBeGreaterThan(0)
      expect(allIndicesValid(b)).toBe(true)
    }
  })

  it('static presets build valid geometry', () => {
    const house = ProceduralBuilding.house(3)
    const tower = ProceduralBuilding.tower(30, 5)
    const warehouse = ProceduralBuilding.warehouse(20, 12, 7)
    for (const b of [house, tower, warehouse]) {
      expect(b.getAttribute('position')!.count).toBeGreaterThan(0)
      expect(allIndicesValid(b)).toBe(true)
    }
  })

  it('is seed-deterministic for house preset', () => {
    const a = ProceduralBuilding.house(42)
    const b = ProceduralBuilding.house(42)
    expect(a.getAttribute('position')!.count).toBe(b.getAttribute('position')!.count)
    const pa = a.getAttribute('position')!
    const pb = b.getAttribute('position')!
    expect(pa.getX(10)).toBeCloseTo(pb.getX(10))
  })

  it('explicit floors override simple-mode dimensions', () => {
    const b = new ProceduralBuilding({
      floors: [
        { width: 10, depth: 10, height: 3 },
        { width: 6, depth: 6, height: 3, offset: { x: 1, z: 0 } },
      ],
      roofStyle: 'flat',
    })
    b.computeBoundingBox()
    // widest floor is 10 wide -> spans at least -5..5 in x
    expect(b.boundingBox!.min.x).toBeLessThanOrEqual(-4.9)
    expect(b.boundingBox!.max.x).toBeGreaterThanOrEqual(4.9)
  })
})
