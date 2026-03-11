import { describe, it, expect } from 'vitest'
import { createTrail } from '../components/trail'

describe('createTrail', () => {
  describe('default values', () => {
    const trail = createTrail()

    it('type is Trail', () => {
      expect(trail.type).toBe('Trail')
    })

    it('default length is 20', () => {
      expect(trail.length).toBe(20)
    })

    it('default color is #ffffff', () => {
      expect(trail.color).toBe('#ffffff')
    })

    it('default width is 3', () => {
      expect(trail.width).toBe(3)
    })

    it('default points is empty array', () => {
      expect(trail.points).toEqual([])
    })
  })

  describe('custom values', () => {
    it('accepts custom length', () => {
      const trail = createTrail({ length: 50 })
      expect(trail.length).toBe(50)
    })

    it('accepts custom color', () => {
      const trail = createTrail({ color: '#ff0000' })
      expect(trail.color).toBe('#ff0000')
    })

    it('accepts custom width', () => {
      const trail = createTrail({ width: 5 })
      expect(trail.width).toBe(5)
    })

    it('accepts initial points', () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]
      const trail = createTrail({ points: pts })
      expect(trail.points).toEqual(pts)
    })
  })

  describe('mutability', () => {
    it('points can be pushed', () => {
      const trail = createTrail()
      trail.points.push({ x: 10, y: 20 })
      expect(trail.points).toHaveLength(1)
    })

    it('length can be changed', () => {
      const trail = createTrail()
      trail.length = 100
      expect(trail.length).toBe(100)
    })
  })
})
