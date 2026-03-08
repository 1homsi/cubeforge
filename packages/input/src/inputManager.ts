import { Keyboard } from './keyboard'
import { Mouse } from './mouse'

export class InputManager {
  readonly keyboard = new Keyboard()
  readonly mouse = new Mouse()

  attach(canvas: HTMLElement): void {
    this.keyboard.attach(window)
    this.mouse.attach(canvas)
  }

  detach(): void {
    this.keyboard.detach()
    this.mouse.detach()
  }

  /** Must be called once at the start of each frame */
  flush(): void {
    this.keyboard.flush()
    this.mouse.flush()
  }

  // Convenience pass-throughs
  isDown(key: string): boolean { return this.keyboard.isDown(key) }
  isPressed(key: string): boolean { return this.keyboard.isPressed(key) }
  isReleased(key: string): boolean { return this.keyboard.isReleased(key) }

  /**
   * Returns a digital axis value (-1, 0, or 1) based on two keys.
   * Positive key = +1, negative key = -1, neither or both = 0.
   *
   * @example
   * const moveX = input.getAxis('ArrowRight', 'ArrowLeft')
   */
  getAxis(positiveKey: string, negativeKey: string, deadZone = 0): number {
    let value = 0
    if (this.keyboard.isDown(positiveKey)) value += 1
    if (this.keyboard.isDown(negativeKey)) value -= 1
    return Math.abs(value) <= deadZone ? 0 : value
  }
}
