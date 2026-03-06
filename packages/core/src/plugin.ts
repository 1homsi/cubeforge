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
}

/** Type-safe helper to define a plugin without needing to import Plugin separately */
export function definePlugin(plugin: Plugin): Plugin {
  return plugin
}
