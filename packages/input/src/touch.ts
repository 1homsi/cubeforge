export interface TouchPoint {
  id: number
  x: number
  y: number
  startX: number
  startY: number
  /** Time in ms since touch started */
  duration: number
}

export class TouchInput {
  private _touches: Map<number, TouchPoint> = new Map()
  private _justStarted: Map<number, TouchPoint> = new Map()
  private _justEnded: Map<number, TouchPoint> = new Map()
  private _element: HTMLElement | null = null
  private _startTime: Map<number, number> = new Map()

  private _onTouchStart = (e: TouchEvent): void => {
    e.preventDefault()
    const rect = this._element!.getBoundingClientRect()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      const x = t.clientX - rect.left
      const y = t.clientY - rect.top
      const now = performance.now()
      this._startTime.set(t.identifier, now)
      const point: TouchPoint = {
        id: t.identifier,
        x,
        y,
        startX: x,
        startY: y,
        duration: 0,
      }
      this._touches.set(t.identifier, point)
      this._justStarted.set(t.identifier, point)
    }
  }

  private _onTouchMove = (e: TouchEvent): void => {
    e.preventDefault()
    const rect = this._element!.getBoundingClientRect()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      const existing = this._touches.get(t.identifier)
      if (!existing) continue
      const now = performance.now()
      const startTime = this._startTime.get(t.identifier) ?? now
      existing.x = t.clientX - rect.left
      existing.y = t.clientY - rect.top
      existing.duration = now - startTime
    }
  }

  private _onTouchEnd = (e: TouchEvent): void => {
    e.preventDefault()
    const rect = this._element!.getBoundingClientRect()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      const existing = this._touches.get(t.identifier)
      if (existing) {
        const now = performance.now()
        const startTime = this._startTime.get(t.identifier) ?? now
        existing.x = t.clientX - rect.left
        existing.y = t.clientY - rect.top
        existing.duration = now - startTime
        this._justEnded.set(t.identifier, { ...existing })
      }
      this._touches.delete(t.identifier)
      this._startTime.delete(t.identifier)
    }
  }

  attach(el: HTMLElement): void {
    if (this._element) this.detach()
    this._element = el
    el.addEventListener('touchstart', this._onTouchStart, { passive: false })
    el.addEventListener('touchmove', this._onTouchMove, { passive: false })
    el.addEventListener('touchend', this._onTouchEnd, { passive: false })
    el.addEventListener('touchcancel', this._onTouchEnd, { passive: false })
  }

  detach(): void {
    if (!this._element) return
    this._element.removeEventListener('touchstart', this._onTouchStart)
    this._element.removeEventListener('touchmove', this._onTouchMove)
    this._element.removeEventListener('touchend', this._onTouchEnd)
    this._element.removeEventListener('touchcancel', this._onTouchEnd)
    this._element = null
    this._touches.clear()
    this._justStarted.clear()
    this._justEnded.clear()
    this._startTime.clear()
  }

  /** Clear justStarted/justEnded — call once per frame */
  flush(): void {
    this._justStarted.clear()
    this._justEnded.clear()
  }

  /** All active touches */
  get touches(): TouchPoint[] {
    return [...this._touches.values()]
  }
  /** Touches that started this frame */
  get justStarted(): TouchPoint[] {
    return [...this._justStarted.values()]
  }
  /** Touches that ended this frame */
  get justEnded(): TouchPoint[] {
    return [...this._justEnded.values()]
  }
  /** Number of active touches */
  get count(): number {
    return this._touches.size
  }
  /** Check if any touch is active */
  get isTouching(): boolean {
    return this._touches.size > 0
  }
}
