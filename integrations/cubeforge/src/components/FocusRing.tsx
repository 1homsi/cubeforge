import { useContext, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ECSWorld, EntityId, TransformComponent } from '@cubeforge/core'
import type { Camera2DComponent, SpriteComponent } from '@cubeforge/renderer'
import type { BoxColliderComponent, CircleColliderComponent } from '@cubeforge/physics'
import { EngineContext, type EngineState } from '../context'
import { getFocusedEntityId, subscribeFocus } from '../hooks/useKeyboardFocus'
import { useOverlayTick } from '../hooks/useOverlayTick'

export interface FocusRingProps {
  /** Ring color. Default '#4fc3f7'. */
  color?: string
  /** Ring width in CSS pixels. Default 3. */
  width?: number
  /** Extra padding around the entity bounds in CSS pixels. Default 4. */
  padding?: number
  /** Border radius in CSS pixels. Default 4. */
  borderRadius?: number
  /** Show a pulsing animation. Default true. */
  pulse?: boolean
}

/**
 * Visual indicator of the currently keyboard-focused entity. Pairs with
 * {@link useKeyboardFocus} and {@link useFocusable} to provide a full sighted
 * keyboard navigation experience.
 *
 * Renders as a DOM overlay outline that tracks the focused entity's Transform
 * and bounds. Respects `prefers-reduced-motion` (disables the pulse when set).
 *
 * @example
 * ```tsx
 * <Stage>
 *   <FocusRing color="#4fc3f7" />
 *   {/* cards that use useFocusable() *\/}
 * </Stage>
 * ```
 */
export function FocusRing({
  color = '#4fc3f7',
  width = 3,
  padding = 4,
  borderRadius = 4,
  pulse = true,
}: FocusRingProps) {
  const engine = useContext(EngineContext)
  const ringRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState<EntityId | null>(getFocusedEntityId())
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const unsub = subscribeFocus(() => setFocused(getFocusedEntityId()))
    return unsub
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const cb = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }, [])

  useOverlayTick(() => {
    if (!engine) return
    const ring = ringRef.current
    if (!ring) return
    if (focused === null) {
      ring.style.display = 'none'
      return
    }
    const t = engine.ecs.getComponent<TransformComponent>(focused, 'Transform')
    if (!t) {
      ring.style.display = 'none'
      return
    }
    const screen = worldToScreenCss(engine, t.x, t.y)
    if (!screen) {
      ring.style.display = 'none'
      return
    }
    const bounds = deriveBounds(engine.ecs, focused) ?? { width: 16, height: 16 }
    const w = bounds.width * Math.abs(t.scaleX) * screen.zoom + padding * 2
    const h = bounds.height * Math.abs(t.scaleY) * screen.zoom + padding * 2
    ring.style.display = 'block'
    ring.style.left = `${screen.x - w / 2}px`
    ring.style.top = `${screen.y - h / 2}px`
    ring.style.width = `${w}px`
    ring.style.height = `${h}px`
    ring.style.transform = `rotate(${t.rotation}rad)`
  }, [engine, focused, padding])

  if (!engine) return null

  const style: CSSProperties = {
    position: 'fixed',
    border: `${width}px solid ${color}`,
    borderRadius,
    boxSizing: 'border-box',
    pointerEvents: 'none',
    zIndex: 9996,
    display: 'none',
    transformOrigin: 'center center',
    boxShadow: `0 0 0 1px rgba(255,255,255,0.4), 0 0 12px ${color}88`,
    animation: pulse && !reducedMotion ? 'cubeforge-focus-pulse 1.4s ease-in-out infinite' : undefined,
  }

  return (
    <>
      <div ref={ringRef} style={style} aria-hidden="true" />
      {pulse && !reducedMotion && (
        <style>{`
          @keyframes cubeforge-focus-pulse {
            0%, 100% { opacity: 1; }
            50%      { opacity: 0.55; }
          }
        `}</style>
      )}
    </>
  )
}

function deriveBounds(ecs: ECSWorld, id: EntityId): { width: number; height: number } | null {
  const sprite = ecs.getComponent<SpriteComponent>(id, 'Sprite')
  if (sprite) return { width: sprite.width, height: sprite.height }
  const box = ecs.getComponent<BoxColliderComponent>(id, 'BoxCollider')
  if (box) return { width: box.width, height: box.height }
  const circle = ecs.getComponent<CircleColliderComponent>(id, 'CircleCollider')
  if (circle) return { width: circle.radius * 2, height: circle.radius * 2 }
  return null
}

function worldToScreenCss(engine: EngineState, wx: number, wy: number): { x: number; y: number; zoom: number } | null {
  const canvas = engine.canvas
  const rect = canvas.getBoundingClientRect()
  const camId = engine.ecs.queryOne('Camera2D')
  if (camId === undefined) {
    return { x: rect.left + canvas.clientWidth / 2 + wx, y: rect.top + canvas.clientHeight / 2 + wy, zoom: 1 }
  }
  const cam = engine.ecs.getComponent<Camera2DComponent>(camId, 'Camera2D')
  if (!cam) return null
  const zoom = cam.zoom
  const x = rect.left + canvas.clientWidth / 2 + (wx - cam.x) * zoom
  const y = rect.top + canvas.clientHeight / 2 + (wy - cam.y) * zoom
  return { x, y, zoom }
}
