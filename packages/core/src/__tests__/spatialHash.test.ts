import { describe, it, expect, beforeEach } from 'vitest'
import { SpatialHash } from '../spatialHash'

describe('SpatialHash', () => {
  let grid: SpatialHash

  beforeEach(() => {
    grid = new SpatialHash(64)
  })

  describe('insert / remove', () => {
    it('inserts an entity and tracks it', () => {
      grid.insert(1, 100, 100, 32, 32)
      expect(grid.size).toBe(1)
    })

    it('removes an entity', () => {
      grid.insert(1, 100, 100, 32, 32)
      grid.remove(1)
      expect(grid.size).toBe(0)
    })

    it('remove on non-existent entity does nothing', () => {
      expect(() => grid.remove(999)).not.toThrow()
      expect(grid.size).toBe(0)
    })
  })

  describe('queryRect', () => {
    it('finds entities in area', () => {
      grid.insert(1, 100, 100, 32, 32)
      grid.insert(2, 200, 200, 32, 32)
      const found = grid.queryRect(100, 100, 64, 64)
      expect(found).toContain(1)
    })

    it('does not find entities outside area', () => {
      grid.insert(1, 100, 100, 32, 32)
      grid.insert(2, 500, 500, 32, 32)
      const found = grid.queryRect(100, 100, 64, 64)
      expect(found).toContain(1)
      expect(found).not.toContain(2)
    })

    it('finds multiple entities in the same area', () => {
      grid.insert(1, 50, 50, 20, 20)
      grid.insert(2, 60, 60, 20, 20)
      const found = grid.queryRect(55, 55, 100, 100)
      expect(found).toContain(1)
      expect(found).toContain(2)
    })

    it('returns empty array when nothing is in area', () => {
      grid.insert(1, 1000, 1000, 10, 10)
      const found = grid.queryRect(0, 0, 10, 10)
      expect(found).toHaveLength(0)
    })
  })

  describe('entity update (re-insert)', () => {
    it('moves entity to new position on re-insert', () => {
      grid.insert(1, 100, 100, 32, 32)
      // Move entity far away
      grid.insert(1, 900, 900, 32, 32)

      expect(grid.size).toBe(1)
      // Should not be found at old position
      const oldArea = grid.queryRect(100, 100, 64, 64)
      expect(oldArea).not.toContain(1)
      // Should be found at new position
      const newArea = grid.queryRect(900, 900, 64, 64)
      expect(newArea).toContain(1)
    })
  })

  describe('queryCircle', () => {
    it('finds entities within radius bounding box', () => {
      grid.insert(1, 100, 100, 10, 10)
      const found = grid.queryCircle(100, 100, 50)
      expect(found).toContain(1)
    })
  })

  describe('clear', () => {
    it('removes all entities', () => {
      grid.insert(1, 10, 10, 20, 20)
      grid.insert(2, 50, 50, 20, 20)
      grid.insert(3, 90, 90, 20, 20)
      expect(grid.size).toBe(3)
      grid.clear()
      expect(grid.size).toBe(0)
      expect(grid.queryRect(0, 0, 200, 200)).toHaveLength(0)
    })
  })
})
