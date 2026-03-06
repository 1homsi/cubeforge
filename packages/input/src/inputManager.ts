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
}
