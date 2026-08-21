import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GamepadInput, gamepadButtonCode, GamepadButton } from '../gamepad'
import { InputManager } from '../inputManager'
import { createInputMap } from '../inputMap'

type MockButton = { pressed: boolean; value: number }
type MockPad = { buttons: MockButton[]; axes: number[]; connected?: boolean }

let mockPads: (MockPad | null)[] = [null, null, null, null]

function makePad(overrides?: Partial<MockPad>): MockPad {
  return {
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: false, value: i === 6 || i === 7 ? 0 : 0 })),
    axes: [0, 0, 0, 0],
    ...overrides,
  }
}

beforeEach(() => {
  mockPads = [null, null, null, null]
  ;(globalThis as Record<string, unknown>).navigator = {
    getGamepads: () => mockPads as unknown as (Gamepad | null)[],
  }
})

afterEach(() => {
  delete (globalThis as Record<string, unknown>).navigator
})

describe('GamepadInput', () => {
  let gp: GamepadInput

  beforeEach(() => {
    gp = new GamepadInput()
  })

  it('reports disconnected when no pads', () => {
    gp.flush()
    expect(gp.isConnected()).toBe(false)
    expect(gp.isDown(GamepadButton.A)).toBe(false)
  })

  it('detects press/hold/release edges', () => {
    mockPads[0] = makePad()
    mockPads[0]!.buttons[0].pressed = true
    gp.flush()
    expect(gp.isConnected()).toBe(true)
    expect(gp.isPressed(GamepadButton.A)).toBe(true)

    // held on subsequent frame
    mockPads[0]!.buttons[0].pressed = true
    gp.flush()
    expect(gp.isDown(GamepadButton.A)).toBe(true)
    expect(gp.isPressed(GamepadButton.A)).toBe(false)

    // release edge
    mockPads[0]!.buttons[0].pressed = false
    gp.flush()
    expect(gp.isReleased(GamepadButton.A)).toBe(true)
    expect(gp.isDown(GamepadButton.A)).toBe(false)
  })

  it('clears held buttons when pad disconnects mid-session', () => {
    mockPads[0] = makePad()
    mockPads[0]!.buttons[GamepadButton.Start].pressed = true
    gp.flush()
    expect(gp.isDown(GamepadButton.Start)).toBe(true)

    mockPads[0] = null
    gp.flush()
    expect(gp.isConnected()).toBe(false)
    expect(gp.isDown(GamepadButton.Start)).toBe(false)
  })

  it('applies dead zone to sticks and flips Y to screen convention', () => {
    mockPads[0] = makePad()
    mockPads[0]!.axes = [0.5, -1, 0.05, 0]
    gp.flush()
    expect(gp.getStick('left', 'x')).toBe(0.5)
    expect(gp.getStick('left', 'y')).toBe(1) // browser −1(up) → +1(down)
    expect(gp.getStick('right', 'x')).toBe(0) // inside dead zone
  })

  it('reads analog trigger values', () => {
    mockPads[0] = makePad()
    mockPads[0]!.buttons[6] = { pressed: true, value: 0.75 }
    gp.flush()
    expect(gp.getTrigger('left')).toBeCloseTo(0.75)
  })

  it('accepts string codes and numeric indices interchangeably', () => {
    mockPads[0] = makePad()
    mockPads[0]!.buttons[12].pressed = true
    gp.flush()
    expect(gp.isDown('gamepad:Up')).toBe(true)
    expect(gp.isDown(gamepadButtonCode(12))).toBe(true)
    expect(gp.isDown(GamepadButton.DPadUp)).toBe(true)
    expect(gp.isDown('gamepad:A')).toBe(false)
  })

  it('isolates player indices', () => {
    mockPads[0] = makePad()
    mockPads[1] = makePad()
    mockPads[1]!.buttons[2].pressed = true
    gp.flush()
    expect(gp.isDown('gamepad:X', 1)).toBe(true)
    expect(gp.isDown('gamepad:X', 0)).toBe(false)
  })
})

describe('InputManager gamepad routing', () => {
  it('routes gamepad: codes through isDown/isPressed/isReleased', () => {
    const input = new InputManager()
    mockPads[0] = makePad()
    mockPads[0]!.buttons[GamepadButton.A].pressed = true
    input.flush()

    expect(input.isDown('gamepad:A')).toBe(true)
    expect(input.keyboard.isDown('gamepad:A')).toBe(false)
  })

  it('treats stick direction codes as digital inputs', () => {
    const input = new InputManager()
    mockPads[0] = makePad()
    mockPads[0]!.axes = [-1, 0, 0, 0]
    input.flush()

    expect(input.isDown('gamepad:LX-')).toBe(true)
    expect(input.isDown('gamepad:LX+')).toBe(false)
    expect(input.getAxis('gamepad:LX+', 'gamepad:LX-')).toBe(-1)
  })
})

describe('InputMap analog stick binding', () => {
  it('blends keyboard digital values with analog stick', () => {
    const input = new InputManager() as InputManager & { gamepad: GamepadInput }
    const map = createInputMap({
      moveX: { positive: ['ArrowRight'], negative: ['ArrowLeft'], stick: 'leftx' },
    })

    mockPads[0] = makePad()
    mockPads[0]!.axes = [0.6, 0, 0, 0]

    input.flush()
    expect(map.getAxis(input, 'moveX')).toBeCloseTo(0.6)

    // keyboard adds on top of stick, clamped to ±1
    input.keyboard.held.add('ArrowRight')
    expect(map.getAxis(input, 'moveX')).toBe(1)

    input.keyboard.held.delete('ArrowRight')
    input.keyboard.held.add('ArrowLeft')
    expect(map.getAxis(input, 'moveX')).toBeCloseTo(-0.4)
  })

  it('isActionDown fires for stick-only movement past dead zone', () => {
    const map = createInputMap({
      moveX: { positive: [], negative: [], deadZone: 0.3, stick: 'leftx' },
    })
    const input = new InputManager() as InputManager & { gamepad: GamepadInput }

    mockPads[0] = makePad()
    mockPads[0]!.axes = [0.2, 0, 0, 0]
    input.flush()
    expect(map.isActionDown(input, 'moveX')).toBe(false)

    mockPads[0]!.axes = [0.8, 0, 0, 0]
    input.flush()
    expect(map.isActionDown(input, 'moveX')).toBe(true)
  })
})
