# Game

Root component. Creates the canvas element, initialises the ECS world, physics system, renderer, input manager, and game loop. All other Cubeforge components must be descendants of `<Game>`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `width` | number | `800` | Canvas width in pixels |
| `height` | number | `600` | Canvas height in pixels |
| `gravity` | number | `980` | Gravitational acceleration in pixels per second squared (downward) |
| `debug` | boolean | `false` | Show collider wireframes, FPS counter, and entity count overlay |
| `devtools` | boolean | `false` | Enable the time-travel DevTools overlay (timeline scrubber + entity inspector) |
| `deterministic` | boolean | `false` | Run the simulation with a seeded RNG for reproducible results |
| `seed` | number | `0` | Seed for the deterministic RNG. Only used when `deterministic` is `true` |
| `scale` | `'none' \| 'contain' \| 'pixel'` | `'none'` | Canvas scaling strategy |
| `onReady` | `(controls: GameControls) => void` | — | Called once when the engine is ready |
| `plugins` | `Plugin[]` | — | Custom plugins to register after core systems |
| `renderer` | `new (canvas, entityIds) => System` | — | Custom render system constructor. Defaults to the Canvas2D renderer. See [@cubeforge/webgl-renderer](/guide/webgl-renderer). |
| `style` | CSSProperties | — | CSS styles applied to the canvas element |
| `className` | string | — | CSS class applied to the canvas element |
| `children` | ReactNode | — | World and other components |

## Scale modes

- **`'none'`** — Fixed pixel size, no scaling. The canvas renders at exactly `width × height`.
- **`'contain'`** — CSS-scales the canvas to fit the parent element while preserving aspect ratio. Uses a `ResizeObserver` to update on container resize.
- **`'pixel'`** — Applies `image-rendering: pixelated` for crisp pixel-art scaling via CSS zoom or transform.

## GameControls

The `onReady` callback receives a `GameControls` object:

| Method | Description |
|---|---|
| `pause()` | Stops the game loop |
| `resume()` | Restarts the game loop |
| `reset()` | Clears all entities and restarts the loop |

## Plugin system

Plugins extend the engine with custom systems and initialization logic without touching engine source code.

```tsx
import { definePlugin } from 'cubeforge'

const PathfindingPlugin = definePlugin({
  name: 'pathfinding',
  systems: [new PathfindingSystem()],
  onInit(engine) {
    // engine is the full EngineState
    console.log('Pathfinding ready', engine.ecs.entityCount)
  },
})

<Game plugins={[PathfindingPlugin]}>
```

Plugin systems run **after** the built-in systems (Script → Physics → Render → Debug → Plugins).

## System order

The engine runs systems in this order each frame:

1. Script system (entity update functions)
2. Physics system (AABB collision at fixed 60 Hz)
3. Render system (Canvas 2D draw, sorted by zIndex)
4. Debug system (if `debug` is enabled)
5. Plugin systems (in array order)

## Example

```tsx
import { useRef } from 'react'
import { Game, World } from 'cubeforge'
import type { GameControls } from 'cubeforge'

function App() {
  const controls = useRef<GameControls | null>(null)

  return (
    <div>
      <Game
        width={900}
        height={560}
        gravity={980}
        debug
        scale="contain"
        onReady={(c) => { controls.current = c }}
        style={{ borderRadius: 8 }}
      >
        <World background="#1a1a2e">
          {/* entities */}
        </World>
      </Game>
      <button onClick={() => controls.current?.pause()}>Pause</button>
      <button onClick={() => controls.current?.resume()}>Resume</button>
    </div>
  )
}
```

## DevTools

The `devtools` overlay adds a time-travel debugger below the canvas:

- **Scrubber** — drag to any recorded frame (up to 10 seconds / 600 frames at 60 fps)
- **Pause / Resume** — freeze the game loop at any point
- **Step back / forward** — advance one frame at a time
- **Entity inspector** — click any entity to see all component values at that frame

```tsx
<Game devtools />
```

When scrubbing, the world is restored to the selected snapshot. Resuming replays from that point forward.

## Deterministic mode

Enable reproducible simulations — useful for replays, tests, and multiplayer rollback:

```tsx
<Game deterministic seed={12345} />
```

In deterministic mode, all internal randomness (camera shake, particles) uses a seeded LCG RNG accessed via `world.rng()`. The same seed produces identical results every run.

## Notes

- The canvas is focusable (`tabindex="0"`) so it can receive keyboard events directly.
- Changing `gravity` after mount is supported — the physics system updates on the next tick.
- The game loop stops automatically when the component unmounts.
- The `debug` overlay is not available when using a custom `renderer` (e.g. WebGL).
