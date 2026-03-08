# useGame

Returns the full engine state. Provides access to the ECS world, input manager, event bus, asset manager, renderer, and physics system. Must be called inside a `<Game>` descendant.

## Signature

```ts
function useGame(): EngineState
```

## EngineState

| Property | Type | Description |
|---|---|---|
| `ecs` | ECSWorld | The ECS world — query, add, remove entities and components |
| `input` | InputManager | Keyboard and mouse state |
| `events` | EventBus | Subscribe and emit game events |
| `assets` | AssetManager | Load images and play audio |
| `activeRenderSystem` | System | The active WebGL2 render system |
| `physics` | PhysicsSystem | Physics system — change gravity, etc. |
| `loop` | GameLoop | The game loop — pause, resume, stop |
| `canvas` | HTMLCanvasElement | The raw canvas element |
| `entityIds` | Map<string, number> | String ID → numeric entity ID map |

## Example

```tsx
import { useGame } from 'cubeforge'
import type { TransformComponent } from 'cubeforge'

function LevelManager() {
  const { ecs, events, assets } = useGame()

  useEffect(() => {
    // Preload assets
    assets.preloadImages(['/player.png', '/tileset.png'])

    // Subscribe to events
    const unsub = events.on('player-died', () => {
      // respawn logic
    })
    return unsub
  }, [])

  // Query all enemies
  const enemies = ecs.query('Tag')

  return null
}
```

## Common patterns

### Subscribe to events

```tsx
const { events } = useGame()

useEffect(() => {
  return events.on<{ score: number }>('score-update', ({ score }) => {
    setScore(score)
  })
}, [events])
```

### Preload assets

```tsx
const { assets } = useGame()

useEffect(() => {
  assets.preloadImages(['/player.png', '/tiles.png', '/bg.png'])
}, [assets])
```

### Access physics

```tsx
const { physics } = useGame()
// Temporarily increase gravity
physics.setGravity(2000)
```

## Notes

- Throws an error if called outside of a `<Game>` context.
- `entityIds` maps string IDs set via `<Entity id="...">` to their numeric ECS IDs.
- Prefer `useEvent` for event subscriptions — it handles cleanup automatically.
