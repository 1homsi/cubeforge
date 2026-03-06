import type { System, ECSWorld } from '../ecs/world'
import type { ScriptComponent } from '../components/script'

export class ScriptSystem implements System {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly input: any) {}

  update(world: ECSWorld, dt: number): void {
    const entities = world.query('Script')
    for (const id of entities) {
      const script = world.getComponent<ScriptComponent>(id, 'Script')!
      script.update(id, world, this.input, dt)
    }
  }
}
