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
  // gamepad (see packages/input/src/gamepad.ts for the code scheme) — buttons
  // AND directional stick codes both get press/release edges, so InputMap,
  // recorders, and scripts need no special cases.
  isDown(key: string): boolean {
    if (key.startsWith(GAMEPAD_PREFIX)) return this.gamepad.isDown(key)
    return this.keyboard.isDown(key)
  }
  isPressed(key: string): boolean {
    if (key.startsWith(GAMEPAD_PREFIX)) return this.gamepad.isPressed(key)
    return this.keyboard.isPressed(key)
  }
  isReleased(key: string): boolean {
    if (key.startsWith(GAMEPAD_PREFIX)) return this.gamepad.isReleased(key)
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
}
