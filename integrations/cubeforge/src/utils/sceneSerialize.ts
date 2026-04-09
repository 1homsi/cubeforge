import type { EngineState } from '../context'

/**
 * Scene save/load helpers. Thin wrappers around the ECS snapshot API that
 * handle JSON serialization and localStorage persistence for editors,
 * "save your creation" features, and quick dev-time checkpoints.
 *
 * For full-featured game saves that include non-ECS state (audio settings,
 * progression flags, player profiles), use {@link useSave} or {@link useIDBSave}
 * from `cubeforge`.
 */

export interface SceneSaveOptions {
  /** Pretty-print the JSON output. Default false. */
  pretty?: boolean
}

/**
 * Serialize the entire ECS world to a JSON string. The returned string can be
 * passed back to {@link loadScene} to restore the exact same state.
 *
 * @example
 * ```ts
 * const json = saveScene(engine)
 * localStorage.setItem('my-level', json)
 * ```
 */
export function saveScene(engine: EngineState, options?: SceneSaveOptions): string {
  const snapshot = engine.ecs.getSnapshot()
  return options?.pretty ? JSON.stringify(snapshot, null, 2) : JSON.stringify(snapshot)
}

/**
 * Restore the ECS world from a JSON string previously produced by
 * {@link saveScene}. Clears the current world state before applying. In
 * onDemand loop mode, automatically calls `markDirty()` to re-render.
 *
 * Throws if the input isn't valid JSON or doesn't match the snapshot shape.
 *
 * @example
 * ```ts
 * const json = localStorage.getItem('my-level')
 * if (json) loadScene(engine, json)
 * ```
 */
export function loadScene(engine: EngineState, json: string): void {
  const snapshot = JSON.parse(json)
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.entities)) {
    throw new Error('loadScene: invalid snapshot JSON — expected { nextId, rngState, entities }')
  }
  engine.ecs.restoreSnapshot(snapshot)
  engine.loop.markDirty()
}

/**
 * Save the current scene to `localStorage` under the given key. Returns true
 * on success, false if the browser rejected the write (quota exceeded,
 * incognito mode, or localStorage unavailable).
 *
 * @example
 * ```ts
 * if (saveSceneToLocalStorage(engine, 'my-game:autosave')) {
 *   toast.show('Saved!')
 * }
 * ```
 */
export function saveSceneToLocalStorage(engine: EngineState, key: string, options?: SceneSaveOptions): boolean {
  try {
    localStorage.setItem(key, saveScene(engine, options))
    return true
  } catch {
    return false
  }
}

/**
 * Load a scene previously saved with {@link saveSceneToLocalStorage}. Returns
 * true if a scene was found and successfully loaded, false otherwise.
 *
 * @example
 * ```ts
 * if (!loadSceneFromLocalStorage(engine, 'my-game:autosave')) {
 *   // No autosave — start fresh
 *   seedInitialScene(engine)
 * }
 * ```
 */
export function loadSceneFromLocalStorage(engine: EngineState, key: string): boolean {
  try {
    const json = localStorage.getItem(key)
    if (!json) return false
    loadScene(engine, json)
    return true
  } catch {
    return false
  }
}

/**
 * Delete a saved scene from localStorage. Returns true if anything was deleted.
 */
export function deleteSavedScene(key: string): boolean {
  try {
    if (localStorage.getItem(key) === null) return false
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/**
 * List all scene keys saved via {@link saveSceneToLocalStorage} that match a
 * prefix. Useful for implementing a "load slot" picker.
 *
 * @example
 * ```ts
 * const slots = listSavedScenes('my-game:')
 * // → ['my-game:slot1', 'my-game:slot2', 'my-game:autosave']
 * ```
 */
export function listSavedScenes(prefix = ''): string[] {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) keys.push(key)
    }
    return keys
  } catch {
    return []
  }
}
