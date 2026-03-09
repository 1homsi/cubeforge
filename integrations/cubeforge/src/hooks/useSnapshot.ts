import { useMemo } from 'react'
import type { WorldSnapshot } from '@cubeforge/core'
import { useGame } from './useGame'

export interface SnapshotControls {
  /**
   * Capture a full serialisable snapshot of all ECS entity/component data.
   * Safe to JSON-stringify and store externally (localStorage, server, etc.)
   *
   * @example
   * ```ts
   * const { save, restore } = useSnapshot()
   * const checkpoint = save()          // capture at checkpoint
   * restore(checkpoint)                // reset to that state
   * ```
   */
  save(): WorldSnapshot

  /**
   * Restore the world to a previously captured snapshot.
   * All current entities are replaced with the snapshot's entities.
   *
   * Note: React component state is NOT rolled back — only ECS data is restored.
   * For a full game reset, prefer remounting the `<Game>` key instead.
   */
  restore(snapshot: WorldSnapshot): void
}

/**
 * Returns save/restore controls for the ECS world snapshot system.
 * Must be used inside `<Game>`.
 *
 * @example
 * ```tsx
 * function SaveButton() {
 *   const { save, restore } = useSnapshot()
 *   const [slot, setSlot] = useState<WorldSnapshot | null>(null)
 *   return (
 *     <>
 *       <button onClick={() => setSlot(save())}>Save</button>
 *       <button onClick={() => slot && restore(slot)}>Load</button>
 *     </>
 *   )
 * }
 * ```
 */
export function useSnapshot(): SnapshotControls {
  const engine = useGame()

  return useMemo(
    (): SnapshotControls => ({
      save: () => engine.ecs.getSnapshot(),
      restore: (snapshot) => engine.ecs.restoreSnapshot(snapshot),
    }),
    [engine],
  )
}
