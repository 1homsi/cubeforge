import { describe, it, expect, vi } from 'vitest'
import { createInputMap } from '../inputMap'

// Helper: create a mock input object
function mockInput(
  downKeys: Set<string> = new Set(),
  pressedKeys: Set<string> = new Set(),
  releasedKeys: Set<string> = new Set(),
) {
  return {
    isDown: (k: string) => downKeys.has(k),
    isPressed: (k: string) => pressedKeys.has(k),
    isReleased: (k: string) => releasedKeys.has(k),
  }
}

describe('createInputMap', () => {
  describe('isActionDown', () => {
    it('returns false when no keys are down', () => {
      const map = createInputMap({ jump: 'Space' })
      expect(map.isActionDown(mockInput(), 'jump')).toBe(false)
    })

    it('returns true when bound key is down (single key)', () => {
      const map = createInputMap({ jump: 'Space' })
      expect(map.isActionDown(mockInput(new Set(['Space'])), 'jump')).toBe(true)
    })

    it('returns true when any bound key is down (array)', () => {
      const map = createInputMap({ jump: ['Space', 'KeyW'] })
      expect(map.isActionDown(mockInput(new Set(['KeyW'])), 'jump')).toBe(true)
    })

    it('returns false for unknown action', () => {
      const map = createInputMap({ jump: 'Space' })
      expect(map.isActionDown(mockInput(new Set(['Space'])), 'nonexistent')).toBe(false)
    })

    it('works with axis bindings (returns true if any axis key is down)', () => {
      const map = createInputMap({
        moveX: { positive: ['ArrowRight'], negative: ['ArrowLeft'] },
      })
      expect(map.isActionDown(mockInput(new Set(['ArrowRight'])), 'moveX')).toBe(true)
      expect(map.isActionDown(mockInput(new Set(['ArrowLeft'])), 'moveX')).toBe(true)
      expect(map.isActionDown(mockInput(), 'moveX')).toBe(false)
    })
  })

  describe('isActionPressed', () => {
    it('returns false when no keys pressed', () => {
      const map = createInputMap({ jump: 'Space' })
      expect(map.isActionPressed(mockInput(), 'jump')).toBe(false)
    })

    it('returns true when bound key is just pressed', () => {
      const map = createInputMap({ jump: 'Space' })
      const input = mockInput(new Set(), new Set(['Space']))
      expect(map.isActionPressed(input, 'jump')).toBe(true)
    })

    it('returns true when any bound key is pressed (array)', () => {
      const map = createInputMap({ jump: ['Space', 'KeyW'] })
      const input = mockInput(new Set(), new Set(['KeyW']))
      expect(map.isActionPressed(input, 'jump')).toBe(true)
    })

    it('returns false for unknown action', () => {
      const map = createInputMap({ jump: 'Space' })
      expect(map.isActionPressed(mockInput(new Set(), new Set(['Space'])), 'nonexistent')).toBe(false)
    })

    it('returns false for axis bindings (axis bindings do not support isActionPressed)', () => {
      const map = createInputMap({
        moveX: { positive: ['ArrowRight'], negative: ['ArrowLeft'] },
      })
      expect(map.isActionPressed(mockInput(new Set(), new Set(['ArrowRight'])), 'moveX')).toBe(false)
    })
  })

  describe('isActionReleased', () => {
    it('returns false when no keys released', () => {
      const map = createInputMap({ jump: 'Space' })
      expect(map.isActionReleased(mockInput(), 'jump')).toBe(false)
    })

    it('returns true when bound key is released', () => {
      const map = createInputMap({ jump: 'Space' })
      const input = mockInput(new Set(), new Set(), new Set(['Space']))
      expect(map.isActionReleased(input, 'jump')).toBe(true)
    })

    it('returns false for unknown action', () => {
      const map = createInputMap({ jump: 'Space' })
      expect(map.isActionReleased(mockInput(new Set(), new Set(), new Set(['Space'])), 'unknown')).toBe(false)
    })
  })

  describe('getAxis', () => {
    it('returns 0 when no keys are down', () => {
      const map = createInputMap({
        moveX: { positive: ['ArrowRight', 'KeyD'], negative: ['ArrowLeft', 'KeyA'] },
      })
      expect(map.getAxis(mockInput(), 'moveX')).toBe(0)
    })

    it('returns 1 when positive key is down', () => {
      const map = createInputMap({
        moveX: { positive: ['ArrowRight'], negative: ['ArrowLeft'] },
      })
      expect(map.getAxis(mockInput(new Set(['ArrowRight'])), 'moveX')).toBe(1)
    })

    it('returns -1 when negative key is down', () => {
      const map = createInputMap({
        moveX: { positive: ['ArrowRight'], negative: ['ArrowLeft'] },
      })
      expect(map.getAxis(mockInput(new Set(['ArrowLeft'])), 'moveX')).toBe(-1)
    })

    it('returns 0 when both positive and negative are down', () => {
      const map = createInputMap({
        moveX: { positive: ['ArrowRight'], negative: ['ArrowLeft'] },
      })
      expect(map.getAxis(mockInput(new Set(['ArrowRight', 'ArrowLeft'])), 'moveX')).toBe(0)
    })

    it('for key bindings, returns 1 when key is down', () => {
      const map = createInputMap({ jump: ['Space'] })
      expect(map.getAxis(mockInput(new Set(['Space'])), 'jump')).toBe(1)
    })

    it('for key bindings, returns 0 when key is not down', () => {
      const map = createInputMap({ jump: ['Space'] })
      expect(map.getAxis(mockInput(), 'jump')).toBe(0)
    })

    it('returns 0 for unknown action', () => {
      const map = createInputMap({ jump: 'Space' })
      expect(map.getAxis(mockInput(new Set(['Space'])), 'unknown')).toBe(0)
    })

    it('applies dead zone for axis bindings', () => {
      const map = createInputMap({
        moveX: { positive: ['ArrowRight'], negative: ['ArrowLeft'], deadZone: 0.5 },
      })
      // When both keys are down value is 0 which is below deadzone → still 0
      expect(map.getAxis(mockInput(new Set(['ArrowRight', 'ArrowLeft'])), 'moveX')).toBe(0)
    })

    it('uses default dead zone of 0.1', () => {
      const map = createInputMap({
        moveX: { positive: ['ArrowRight'], negative: ['ArrowLeft'] },
      })
      // Value of 0 is below 0.1 dead zone → 0
      expect(map.getAxis(mockInput(), 'moveX')).toBe(0)
      // Value of 1 is above 0.1 → 1
      expect(map.getAxis(mockInput(new Set(['ArrowRight'])), 'moveX')).toBe(1)
    })

    it('works with multiple positive keys', () => {
      const map = createInputMap({
        moveX: { positive: ['ArrowRight', 'KeyD'], negative: ['ArrowLeft', 'KeyA'] },
      })
      expect(map.getAxis(mockInput(new Set(['KeyD'])), 'moveX')).toBe(1)
    })
  })
})
