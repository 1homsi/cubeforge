import { useContext, useEffect, useState } from 'react'
import type { EntityId, TransformComponent } from '@cubeforge/core'
import { EngineContext, EntityContext, type EngineState } from '../context'

// ── Shared focus registry ────────────────────────────────────────────────────
//
// Module-level so <FocusRing> and useKeyboardFocus can coordinate with
// useFocusable hooks anywhere in the tree without a provider.

interface FocusEntry {
  entityId: EntityId
  onFocus?: (id: EntityId) => void
  onBlur?: (id: EntityId) => void
  onActivate?: (id: EntityId) => void
}

const registry = new Map<EntityId, FocusEntry>()
let focusedId: EntityId | null = null
const subscribers = new Set<() => void>()

function notifyFocus() {
  for (const cb of subscribers) cb()
}

function setFocused(id: EntityId | null) {
  if (focusedId === id) return
  const prev = focusedId
  focusedId = id
  if (prev !== null) registry.get(prev)?.onBlur?.(prev)
  if (id !== null) registry.get(id)?.onFocus?.(id)
  notifyFocus()
}

// ── useFocusable ─────────────────────────────────────────────────────────────

export interface FocusableOptions {
  /** Called when this entity gains keyboard focus. */
  onFocus?: (id: EntityId) => void
  /** Called when this entity loses keyboard focus. */
  onBlur?: (id: EntityId) => void
  /** Called when the user activates this entity (Enter/Space). */
  onActivate?: (id: EntityId) => void
  /** If true and nothing else is focused when this mounts, take initial focus. */
  autoFocus?: boolean
}

/**
 * Register an entity as keyboard-focusable. Pair with {@link useKeyboardFocus}
 * and optionally {@link FocusRing} for a full accessible keyboard navigation
 * flow. Arrow keys move focus to the spatially-nearest registered entity in
 * the arrow's direction; Enter and Space trigger `onActivate`.
 *
 * @example
 * ```tsx
 * function Card({ id }: { id: number }) {
 *   useFocusable({ onActivate: () => selectCard(id) })
 *   return <Entity id={id}>…</Entity>
 * }
 * ```
 */
export function useFocusable(options?: FocusableOptions): void {
  const entityIdCtx = useContext(EntityContext)
  useEffect(() => {
    if (entityIdCtx === null || entityIdCtx === undefined) return
    const id = entityIdCtx as EntityId
    const entry: FocusEntry = {
      entityId: id,
      onFocus: options?.onFocus,
      onBlur: options?.onBlur,
      onActivate: options?.onActivate,
    }
    registry.set(id, entry)
    if (options?.autoFocus && focusedId === null) setFocused(id)
    return () => {
      registry.delete(id)
      if (focusedId === id) setFocused(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityIdCtx])
}

// ── useKeyboardFocus ─────────────────────────────────────────────────────────

export interface KeyboardFocusControls {
  /** The currently focused entity ID, or null. */
  focused: EntityId | null
  /** Manually set focus to a specific entity. */
  focus(id: EntityId | null): void
  /** Move focus to the next registered entity (insertion order). */
  next(): void
  /** Move focus to the previous registered entity. */
  prev(): void
  /** Move focus in a world-space direction using spatial nearest-neighbor. */
  move(direction: 'up' | 'down' | 'left' | 'right'): void
  /** Activate the currently focused entity (fires its `onActivate`). */
  activate(): void
}

/**
 * Keyboard-driven focus navigation across all {@link useFocusable} entities in
 * the scene. Arrow keys move focus spatially (nearest neighbor in the arrow's
 * direction), Tab/Shift+Tab cycles through registration order, and Enter/Space
 * activates the focused entity.
 *
 * @example
 * ```tsx
 * function Board() {
 *   useKeyboardFocus() // arrow keys automatically move between cards
 *   return (
 *     <>
 *       <FocusRing />
 *       <Card id={1} />
 *       <Card id={2} />
 *     </>
 *   )
 * }
 * ```
 */
export function useKeyboardFocus(): KeyboardFocusControls {
  const engine = useContext(EngineContext)
  const [focused, setFocusedState] = useState<EntityId | null>(focusedId)

  useEffect(() => {
    const cb = () => setFocusedState(focusedId)
    subscribers.add(cb)
    return () => {
      subscribers.delete(cb)
    }
  }, [])

  useEffect(() => {
    if (!engine) return
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack keys when focus is inside an input/textarea/contenteditable
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          moveSpatial(engine, 'up')
          break
        case 'ArrowDown':
          e.preventDefault()
          moveSpatial(engine, 'down')
          break
        case 'ArrowLeft':
          e.preventDefault()
          moveSpatial(engine, 'left')
          break
        case 'ArrowRight':
          e.preventDefault()
          moveSpatial(engine, 'right')
          break
        case 'Tab': {
          e.preventDefault()
          const ids = Array.from(registry.keys())
          if (ids.length === 0) return
          const idx = focusedId === null ? -1 : ids.indexOf(focusedId)
          const nextIdx = e.shiftKey ? (idx <= 0 ? ids.length - 1 : idx - 1) : (idx + 1) % ids.length
          setFocused(ids[nextIdx])
          engine.loop.markDirty()
          break
        }
        case 'Enter':
        case ' ': {
          if (focusedId === null) return
          e.preventDefault()
          registry.get(focusedId)?.onActivate?.(focusedId)
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [engine])

  return {
    focused,
    focus: (id) => {
      setFocused(id)
      engine?.loop.markDirty()
    },
    next: () => {
      const ids = Array.from(registry.keys())
      if (ids.length === 0) return
      const idx = focusedId === null ? -1 : ids.indexOf(focusedId)
      setFocused(ids[(idx + 1) % ids.length])
      engine?.loop.markDirty()
    },
    prev: () => {
      const ids = Array.from(registry.keys())
      if (ids.length === 0) return
      const idx = focusedId === null ? 0 : ids.indexOf(focusedId)
      setFocused(ids[idx <= 0 ? ids.length - 1 : idx - 1])
      engine?.loop.markDirty()
    },
    move: (direction) => {
      if (engine) moveSpatial(engine, direction)
    },
    activate: () => {
      if (focusedId !== null) registry.get(focusedId)?.onActivate?.(focusedId)
    },
  }
}

function moveSpatial(engine: EngineState, direction: 'up' | 'down' | 'left' | 'right') {
  const current = focusedId === null ? null : registry.get(focusedId)
  const currentT =
    current !== undefined && current !== null
      ? engine.ecs.getComponent<TransformComponent>(current.entityId, 'Transform')
      : null

  // If there's no current focus, pick the entity closest to the screen origin.
  if (!currentT) {
    let best: EntityId | null = null
    let bestDist = Infinity
    for (const entry of registry.values()) {
      const t = engine.ecs.getComponent<TransformComponent>(entry.entityId, 'Transform')
      if (!t) continue
      const d = t.x * t.x + t.y * t.y
      if (d < bestDist) {
        bestDist = d
        best = entry.entityId
      }
    }
    if (best !== null) {
      setFocused(best)
      engine.loop.markDirty()
    }
    return
  }

  // Find the entity whose direction from current matches the key and whose
  // distance (with perpendicular-axis penalty) is smallest.
  const dirSign = direction === 'up' || direction === 'left' ? -1 : 1
  const isHoriz = direction === 'left' || direction === 'right'
  let best: EntityId | null = null
  let bestScore = Infinity
  for (const entry of registry.values()) {
    if (entry.entityId === focusedId) continue
    const t = engine.ecs.getComponent<TransformComponent>(entry.entityId, 'Transform')
    if (!t) continue
    const dx = t.x - currentT.x
    const dy = t.y - currentT.y
    const along = isHoriz ? dx : dy
    // Must move in the right direction
    if (along * dirSign <= 0) continue
    const perp = isHoriz ? dy : dx
    // Score: distance along the arrow, with a 3x penalty on perpendicular offset
    const score = Math.abs(along) + Math.abs(perp) * 3
    if (score < bestScore) {
      bestScore = score
      best = entry.entityId
    }
  }
  if (best !== null) {
    setFocused(best)
    engine.loop.markDirty()
  }
}

// ── FocusRing ────────────────────────────────────────────────────────────────
//
// Lightweight DOM overlay that outlines the currently focused entity. Lives in
// this file rather than its own so it shares the registry state.

export function getFocusedEntityId(): EntityId | null {
  return focusedId
}

export function subscribeFocus(cb: () => void): () => void {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}
