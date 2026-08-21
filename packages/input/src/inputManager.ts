import { Keyboard } from './keyboard'
import { Mouse } from './mouse'
import { TouchInput } from './touch'
import { GamepadInput, GAMEPAD_PREFIX } from './gamepad'

export class InputManager {
  readonly keyboard = new Keyboard()
  readonly mouse = new Mouse()
  readonly touch = new TouchInput()
  readonly gamepad = new GamepadInput()
  private _attachedElement: HTMLElement | null = null

  attach(canvas: HTMLElement): void {
    if (this._attachedElement === canvas) return
    if (this._attachedElement) this.detach()
    this._attachedElement = canvas
    this.keyboard.attach(window)
    this.mouse.attach(canvas)
    this.touch.attach(canvas)
    this.gamepad.attach()
  }

  detach(): void {
    this._attachedElement = null
    this.keyboard.detach()
    this.mouse.detach()
    this.touch.detach()
    this.gamepad.detach()
  }

  /** Must be called once at the start of each frame */
  flush(): void {
    this.keyboard.flush()
    this.mouse.flush()
    this.touch.flush()
    this.gamepad.flush()
  }

  // Convenience pass-throughs. Keys starting with 'gamepad:' route to the
  // gamepad (see packages/input/src/gamepad.ts for the code scheme), so
  // recorders, InputMap bindings, and scripts need no special cases.
  isDown(key: string): boolean {
    if (key.startsWith(GAMEPAD_PREFIX)) return this.gamepadKey(key)
    return this.keyboard.isDown(key)
  }
  isPressed(key: string): boolean {
    if (key.startsWith(GAMEPAD_PREFIX)) return this.gamepad.isPressed(this.stripDirection(key))
    return this.keyboard.isPressed(key)
  }
  isReleased(key: string): boolean {
    if (key.startsWith(GAMEPAD_PREFIX)) return this.gamepad.isReleased(this.stripDirection(key))
    return this.keyboard.isReleased(key)
  }

  /**
   * Returns a digital axis value (-1, 0, or 1) based on two keys.
   * Positive key = +1, negative key = -1, neither or both = 0.
   *
   * @example
   * const moveX = input.getAxis('ArrowRight', 'ArrowLeft')
   */
  getAxis(positiveKey: string, negativeKey: string, deadZone = 0): number {
    let value = 0
    if (this.isDown(positiveKey)) value += 1
    if (this.isDown(negativeKey)) value -= 1
    return Math.abs(value) <= deadZone ? 0 : value
  }

  /** Analog stick read: input.gamepad.getStick('left', 'x'). */
  readonly sticks = {
    left: {
      x: (playerIndex = 0) => this.gamepad.getStick('left', 'x', playerIndex),
      y: (playerIndex = 0) => this.gamepad.getStick('left', 'y', playerIndex),
    },
    right: {
      x: (playerIndex = 0) => this.gamepad.getStick('right', 'x', playerIndex),
      y: (playerIndex = 0) => this.gamepad.getStick('right', 'y', playerIndex),
    },
  }

  /**
   * Digital truth for a 'gamepad:*' key: buttons map directly; directional
   * stick codes (LX+, LY-, ...) compare the analog axis against the dead zone.
   */
  private gamepadKey(code: string): boolean {
    const dir = STICK_DIRECTIONS.get(code)
    if (!dir) return this.gamepad.isDown(this.stripDirection(code))
    const v = this.gamepad.getStick(dir.stick, dir.axis)
    return dir.positive ? v > 0 : v < 0
  }

  /** 'gamepad:LX+' → 'LX'; plain button names pass through unchanged. */
  private stripDirection(code: string): string {
    const name = code.slice(GAMEPAD_PREFIX.length)
    return name.endsWith('+') || name.endsWith('-') ? name.slice(0, -1) : name
  }
}

/** Parsed directional stick codes, e.g. 'gamepad:LX+' → left/x/+ */
const STICK_DIRECTIONS = new Map<string, { stick: 'left' | 'right'; axis: 'x' | 'y'; positive: boolean }>()
for (const s of ['L', 'R'] as const) {
  const stick = s === 'L' ? 'left' : 'right'
  for (const a of ['X', 'Y'] as const) {
    const axis = a === 'X' ? 'x' : 'y'
    STICK_DIRECTIONS.set(`${GAMEPAD_PREFIX}${s}${a}+`, { stick, axis, positive: true })
    STICK_DIRECTIONS.set(`${GAMEPAD_PREFIX}${s}${a}-`, { stick, axis, positive: false })
  }
}
