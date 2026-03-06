# Cubeforge

**A React-first game engine for the browser.**

Build games the same way you build interfaces — with components, hooks, and composition. No imperative setup, no boilerplate. Just React.

```tsx
<Game width={900} height={560}>
  <World background="#12131f">
    <Camera2D followEntity="player" smoothing={0.87} />
    <Player x={100} y={420} />
    <Enemy x={380} y={420} patrolLeft={250} patrolRight={550} />
    <Platform x={450} y={500} width={900} height={32} />
  </World>
</Game>
```

---

## Why Cubeforge

Most browser game engines are imperative. You create objects, call methods, manage loops manually. Cubeforge flips that: your game is a React component tree. Mount a component → entity exists. Unmount it → entity is gone. The engine handles the rest.

- **Declarative** — describe your world, don't script it
- **Composable** — `<Player />` is just React components under the hood
- **Zero runtime dependencies** — no Three.js, no physics library, no framework lock-in
- **Hand-rolled everything** — ECS, renderer, physics, input — all from scratch
- **TypeScript-first** — every API is fully typed

---

## Packages

Cubeforge is a monorepo. Each system is its own package so you can use only what you need.

| Package | Description |
|---|---|
| `@cubeforge/core` | ECS world, game loop, event bus, asset manager, math (Vec2, Rect) |
| `@cubeforge/input` | Keyboard and mouse input with `isDown`, `isPressed`, `isReleased` |
| `@cubeforge/renderer` | Canvas2D renderer, camera system, sprite rendering |
| `@cubeforge/physics` | AABB collision detection, rigid bodies, triggers |
| `@cubeforge/react` | React components and hooks — the main developer-facing API |

---

## Getting Started

```bash
bun add @cubeforge/react react react-dom
```

```tsx
import { Game, World, Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { ECSWorld, EntityId, TransformComponent, RigidBodyComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'

function update(id: EntityId, world: ECSWorld, input: InputManager) {
  const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  if (input.isDown('ArrowLeft'))  rb.vx = -200
  if (input.isDown('ArrowRight')) rb.vx = 200
  if (input.isPressed('Space') && rb.onGround) rb.vy = -500
}

export default function MyGame() {
  return (
    <Game width={800} height={500}>
      <World background="#1a1a2e">
        <Camera2D followEntity="player" smoothing={0.85} />

        <Entity id="player" tags={['player']}>
          <Transform x={100} y={300} />
          <Sprite width={32} height={48} color="#4fc3f7" />
          <RigidBody />
          <BoxCollider width={32} height={48} />
          <Script update={update} />
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

---

## React API

### Components

#### `<Game>`
The root component. Creates the canvas, the engine, and all subsystems.

```tsx
<Game
  width={900}       // canvas width in px
  height={560}      // canvas height in px
  gravity={980}     // pixels/s² downward
/>
```

#### `<World>`
Sets world-level config. All game entities go inside here.

```tsx
<World
  background="#1a1a2e"  // canvas background color
  gravity={1200}        // override gravity (optional)
/>
```

#### `<Entity>`
Creates an ECS entity. Children attach components to it.

```tsx
<Entity
  id="player"               // optional string ID for cross-entity lookup
  tags={['player', 'hero']} // optional tags for querying
/>
```

#### `<Transform>`
Position, rotation, and scale. Required for rendering and physics.

```tsx
<Transform x={100} y={300} rotation={0} scaleX={1} scaleY={1} />
```

#### `<Sprite>`
Renders the entity — color rect or image.

```tsx
<Sprite
  width={32}
  height={48}
  color="#4fc3f7"      // fallback color
  src="/player.png"   // optional image
  zIndex={10}
  flipX={false}
  visible={true}
/>
```

#### `<RigidBody>`
Makes an entity participate in physics simulation.

```tsx
<RigidBody
  isStatic={false}    // true = immovable (platforms, walls)
  mass={1}
  gravityScale={1}
  friction={0.85}
  bounce={0}
/>
```

When `onGround` is `true`, the entity is resting on a solid surface. Read it in a `<Script>` to gate jumps.

#### `<BoxCollider>`
Axis-aligned bounding box for collision.

```tsx
<BoxCollider
  width={32}
  height={48}
  offsetX={0}
  offsetY={0}
  isTrigger={false}   // triggers fire events but don't block movement
  layer="default"
/>
```

#### `<Script>`
Per-entity update logic. Called every frame.

```tsx
<Script
  init={(entityId, world) => {
    // runs once on mount — attach extra data here
  }}
  update={(entityId, world, input, dt) => {
    // runs every frame
  }}
/>
```

#### `<Camera2D>`
Positions and moves the viewport.

```tsx
<Camera2D
  followEntity="player"  // string ID of entity to track
  zoom={1}
  smoothing={0.87}       // 0 = instant, higher = smoother follow
  background="#1a1a2e"
/>
```

---

### Hooks

#### `useGame()`
Access the full engine state — ECS world, input, events, assets, renderer.

```tsx
const engine = useGame()
engine.ecs.query('Transform', 'RigidBody') // query all physics entities
engine.events.on('collision', handler)
engine.assets.loadImage('/tileset.png')
```

#### `useEntity()`
Get the numeric ECS entity ID for the current `<Entity>`.

```tsx
const entityId = useEntity()
```

#### `useInput()`
Direct access to the `InputManager` outside of a `<Script>`.

```tsx
const input = useInput()
if (input.isDown('ArrowRight')) { ... }
```

#### `useEvent(event, handler)`
Subscribe to an engine event and auto-cleanup on unmount.

```tsx
useEvent('collision', ({ a, b }) => {
  console.log('entities collided:', a, b)
})
```

---

## Composing High-Level Components

The real power of Cubeforge is that `<Player>`, `<Enemy>`, `<Platform>` are just regular React components:

```tsx
function Platform({ x, y, width }: PlatformProps) {
  return (
    <Entity tags={['solid']}>
      <Transform x={x} y={y} />
      <Sprite width={width} height={20} color="#455a64" />
      <RigidBody isStatic />
      <BoxCollider width={width} height={20} />
    </Entity>
  )
}

function Level() {
  return (
    <>
      <Platform x={400} y={500} width={800} />
      <Platform x={200} y={380} width={160} />
      <Platform x={600} y={300} width={160} />
    </>
  )
}
```

---

## Physics

The physics system runs two passes per frame — X then Y — which gives accurate platformer collision response with no corner sticking.

- Gravity is applied first
- X movement is integrated and resolved
- Y movement is integrated and resolved
- `onGround` is set on `RigidBody` when an entity lands on a surface
- Triggers fire `collision` events via `EventBus` without blocking movement

---

## Input

```tsx
input.isDown('ArrowLeft')    // true every frame the key is held
input.isPressed('Space')     // true only on the frame the key was pressed
input.isReleased('Escape')   // true only on the frame the key was released

input.mouse.x                // cursor X relative to canvas
input.mouse.isDown(0)        // left mouse button held
input.mouse.isPressed(2)     // right mouse button just clicked
```

Keys can be checked by `e.code` (`'Space'`, `'ArrowLeft'`, `'KeyA'`) or `e.key` (`'a'`, `'Enter'`).

---

## ECS

The engine uses a simple map-based Entity Component System. You don't need to use it directly most of the time, but it's fully accessible via `useGame()`.

```tsx
const { ecs, entityIds } = useGame()

// Query all entities with both Transform and RigidBody
const physicsEntities = ecs.query('Transform', 'RigidBody')

// Get a component
const rb = ecs.getComponent<RigidBodyComponent>(entityId, 'RigidBody')

// Get entity by string ID
const playerId = entityIds.get('player')

// Create/destroy entities at runtime
const id = ecs.createEntity()
ecs.addComponent(id, { type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })
ecs.destroyEntity(id)
```

---

## Events

The event bus is accessible on `engine.events` or via `useEvent`.

Built-in events:

| Event | Payload | When |
|---|---|---|
| `collision` | `{ a: EntityId, b: EntityId }` | Two dynamic bodies overlap |
| `trigger` | `{ a: EntityId, b: EntityId }` | A trigger collider is entered |

Custom events:

```tsx
engine.events.emit('player-died', { score: 1200 })
engine.events.on('player-died', ({ score }) => { ... })
```

---

## Asset Loading

```tsx
const { assets } = useGame()

// Preload images
await assets.preloadImages(['/player.png', '/tileset.png'])

// Then use in Sprite
<Sprite src="/player.png" width={32} height={48} />

// Audio
await assets.loadAudio('/jump.wav')
assets.playAudio('/jump.wav', 0.8)
```

---

## Architecture

```
React component tree
       ↓
   <Game> creates:
     ECSWorld   — entity/component storage
     GameLoop   — requestAnimationFrame driver
     InputManager — keyboard + mouse events
     PhysicsSystem — AABB collision, gravity
     RenderSystem  — Canvas2D draw loop
     EventBus   — pub/sub for game events
     AssetManager — image + audio cache
       ↓
  Entity components mount → register in ECS
       ↓
  Game loop: ecs.update(dt) → ScriptSystem → PhysicsSystem → RenderSystem
       ↓
  input.flush() — clears single-frame state
```

The React tree is the **scene description**. Once entities are mounted, the ECS and game loop take over — React does not re-render every frame.

---

## Monorepo

```bash
bun install           # install all workspace deps
bun run dev           # start the demo example
bun run typecheck     # type-check all packages
```

Built with [Bun](https://bun.sh) workspaces.

---

## License

MIT — [Mohamad Homsi](https://github.com/1homsi)
