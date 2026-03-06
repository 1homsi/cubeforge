# Cubeforge

**Build browser games with React.**

```tsx
<Game width={800} height={500} gravity={980}>
  <World background="#1a1a2e">
    <Camera2D followEntity="player" smoothing={0.85} />
    <Player x={100} y={300} />
    <Enemy x={500} y={300} />
    <MovingPlatform x1={200} y1={350} x2={450} y2={350} duration={2.5} />
  </World>
</Game>
```

## Install

```bash
# bun
bun add @cubeforge/react react react-dom

# npm
npm install @cubeforge/react react react-dom

# yarn
yarn add @cubeforge/react react react-dom

# pnpm
pnpm add @cubeforge/react react react-dom
```

## Quick start

```tsx
import { Game, World, Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { ECSWorld, EntityId, RigidBodyComponent, InputManager } from '@cubeforge/react'

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

## Examples

Six runnable games in [cubeforge-examples](https://github.com/1homsi/cubeforge-examples):

| Example | Description |
|---|---|
| [platformer](https://github.com/1homsi/cubeforge-examples/tree/main/platformer) | Scrolling platformer — double jump, stomp, coins, lives, HUD |
| [mario-clone](https://github.com/1homsi/cubeforge-examples/tree/main/mario-clone) | Mario-style level — question blocks, mushroom powerup, goombas, goal flag |
| [breakout](https://github.com/1homsi/cubeforge-examples/tree/main/breakout) | Classic brick breaker — paddle, bouncing ball, multi-row bricks |
| [flappy-bird](https://github.com/1homsi/cubeforge-examples/tree/main/flappy-bird) | Tap-to-flap — scrolling pipes, high score |
| [shooter](https://github.com/1homsi/cubeforge-examples/tree/main/shooter) | Side-scrolling shoot-em-up — waves, enemy patterns, stars |
| [top-down](https://github.com/1homsi/cubeforge-examples/tree/main/top-down) | Top-down dungeon — 4-directional movement, sword combat, keys, exit |

---

## Why Cubeforge

Most browser game engines are imperative. You create objects, call methods, manage loops manually. Cubeforge flips that: your game is a React component tree. Mount a component → entity exists. Unmount it → entity is gone.

- **Declarative** — describe your world, not your frame loop
- **Composable** — `<Player />`, `<Enemy />`, `<MovingPlatform />` are just React components
- **Lightweight runtime** — no heavy engine dependencies; ECS, physics, renderer, and input are all purpose-built and small
- **TypeScript-first** — every API is fully typed
- **Embeddable** — drop a game into any React app with one component
- **Debug-ready** — `<Game debug>` shows collider wireframes, FPS, entity counts

---

## What can I build?

Cubeforge is a good fit for:

- **Platformers** — scrolling levels, jump mechanics, enemies, coins
- **Top-down games** — dungeon crawlers, twin-stick shooters, RPG overworlds
- **Arcade games** — breakout, flappy bird, shoot-em-ups, endless runners
- **Roguelikes** — procedural rooms, turn-based or real-time combat
- **Mini-games in web apps** — embed a playable game directly in a marketing page, onboarding flow, or dashboard
- **Interactive experiences** — educational games, gamified UI, interactive demos
- **Game jams** — fast to set up, familiar if you already know React

---

## Why Cubeforge?

**vs Phaser**

Phaser uses an imperative API — you call `this.physics.add.sprite()`, manage scene lifecycles, and wire everything up manually. Cubeforge uses React components. Your game tree is JSX, state is React state, and everything composes the same way your UI does.

**vs Three.js**

Three.js is a 3D rendering library. It doesn't include physics, input, game loops, or an entity system. Cubeforge is a complete 2D game runtime — you get all of that out of the box.

**vs Unity WebGL**

Unity exports require a separate build pipeline and ship a large runtime. Cubeforge is a npm package — add it to any existing React app, ship it as part of your normal build, and it loads instantly.

---

## Components

### `<Game>`

Root component. Creates the canvas, engine, and all subsystems.

```tsx
<Game
  width={900}
  height={560}
  gravity={980}
  debug                 // collider wireframes + FPS overlay
  scale="contain"       // 'none' | 'contain' | 'pixel'
  onReady={(controls) => {
    controls.pause()
    controls.resume()
    controls.reset()
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
  color="#4fc3f7"
  src="/player.png"
  frameIndex={2}
  frameWidth={32}
  frameHeight={48}
  frameColumns={8}
  anchorX={0.5}
  anchorY={0.5}
  zIndex={10}
  flipX={false}
  visible={true}
/>
```

### `<Animation>`

Drives frame-based sprite sheet animations.

```tsx
<Animation frames={[0, 1, 2, 3]} fps={12} loop playing />
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
/>
```

### `<SquashStretch>`

Adds squash-and-stretch visual feel based on velocity (visual only).

```tsx
<SquashStretch intensity={0.2} recovery={8} />
```

### `<ParticleEmitter>`

Lightweight particle effect attached to an entity.

```tsx
<ParticleEmitter
  active={true}
  rate={20}
  speed={80}
  spread={Math.PI}
  angle={-Math.PI / 2}
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
<MovingPlatform x1={200} y1={350} x2={450} y2={350} width={120} duration={2.5} />
```

### `<Checkpoint>`

Fires `onActivate` when the player enters the zone, then destroys itself.

```tsx
<Checkpoint x={800} y={450} onActivate={() => setSavePoint(800)} />
```

### `<Tilemap>`

Loads a [Tiled](https://www.mapeditor.org/) JSON map, renders tiles, and auto-generates collision entities.

```tsx
<Tilemap
  src="/levels/level1.json"
  onSpawnObject={(obj, layer) => {
    if (obj.type === 'player') return <Player x={obj.x} y={obj.y} />
    if (obj.type === 'enemy')  return <Enemy  x={obj.x} y={obj.y} />
    return null
  }}
/>
```

Layers named `"collision"` or with property `collision: true` auto-generate static `BoxCollider` entities.

---

## Hooks

### `usePlatformerController(entityId, opts?)`

Full platformer controls (WASD/arrows + jump) with coyote time, jump buffer, and sprite flip.

```tsx
const id = useEntity()
usePlatformerController(id, {
  speed: 220,
  jumpForce: -520,
  maxJumps: 2,
  coyoteTime: 0.08,
  jumpBuffer: 0.08,
})
```

### `useTopDownMovement(entityId, opts?)`

4-directional top-down movement. Set `gravityScale={0}` on `<RigidBody>`.

```tsx
const id = useEntity()
useTopDownMovement(id, { speed: 180, normalizeDiagonal: true })
```

### `useGame()`

Full engine access — ECS, input, events, assets, renderer.

```tsx
const engine = useGame()
engine.ecs.query('Transform', 'RigidBody')
engine.events.on('collision', ({ a, b }) => { ... })
engine.assets.loadImage('/tileset.png')
```

### `useEvent(event, handler)`

Subscribe to an engine event with auto-cleanup on unmount.

```tsx
useEvent('collision', ({ a, b }) => { ... })
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

Keys work by `e.code` (`'Space'`, `'KeyA'`) or `e.key` (`'a'`).

---

## Physics

Two-pass AABB (X then Y) with fixed 60hz timestep and spatial broadphase grid.

- Fixed timestep: physics always runs at 60 steps/sec regardless of render FPS
- Broadphase: 128px cell spatial grid — no O(n×m) checks
- `gravityScale={0}` for top-down or zero-gravity games
- Triggers fire a `trigger` event on `EventBus` without blocking movement

---

## Tween

```tsx
import { tween, Ease } from '@cubeforge/react'

const handle = tween(0, 100, 0.5, Ease.easeOutQuad, (v) => {
  sprite.width = v
})

// In a Script update:
handle.update(dt)
handle.stop()
handle.isComplete
```

Available easing: `Ease.linear`, `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, `easeOutBack`.

---

## Assets

```tsx
const { assets } = useGame()

await assets.preloadImages(['/player.png', '/tileset.png'])
assets.playAudio('/jump.wav', 0.8)
assets.playLoopAudio('/bgm.mp3', 0.5)
assets.stopAudio('/bgm.mp3')
assets.stopAll()
```

---

## Embedding in React Apps

```tsx
<Game width={800} height={500} scale="contain" onReady={setControls}>
  <World>...</World>
</Game>

<button onClick={() => controls?.pause()}>Pause</button>
<button onClick={() => controls?.resume()}>Resume</button>
```

Scale modes: `'none'` (default), `'contain'` (fit parent), `'pixel'` (pixel-art).

---

## Packages

| Package | Description |
|---|---|
| `@cubeforge/core` | ECS, game loop, events, assets, tween |
| `@cubeforge/input` | Keyboard and mouse |
| `@cubeforge/renderer` | Canvas2D renderer, camera, sprites, particles |
| `@cubeforge/physics` | AABB collision, rigid bodies, fixed timestep |
| `@cubeforge/react` | Components and hooks — the main API |

---

## Local Development

```bash
git clone https://github.com/1homsi/cubeforge
cd cubeforge
bun install
bun run typecheck
bun test
```

---

## License

MIT — [Mohamad Homsi](https://github.com/1homsi)
