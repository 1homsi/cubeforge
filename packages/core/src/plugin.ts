import type { System } from './ecs/world'

/**
 * A plugin bundles one or more systems plus optional initialization logic.
 * Pass plugins to `<Game plugins={[...]} />` to extend the engine.
 */
export interface Plugin {
  /** Human-readable identifier (used for debug/logging) */
  name: string
  /** Systems to register after the core systems (Script → Physics → Render → Debug) */
  systems: System[]
  /** Called once after engine state is fully initialized, before the game loop starts */
  onInit?(engine: unknown): void
  /** Called once when the engine is destroyed (component unmount or explicit cleanup) */
  onDestroy?(engine: unknown): void
  /**
   * Relative registration priority. Higher values → systems registered earlier
   * within the plugin section (after core systems). Default: 0.
   */
  priority?: number
  /**
   * Names of other plugins this plugin depends on.
   * A warning is emitted at startup if any dependency is not present.
   */
  requires?: string[]
}

/** Type-safe helper to define a plugin without needing to import Plugin separately */
export function definePlugin(plugin: Plugin): Plugin {
  return plugin
}
