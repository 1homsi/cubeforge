import { useContext, useEffect, useState } from 'react'
import type { ECSWorld, EntityId, TransformComponent } from '@cubeforge/core'
import type { Camera2DComponent, SpriteComponent } from '@cubeforge/renderer'
import type { BoxColliderComponent, CircleColliderComponent } from '@cubeforge/physics'
import { EngineContext, EntityContext, type EngineState } from '../context'

export interface HoverableOptions {
  /** Override the entity ID to hit-test. Defaults to the surrounding <Entity> context. */
  entityId?: EntityId
  /**
   * Custom bounds in world units. If omitted, derived from Sprite → BoxCollider →
   * CircleCollider on the target entity.
   */
  bounds?: { width: number; height: number }
  /** Called once when the pointer enters the entity. */
  onEnter?: (id: EntityId) => void
  /** Called once when the pointer leaves the entity. */
  onLeave?: (id: EntityId) => void
  /** Disable hover tracking entirely. */
  disabled?: boolean
}

export interface HoverableControls {
  /** True while the pointer is over the entity's bounding box. */
  isHovered: boolean
}

/**
 * Reactive "is the pointer over this entity?" state. Hit-tests against the
 * entity's Sprite / BoxCollider / CircleCollider bounds every pointermove,
 * respecting the active Camera2D zoom and pan.
 *
 * Calls `engine.loop.markDirty()` on state change, so in onDemand mode the
 * canvas re-renders automatically (useful for "highlight under cursor" effects).
 *
 * @example
 * ```tsx
 * function Card() {
 *   const { isHovered } = useHoverable({
 *     onEnter: (id) => console.log('enter', id),
 *   })
 *   return (
 *     <Entity>
 *       <Transform x={100} y={100} />
 *       <Sprite src="card.png" width={80} height={120} opacity={isHovered ? 1 : 0.8} />
 *     </Entity>
 *   )
 * }
 * ```
 */
export function useHoverable(options?: HoverableOptions): HoverableControls {
  const engine = useContext(EngineContext)
  const ctxEntityId = useContext(EntityContext)
  const entityId = options?.entityId ?? ctxEntityId
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (!engine || entityId === null || entityId === undefined || options?.disabled) return
    const canvas = engine.canvas
    let hovered = false

    const onMove = (e: PointerEvent) => {
      const t = engine.ecs.getComponent<TransformComponent>(entityId as EntityId, 'Transform')
      if (!t) return
      const rect = canvas.getBoundingClientRect()
      // Pointer in CSS pixels relative to canvas top-left
      const cssX = e.clientX - rect.left
      const cssY = e.clientY - rect.top
      // Convert to world using camera
      const world = screenToWorld(engine, cssX, cssY)
      if (!world) return
      const bounds = options?.bounds ?? deriveBounds(engine.ecs, entityId as EntityId)
      if (!bounds) return
      const halfW = (bounds.width * Math.abs(t.scaleX)) / 2
      const halfH = (bounds.height * Math.abs(t.scaleY)) / 2
      // Rotate the pointer into the entity's local frame
      const dx = world.x - t.x
      const dy = world.y - t.y
      const cos = Math.cos(-t.rotation)
      const sin = Math.sin(-t.rotation)
      const localX = dx * cos - dy * sin
      const localY = dx * sin + dy * cos
      const inside = Math.abs(localX) <= halfW && Math.abs(localY) <= halfH

      if (inside && !hovered) {
        hovered = true
        setIsHovered(true)
        options?.onEnter?.(entityId as EntityId)
        engine.loop.markDirty()
      } else if (!inside && hovered) {
        hovered = false
        setIsHovered(false)
        options?.onLeave?.(entityId as EntityId)
        engine.loop.markDirty()
      }
    }

    const onLeaveCanvas = () => {
      if (hovered) {
        hovered = false
        setIsHovered(false)
        options?.onLeave?.(entityId as EntityId)
        engine.loop.markDirty()
      }
    }

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeaveCanvas)
    return () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeaveCanvas)
    }
  }, [engine, entityId, options])

  return { isHovered }
}

// ── Internals ────────────────────────────────────────────────────────────────

function deriveBounds(ecs: ECSWorld, id: EntityId): { width: number; height: number } | null {
  const sprite = ecs.getComponent<SpriteComponent>(id, 'Sprite')
  if (sprite) return { width: sprite.width, height: sprite.height }
  const box = ecs.getComponent<BoxColliderComponent>(id, 'BoxCollider')
  if (box) return { width: box.width, height: box.height }
  const circle = ecs.getComponent<CircleColliderComponent>(id, 'CircleCollider')
  if (circle) return { width: circle.radius * 2, height: circle.radius * 2 }
  return null
}

function screenToWorld(engine: EngineState, cssX: number, cssY: number): { x: number; y: number } | null {
  const canvas = engine.canvas
  const camId = engine.ecs.queryOne('Camera2D')
  if (camId === undefined) {
    return { x: cssX - canvas.clientWidth / 2, y: cssY - canvas.clientHeight / 2 }
  }
  const cam = engine.ecs.getComponent<Camera2DComponent>(camId, 'Camera2D')
  if (!cam) return null
  const zoom = cam.zoom
  return {
    x: cam.x + (cssX - canvas.clientWidth / 2) / zoom,
    y: cam.y + (cssY - canvas.clientHeight / 2) / zoom,
  }
}
