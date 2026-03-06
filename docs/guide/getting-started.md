# Getting Started

## Install

Cubeforge requires React 18+. Install the main package:

::: code-group

```bash [bun]
bun add @cubeforge/react react react-dom
```

```bash [npm]
npm install @cubeforge/react react react-dom
```

```bash [yarn]
yarn add @cubeforge/react react react-dom
```

```bash [pnpm]
pnpm add @cubeforge/react react react-dom
```

:::

## Quick start

Here's a complete minimal game — a player that can walk and jump on a platform:

```tsx
import {
  Game, World, Entity,
  Transform, Sprite, RigidBody, BoxCollider,
  Script, Camera2D,
} from '@cubeforge/react'
import type { EntityId, ECSWorld, InputManager, RigidBodyComponent } from '@cubeforge/react'

function playerUpdate(id: EntityId, world: ECSWorld, input: InputManager) {
  const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
  if (!rb) return

  if (input.isDown('ArrowLeft'))  rb.vx = -220
  if (input.isDown('ArrowRight')) rb.vx =  220
  if (input.isPressed('Space') && rb.onGround) rb.vy = -520
}

export default function MyGame() {
  return (
    <Game width={800} height={500} gravity={980}>
      <World background="#1a1a2e">
        <Camera2D followEntity="player" smoothing={0.85} />

        <Entity id="player" tags={['player']}>
          <Transform x={100} y={300} />
          <Sprite width={32} height={48} color="#4fc3f7" />
          <RigidBody />
          <BoxCollider width={32} height={48} />
          <Script update={playerUpdate} />
        </Entity>

        <Entity tags={['ground']}>
          <Transform x={400} y={480} />
          <Sprite width={800} height={32} color="#37474f" />
          <RigidBody isStatic />
          <BoxCollider width={800} height={32} />
        </Entity>
      </World>
    </Game>
  )
}
```

## Using the platformer hook

For platformers, `usePlatformerController` handles movement, jumping, coyote time, and jump buffering automatically:

```tsx
import {
  Game, World, Entity,
  Transform, Sprite, RigidBody, BoxCollider,
  Camera2D, useEntity, usePlatformerController,
} from '@cubeforge/react'

function Player() {
  const id = useEntity()
  usePlatformerController(id, {
    speed: 220,
    jumpForce: -520,
    maxJumps: 2,       // double jump
    coyoteTime: 0.08,
    jumpBuffer: 0.08,
  })
  return null
}

export default function MyGame() {
  return (
    <Game width={800} height={500} gravity={980}>
      <World background="#1a1a2e">
        <Camera2D followEntity="player" smoothing={0.85} />

        <Entity id="player" tags={['player']}>
          <Transform x={100} y={300} />
          <Sprite width={32} height={48} color="#4fc3f7" />
          <RigidBody />
          <BoxCollider width={32} height={48} />
          <Player />
        </Entity>

        <Entity tags={['ground']}>
          <Transform x={400} y={480} />
          <Sprite width={800} height={32} color="#37474f" />
          <RigidBody isStatic />
          <BoxCollider width={800} height={32} />
        </Entity>
      </World>
    </Game>
  )
}
```

## How it works

**`<Game>`** creates the canvas and initialises all engine subsystems — ECS world, physics, renderer, input, and the game loop. It accepts `width`, `height`, `gravity`, and `debug` props.

**`<World>`** sets world-level config like background colour and gravity override. All entities live inside it.

**`<Entity>`** creates an ECS entity. An optional `id` lets other components reference it (e.g. for camera follow). `tags` are used for querying and grouping entities.

**`<Transform>`**, **`<Sprite>`**, **`<RigidBody>`**, **`<BoxCollider>`** are ECS components — each one registers data on the entity in a `useEffect`. When the entity unmounts, the components are automatically cleaned up.

**`<Script>`** runs an `update` function every frame. The function receives `(entityId, world, input, dt)` — the entity's id, the ECS world for querying other entities, the input manager, and the delta time in seconds.

**`<Camera2D>`** follows an entity by its string `id`, with configurable smoothing, zoom, bounds, and dead zone.

## Enabling debug mode

Add `debug` to `<Game>` to overlay collider wireframes, FPS, and entity count:

```tsx
<Game width={800} height={500} debug>
```

This is useful during development to verify collider sizes and positions without needing external tools.
