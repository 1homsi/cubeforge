import { useContext, useEffect, useRef, type CSSProperties } from 'react'
import type { ECSWorld, EntityId, TransformComponent } from '@cubeforge/core'
import type { Camera2DComponent, SpriteComponent } from '@cubeforge/renderer'
import type { BoxColliderComponent, CircleColliderComponent } from '@cubeforge/physics'
import { EngineContext, EntityContext, type EngineState } from '../context'

export interface A11yNodeProps {
  /**
   * Accessible label read by screen readers. Required — this is what the user
   * will hear when the element is focused.
   */
  label: string
  /** Optional longer description (maps to aria-description). */
  description?: string
  /**
   * ARIA role. Defaults to 'button' if `onActivate` is provided, else 'presentation'.
   * Common values: 'button', 'checkbox', 'link', 'img', 'listitem', 'option'.
   */
  role?: string
  /**
   * Called when the user activates the element (click, Enter, or Space).
   * If provided, the element becomes keyboard focusable and gains role='button'.
   */
  onActivate?: (entityId: EntityId) => void
  /** Controls tab order. Default 0 (natural order), or -1 to skip. */
  tabIndex?: number
  /** ARIA pressed state for toggle buttons. */
  pressed?: boolean
  /** ARIA checked state for checkboxes/switches. */
  checked?: boolean
  /** ARIA disabled state. */
  disabled?: boolean
  /** ARIA selected state for list options. */
  selected?: boolean
  /** Override the element's bounding box in world units. If omitted, derived from Sprite/BoxCollider/CircleCollider. */
  bounds?: { width: number; height: number }
}

/**
 * Mirrors the parent {@link Entity} into a focusable, screen-reader-friendly
 * DOM element positioned over the canvas. Enables keyboard navigation and
 * accessibility for puzzle games, turn-based games, and any scene where the
 * canvas content has meaningful structure.
 *
 * The element is visually hidden (clipped to 1px) but focusable and in the
 * document flow, so screen readers announce it and Tab cycles through it. When
 * focused, it dispatches `onActivate(entityId)` on click, Enter, or Space.
 *
 * @example
 * ```tsx
 * <Entity>
 *   <Transform x={100} y={100} />
 *   <Sprite src="red-pawn.png" width={48} height={48} />
 *   <A11yNode
 *     label="Red pawn at E4"
 *     description="Press Enter to select"
 *     onActivate={(id) => selectPawn(id)}
 *   />
 * </Entity>
 * ```
 */
export function A11yNode({
  label,
  description,
  role,
  onActivate,
  tabIndex = 0,
  pressed,
  checked,
  disabled,
  selected,
  bounds,
}: A11yNodeProps) {
  const engine = useContext(EngineContext)
  const entityId = useContext(EntityContext)
  const nodeRef = useRef<HTMLButtonElement>(null)

  // Keep the node positioned over the entity so screen-reader "flyover" works.
  useEffect(() => {
    if (!engine || entityId === null || entityId === undefined) return
    const node = nodeRef.current
    if (!node) return
    let rafId = 0
    const tick = () => {
      const t = engine.ecs.getComponent<TransformComponent>(entityId as EntityId, 'Transform')
      if (t) {
        const screen = worldToScreenCss(engine, t.x, t.y)
        if (screen) {
          const size = bounds ?? deriveBounds(engine.ecs, entityId as EntityId) ?? { width: 16, height: 16 }
          const w = size.width * Math.abs(t.scaleX) * screen.zoom
          const h = size.height * Math.abs(t.scaleY) * screen.zoom
          // Keep a minimum 1px hit area so the element isn't collapsed away.
          node.style.left = `${screen.x - Math.max(w, 1) / 2}px`
          node.style.top = `${screen.y - Math.max(h, 1) / 2}px`
          node.style.width = `${Math.max(w, 1)}px`
          node.style.height = `${Math.max(h, 1)}px`
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [engine, entityId, bounds])

  if (!engine || entityId === null || entityId === undefined) return null

  const effectiveRole = role ?? (onActivate ? 'button' : 'presentation')

  const handleClick = () => onActivate?.(entityId as EntityId)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!onActivate) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onActivate(entityId as EntityId)
    }
  }

  // Visually-hidden-but-focusable styles (WAI-ARIA "sr-only" pattern with position adjusted
  // so the element actually sits under the entity for screen-reader flyover).
  const style: CSSProperties = {
    position: 'fixed',
    // Clip to 1px but stay focusable.
    clipPath: 'inset(50%)',
    clip: 'rect(0 0 0 0)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    background: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    font: 'inherit',
    color: 'inherit',
    cursor: 'pointer',
    pointerEvents: 'auto',
    zIndex: 9998,
  }

  return (
    <button
      ref={nodeRef}
      type="button"
      role={effectiveRole}
      tabIndex={disabled ? -1 : tabIndex}
      aria-label={label}
      aria-description={description}
      aria-pressed={pressed}
      aria-checked={checked}
      aria-disabled={disabled}
      aria-selected={selected}
      onClick={disabled ? undefined : handleClick}
      onKeyDown={disabled ? undefined : handleKeyDown}
      style={style}
    >
      {label}
    </button>
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
