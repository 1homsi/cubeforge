import { describe, it, expect } from 'vitest'
import { createRenderLayerManager, defaultLayers } from '../renderLayers'

describe('createRenderLayerManager', () => {
  describe('with default layers', () => {
    const mgr = createRenderLayerManager()

    it('has background layer at -100', () => {
      expect(mgr.getOrder('background')).toBe(-100)
    })

    it('has default layer at 0', () => {
      expect(mgr.getOrder('default')).toBe(0)
    })

    it('has foreground layer at 100', () => {
      expect(mgr.getOrder('foreground')).toBe(100)
    })

    it('has ui layer at 200', () => {
      expect(mgr.getOrder('ui')).toBe(200)
    })

    it('returns 0 for unknown layers', () => {
      expect(mgr.getOrder('nonexistent')).toBe(0)
    })
  })

  describe('with custom layers', () => {
    it('accepts custom layer definitions', () => {
      const mgr = createRenderLayerManager([
        { name: 'ground', order: -50 },
        { name: 'sky', order: -200 },
      ])
      expect(mgr.getOrder('ground')).toBe(-50)
      expect(mgr.getOrder('sky')).toBe(-200)
    })

    it('does not have default layers when custom ones are provided', () => {
      const mgr = createRenderLayerManager([{ name: 'custom', order: 5 }])
      expect(mgr.getOrder('background')).toBe(0) // unknown → 0
    })
  })

  describe('addLayer', () => {
    it('adds a new layer', () => {
      const mgr = createRenderLayerManager()
      mgr.addLayer('particles', 150)
      expect(mgr.getOrder('particles')).toBe(150)
    })

    it('updates an existing layer order', () => {
      const mgr = createRenderLayerManager()
      mgr.addLayer('default', 50)
      expect(mgr.getOrder('default')).toBe(50)
    })

    it('supports negative order', () => {
      const mgr = createRenderLayerManager()
      mgr.addLayer('deep-bg', -500)
      expect(mgr.getOrder('deep-bg')).toBe(-500)
    })

    it('supports zero order', () => {
      const mgr = createRenderLayerManager()
      mgr.addLayer('zero', 0)
      expect(mgr.getOrder('zero')).toBe(0)
    })
  })

  describe('defaultLayers', () => {
    it('is an array of 4 layers', () => {
      expect(defaultLayers).toHaveLength(4)
    })

    it('layers are sorted by order', () => {
      const orders = defaultLayers.map((l) => l.order)
      expect(orders).toEqual([-100, 0, 100, 200])
    })
  })
})
