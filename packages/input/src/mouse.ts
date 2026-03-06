export interface MouseState {
  x: number
  y: number
  dx: number
  dy: number
}

export class Mouse {
  x = 0
  y = 0
  dx = 0
  dy = 0

  private held = new Set<number>()
  private justPressed = new Set<number>()
  private justReleased = new Set<number>()
  private target: HTMLElement | null = null

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.target) return
    const rect = this.target.getBoundingClientRect()
    this.dx = e.clientX - rect.left - this.x
    this.dy = e.clientY - rect.top - this.y
    this.x = e.clientX - rect.left
    this.y = e.clientY - rect.top
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.held.has(e.button)) {
      this.justPressed.add(e.button)
    }
    this.held.add(e.button)
  }

  private onMouseUp = (e: MouseEvent): void => {
    this.held.delete(e.button)
    this.justReleased.add(e.button)
  }

  private onContextMenu = (e: Event): void => {
    e.preventDefault()
  }

  attach(target: HTMLElement): void {
    this.target = target
    target.addEventListener('mousemove', this.onMouseMove)
    target.addEventListener('mousedown', this.onMouseDown)
    target.addEventListener('mouseup', this.onMouseUp)
    target.addEventListener('contextmenu', this.onContextMenu)
  }

  detach(): void {
    if (!this.target) return
    this.target.removeEventListener('mousemove', this.onMouseMove)
    this.target.removeEventListener('mousedown', this.onMouseDown)
    this.target.removeEventListener('mouseup', this.onMouseUp)
    this.target.removeEventListener('contextmenu', this.onContextMenu)
    this.target = null
  }

  isDown(button = 0): boolean { return this.held.has(button) }
  isPressed(button = 0): boolean { return this.justPressed.has(button) }
  isReleased(button = 0): boolean { return this.justReleased.has(button) }

  flush(): void {
    this.justPressed.clear()
    this.justReleased.clear()
    this.dx = 0
    this.dy = 0
  }
}
