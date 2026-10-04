import { useEffect, useRef } from 'react'
import type { Camera2DComponent } from '@cubeforge/renderer'
import { useGame } from './useGame'

export interface CameraPanZoomOptions {
  enabled?: boolean
  minZoom?: number
  maxZoom?: number
  /** Zoom factor per wheel pixel (exponential). Default 0.0015. */
  wheelSpeed?: number
  /** Keep gliding after a drag. Default true. */
  inertia?: boolean
  /** Velocity kept per 1/60 s while gliding, 0..1. Default 0.92. */
  friction?: number
  /** Mouse buttons that pan. Default [0, 1, 2]. */
  buttons?: number[]
  /** Pointer travel (CSS px) before a press becomes a drag instead of a tap. Default 6. */
  dragThreshold?: number
  /** Press released without dragging, in canvas CSS px and world units. */
  onTap?: (e: { screenX: number; screenY: number; worldX: number; worldY: number; button: number }) => void
}

interface Ptr {
  x: number
  y: number
  sx: number
  sy: number
}

/**
 * Mouse + touch camera control on the game canvas: drag to pan (with inertia),
 * wheel and pinch zoom around the cursor / fingers, and tap detection for
 * selection. Works with `<Camera2D pixelSnap>` and camera bounds.
 */
export function useCameraPanZoom(options: CameraPanZoomOptions = {}): void {
  const engine = useGame()
  const opts = useRef(options)
  opts.current = options

  useEffect(() => {
    const canvas = engine.canvas
    const ptrs = new Map<number, Ptr>()
    let dragging = false
    let pinchDist = 0
    let vx = 0
    let vy = 0
    let lastMove = 0
    let glide = 0

    const cam = (): Camera2DComponent | undefined => {
      const id = engine.ecs.queryOne('Camera2D')
      return id === undefined ? undefined : engine.ecs.getComponent<Camera2DComponent>(id, 'Camera2D')
    }
    const local = (e: { clientX: number; clientY: number }) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const size = () => ({ w: canvas.clientWidth || canvas.width, h: canvas.clientHeight || canvas.height })
    const clampZoom = (z: number) => Math.min(opts.current.maxZoom ?? 4, Math.max(opts.current.minZoom ?? 0.05, z))

    const zoomAt = (c: Camera2DComponent, sx: number, sy: number, zoom: number) => {
      const { w, h } = size()
      const z = clampZoom(zoom)
      const dx = sx - w / 2
      const dy = sy - h / 2
      c.x += dx / c.zoom - dx / z
      c.y += dy / c.zoom - dy / z
      c.zoom = z
    }
    const stopGlide = () => {
      if (glide) cancelAnimationFrame(glide)
      glide = 0
    }

    const onDown = (e: PointerEvent) => {
      if (opts.current.enabled === false) return
      if (e.pointerType === 'mouse' && !(opts.current.buttons ?? [0, 1, 2]).includes(e.button)) return
      stopGlide()
      const p = local(e)
      ptrs.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y })
      canvas.setPointerCapture?.(e.pointerId)
      vx = vy = 0
      lastMove = performance.now()
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
        dragging = true
      }
    }

    const onMove = (e: PointerEvent) => {
      const p = ptrs.get(e.pointerId)
      if (!p) return
      const c = cam()
      const q = local(e)
      if (!dragging && Math.hypot(q.x - p.sx, q.y - p.sy) >= (opts.current.dragThreshold ?? 6)) dragging = true
      if (!c || !dragging) {
        p.x = q.x
        p.y = q.y
        return
      }
      if (ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()]
        const midX0 = (a.x + b.x) / 2
        const midY0 = (a.y + b.y) / 2
        p.x = q.x
        p.y = q.y
        const midX = (a.x + b.x) / 2
        const midY = (a.y + b.y) / 2
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        c.x -= (midX - midX0) / c.zoom
        c.y -= (midY - midY0) / c.zoom
        if (pinchDist > 0) zoomAt(c, midX, midY, (c.zoom * dist) / pinchDist)
        pinchDist = dist
        vx = vy = 0
      } else {
        const dx = (q.x - p.x) / c.zoom
        const dy = (q.y - p.y) / c.zoom
        p.x = q.x
        p.y = q.y
        c.x -= dx
        c.y -= dy
        const now = performance.now()
        const dt = Math.max(1, now - lastMove) / 1000
        lastMove = now
        // Smoothed release velocity in world units / s.
        vx = vx * 0.6 + (-dx / dt) * 0.4
        vy = vy * 0.6 + (-dy / dt) * 0.4
      }
      engine.loop.markDirty()
    }

    const onUp = (e: PointerEvent) => {
      const p = ptrs.get(e.pointerId)
      if (!p) return
      ptrs.delete(e.pointerId)
      canvas.releasePointerCapture?.(e.pointerId)
      if (ptrs.size === 1) {
        // Continue as a one-finger pan from where the remaining finger is.
        pinchDist = 0
        vx = vy = 0
        return
      }
      if (ptrs.size > 0) return
      const c = cam()
      if (!dragging && c && opts.current.onTap) {
        const { w, h } = size()
        opts.current.onTap({
          screenX: p.x,
          screenY: p.y,
          worldX: c.x + (p.x - w / 2) / c.zoom,
          worldY: c.y + (p.y - h / 2) / c.zoom,
          button: e.button,
        })
      }
      const idle = performance.now() - lastMove > 80
      if (dragging && c && opts.current.inertia !== false && !idle && Math.hypot(vx, vy) > 20) {
        let last = performance.now()
        const step = () => {
          const now = performance.now()
          const dt = Math.min(0.05, (now - last) / 1000)
          last = now
          const k = Math.pow(opts.current.friction ?? 0.92, dt * 60)
          vx *= k
          vy *= k
          c.x += vx * dt
          c.y += vy * dt
          engine.loop.markDirty()
          glide = Math.hypot(vx, vy) > 5 ? requestAnimationFrame(step) : 0
        }
        glide = requestAnimationFrame(step)
      }
      dragging = false
    }

    const onWheel = (e: WheelEvent) => {
      if (opts.current.enabled === false) return
      const c = cam()
      if (!c) return
      e.preventDefault()
      stopGlide()
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY
      const p = local(e)
      zoomAt(c, p.x, p.y, c.zoom * Math.exp(-px * (opts.current.wheelSpeed ?? 0.0015)))
      engine.loop.markDirty()
    }

    const prevTouchAction = canvas.style.touchAction
    canvas.style.touchAction = 'none'
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      stopGlide()
      canvas.style.touchAction = prevTouchAction
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [engine])
}
