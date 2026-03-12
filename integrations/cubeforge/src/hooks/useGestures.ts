import { useEffect, useRef } from 'react'

// ─── Event types ──────────────────────────────────────────────────────────────

export interface SwipeEvent {
  /** Cardinal direction of the swipe. */
  direction: 'up' | 'down' | 'left' | 'right'
  /** Total distance in pixels. */
  distance: number
  /** Pixels per second at the end of the gesture. */
  velocity: number
}

export interface PinchEvent {
  /** Current scale factor relative to pinch start (< 1 = pinch in, > 1 = spread). */
  scale: number
  /** Change in scale since the last event. */
  delta: number
}

export interface GestureHandlers {
  /** Fires when a fast directional flick is detected. */
  onSwipe?: (event: SwipeEvent) => void
  /** Fires once when a two-finger pinch/spread begins. */
  onPinchStart?: () => void
  /** Fires each frame during an active pinch gesture. */
  onPinch?: (event: PinchEvent) => void
  /** Fires once when a single touch is held in place without moving. */
  onLongPress?: (x: number, y: number) => void
}

export interface GestureOptions {
  /**
   * Minimum pixel distance before a move is classified as a swipe (default 40).
   */
  swipeThreshold?: number
  /**
   * Minimum velocity (px/s) required for swipe detection (default 200).
   */
  swipeVelocityThreshold?: number
  /**
   * Duration in milliseconds a touch must be held before firing onLongPress (default 500).
   */
  longPressDelay?: number
  /**
   * Maximum pixel movement allowed while waiting for a long-press (default 10).
   */
  longPressTolerance?: number
  /**
   * Element to attach listeners to. Defaults to `window`.
   */
  target?: HTMLElement | null
}

/**
 * Recognizes common touch gestures (swipe, pinch, long-press) on top of the
 * raw Touch API. Attach to any element or the whole window.
 *
 * @example
 * useGestures({
 *   onSwipe: ({ direction }) => { if (direction === 'left') nextCard() },
 *   onPinch: ({ scale }) => setZoom(scale),
 *   onLongPress: (x, y) => openContextMenu(x, y),
 * })
 */
export function useGestures(handlers: GestureHandlers, opts: GestureOptions = {}): void {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    const target: EventTarget = optsRef.current.target ?? window

    // ── Shared state ─────────────────────────────────────────────────────────

    interface TouchStart {
      id: number
      x: number
      y: number
      t: number
    }

    let starts: TouchStart[] = []
    let longPressTimer: ReturnType<typeof setTimeout> | null = null
    let prevPinchDist = 0
    let prevPinchScale = 1
    let pinchActive = false

    function pinchDist(a: Touch, b: Touch) {
      const dx = a.clientX - b.clientX
      const dy = a.clientY - b.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    function clearLongPress() {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
    }

    // ── Listeners ─────────────────────────────────────────────────────────────

    function onStart(e: TouchEvent) {
      const { swipeThreshold = 40, longPressDelay = 500 } = optsRef.current

      for (const t of Array.from(e.changedTouches)) {
        starts.push({ id: t.identifier, x: t.clientX, y: t.clientY, t: Date.now() })
      }

      if (e.touches.length === 2) {
        pinchActive = true
        prevPinchDist = pinchDist(e.touches[0], e.touches[1])
        prevPinchScale = 1
        handlersRef.current.onPinchStart?.()
        clearLongPress()
      }

      if (e.touches.length === 1) {
        clearLongPress()
        const touch = e.touches[0]
        const startX = touch.clientX
        const startY = touch.clientY
        const tolerance = optsRef.current.longPressTolerance ?? 10

        longPressTimer = setTimeout(() => {
          longPressTimer = null
          // Only fire if touch hasn't moved much
          const s = starts.find((s) => s.id === touch.identifier)
          if (!s) return
          const dx = touch.clientX - startX
          const dy = touch.clientY - startY
          if (Math.sqrt(dx * dx + dy * dy) < tolerance) {
            handlersRef.current.onLongPress?.(startX, startY)
          }
        }, longPressDelay)

        void swipeThreshold // used in onEnd
      }
    }

    function onMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinchActive) {
        const dist = pinchDist(e.touches[0], e.touches[1])
        const scale = prevPinchDist > 0 ? dist / prevPinchDist : 1
        const delta = scale - prevPinchScale
        prevPinchScale = scale
        handlersRef.current.onPinch?.({ scale, delta })
      }

      // Cancel long-press if finger moves beyond tolerance
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        const s = starts.find((s) => s.id === touch.identifier)
        if (s) {
          const dx = touch.clientX - s.x
          const dy = touch.clientY - s.y
          const tolerance = optsRef.current.longPressTolerance ?? 10
          if (Math.sqrt(dx * dx + dy * dy) > tolerance) {
            clearLongPress()
          }
        }
      }
    }

    function onEnd(e: TouchEvent) {
      clearLongPress()
      pinchActive = false

      const { swipeThreshold = 40, swipeVelocityThreshold = 200 } = optsRef.current

      for (const t of Array.from(e.changedTouches)) {
        const s = starts.find((s) => s.id === t.identifier)
        if (!s) continue
        starts = starts.filter((s) => s.id !== t.identifier)

        const dx = t.clientX - s.x
        const dy = t.clientY - s.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const elapsed = (Date.now() - s.t) / 1000
        const velocity = elapsed > 0 ? dist / elapsed : 0

        if (dist >= swipeThreshold && velocity >= swipeVelocityThreshold) {
          const direction: SwipeEvent['direction'] =
            Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
          handlersRef.current.onSwipe?.({ direction, distance: dist, velocity })
        }
      }
    }

    function onCancel() {
      clearLongPress()
      starts = []
      pinchActive = false
    }

    target.addEventListener('touchstart', onStart as EventListener, { passive: true })
    target.addEventListener('touchmove', onMove as EventListener, { passive: true })
    target.addEventListener('touchend', onEnd as EventListener, { passive: true })
    target.addEventListener('touchcancel', onCancel as EventListener)

    return () => {
      clearLongPress()
      target.removeEventListener('touchstart', onStart as EventListener)
      target.removeEventListener('touchmove', onMove as EventListener)
      target.removeEventListener('touchend', onEnd as EventListener)
      target.removeEventListener('touchcancel', onCancel as EventListener)
    }
  }, [opts.target]) // re-attach only when target element changes
}
