# Game

Root component. Creates the canvas element, initialises the ECS world, physics system, renderer, input manager, and game loop. All other Cubeforge components must be descendants of `<Game>`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `width` | number | `800` | Canvas width in pixels |
| `height` | number | `600` | Canvas height in pixels |
| `gravity` | number | `980` | Gravitational acceleration in pixels per second squared (downward) |
| `debug` | boolean | `false` | Show collider wireframes, FPS counter, and entity count overlay |
| `scale` | `'none' \| 'contain' \| 'pixel'` | `'none'` | Canvas scaling strategy |
| `onReady` | `(controls: GameControls) => void` | — | Called once when the engine is ready |
| `plugins` | `Plugin[]` | — | Custom plugins to register after core systems |
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

## Notes

- The canvas is focusable (`tabindex="0"`) so it can receive keyboard events directly.
- Changing `gravity` after mount is supported — the physics system updates on the next tick.
- The game loop stops automatically when the component unmounts.
