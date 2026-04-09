import { useCallback, useContext } from 'react'
import type { ECSWorld, EntityId, TransformComponent } from '@cubeforge/core'
import type { SpriteComponent } from '@cubeforge/renderer'
import type { BoxColliderComponent, CircleColliderComponent } from '@cubeforge/physics'
import { EngineContext } from '../context'

export interface SnapOptions {
  /**
   * Grid cell size in world units. If set, points are snapped to the nearest
   * multiple of `grid`. Can be a single number (uniform) or `{ x, y }`.
   */
  grid?: number | { x: number; y: number }
  /**
   * When true, snap to the edges/centers of other entities that have a Sprite or
   * collider within `threshold` distance. Default false.
   */
  snapToEntities?: boolean
  /**
   * Maximum distance in world units at which entity-edge snapping triggers.
   * Default 8.
   */
  threshold?: number
  /**
   * Entity IDs to exclude from entity snapping (e.g. the entity being dragged).
   */
  exclude?: EntityId[]
}

export interface SnapResult {
  x: number
  y: number
  /** True if the returned point was snapped (to grid or to an entity). */
  snapped: boolean
  /** 'grid' | 'entity' | null, describing which snap fired. */
  source: 'grid' | 'entity' | null
}

export interface SnapControls {
  /** Snap a world-space point to the nearest grid cell and/or nearby entity edge. */
  snap(x: number, y: number): SnapResult
  /** Snap just to the grid, ignoring any entity edges. */
  snapToGrid(x: number, y: number): { x: number; y: number }
}

/**
 * Returns snap helpers for puzzle games, level editors, and tile-based placement.
 *
 * @example
 * ```tsx
 * function DraggablePiece() {
 *   const { snap } = useSnap({ grid: 32, snapToEntities: true, threshold: 6 })
 *   const onDrag = (x: number, y: number) => {
 *     const result = snap(x, y)
 *     piece.x = result.x
 *     piece.y = result.y
 *   }
 *   // …
 * }
 * ```
 */
export function useSnap(options?: SnapOptions): SnapControls {
  const engine = useContext(EngineContext)!
  const gridX = typeof options?.grid === 'number' ? options.grid : (options?.grid?.x ?? 0)
  const gridY = typeof options?.grid === 'number' ? options.grid : (options?.grid?.y ?? 0)
  const snapToEntities = options?.snapToEntities ?? false
  const threshold = options?.threshold ?? 8
  const exclude = options?.exclude

  const snapToGrid = useCallback(
    (x: number, y: number) => {
      const sx = gridX > 0 ? Math.round(x / gridX) * gridX : x
      const sy = gridY > 0 ? Math.round(y / gridY) * gridY : y
      return { x: sx, y: sy }
    },
    [gridX, gridY],
  )

  const snap = useCallback(
    (x: number, y: number): SnapResult => {
      let outX = x
      let outY = y
      let snapped = false
      let source: 'grid' | 'entity' | null = null

      if (snapToEntities) {
        // Find the closest edge/center among other entities within threshold.
        let bestDx = threshold + 1
        let bestDy = threshold + 1
        let bestX = x
        let bestY = y
        const excludeSet = exclude ? new Set(exclude) : null
        const entities = engine.ecs.query('Transform')
        for (const id of entities) {
          if (excludeSet?.has(id)) continue
          const t = engine.ecs.getComponent<TransformComponent>(id, 'Transform')
          if (!t) continue
          const bounds = getBounds(engine.ecs, id)
          if (!bounds) continue
          const hw = (bounds.w * Math.abs(t.scaleX)) / 2
          const hh = (bounds.h * Math.abs(t.scaleY)) / 2
          // Candidate x values: left edge, center, right edge
          const xs = [t.x - hw, t.x, t.x + hw]
          const ys = [t.y - hh, t.y, t.y + hh]
          for (const cx of xs) {
            const dx = Math.abs(x - cx)
            if (dx < bestDx) {
              bestDx = dx
              bestX = cx
            }
          }
          for (const cy of ys) {
            const dy = Math.abs(y - cy)
            if (dy < bestDy) {
              bestDy = dy
              bestY = cy
            }
          }
        }
        if (bestDx <= threshold) {
          outX = bestX
          snapped = true
          source = 'entity'
        }
        if (bestDy <= threshold) {
          outY = bestY
          snapped = true
          source = 'entity'
        }
      }

      if (gridX > 0 || gridY > 0) {
        const g = snapToGrid(outX, outY)
        // Grid wins only if we didn't already snap to an entity (keeps entity snap exact)
        if (source !== 'entity') {
          outX = g.x
          outY = g.y
          snapped = true
          source = 'grid'
        }
      }

      return { x: outX, y: outY, snapped, source }
    },
    [engine, gridX, gridY, snapToEntities, threshold, exclude, snapToGrid],
  )

  return { snap, snapToGrid }
}

// ── Internals ────────────────────────────────────────────────────────────────

function getBounds(ecs: ECSWorld, id: EntityId): { w: number; h: number } | null {
  const sprite = ecs.getComponent<SpriteComponent>(id, 'Sprite')
  if (sprite) return { w: sprite.width, h: sprite.height }
  const box = ecs.getComponent<BoxColliderComponent>(id, 'BoxCollider')
  if (box) return { w: box.width, h: box.height }
  const circle = ecs.getComponent<CircleColliderComponent>(id, 'CircleCollider')
  if (circle) return { w: circle.radius * 2, h: circle.radius * 2 }
  return null
}
