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

**[Documentation](https://cubeforge.dev)** · **[Examples](https://github.com/1homsi/cubeforge-examples)**

---

## Quick start

```bash
# npm
npx create-cubeforge-game my-game

# pnpm
pnpm create cubeforge-game my-game

# yarn
yarn create cubeforge-game my-game

# bun
bunx create-cubeforge-game my-game
```

```bash
cd my-game
npm install
npm run dev
```

Or add to an existing React project:

```bash
npm install cubeforge react react-dom
```

---

## Example

```tsx
import { Game, World, Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from 'cubeforge'
import type { ECSWorld, EntityId, RigidBodyComponent, InputManager } from 'cubeforge'

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

---

## Examples

Ten runnable games in [cubeforge-examples](https://github.com/1homsi/cubeforge-examples):

| Example | Description |
|---|---|
| [platformer](https://github.com/1homsi/cubeforge-examples/tree/main/platformer) | Scrolling platformer — double jump, stomp, coins, lives, HUD |
| [mario-clone](https://github.com/1homsi/cubeforge-examples/tree/main/mario-clone) | Mario-style level — question blocks, mushroom powerup, goombas, goal flag |
| [breakout](https://github.com/1homsi/cubeforge-examples/tree/main/breakout) | Classic brick breaker — paddle, bouncing ball, multi-row bricks |
| [flappy-bird](https://github.com/1homsi/cubeforge-examples/tree/main/flappy-bird) | Tap-to-flap — scrolling pipes, high score |
| [shooter](https://github.com/1homsi/cubeforge-examples/tree/main/shooter) | Side-scrolling shoot-em-up — waves, enemy patterns, stars |
| [top-down](https://github.com/1homsi/cubeforge-examples/tree/main/top-down) | Top-down dungeon — 4-directional movement, sword combat, keys, exit |
| [pong](https://github.com/1homsi/cubeforge-examples/tree/main/pong) | Two-player paddle battle — first to 7 wins, ball speeds up on every hit |
| [snake](https://github.com/1homsi/cubeforge-examples/tree/main/snake) | Classic snake — eat food to grow, avoid your tail, speed ramps up |
| [endless-runner](https://github.com/1homsi/cubeforge-examples/tree/main/endless-runner) | Dodge incoming obstacles as the world speeds up |
| [asteroids](https://github.com/1homsi/cubeforge-examples/tree/main/asteroids) | Rotate, thrust, and shoot through waves of splitting asteroids — 3 lives |

---

## Why Cubeforge

Most browser game engines are imperative — you create objects, call methods, and manage loops manually. Cubeforge flips that: your game is a React component tree. Mount a component → entity exists. Unmount it → entity is gone.

- **Declarative** — describe your world, not your frame loop
- **Composable** — `<Player />`, `<Enemy />`, `<MovingPlatform />` are just React components
- **Lightweight** — purpose-built ECS, physics, renderer, and input; no heavy runtime deps
- **TypeScript-first** — every API is fully typed
- **Embeddable** — drop a game into any React app with one component
- **Debug-ready** — `<Game debug>` shows collider wireframes, FPS, entity counts
- **Time-travel DevTools** — `<Game devtools>` adds a frame scrubber and entity inspector
- **Deterministic** — `<Game deterministic seed={n}>` for reproducible physics and replays
- **WebGL2 renderer** — default renderer; instanced GPU rendering out of the box (Canvas2D opt-in via `renderer={Canvas2DRenderSystem}`)
- **Multiplayer** — `@cubeforge/net` provides Room, syncEntity, and ClientPrediction rollback

---

## What can I build?

- **Platformers** — scrolling levels, jump mechanics, enemies, coins
- **Top-down games** — dungeon crawlers, twin-stick shooters, RPG overworlds
- **Arcade games** — breakout, flappy bird, shoot-em-ups, endless runners
- **Roguelikes** — procedural rooms, turn-based or real-time combat
- **Mini-games in web apps** — embed a playable game in a marketing page, onboarding flow, or dashboard
- **Game jams** — fast to set up, familiar if you already know React

---

## vs other tools

**vs Phaser** — Phaser is imperative: `this.physics.add.sprite()`, scene lifecycles, manual wiring. Cubeforge is JSX — your game tree, React state, same composition model as your UI.

**vs Three.js** — Three.js is a 3D rendering library with no physics, input, or entity system. Cubeforge is a complete 2D game runtime with all of that included.

**vs Unity WebGL** — Unity requires a separate build pipeline and ships a large runtime. Cubeforge is an npm package — add it to any React app, ship with your normal build, loads instantly.

---

## Packages

| Package | Description |
|---|---|
| `cubeforge` | Components and hooks — the main public API |
| `@cubeforge/core` | ECS, game loop, events, assets, tween, pathfinding, steering, deterministic RNG |
| `@cubeforge/input` | Keyboard, mouse, gamepad, input contexts, player input, recording/playback |
| `@cubeforge/renderer` | Canvas2D renderer, camera, sprites, animations, particles, trails, parallax |
| `@cubeforge/physics` | AABB + capsule collision, rigid bodies, kinematic mode, fixed 60 Hz, spatial broadphase |
| `@cubeforge/audio` | Web Audio API — useSound, volume groups, fade, duck, crossfade |
| `@cubeforge/webgl-renderer` | WebGL2 instanced renderer — the default renderer used by `<Game>` |
| `@cubeforge/net` | Multiplayer — Room, syncEntity, useNetworkInput, ClientPrediction |
| `create-cubeforge-game` | CLI scaffolder |

---

## Local Development

```bash
git clone https://github.com/1homsi/cubeforge
cd cubeforge
pnpm install
pnpm run typecheck
pnpm test
```

---

## License

MIT — [1homsi](https://github.com/1homsi)
