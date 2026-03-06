export class Keyboard {
  private held = new Set<string>()
  private justPressed = new Set<string>()
  private justReleased = new Set<string>()
  private target: EventTarget | null = null

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.held.has(e.code)) {
      this.justPressed.add(e.code)
    }
    this.held.add(e.code)
    // Also track by key for convenience (e.g. 'ArrowLeft')
    if (!this.held.has(e.key)) {
      this.justPressed.add(e.key)
    }
    this.held.add(e.key)
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code)
    this.held.delete(e.key)
    this.justReleased.add(e.code)
    this.justReleased.add(e.key)
  }

  attach(target: EventTarget = window): void {
    this.target = target
    target.addEventListener('keydown', this.onKeyDown as EventListener)
    target.addEventListener('keyup', this.onKeyUp as EventListener)
  }

  detach(): void {
    if (!this.target) return
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener)
    this.target.removeEventListener('keyup', this.onKeyUp as EventListener)
    this.target = null
  }

  /** True every frame the key is held */
  isDown(key: string): boolean {
    return this.held.has(key)
  }

  /** True only on the first frame the key was pressed */
  isPressed(key: string): boolean {
    return this.justPressed.has(key)
  }

  /** True only on the frame the key was released */
  isReleased(key: string): boolean {
    return this.justReleased.has(key)
  }

  /** Call once per frame at the START of the frame to flush transient state */
  flush(): void {
    this.justPressed.clear()
    this.justReleased.clear()
  }
}
