import { describe, it, expect } from 'vitest'
import { createInputMap } from '@cubeforge/input'

// Test the createInputMap used by the React useInputMap hook
describe('createInputMap (used by useInputMap)', () => {
  function mockInput(down: Set<string> = new Set(), pressed: Set<string> = new Set(), released: Set<string> = new Set()) {
    return {
      isDown: (k: string) => down.has(k),
      isPressed: (k: string) => pressed.has(k),
      isReleased: (k: string) => released.has(k),
    }
  }

  it('binds a single key string', () => {
    const map = createInputMap({ jump: 'Space' })
    expect(map.isActionDown(mockInput(new Set(['Space'])), 'jump')).toBe(true)
  })

  it('binds an array of keys', () => {
    const map = createInputMap({ jump: ['Space', 'ArrowUp', 'KeyW'] })
    expect(map.isActionDown(mockInput(new Set(['KeyW'])), 'jump')).toBe(true)
    expect(map.isActionDown(mockInput(new Set(['ArrowUp'])), 'jump')).toBe(true)
  })

  it('binds axis with positive and negative', () => {
    const map = createInputMap({
      moveX: { positive: ['ArrowRight', 'KeyD'], negative: ['ArrowLeft', 'KeyA'] },
    })
    expect(map.getAxis(mockInput(new Set(['ArrowRight'])), 'moveX')).toBe(1)
    expect(map.getAxis(mockInput(new Set(['KeyA'])), 'moveX')).toBe(-1)
    expect(map.getAxis(mockInput(new Set(['ArrowRight', 'ArrowLeft'])), 'moveX')).toBe(0)
  })

  it('supports multiple action bindings', () => {
    const map = createInputMap({
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD'],
      jump: ['Space'],
    })
    const input = mockInput(new Set(['ArrowLeft', 'Space']))
    expect(map.isActionDown(input, 'left')).toBe(true)
    expect(map.isActionDown(input, 'right')).toBe(false)
    expect(map.isActionDown(input, 'jump')).toBe(true)
  })

  it('isActionPressed checks just-pressed keys', () => {
    const map = createInputMap({ jump: ['Space', 'KeyW'] })
    const input = mockInput(new Set(), new Set(['Space']))
    expect(map.isActionPressed(input, 'jump')).toBe(true)
  })

  it('isActionReleased checks just-released keys', () => {
    const map = createInputMap({ jump: 'Space' })
    const input = mockInput(new Set(), new Set(), new Set(['Space']))
    expect(map.isActionReleased(input, 'jump')).toBe(true)
  })

  it('getAxis returns 1 for non-axis key binding when held', () => {
    const map = createInputMap({ dash: 'ShiftLeft' })
    expect(map.getAxis(mockInput(new Set(['ShiftLeft'])), 'dash')).toBe(1)
    expect(map.getAxis(mockInput(), 'dash')).toBe(0)
  })

  it('handles unknown actions gracefully', () => {
    const map = createInputMap({ jump: 'Space' })
    expect(map.isActionDown(mockInput(new Set(['Space'])), 'fly')).toBe(false)
    expect(map.isActionPressed(mockInput(new Set(), new Set(['Space'])), 'fly')).toBe(false)
    expect(map.isActionReleased(mockInput(new Set(), new Set(), new Set(['Space'])), 'fly')).toBe(false)
    expect(map.getAxis(mockInput(new Set(['Space'])), 'fly')).toBe(0)
  })
})
