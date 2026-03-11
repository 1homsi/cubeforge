import { describe, it, expect, beforeEach } from 'vitest'
import { InputManager } from '../inputManager'

describe('InputManager', () => {
  let input: InputManager

  beforeEach(() => {
    input = new InputManager()
  })

  describe('keyboard pass-throughs', () => {
    it('isDown delegates to keyboard', () => {
      expect(input.isDown('Space')).toBe(false)
    })

    it('isPressed delegates to keyboard', () => {
      expect(input.isPressed('Space')).toBe(false)
    })

    it('isReleased delegates to keyboard', () => {
      expect(input.isReleased('Space')).toBe(false)
    })
  })

  describe('getAxis', () => {
    it('returns 0 when no keys are pressed', () => {
      expect(input.getAxis('ArrowRight', 'ArrowLeft')).toBe(0)
    })

    it('returns 0 by default with dead zone of 0', () => {
      expect(input.getAxis('ArrowRight', 'ArrowLeft', 0)).toBe(0)
    })
  })

  describe('sub-systems', () => {
    it('has keyboard, mouse, and touch instances', () => {
      expect(input.keyboard).toBeDefined()
      expect(input.mouse).toBeDefined()
      expect(input.touch).toBeDefined()
    })
  })

  describe('flush', () => {
    it('can be called without error', () => {
      expect(() => input.flush()).not.toThrow()
    })
  })

  describe('attach / detach', () => {
    it('attach can be called without error with a DOM element', () => {
      const el = document.createElement('div')
      expect(() => input.attach(el)).not.toThrow()
    })

    it('detach can be called without error', () => {
      const el = document.createElement('div')
      input.attach(el)
      expect(() => input.detach()).not.toThrow()
    })

    it('double attach to same element does not throw', () => {
      const el = document.createElement('div')
      input.attach(el)
      expect(() => input.attach(el)).not.toThrow()
    })

    it('detach without attach does not throw', () => {
      expect(() => input.detach()).not.toThrow()
    })
  })

  describe('keyboard integration', () => {
    it('tracks key state after attach', () => {
      const target = new EventTarget()
      input.keyboard.attach(target)

      const e = Object.assign(new Event('keydown'), { code: 'KeyA', key: 'a' }) as KeyboardEvent
      target.dispatchEvent(e)

      expect(input.isDown('KeyA')).toBe(true)
      expect(input.isPressed('KeyA')).toBe(true)

      input.flush()
      expect(input.isPressed('KeyA')).toBe(false)
      expect(input.isDown('KeyA')).toBe(true)
    })
  })

  describe('getAxis with keys', () => {
    it('returns 1 when positive key is down', () => {
      const target = new EventTarget()
      input.keyboard.attach(target)
      target.dispatchEvent(
        Object.assign(new Event('keydown'), { code: 'ArrowRight', key: 'ArrowRight' }) as KeyboardEvent,
      )
      expect(input.getAxis('ArrowRight', 'ArrowLeft')).toBe(1)
    })

    it('returns -1 when negative key is down', () => {
      const target = new EventTarget()
      input.keyboard.attach(target)
      target.dispatchEvent(
        Object.assign(new Event('keydown'), { code: 'ArrowLeft', key: 'ArrowLeft' }) as KeyboardEvent,
      )
      expect(input.getAxis('ArrowRight', 'ArrowLeft')).toBe(-1)
    })

    it('returns 0 when both keys are down', () => {
      const target = new EventTarget()
      input.keyboard.attach(target)
      target.dispatchEvent(
        Object.assign(new Event('keydown'), { code: 'ArrowRight', key: 'ArrowRight' }) as KeyboardEvent,
      )
      target.dispatchEvent(
        Object.assign(new Event('keydown'), { code: 'ArrowLeft', key: 'ArrowLeft' }) as KeyboardEvent,
      )
      expect(input.getAxis('ArrowRight', 'ArrowLeft')).toBe(0)
    })

    it('applies dead zone', () => {
      // With a dead zone of 2, value=1 should be snapped to 0
      expect(input.getAxis('ArrowRight', 'ArrowLeft', 2)).toBe(0)
    })
  })
})
