# definePlugin

Helper function to define a type-safe engine plugin. Pass one or more plugins to `<Game plugins={[...]} />` to extend the engine with custom systems.

## Signature

```ts
function definePlugin(plugin: Plugin): Plugin
```

## Plugin interface

```ts
interface Plugin {
  /** Human-readable identifier */
  name: string
  /** Systems to register after core systems each frame */
  systems: System[]
  /** Called once after engine initialises, before the game loop starts */
  onInit?(engine: EngineState): void
}
```

## Example

```tsx
import { definePlugin } from 'cubeforge'
import type { System, ECSWorld } from 'cubeforge'

class PathfindingSystem implements System {
  update(world: ECSWorld, dt: number) {
    const agents = world.query('Transform', 'PathAgent')
    for (const id of agents) {
      // ... pathfinding logic
    }
  }
}

const PathfindingPlugin = definePlugin({
  name: 'pathfinding',
  systems: [new PathfindingSystem()],
  onInit(engine) {
    console.log('[PathfindingPlugin] ready, entities:', engine.ecs.entityCount)
  },
})

// In your component:
<Game plugins={[PathfindingPlugin]}>
  <World>
    {/* ... */}
  </World>
</Game>
```

## Notes

- Plugin systems run **after** the built-in systems (Script → Physics → Render → Debug).
- Multiple plugins are registered in the array order given to `plugins`.
- `definePlugin` is purely a type helper — it returns the object unchanged.
- Access the full `EngineState` (ecs, physics, renderer, events…) in `onInit`.
