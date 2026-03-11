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

  describe('colorOverLife', () => {
    it('defaults to undefined', () => {
      expect(createTrail().colorOverLife).toBeUndefined()
    })

    it('accepts a color palette', () => {
      const trail = createTrail({ colorOverLife: ['#ff0000', '#0000ff'] })
      expect(trail.colorOverLife).toEqual(['#ff0000', '#0000ff'])
    })

    it('accepts a multi-stop palette', () => {
      const palette = ['#ff0000', '#00ff00', '#0000ff']
      const trail = createTrail({ colorOverLife: palette })
      expect(trail.colorOverLife).toHaveLength(3)
    })

    it('is mutable', () => {
      const trail = createTrail({ colorOverLife: ['#ffffff'] })
      trail.colorOverLife!.push('#000000')
      expect(trail.colorOverLife).toHaveLength(2)
    })
  })

  describe('widthOverLife', () => {
    it('defaults to undefined', () => {
      expect(createTrail().widthOverLife).toBeUndefined()
    })

    it('accepts start and end width', () => {
      const trail = createTrail({ widthOverLife: { start: 8, end: 1 } })
      expect(trail.widthOverLife).toEqual({ start: 8, end: 1 })
    })

    it('allows start === end (uniform width via widthOverLife)', () => {
      const trail = createTrail({ widthOverLife: { start: 4, end: 4 } })
      expect(trail.widthOverLife!.start).toBe(4)
      expect(trail.widthOverLife!.end).toBe(4)
    })

    it('allows end > start (thickening trail)', () => {
      const trail = createTrail({ widthOverLife: { start: 1, end: 10 } })
      expect(trail.widthOverLife!.end).toBeGreaterThan(trail.widthOverLife!.start)
    })
  })
})
