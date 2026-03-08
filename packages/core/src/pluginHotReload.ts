import type { Plugin } from './plugin'
import type { ECSWorld } from './ecs/world'

export interface HotReloadablePlugin extends Plugin {
  /** Unique key for hot-reload identity matching */
  hotId?: string
}

/**
 * Replace a plugin's systems in a running engine.
 *
 * Because plugin systems are typically wrapped (e.g. by a timing wrapper)
 * before being added to the ECS world, this function accepts the actual
 * registered system references via `oldSystems`. If `oldSystems` is not
 * provided, it falls back to `oldPlugin.systems` (works when systems were
 * added directly without wrapping).
 *
 * Returns the new systems that were added, so callers can track them for
 * future hot-reload calls.
 *
 * @param engine - The engine state containing at least `ecs`
 * @param oldPlugin - The plugin being replaced
 * @param newPlugin - The replacement plugin
 * @param oldSystems - The actual system references registered in ECS
 *                     (e.g. the timed-wrapped versions). Falls back to
 *                     `oldPlugin.systems` if not provided.
 * @returns The new systems that were added to ECS (useful if callers need
 *          to wrap them before passing, or to track for future reloads).
 */
export function hotReloadPlugin(
  engine: {
    ecs: ECSWorld
    [key: string]: unknown
  },
  oldPlugin: HotReloadablePlugin,
  newPlugin: HotReloadablePlugin,
  oldSystems?: { update: (world: ECSWorld, dt: number) => void }[],
): void {
  const { ecs } = engine
  const toRemove = oldSystems ?? oldPlugin.systems

  // Remove old systems from the ECS world
  for (const system of toRemove) {
    ecs.removeSystem(system)
  }

  // Call onDestroy lifecycle on the old plugin
  oldPlugin.onDestroy?.(engine)

  // Register new systems
  for (const system of newPlugin.systems) {
    ecs.addSystem(system)
  }

  // Call onInit lifecycle on the new plugin
  newPlugin.onInit?.(engine)
}
