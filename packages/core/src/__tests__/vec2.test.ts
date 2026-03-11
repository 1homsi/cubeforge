import { describe, it, expect } from 'vitest'
import { Vec2 } from '../math/vec2'

describe('Vec2', () => {
  describe('constructor', () => {
    it('defaults to (0, 0)', () => {
      const v = new Vec2()
      expect(v.x).toBe(0)
      expect(v.y).toBe(0)
    })

    it('accepts x and y', () => {
      const v = new Vec2(3, 4)
      expect(v.x).toBe(3)
      expect(v.y).toBe(4)
    })

    it('accepts only x, y defaults to 0', () => {
      const v = new Vec2(5)
      expect(v.x).toBe(5)
      expect(v.y).toBe(0)
    })
  })

  describe('add', () => {
    it('adds two vectors', () => {
      const a = new Vec2(1, 2)
      const b = new Vec2(3, 4)
      const c = a.add(b)
      expect(c.x).toBe(4)
      expect(c.y).toBe(6)
    })

    it('does not mutate the original', () => {
      const a = new Vec2(1, 2)
      a.add(new Vec2(10, 20))
      expect(a.x).toBe(1)
      expect(a.y).toBe(2)
    })

    it('handles negative values', () => {
      const r = new Vec2(5, 3).add(new Vec2(-2, -1))
      expect(r.x).toBe(3)
      expect(r.y).toBe(2)
    })
  })

  describe('sub', () => {
    it('subtracts two vectors', () => {
      const r = new Vec2(5, 7).sub(new Vec2(2, 3))
      expect(r.x).toBe(3)
      expect(r.y).toBe(4)
    })

    it('does not mutate the original', () => {
      const a = new Vec2(5, 7)
      a.sub(new Vec2(1, 1))
      expect(a.x).toBe(5)
      expect(a.y).toBe(7)
    })
  })

  describe('scale', () => {
    it('scales by a positive factor', () => {
      const r = new Vec2(3, 4).scale(2)
      expect(r.x).toBe(6)
      expect(r.y).toBe(8)
    })

    it('scales by zero', () => {
      const r = new Vec2(3, 4).scale(0)
      expect(r.x).toBe(0)
      expect(r.y).toBe(0)
    })

    it('scales by a negative factor', () => {
      const r = new Vec2(3, 4).scale(-1)
      expect(r.x).toBe(-3)
      expect(r.y).toBe(-4)
    })

    it('scales by a fractional factor', () => {
      const r = new Vec2(10, 20).scale(0.5)
      expect(r.x).toBe(5)
      expect(r.y).toBe(10)
    })
  })

  describe('dot', () => {
    it('computes the dot product', () => {
      expect(new Vec2(1, 0).dot(new Vec2(0, 1))).toBe(0)
      expect(new Vec2(2, 3).dot(new Vec2(4, 5))).toBe(23)
    })

    it('returns positive for same-direction vectors', () => {
      expect(new Vec2(1, 0).dot(new Vec2(1, 0))).toBeGreaterThan(0)
    })

    it('returns negative for opposing vectors', () => {
      expect(new Vec2(1, 0).dot(new Vec2(-1, 0))).toBeLessThan(0)
    })
  })

  describe('lengthSq', () => {
    it('returns the squared length', () => {
      expect(new Vec2(3, 4).lengthSq()).toBe(25)
    })

    it('returns 0 for zero vector', () => {
      expect(new Vec2(0, 0).lengthSq()).toBe(0)
    })
  })

  describe('length', () => {
    it('returns the magnitude', () => {
      expect(new Vec2(3, 4).length()).toBe(5)
    })

    it('returns 0 for zero vector', () => {
      expect(new Vec2().length()).toBe(0)
    })

    it('returns 1 for unit vectors', () => {
      expect(new Vec2(1, 0).length()).toBe(1)
      expect(new Vec2(0, 1).length()).toBe(1)
    })
  })

  describe('normalize', () => {
    it('returns a unit vector', () => {
      const n = new Vec2(3, 4).normalize()
      expect(n.length()).toBeCloseTo(1)
      expect(n.x).toBeCloseTo(0.6)
      expect(n.y).toBeCloseTo(0.8)
    })

    it('returns zero vector when normalizing zero vector', () => {
      const n = new Vec2(0, 0).normalize()
      expect(n.x).toBe(0)
      expect(n.y).toBe(0)
    })

    it('does not mutate the original', () => {
      const v = new Vec2(3, 4)
      v.normalize()
      expect(v.x).toBe(3)
      expect(v.y).toBe(4)
    })
  })

  describe('clone', () => {
    it('creates an independent copy', () => {
      const a = new Vec2(1, 2)
      const b = a.clone()
      expect(b.x).toBe(1)
      expect(b.y).toBe(2)
      b.x = 99
      expect(a.x).toBe(1)
    })
  })

  describe('negate', () => {
    it('negates both components', () => {
      const r = new Vec2(3, -4).negate()
      expect(r.x).toBe(-3)
      expect(r.y).toBe(4)
    })

    it('negating zero returns zero', () => {
      const r = new Vec2(0, 0).negate()
      expect(r.x).toEqual(-0)
      expect(r.y).toEqual(-0)
    })
  })

  describe('lerp', () => {
    it('returns start at t=0', () => {
      const r = new Vec2(0, 0).lerp(new Vec2(10, 20), 0)
      expect(r.x).toBe(0)
      expect(r.y).toBe(0)
    })

    it('returns end at t=1', () => {
      const r = new Vec2(0, 0).lerp(new Vec2(10, 20), 1)
      expect(r.x).toBe(10)
      expect(r.y).toBe(20)
    })

    it('returns midpoint at t=0.5', () => {
      const r = new Vec2(0, 0).lerp(new Vec2(10, 20), 0.5)
      expect(r.x).toBe(5)
      expect(r.y).toBe(10)
    })

    it('does not mutate the original', () => {
      const a = new Vec2(0, 0)
      a.lerp(new Vec2(10, 10), 0.5)
      expect(a.x).toBe(0)
      expect(a.y).toBe(0)
    })
  })

  describe('addMut', () => {
    it('mutates in place and returns this', () => {
      const a = new Vec2(1, 2)
      const result = a.addMut(new Vec2(3, 4))
      expect(result).toBe(a)
      expect(a.x).toBe(4)
      expect(a.y).toBe(6)
    })
  })

  describe('subMut', () => {
    it('mutates in place and returns this', () => {
      const a = new Vec2(5, 7)
      const result = a.subMut(new Vec2(2, 3))
      expect(result).toBe(a)
      expect(a.x).toBe(3)
      expect(a.y).toBe(4)
    })
  })

  describe('scaleMut', () => {
    it('mutates in place and returns this', () => {
      const a = new Vec2(3, 4)
      const result = a.scaleMut(2)
      expect(result).toBe(a)
      expect(a.x).toBe(6)
      expect(a.y).toBe(8)
    })
  })

  describe('set', () => {
    it('sets x and y and returns this', () => {
      const a = new Vec2()
      const result = a.set(5, 10)
      expect(result).toBe(a)
      expect(a.x).toBe(5)
      expect(a.y).toBe(10)
    })
  })

  describe('copyFrom', () => {
    it('copies from another Vec2 and returns this', () => {
      const a = new Vec2()
      const b = new Vec2(7, 8)
      const result = a.copyFrom(b)
      expect(result).toBe(a)
      expect(a.x).toBe(7)
      expect(a.y).toBe(8)
    })
  })

  describe('static methods', () => {
    it('Vec2.zero() returns (0,0)', () => {
      const z = Vec2.zero()
      expect(z.x).toBe(0)
      expect(z.y).toBe(0)
    })

    it('Vec2.from() creates a new Vec2', () => {
      const v = Vec2.from(3, 4)
      expect(v.x).toBe(3)
      expect(v.y).toBe(4)
    })

    it('Vec2.distance() computes distance between two points', () => {
      const a = new Vec2(0, 0)
      const b = new Vec2(3, 4)
      expect(Vec2.distance(a, b)).toBe(5)
    })

    it('Vec2.distance() returns 0 for same point', () => {
      const p = new Vec2(5, 5)
      expect(Vec2.distance(p, p)).toBe(0)
    })
  })
})
