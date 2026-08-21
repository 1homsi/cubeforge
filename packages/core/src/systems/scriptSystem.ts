import type { System, ECSWorld } from '../ecs/world'
import type { ScriptComponent } from '../components/script'

/**
 * Runs every Script component's update callback each frame. The host passes
 * its input object (structurally a {@link ScriptInput}); it is forwarded to
 * scripts untouched.
 */
export class ScriptSystem implements System {
  constructor(private readonly input: unknown) {}

  update(world: ECSWorld, dt: number): void {
    const entities = world.query('Script')
    for (const id of entities) {
      if (!world.hasEntity(id)) continue
      const script = world.getComponent<ScriptComponent>(id, 'Script')
      if (!script?.update) continue
      try {
        script.update(id, world, this.input, dt)
      } catch (err) {
        console.error(`[Cubeforge] Script update error on entity ${id}:`, err)
      }
    }
  }
}
