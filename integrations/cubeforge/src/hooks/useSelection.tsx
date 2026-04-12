import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { EntityId } from '@cubeforge/core'
import { EngineContext } from '../context'

export interface SelectOptions {
  /** If true, add to the current selection instead of replacing it. */
  additive?: boolean
}

export interface SelectionControls {
  /** The currently selected entity IDs, in selection order. */
  selected: EntityId[]
  /** Select one entity. Pass `{ additive: true }` to add to existing selection. */
  select(id: EntityId, opts?: SelectOptions): void
  /** Remove an entity from the selection. */
  deselect(id: EntityId): void
  /** Toggle an entity's selection state. */
  toggle(id: EntityId): void
  /** Clear the entire selection. */
  clear(): void
  /** True if the given entity is currently selected. */
  isSelected(id: EntityId): boolean
}

const SelectionContext = createContext<SelectionControls | null>(null)

export interface SelectionProps {
  /** Initial selection when the provider mounts. */
  initial?: EntityId[]
  /** Called every time the selection changes. */
  onChange?: (selected: EntityId[]) => void
  children?: ReactNode
}

/**
 * Provides a selection state to descendants. Works with {@link TransformHandles}
 * to render drag-to-move/resize/rotate handles, or with any custom UI.
 *
 * @example
 * ```tsx
 * <Stage>
 *   <Selection>
 *     <Entity>
 *       <Sprite src="card.png" width={80} height={120} />
 *     </Entity>
 *     <TransformHandles />
 *   </Selection>
 * </Stage>
 * ```
 */
export function Selection({ initial, onChange, children }: SelectionProps) {
  const engine = useContext(EngineContext)
  const [selected, setSelected] = useState<EntityId[]>(initial ?? [])

  // Auto-prune destroyed entities so stale IDs don't linger in the selection.
  useEffect(() => {
    if (!engine) return
    return engine.ecs.onDestroyEntity((destroyedId) => {
      setSelected((prev) => {
        if (!prev.includes(destroyedId)) return prev
        const next = prev.filter((id) => id !== destroyedId)
        onChange?.(next)
        return next
      })
    })
  }, [engine, onChange])

  const commit = useCallback(
    (next: EntityId[]) => {
      setSelected(next)
      onChange?.(next)
    },
    [onChange],
  )

  const select = useCallback(
    (id: EntityId, opts?: SelectOptions) => {
      if (opts?.additive) {
        setSelected((prev) => {
          if (prev.includes(id)) return prev
          const next = [...prev, id]
          onChange?.(next)
          return next
        })
      } else {
        commit([id])
      }
    },
    [commit, onChange],
  )

  const deselect = useCallback(
    (id: EntityId) => {
      setSelected((prev) => {
        if (!prev.includes(id)) return prev
        const next = prev.filter((x) => x !== id)
        onChange?.(next)
        return next
      })
    },
    [onChange],
  )

  const toggle = useCallback(
    (id: EntityId) => {
      setSelected((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        onChange?.(next)
        return next
      })
    },
    [onChange],
  )

  const clear = useCallback(() => commit([]), [commit])

  const isSelected = useCallback((id: EntityId) => selected.includes(id), [selected])

  const value = useMemo<SelectionControls>(
    () => ({ selected, select, deselect, toggle, clear, isSelected }),
    [selected, select, deselect, toggle, clear, isSelected],
  )

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}

/**
 * Reads and mutates the selection state from inside a {@link Selection} provider.
 *
 * @example
 * ```tsx
 * function Card({ id }: { id: number }) {
 *   const { select, isSelected } = useSelection()
 *   return <button onClick={() => select(id)}>{isSelected(id) ? '✓' : ''} Card</button>
 * }
 * ```
 */
export function useSelection(): SelectionControls {
  const ctx = useContext(SelectionContext)
  if (!ctx) throw new Error('useSelection must be used inside a <Selection> provider')
  return ctx
}
