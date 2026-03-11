import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPlayerInput } from '../playerInput'
import type { InputManager } from '../inputManager'

function makeMockInput(overrides: Partial<InputManager> = {}): InputManager {
  return {
    isDown: vi.fn().mockReturnValue(false),
    isPressed: vi.fn().mockReturnValue(false),
    isReleased: vi.fn().mockReturnValue(false),
    getAxis: vi.fn().mockReturnValue(0),
    flush: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
    ...overrides,
  } as unknown as InputManager
}

describe('createPlayerInput', () => {
  let input: InputManager

  beforeEach(() => {
    input = makeMockInput()
  })

  it('stores the playerId', () => {
    const p = createPlayerInput(1, {}, input)
    expect(p.playerId).toBe(1)
  })

  it('isDown delegates to input.isDown', () => {
    ;(input.isDown as ReturnType<typeof vi.fn>).mockImplementation((k: string) => k === 'Space')
    const p = createPlayerInput(1, {}, input)
    expect(p.isDown('Space')).toBe(true)
    expect(p.isDown('KeyA')).toBe(false)
  })

  it('isPressed delegates to input.isPressed', () => {
    ;(input.isPressed as ReturnType<typeof vi.fn>).mockImplementation((k: string) => k === 'ArrowUp')
    const p = createPlayerInput(1, {}, input)
    expect(p.isPressed('ArrowUp')).toBe(true)
    expect(p.isPressed('ArrowDown')).toBe(false)
  })

  it('isReleased delegates to input.isReleased', () => {
    ;(input.isReleased as ReturnType<typeof vi.fn>).mockImplementation((k: string) => k === 'KeyZ')
    const p = createPlayerInput(1, {}, input)
    expect(p.isReleased('KeyZ')).toBe(true)
    expect(p.isReleased('KeyX')).toBe(false)
  })

  it('getAxis delegates to input.getAxis', () => {
    ;(input.getAxis as ReturnType<typeof vi.fn>).mockReturnValue(-1)
    const p = createPlayerInput(1, {}, input)
    expect(p.getAxis('ArrowRight', 'ArrowLeft')).toBe(-1)
    expect(input.getAxis).toHaveBeenCalledWith('ArrowRight', 'ArrowLeft')
  })

  describe('action bindings', () => {
    it('isActionDown returns true when bound key is down', () => {
      ;(input.isDown as ReturnType<typeof vi.fn>).mockImplementation((k: string) => k === 'Space')
      const p = createPlayerInput(1, { jump: 'Space' }, input)
      expect(p.isActionDown('jump')).toBe(true)
    })

    it('isActionDown returns false when bound key is not down', () => {
      ;(input.isDown as ReturnType<typeof vi.fn>).mockReturnValue(false)
      const p = createPlayerInput(1, { jump: 'Space' }, input)
      expect(p.isActionDown('jump')).toBe(false)
    })

    it('isActionDown returns false for unknown action', () => {
      const p = createPlayerInput(1, { jump: 'Space' }, input)
      expect(p.isActionDown('attack')).toBe(false)
    })

    it('isActionPressed returns true when bound key was pressed this frame', () => {
      ;(input.isPressed as ReturnType<typeof vi.fn>).mockImplementation((k: string) => k === 'KeyZ')
      const p = createPlayerInput(1, { fire: 'KeyZ' }, input)
      expect(p.isActionPressed('fire')).toBe(true)
    })

    it('isActionReleased returns true when bound key was released this frame', () => {
      ;(input.isReleased as ReturnType<typeof vi.fn>).mockImplementation((k: string) => k === 'KeyX')
      const p = createPlayerInput(1, { dash: 'KeyX' }, input)
      expect(p.isActionReleased('dash')).toBe(true)
    })

    it('pressed and released return false for unknown actions', () => {
      const p = createPlayerInput(1, { jump: 'Space' }, input)
      expect(p.isActionPressed('attack')).toBe(false)
      expect(p.isActionReleased('attack')).toBe(false)
    })

    it('supports array of keys for a single action', () => {
      ;(input.isDown as ReturnType<typeof vi.fn>).mockImplementation((k: string) => k === 'ArrowLeft')
      const p = createPlayerInput(1, { left: ['ArrowLeft', 'KeyA'] }, input)
      expect(p.isActionDown('left')).toBe(true)
    })

    it('supports array actions when only the second key is active', () => {
      ;(input.isDown as ReturnType<typeof vi.fn>).mockImplementation((k: string) => k === 'KeyA')
      const p = createPlayerInput(1, { left: ['ArrowLeft', 'KeyA'] }, input)
      expect(p.isActionDown('left')).toBe(true)
    })

    it('getActionAxis returns 1 when positive key is down', () => {
      ;(input.isDown as ReturnType<typeof vi.fn>).mockImplementation((k: string) => k === 'ArrowRight')
      const p = createPlayerInput(1, { moveRight: 'ArrowRight', moveLeft: 'ArrowLeft' }, input)
      // Single-key action axis: 1 if held, 0 otherwise
      expect(p.getActionAxis('moveRight')).toBeGreaterThan(0)
    })

    it('getActionAxis returns 0 when key is not down', () => {
      ;(input.isDown as ReturnType<typeof vi.fn>).mockReturnValue(false)
      const p = createPlayerInput(1, { moveRight: 'ArrowRight' }, input)
      expect(p.getActionAxis('moveRight')).toBe(0)
    })
  })

  it('two players with different bindings operate independently', () => {
    const isDown1 = vi.fn().mockImplementation((k: string) => k === 'Space')
    const isDown2 = vi.fn().mockImplementation((k: string) => k === 'KeyW')
    const input1 = makeMockInput({ isDown: isDown1 })
    const input2 = makeMockInput({ isDown: isDown2 })

    const p1 = createPlayerInput(1, { jump: 'Space' }, input1)
    const p2 = createPlayerInput(2, { jump: 'KeyW' }, input2)

    expect(p1.isActionDown('jump')).toBe(true)
    expect(p2.isActionDown('jump')).toBe(true)
    expect(p1.playerId).toBe(1)
    expect(p2.playerId).toBe(2)
  })
})
