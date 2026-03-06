# Embedding in React Apps

Cubeforge is designed to be dropped into any existing React application. The `<Game>` component is self-contained — it creates its own canvas, initialises all engine subsystems, and tears everything down when it unmounts.

## Basic embedding

```tsx
import { Game, World, Entity, Transform, Sprite, RigidBody, BoxCollider } from '@cubeforge/react'

export function GameSection() {
  return (
    <div className="game-container">
      <h2>Play the demo</h2>
      <Game width={800} height={500} gravity={980}>
        <World background="#1a1a2e">
          {/* your game entities */}
        </World>
      </Game>
    </div>
  )
}
```

## Scale modes

The `scale` prop controls how the canvas scales relative to its container.

### `scale="none"` (default)

The canvas is a fixed pixel size. No scaling is applied. Use this when you want pixel-perfect rendering and control the container size yourself.

```tsx
<Game width={800} height={500} scale="none" />
```

### `scale="contain"`

The canvas scales via CSS transform to fit the parent element while preserving the aspect ratio. The parent element must have a defined size.

```tsx
<div style={{ width: '100%', height: '60vh' }}>
  <Game width={800} height={500} scale="contain" />
</div>
```

A `ResizeObserver` watches the parent and updates the scale when the container resizes. Works well for responsive layouts.

### `scale="pixel"`

Like `scale="none"`, but applies `image-rendering: pixelated` via CSS. Use for pixel art games where you want crisp scaling via CSS zoom or transform without the browser smoothing pixels.

```tsx
<Game width={320} height={180} scale="pixel" style={{ zoom: 3 }} />
```

## Pause, resume, and reset controls

Use `onReady` to receive engine controls when the game is initialised:

```tsx
import { useState, useRef } from 'react'
import type { GameControls } from '@cubeforge/react'

function GamePage() {
  const [paused, setPaused] = useState(false)
  const controlsRef = useRef<GameControls | null>(null)

  const toggle = () => {
    if (paused) {
      controlsRef.current?.resume()
      setPaused(false)
    } else {
      controlsRef.current?.pause()
      setPaused(true)
    }
  }

  const restart = () => {
    controlsRef.current?.reset()
    setPaused(false)
  }

  return (
    <div>
      <Game
        width={800}
        height={500}
        onReady={(controls) => { controlsRef.current = controls }}
      >
        <World background="#1a1a2e">
          {/* game content */}
        </World>
      </Game>
      <div className="controls">
        <button onClick={toggle}>{paused ? 'Resume' : 'Pause'}</button>
        <button onClick={restart}>Restart</button>
      </div>
    </div>
  )
}
```

`pause()` stops the game loop. `resume()` restarts it. `reset()` clears all entities and restarts the loop from scratch.

## ScreenFlash

`<ScreenFlash>` overlays a full-canvas colour flash — useful for hit effects, screen transitions, or game-over flashes.

```tsx
import { useRef } from 'react'
import { Game, World, ScreenFlash, type ScreenFlashHandle } from '@cubeforge/react'

function MyGame() {
  const flashRef = useRef<ScreenFlashHandle>(null)

  return (
    <div style={{ position: 'relative', width: 800, height: 500 }}>
      <Game width={800} height={500}>
        <World>
          {/* game */}
        </World>
      </Game>
      <ScreenFlash ref={flashRef} />
      <button onClick={() => flashRef.current?.flash('#ff0000', 0.3)}>
        Flash red
      </button>
    </div>
  )
}
```

`flash(color, duration)` shows the colour at full opacity and fades it out over `duration` seconds.

`<ScreenFlash>` must be positioned over the canvas — use `position: absolute; inset: 0` on a wrapper with `position: relative`.

## Reacting to game events from outside

Use `onReady` to store the engine and subscribe to events from React:

```tsx
import { useEffect, useState } from 'react'
import type { EngineState } from '@cubeforge/react'

function GameWithHUD() {
  const [score, setScore] = useState(0)

  return (
    <div>
      <div className="hud">Score: {score}</div>
      <Game
        width={800}
        height={500}
        onReady={(controls) => {
          // access the engine via useGame() inside the tree instead
        }}
      >
        <World>
          <ScoreTracker onScore={setScore} />
          {/* game */}
        </World>
      </Game>
    </div>
  )
}

function ScoreTracker({ onScore }: { onScore: (s: number) => void }) {
  useEvent<{ amount: number }>('coin-collected', ({ amount }) => {
    onScore(s => s + amount)
  })
  return null
}
```

Events emitted inside the game (via `engine.events.emit`) can be received by components in the React tree using `useEvent`. This keeps game logic inside the engine and UI logic in React.

## Lazy loading

For large games, lazy-load the game component to keep the initial bundle small:

```tsx
import { lazy, Suspense } from 'react'

const MyGame = lazy(() => import('./MyGame'))

function App() {
  return (
    <Suspense fallback={<div>Loading game...</div>}>
      <MyGame />
    </Suspense>
  )
}
```
