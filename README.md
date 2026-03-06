# Cubeforge

**Build browser games with React.**

A React-first 2D game engine for the web. Write games the same way you write interfaces — with components, hooks, and composition. No imperative setup, no boilerplate, no Three.js. Just React.

```tsx
<Game width={900} height={560} gravity={980} debug>
  <World background="#12131f">
    <Camera2D followEntity="player" smoothing={0.87} bounds={{ x: 0, y: 0, width: 3000, height: 900 }} />
    <Player x={100} y={420} />
    <Enemy x={380} y={420} patrolLeft={250} patrolRight={550} />
    <MovingPlatform x1={200} y1={350} x2={450} y2={350} duration={2.5} />
    <Checkpoint x={800} y={450} onActivate={() => setSave(800)} />
  </World>
</Game>
```

---

## Why Cubeforge

Most browser game engines are imperative. You create objects, call methods, manage loops manually. Cubeforge flips that: your game is a React component tree. Mount a component → entity exists. Unmount it → entity is gone. The engine handles the rest.

- **Declarative** — describe your world, not your frame loop
- **Composable** — `<Player />`, `<Enemy />`, `<MovingPlatform />` are just React components
- **Zero runtime dependencies** — ECS, physics, renderer, input all hand-rolled
- **TypeScript-first** — every API is fully typed with TSDoc comments
- **Embeddable** — drop a game into any React app with one component
- **Debug-ready** — `<Game debug>` shows collider wireframes, FPS, entity counts

---

## Examples

All runnable examples live in [cubeforge-examples](https://github.com/1homsi/cubeforge-examples).

| Example | Description |
|---|---|
| [platformer](https://github.com/1homsi/cubeforge-examples/tree/main/platformer) | Scrolling platformer — double jump, stomp, coins, lives, HUD |
| [mario-clone](https://github.com/1homsi/cubeforge-examples/tree/main/mario-clone) | Mario-style level — question blocks, mushroom powerup, goombas, goal flag |
| [breakout](https://github.com/1homsi/cubeforge-examples/tree/main/breakout) | Classic brick breaker — paddle, bouncing ball, multi-row bricks |
| [flappy-bird](https://github.com/1homsi/cubeforge-examples/tree/main/flappy-bird) | Tap-to-flap — scrolling pipes, high score |
| [shooter](https://github.com/1homsi/cubeforge-examples/tree/main/shooter) | Side-scrolling shoot-em-up — waves, enemy patterns, stars |
| [top-down](https://github.com/1homsi/cubeforge-examples/tree/main/top-down) | Top-down dungeon — 4-directional movement, sword combat, keys, exit |

---

## Packages

| Package | Description |
|---|---|
| `@cubeforge/core` | ECS world, game loop, event bus, asset manager, tween utility, math |
| `@cubeforge/input` | Keyboard and mouse — `isDown`, `isPressed`, `isReleased` |
| `@cubeforge/renderer` | Canvas2D renderer, camera, sprite sheets, animation, particles, squash-stretch |
| `@cubeforge/physics` | AABB collision, rigid bodies, triggers, fixed timestep, spatial broadphase |
| `@cubeforge/react` | React components and hooks — the main developer-facing API |

---

## Getting Started

```bash
bun add @cubeforge/react react react-dom
```

```tsx
import {
  Game, World, Entity, Transform, Sprite,
  RigidBody, BoxCollider, Script, Camera2D
} from '@cubeforge/react'
import type { ECSWorld, EntityId, RigidBodyComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'

function update(id: EntityId, world: ECSWorld, input: InputManager) {
  const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  if (input.isDown('ArrowLeft'))  rb.vx = -200
  if (input.isDown('ArrowRight')) rb.vx =  200
  if (input.isPressed('Space') && rb.onGround) rb.vy = -500
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

## Components

### `<Game>`

Root component. Creates the canvas, engine, and all subsystems.

```tsx
<Game
  width={900}           // canvas width in px
  height={560}          // canvas height in px
  gravity={980}         // pixels/s² downward
  debug                 // show collider wireframes + FPS overlay
  scale="contain"       // 'none' | 'contain' | 'pixel'
  onReady={(controls) => {
    controls.pause()    // pause the game loop
    controls.resume()   // resume
    controls.reset()    // clear + restart
  }}
/>
```

### `<World>`

Sets world-level config. All game entities go inside.

```tsx
<World background="#1a1a2e" gravity={1200} />
```

### `<Entity>`

Creates an ECS entity. Children attach components to it.

```tsx
<Entity id="player" tags={['player', 'hero']}>
  {/* components */}
</Entity>
```

### `<Transform>`

Position, rotation, scale. Required for physics and rendering.

```tsx
<Transform x={100} y={300} rotation={0} scaleX={1} scaleY={1} />
```

### `<Sprite>`

Renders the entity — color rect, image, or sprite sheet frame.

```tsx
<Sprite
  width={32}
  height={48}
  color="#4fc3f7"         // fallback color
  src="/player.png"       // optional image
  frameIndex={2}          // sprite sheet frame (0-based)
  frameWidth={32}         // frame size on the sheet
  frameHeight={48}
  frameColumns={8}        // columns in the sheet
  anchorX={0.5}           // 0=left, 0.5=center, 1=right
  anchorY={0.5}           // 0=top, 0.5=center, 1=bottom
  zIndex={10}
  flipX={false}
  visible={true}
/>
```

### `<Animation>`

Drives frame-based sprite sheet animations.

```tsx
<Animation
  frames={[0, 1, 2, 3]}   // frame indices to cycle
  fps={12}                  // frames per second
  loop={true}
  playing={true}
/>
```

### `<RigidBody>`

Makes an entity participate in physics.

```tsx
<RigidBody
  isStatic={false}     // true = immovable (platforms, walls)
  gravityScale={1}     // 0 for top-down games
  mass={1}
  friction={0.85}
  bounce={0}
/>
```

`rb.onGround` is `true` when the entity rests on a solid surface.

### `<BoxCollider>`

Axis-aligned bounding box.

```tsx
<BoxCollider
  width={32}
  height={48}
  offsetX={0}
  offsetY={0}
  isTrigger={false}    // trigger: fires event, doesn't block movement
/>
```

### `<Script>`

Per-entity logic. Called every frame.

```tsx
<Script
  init={(id, world) => {
    // runs once on mount — use to attach custom data
    world.addComponent(id, { type: 'MyData', value: 42 })
  }}
  update={(id, world, input, dt) => {
    // runs every frame
  }}
/>
```

### `<Camera2D>`

Smooth-follow camera with bounds and dead zone.

```tsx
<Camera2D
  followEntity="player"
  smoothing={0.87}
  zoom={1}
  bounds={{ x: 0, y: 0, width: 3000, height: 900 }}
  deadZone={{ w: 80, h: 40 }}
  background="#12131f"
/>
```

### `<Animation>`

Frame-based sprite animation driven per entity.

```tsx
<Animation frames={[0, 1, 2, 3]} fps={12} loop playing />
```

### `<SquashStretch>`

Adds squash-and-stretch visual feel based on velocity (visual only — does not modify physics).

```tsx
<SquashStretch intensity={0.2} recovery={8} />
```

### `<ParticleEmitter>`

Lightweight particle effect attached to an entity.

```tsx
<ParticleEmitter
  active={true}
  rate={20}              // particles per second
  speed={80}
  spread={Math.PI}       // angle spread in radians
  angle={-Math.PI / 2}   // emit direction (upward)
  particleLife={0.8}
  particleSize={4}
  color="#ff6b35"
  gravity={200}
  maxParticles={100}
/>
```

### `<MovingPlatform>`

A static platform that oscillates between two points.

```tsx
<MovingPlatform
  x1={200} y1={350}
  x2={450} y2={350}
  width={120}
  duration={2.5}
  color="#37474f"
/>
```

### `<Checkpoint>`

A trigger zone that fires `onActivate` when the player enters it.

```tsx
<Checkpoint
  x={800} y={450}
  width={24} height={48}
  onActivate={() => setSavePoint(800)}
/>
```

### `<Tilemap>`

Loads a [Tiled](https://www.mapeditor.org/) JSON map, renders tiles, and auto-generates collision entities from collision layers.

```tsx
<Tilemap
  src="/levels/level1.json"
  zIndex={1}
  layerFilter={(layer) => layer.visible}
  onSpawnObject={(obj, layer) => {
    if (obj.type === 'player') return <Player x={obj.x} y={obj.y} />
    if (obj.type === 'enemy')  return <Enemy  x={obj.x} y={obj.y} />
    return null
  }}
/>
```

Supported features:
- Tile layers: renders tiles using sprite sheet frames from the tileset image
- Layers named `"collision"` or with property `collision: true` auto-generate static `BoxCollider` entities
- Object layers: passes each object to `onSpawnObject` for React-based spawning
- Multiple tilesets

---

## Hooks

### `useGame()`

Full engine access — ECS, input, events, assets, renderer.

```tsx
const engine = useGame()
engine.ecs.query('Transform', 'RigidBody')
engine.events.on('collision', ({ a, b }) => { ... })
engine.assets.loadImage('/tileset.png')
engine.loop.pause()
```

### `useEntity()`

Get the numeric ECS entity ID for the current `<Entity>`.

```tsx
const entityId = useEntity()
```

### `useInput()`

Direct `InputManager` access outside of `<Script>`.

```tsx
const input = useInput()
if (input.isDown('ArrowRight')) { ... }
if (input.mouse.isPressed(0)) { ... }
```

### `useEvent(event, handler)`

Subscribe to an engine event with auto-cleanup on unmount.

```tsx
useEvent('collision', ({ a, b }) => {
  console.log('collision:', a, b)
})
```

### `usePlatformerController(entityId, opts?)`

Attaches full platformer controls (WASD/arrows + jump) to an entity. Handles coyote time, jump buffer, and sprite flip automatically.

```tsx
const id = useEntity()
usePlatformerController(id, {
  speed: 220,
  jumpForce: -520,
  maxJumps: 2,       // double jump
  coyoteTime: 0.08,
  jumpBuffer: 0.08,
})
```

### `useTopDownMovement(entityId, opts?)`

Attaches 4-directional top-down movement to an entity. Set `gravityScale={0}` on the entity's `<RigidBody>`.

```tsx
const id = useEntity()
useTopDownMovement(id, { speed: 180, normalizeDiagonal: true })
```

---

## Input

```tsx
input.isDown('ArrowLeft')     // held every frame
input.isPressed('Space')      // true only on the frame pressed
input.isReleased('Escape')    // true only on the frame released

input.mouse.x                 // cursor X relative to canvas
input.mouse.isDown(0)         // left button held
input.mouse.isPressed(0)      // left button just clicked
```

Keys work by `e.code` (`'Space'`, `'KeyA'`) or `e.key` (`'a'`, `' '`).

---

## Physics

Two-pass AABB (X then Y) with fixed 60hz timestep and spatial broadphase grid.

- Gravity applied per frame scaled by `gravityScale`
- X: integrate → resolve static collisions
- Y: integrate → resolve static collisions → set `onGround`
- Dynamic vs dynamic: simple equal push-apart
- Triggers: fire `trigger` event on `EventBus` without blocking movement
- Fixed timestep: physics always runs at 60 steps/sec regardless of render FPS
- Broadphase: 128px cell spatial grid for dynamic-vs-static (no O(n×m) checks)

---

## ECS

Map-based Entity Component System. Direct access via `useGame()`.

```tsx
const { ecs, entityIds } = useGame()

// Query entities with multiple component types
const movers = ecs.query('Transform', 'RigidBody')

// Per-frame query cache — same query within a frame is free
const renderables = ecs.query('Transform', 'Sprite')

// Get a component
const rb = ecs.getComponent<RigidBodyComponent>(id, 'RigidBody')

// Named entity lookup
const playerId = entityIds.get('player')

// Runtime entity management
const id = ecs.createEntity()
ecs.addComponent(id, { type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })
ecs.destroyEntity(id)
```

---

## Events

Built-in events:

| Event | Payload | When |
|---|---|---|
| `collision` | `{ a: EntityId, b: EntityId }` | Two dynamic bodies overlap |
| `trigger` | `{ a: EntityId, b: EntityId }` | A trigger collider is entered |

Custom events:

```tsx
engine.events.emit('player-died', { score: 1200 })
engine.events.on('player-died', ({ score }) => { ... })
engine.events.once('player-died', handler)
```

---

## Tween

A tiny tween utility included in `@cubeforge/core`.

```tsx
import { tween, Ease } from '@cubeforge/react'

const handle = tween(0, 100, 0.5, Ease.easeOutQuad, (v) => {
  sprite.width = v
}, () => {
  console.log('done')
})

// In a Script update:
handle.update(dt)
handle.stop()        // cancel
handle.isComplete    // boolean
```

Available easing functions: `Ease.linear`, `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, `easeOutBack`.

---

## Assets

```tsx
const { assets } = useGame()

// Images
await assets.preloadImages(['/player.png', '/tileset.png'])
<Sprite src="/player.png" width={32} height={48} />

// Audio
await assets.loadAudio('/jump.wav')
assets.playAudio('/jump.wav', 0.8)
assets.playLoopAudio('/bgm.mp3', 0.5)  // returns source node
assets.stopAudio('/bgm.mp3')
assets.stopAll()
assets.preloadAudio(['/jump.wav', '/hit.wav'])
```

---

## Debug Mode

```tsx
<Game debug>
```

When `debug` is true:
- **Green wireframes** on all solid `BoxCollider` entities
- **Yellow wireframes** on trigger colliders
- **FPS** counter (rolling 0.5s average)
- **Entity count**, physics count, renderable count

---

## Embedding in React Apps

```tsx
// Pause/resume via onReady callback
function ProductPage() {
  const [controls, setControls] = useState<GameControls | null>(null)

  return (
    <div>
      <Game
        width={800} height={500}
        scale="contain"      // CSS-scales to fit parent
        onReady={setControls}
      >
        <World background="#12131f">
          {/* ... */}
        </World>
      </Game>
      <button onClick={() => controls?.pause()}>Pause</button>
      <button onClick={() => controls?.resume()}>Resume</button>
    </div>
  )
}
```

Scale modes:
- `'none'` — fixed pixel size (default)
- `'contain'` — CSS-scales to fit parent while preserving aspect ratio
- `'pixel'` — `image-rendering: pixelated` for pixel-art games

---

## Camera Shake

Trigger camera shake via the engine events:

```tsx
// From a Script:
update={(id, world, _input, _dt) => {
  const { events } = engine
  events.emit('camera:shake', { intensity: 8, duration: 0.3 })
}}

// Or store the engine reference and call directly:
const { renderer } = useGame()
```

---

## Architecture

```
React component tree (scene description)
         ↓ mount
    <Game> creates:
      ECSWorld       — entity/component storage + per-frame query cache
      GameLoop       — requestAnimationFrame driver with pause/resume
      InputManager   — keyboard + mouse events
      PhysicsSystem  — fixed-timestep AABB + spatial broadphase
      RenderSystem   — Canvas2D draw: sprites, animations, particles, squash-stretch
      DebugSystem    — (debug=true) collider wireframes + FPS overlay
      EventBus       — pub/sub for game events
      AssetManager   — image + audio cache
         ↓
  Entity components mount → register in ECS
         ↓
  Frame pipeline:
    ScriptSystem  — user scripts (try/catch per script)
    PhysicsSystem — fixed 60hz steps with accumulator
    RenderSystem  — variable FPS canvas draw
    DebugSystem   — (if debug=true)
    input.flush() — clear single-frame input state
```

The React tree is the **scene description**. Once entities are mounted, ECS and the game loop own the frame — React does not re-render every frame.

---

## Runtime Warnings

Cubeforge emits dev-friendly warnings for common mistakes:

- `Duplicate entity ID "player"` — two entities with same string ID
- `BoxCollider on entity N has no Transform` — physics requires Transform
- `Script init error on entity N: ...` — init threw, logged with entity ID
- `Script update error on entity N: ...` — update threw without crashing the loop
- `Failed to load image: /path.png` — asset load failure
- `Invalid Game dimensions: 0×560` — zero/negative canvas size

---

## Local Development

```bash
git clone https://github.com/1homsi/cubeforge
cd cubeforge
bun install
bun run typecheck   # type-check all packages
bun test            # run test suite
```

---

## Monorepo Structure

```
cubeforge/
  packages/
    core/       @cubeforge/core     — ECS, loop, events, assets, tween
    input/      @cubeforge/input    — keyboard, mouse
    renderer/   @cubeforge/renderer — Canvas2D, sprites, camera, particles
    physics/    @cubeforge/physics  — AABB, RigidBody, broadphase
    react/      @cubeforge/react    — components, hooks, context
```

---

## License

MIT — [Mohamad Homsi](https://github.com/1homsi)
