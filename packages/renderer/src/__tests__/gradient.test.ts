import { describe, it, expect } from 'vitest'
import { createGradient } from '../components/gradient'

describe('createGradient', () => {
  describe('default values', () => {
    const g = createGradient()

    it('type is Gradient', () => {
      expect(g.type).toBe('Gradient')
    })

    it('default gradientType is linear', () => {
      expect(g.gradientType).toBe('linear')
    })

    it('default stops is empty array', () => {
      expect(g.stops).toEqual([])
    })

    it('default angle is 0', () => {
      expect(g.angle).toBe(0)
    })

    it('default innerRadius is 0', () => {
      expect(g.innerRadius).toBe(0)
    })

    it('default visible is true', () => {
      expect(g.visible).toBe(true)
    })

    it('default zIndex is 0', () => {
      expect(g.zIndex).toBe(0)
    })

    it('default size is 100x100', () => {
      expect(g.width).toBe(100)
      expect(g.height).toBe(100)
    })

    it('default anchor is center (0.5, 0.5)', () => {
      expect(g.anchorX).toBe(0.5)
      expect(g.anchorY).toBe(0.5)
    })
  })

  describe('custom values', () => {
    it('accepts radial type', () => {
      const g = createGradient({ gradientType: 'radial' })
      expect(g.gradientType).toBe('radial')
    })

    it('accepts gradient stops', () => {
      const stops = [
        { offset: 0, color: '#ff0000' },
        { offset: 1, color: '#0000ff' },
      ]
      const g = createGradient({ stops })
      expect(g.stops).toEqual(stops)
    })

    it('accepts angle', () => {
      const g = createGradient({ angle: Math.PI / 4 })
      expect(g.angle).toBeCloseTo(Math.PI / 4)
    })

    it('accepts innerRadius', () => {
      const g = createGradient({ innerRadius: 0.3 })
      expect(g.innerRadius).toBe(0.3)
    })

    it('accepts custom size', () => {
      const g = createGradient({ width: 200, height: 300 })
      expect(g.width).toBe(200)
      expect(g.height).toBe(300)
    })

    it('accepts custom anchor', () => {
      const g = createGradient({ anchorX: 0, anchorY: 1 })
      expect(g.anchorX).toBe(0)
      expect(g.anchorY).toBe(1)
    })

    it('accepts hidden state', () => {
      const g = createGradient({ visible: false })
      expect(g.visible).toBe(false)
    })

    it('accepts zIndex', () => {
      const g = createGradient({ zIndex: 10 })
      expect(g.zIndex).toBe(10)
    })
  })

  describe('mutability', () => {
    it('stops can be modified', () => {
      const g = createGradient()
      g.stops.push({ offset: 0, color: 'red' })
      expect(g.stops).toHaveLength(1)
    })

    it('gradientType can be changed', () => {
      const g = createGradient()
      g.gradientType = 'radial'
      expect(g.gradientType).toBe('radial')
    })
  })
})
