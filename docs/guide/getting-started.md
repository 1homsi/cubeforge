# Getting Started

## CLI (recommended)

The fastest way to start is with the scaffolding CLI. It generates a full Vite + React project with a working game:

::: code-group

```bash [bun]
bunx create-cubeforge-game my-game
```

```bash [npm]
npx create-cubeforge-game my-game
```

```bash [yarn]
yarn create cubeforge-game my-game
```

```bash [pnpm]
pnpm create cubeforge-game my-game
```

:::

Then run your game:

::: code-group

```bash [bun]
cd my-game && bun install && bun run dev
```

```bash [npm]
cd my-game && npm install && npm run dev
```

:::

Open `http://localhost:5173` and you'll have a playable game with a player, a platform, and keyboard controls ready to modify.

## Manual install

Adding Cubeforge to an existing React project:

::: code-group

```bash [bun]
bun add cubeforge react react-dom
```

```bash [npm]
npm install cubeforge react react-dom
```

```bash [yarn]
yarn add cubeforge react react-dom
```

```bash [pnpm]
pnpm add cubeforge react react-dom
```

:::

## Quick start

Here's a complete minimal game — a player that can walk and jump on a platform:

```tsx
import {
  Game, World, Entity,
  Transform, Sprite, RigidBody, BoxCollider,
  Script, Camera2D,
} from 'cubeforge'
import type { EntityId, ECSWorld, InputManager, RigidBodyComponent } from 'cubeforge'

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
} from 'cubeforge'

function Player() {
  const id = useEntity()
  usePlatformerController(id, {
    speed: 220,
    jumpForce: -520,
    maxJumps: 2,
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

**`<Game>`** creates the canvas and initialises all engine subsystems — ECS world, physics, renderer, input, and the game loop.

**`<World>`** sets world-level config like background colour. All entities live inside it.

**`<Entity>`** creates an ECS entity. An optional `id` lets other components reference it (e.g. camera follow). `tags` are used for querying and grouping.

**`<Transform>`**, **`<Sprite>`**, **`<RigidBody>`**, **`<BoxCollider>`** are ECS components — each registers data on the entity via `useEffect`. When the entity unmounts, components are cleaned up automatically.

**`<Script>`** runs an `update` function every frame with `(entityId, world, input, dt)`.

**`<Camera2D>`** follows an entity by its string `id`, with configurable smoothing, zoom, bounds, and dead zone.

## Enabling debug mode

Add `debug` to `<Game>` to overlay collider wireframes, FPS, and entity count:

```tsx
<Game width={800} height={500} debug>
```
