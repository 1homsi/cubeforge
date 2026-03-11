import { describe, it, expect, beforeEach } from 'vitest'
import { SweepAndPrune } from '../broadPhase'
import type { BroadPhaseAABB, BroadPhasePair } from '../broadPhase'
import type { EntityId } from '@cubeforge/core'

function aabb(entityId: number, minX: number, maxX: number, minY: number, maxY: number): BroadPhaseAABB {
  return { entityId: entityId as EntityId, minX, maxX, minY, maxY }
}

function pairSet(pairs: BroadPhasePair[]): Set<string> {
  return new Set(
    pairs.map((p) => {
      const a = Math.min(p.entityA, p.entityB)
      const b = Math.max(p.entityA, p.entityB)
      return `${a}:${b}`
    }),
  )
}

describe('SweepAndPrune', () => {
  let sap: SweepAndPrune

  beforeEach(() => {
    sap = new SweepAndPrune()
  })

  describe('empty state', () => {
    it('query returns empty array initially', () => {
      expect(sap.query()).toEqual([])
    })

    it('update with empty array returns no pairs', () => {
      sap.update([])
      expect(sap.query()).toEqual([])
    })
  })

  describe('non-overlapping entities', () => {
    it('returns no pairs for separated AABBs', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 20, 30, 0, 10)])
      expect(sap.query()).toEqual([])
    })

    it('returns no pairs when separated on Y', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 0, 10, 20, 30)])
      expect(sap.query()).toEqual([])
    })
  })

  describe('overlapping entities', () => {
    it('detects X and Y overlap', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 5, 15)])
      const pairs = sap.query()
      expect(pairs).toHaveLength(1)
      const ps = pairSet(pairs)
      expect(ps.has('0:1')).toBe(true)
    })

    it('detects fully contained AABB', () => {
      sap.update([aabb(0, 0, 100, 0, 100), aabb(1, 10, 20, 10, 20)])
      const pairs = sap.query()
      expect(pairs).toHaveLength(1)
    })

    it('detects multiple overlapping pairs', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 5, 15), aabb(2, 8, 18, 8, 18)])
      const ps = pairSet(sap.query())
      expect(ps.has('0:1')).toBe(true)
      expect(ps.has('1:2')).toBe(true)
      expect(ps.has('0:2')).toBe(true)
    })
  })

  describe('update with movement', () => {
    it('detects new overlap after entities move together', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 20, 30, 0, 10)])
      expect(sap.query()).toEqual([])

      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 0, 10)])
      expect(sap.query()).toHaveLength(1)
    })

    it('removes overlap after entities separate', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 5, 15)])
      expect(sap.query()).toHaveLength(1)

      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 50, 60, 50, 60)])
      expect(sap.query()).toEqual([])
    })

    it('updates pairs correctly when an entity teleports across the axis', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 0, 10), aabb(2, 30, 40, 0, 10)])
      expect(pairSet(sap.query())).toEqual(new Set(['0:1']))

      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 35, 45, 0, 10), aabb(2, 30, 40, 0, 10)])
      expect(pairSet(sap.query())).toEqual(new Set(['1:2']))
    })

    it('removes stale pairs when an entity changes Y overlap only', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 5, 15)])
      expect(sap.query()).toHaveLength(1)

      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 20, 30)])
      expect(sap.query()).toEqual([])
    })
  })

  describe('entity removal', () => {
    it('remove() removes entity and its pairs', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 5, 15)])
      expect(sap.query()).toHaveLength(1)

      sap.remove(1 as EntityId)
      expect(sap.query()).toEqual([])
    })

    it('remove() is safe for unknown entities', () => {
      expect(() => sap.remove(999 as EntityId)).not.toThrow()
    })

    it('entities absent from update are auto-removed', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 5, 15)])
      expect(sap.query()).toHaveLength(1)

      // Only entity 0 remains
      sap.update([aabb(0, 0, 10, 0, 10)])
      expect(sap.query()).toEqual([])
    })

    it('remove() preserves unrelated pairs', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 0, 10), aabb(2, 20, 30, 0, 10), aabb(3, 25, 35, 0, 10)])

      sap.remove(0 as EntityId)

      expect(pairSet(sap.query())).toEqual(new Set(['2:3']))
    })
  })

  describe('clear', () => {
    it('clears all state', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 5, 15)])
      sap.clear()
      expect(sap.query()).toEqual([])
    })
  })

  describe('single entity', () => {
    it('no pairs with one entity', () => {
      sap.update([aabb(0, 0, 10, 0, 10)])
      expect(sap.query()).toEqual([])
    })
  })

  describe('caching', () => {
    it('query returns same result when called twice without update', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 5, 15)])
      const r1 = sap.query()
      const r2 = sap.query()
      expect(r1).toBe(r2) // same reference
    })

    it('query returns a new cached array after update', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 5, 15)])
      const r1 = sap.query()

      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 50, 60, 50, 60)])
      const r2 = sap.query()

      expect(r2).toBe(r1)
      expect(r2).toEqual([])
    })
  })

  describe('edge cases', () => {
    it('handles touching edges (not overlapping) on X', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 10, 20, 0, 10)])
      expect(sap.query()).toEqual([])
    })

    it('handles touching edges on Y as overlap', () => {
      sap.update([aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 10, 20)])
      expect(pairSet(sap.query())).toEqual(new Set(['0:1']))
    })

    it('handles identical AABBs', () => {
      sap.update([aabb(0, 5, 15, 5, 15), aabb(1, 5, 15, 5, 15)])
      expect(sap.query()).toHaveLength(1)
    })

    it('does not duplicate pairs when updates repeat identical input', () => {
      const boxes = [aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 0, 10)]

      sap.update(boxes)
      sap.update(boxes)

      expect(sap.query()).toHaveLength(1)
      expect(pairSet(sap.query())).toEqual(new Set(['0:1']))
    })

    it('does not create self-pairs for degenerate AABBs', () => {
      sap.update([aabb(7, 10, 10, 10, 10)])
      expect(sap.query()).toEqual([])
    })

    it('handles negative coordinates', () => {
      sap.update([aabb(0, -20, -10, -20, -10), aabb(1, -15, -5, -15, -5)])
      expect(pairSet(sap.query())).toEqual(new Set(['0:1']))
    })

    it('reports only overlapping combinations in mixed sets', () => {
      sap.update([
        aabb(0, 0, 10, 0, 10),
        aabb(1, 2, 8, 2, 8),
        aabb(2, 20, 30, 0, 10),
        aabb(3, 22, 28, 2, 8),
        aabb(4, 40, 50, 40, 50),
      ])

      expect(pairSet(sap.query())).toEqual(new Set(['0:1', '2:3']))
    })

    it('handles endpoints arriving out of order in the input array', () => {
      sap.update([aabb(2, 20, 30, 0, 10), aabb(0, 0, 10, 0, 10), aabb(1, 5, 15, 0, 10)])

      expect(pairSet(sap.query())).toEqual(new Set(['0:1']))
    })

    it('handles many entities', () => {
      const boxes = Array.from({ length: 50 }, (_, i) => aabb(i, i * 5, i * 5 + 10, 0, 10))
      sap.update(boxes)
      // Should not throw and should return some pairs (overlapping by 5 units)
      const pairs = sap.query()
      expect(pairs.length).toBeGreaterThan(0)
    })

    it('keeps pair ordering canonical regardless of input order', () => {
      sap.update([aabb(9, 0, 10, 0, 10), aabb(3, 5, 15, 0, 10)])

      expect(sap.query()).toEqual([{ entityA: 3 as EntityId, entityB: 9 as EntityId }])
    })
  })
})
