import { describe, it, expect } from 'vitest'
import { createCamera2D } from '../components/camera2d'

describe('createCamera2D', () => {
  describe('default values', () => {
    const cam = createCamera2D()

    it('type is Camera2D', () => {
      expect(cam.type).toBe('Camera2D')
    })

    it('default position is (0, 0)', () => {
      expect(cam.x).toBe(0)
      expect(cam.y).toBe(0)
    })

    it('default zoom is 1', () => {
      expect(cam.zoom).toBe(1)
    })

    it('default smoothing is 0', () => {
      expect(cam.smoothing).toBe(0)
    })

    it('default background is #1a1a2e', () => {
      expect(cam.background).toBe('#1a1a2e')
    })

    it('default followOffset is (0, 0)', () => {
      expect(cam.followOffsetX).toBe(0)
      expect(cam.followOffsetY).toBe(0)
    })

    it('default shake values are 0', () => {
      expect(cam.shakeIntensity).toBe(0)
      expect(cam.shakeDuration).toBe(0)
      expect(cam.shakeTimer).toBe(0)
    })

    it('default bounds is undefined', () => {
      expect(cam.bounds).toBeUndefined()
    })

    it('default deadZone is undefined', () => {
      expect(cam.deadZone).toBeUndefined()
    })

    it('default followEntityId is undefined', () => {
      expect(cam.followEntityId).toBeUndefined()
    })
  })

  describe('custom values', () => {
    it('accepts position', () => {
      const cam = createCamera2D({ x: 100, y: 200 })
      expect(cam.x).toBe(100)
      expect(cam.y).toBe(200)
    })

    it('accepts zoom', () => {
      const cam = createCamera2D({ zoom: 2 })
      expect(cam.zoom).toBe(2)
    })

    it('accepts smoothing', () => {
      const cam = createCamera2D({ smoothing: 0.87 })
      expect(cam.smoothing).toBe(0.87)
    })

    it('accepts followEntityId', () => {
      const cam = createCamera2D({ followEntityId: 'player' })
      expect(cam.followEntityId).toBe('player')
    })

    it('accepts bounds', () => {
      const bounds = { x: 0, y: 0, width: 2000, height: 1000 }
      const cam = createCamera2D({ bounds })
      expect(cam.bounds).toEqual(bounds)
    })

    it('accepts deadZone', () => {
      const cam = createCamera2D({ deadZone: { w: 100, h: 80 } })
      expect(cam.deadZone).toEqual({ w: 100, h: 80 })
    })

    it('accepts followOffset', () => {
      const cam = createCamera2D({ followOffsetX: 50, followOffsetY: -30 })
      expect(cam.followOffsetX).toBe(50)
      expect(cam.followOffsetY).toBe(-30)
    })

    it('accepts shake values', () => {
      const cam = createCamera2D({ shakeIntensity: 10, shakeDuration: 0.5, shakeTimer: 0.5 })
      expect(cam.shakeIntensity).toBe(10)
      expect(cam.shakeDuration).toBe(0.5)
      expect(cam.shakeTimer).toBe(0.5)
    })

    it('accepts background color', () => {
      const cam = createCamera2D({ background: '#000000' })
      expect(cam.background).toBe('#000000')
    })
  })

  describe('mutability', () => {
    it('position can be updated', () => {
      const cam = createCamera2D()
      cam.x = 500
      cam.y = 300
      expect(cam.x).toBe(500)
      expect(cam.y).toBe(300)
    })

    it('zoom can be updated', () => {
      const cam = createCamera2D()
      cam.zoom = 3
      expect(cam.zoom).toBe(3)
    })
  })
})
