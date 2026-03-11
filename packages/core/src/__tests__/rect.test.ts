import { describe, it, expect } from 'vitest'
import { Rect } from '../math/rect'
import { Vec2 } from '../math/vec2'

describe('Rect', () => {
  describe('constructor', () => {
    it('stores x, y, width, height', () => {
      const r = new Rect(10, 20, 30, 40)
      expect(r.x).toBe(10)
      expect(r.y).toBe(20)
      expect(r.width).toBe(30)
      expect(r.height).toBe(40)
    })
  })

  describe('edge getters', () => {
    it('computes left (x - width/2)', () => {
      expect(new Rect(10, 0, 20, 10).left).toBe(0)
    })

    it('computes right (x + width/2)', () => {
      expect(new Rect(10, 0, 20, 10).right).toBe(20)
    })

    it('computes top (y - height/2)', () => {
      expect(new Rect(0, 10, 10, 20).top).toBe(0)
    })

    it('computes bottom (y + height/2)', () => {
      expect(new Rect(0, 10, 10, 20).bottom).toBe(20)
    })

    it('handles zero-size rect', () => {
      const r = new Rect(5, 5, 0, 0)
      expect(r.left).toBe(5)
      expect(r.right).toBe(5)
      expect(r.top).toBe(5)
      expect(r.bottom).toBe(5)
    })
  })

  describe('contains', () => {
    const rect = new Rect(50, 50, 20, 20) // left=40, right=60, top=40, bottom=60

    it('returns true for a point inside', () => {
      expect(rect.contains(new Vec2(50, 50))).toBe(true)
    })

    it('returns true for a point on the left edge', () => {
      expect(rect.contains(new Vec2(40, 50))).toBe(true)
    })

    it('returns true for a point on the right edge', () => {
      expect(rect.contains(new Vec2(60, 50))).toBe(true)
    })

    it('returns true for a point on the top edge', () => {
      expect(rect.contains(new Vec2(50, 40))).toBe(true)
    })

    it('returns true for a point on the bottom edge', () => {
      expect(rect.contains(new Vec2(50, 60))).toBe(true)
    })

    it('returns false for a point outside left', () => {
      expect(rect.contains(new Vec2(39, 50))).toBe(false)
    })

    it('returns false for a point outside right', () => {
      expect(rect.contains(new Vec2(61, 50))).toBe(false)
    })

    it('returns false for a point outside top', () => {
      expect(rect.contains(new Vec2(50, 39))).toBe(false)
    })

    it('returns false for a point outside bottom', () => {
      expect(rect.contains(new Vec2(50, 61))).toBe(false)
    })

    it('returns true for corner point', () => {
      expect(rect.contains(new Vec2(40, 40))).toBe(true)
    })
  })

  describe('intersects', () => {
    const rect = new Rect(50, 50, 20, 20)

    it('returns true for overlapping rects', () => {
      const other = new Rect(55, 55, 20, 20)
      expect(rect.intersects(other)).toBe(true)
    })

    it('returns true for fully contained rect', () => {
      const inner = new Rect(50, 50, 5, 5)
      expect(rect.intersects(inner)).toBe(true)
    })

    it('returns false for non-overlapping rects (separated on X)', () => {
      const other = new Rect(100, 50, 20, 20)
      expect(rect.intersects(other)).toBe(false)
    })

    it('returns false for non-overlapping rects (separated on Y)', () => {
      const other = new Rect(50, 100, 20, 20)
      expect(rect.intersects(other)).toBe(false)
    })

    it('returns false for touching edges (not overlapping)', () => {
      // rect right=60, other left=60 → not overlapping (strict </>)
      const other = new Rect(80, 50, 20, 20) // left=70
      expect(rect.intersects(other)).toBe(false)
    })

    it('is commutative', () => {
      const other = new Rect(55, 55, 20, 20)
      expect(rect.intersects(other)).toBe(other.intersects(rect))
    })
  })

  describe('clone', () => {
    it('creates an independent copy', () => {
      const a = new Rect(1, 2, 3, 4)
      const b = a.clone()
      expect(b.x).toBe(1)
      expect(b.y).toBe(2)
      expect(b.width).toBe(3)
      expect(b.height).toBe(4)
      b.x = 99
      expect(a.x).toBe(1)
    })
  })
})
