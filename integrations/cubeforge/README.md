# cubeforge

**Build browser games with React.**

```tsx
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
```

## Install

```bash
npm install cubeforge react react-dom
```

## What's included

- **ECS** — archetype-based entity-component-system with query caching
- **Physics** — two-pass AABB, capsule colliders, kinematic bodies, one-way platforms, 60 Hz fixed timestep
- **Renderer** — WebGL2 instanced renderer by default; Canvas2D opt-in via `renderer={Canvas2DRenderSystem}`
- **Input** — keyboard, mouse, gamepad, per-player input maps, input contexts, recording/playback
- **Audio** — Web Audio API with volume groups, fade, crossfade, ducking (`useSound`)
- **Gameplay hooks** — `usePlatformerController`, `useTopDownMovement`, `useHealth`, `useSave`, `useGameStateMachine`, `useLevelTransition`, `usePathfinding`, `useAISteering`, and more
- **DevTools** — time-travel frame scrubber and entity inspector (`<Game devtools>`)
- **Deterministic mode** — seeded RNG for reproducible simulations (`<Game deterministic seed={n}>`)

## Quick example

```tsx
import {
  Game, World, Entity, Transform, Sprite,
  RigidBody, BoxCollider, Script,
  usePlatformerController, useHealth, useSound,
} from 'cubeforge'

function Player() {
  const id = useEntity()
  usePlatformerController(id, { speed: 220, jumpForce: -520, maxJumps: 2 })
  const { hp, takeDamage } = useHealth(5, { onDeath: () => console.log('dead') })
  const jump = useSound('/jump.wav', { group: 'sfx' })
  return null
}

export default function MyGame() {
  return (
    <Game width={800} height={500} gravity={980}>
      <World background="#1a1a2e">
        <Camera2D followEntity="player" smoothing={0.87} />
        <Entity id="player" tags={['player']}>
          <Transform x={100} y={300} />
          <Sprite src="/player.png" width={32} height={48} />
          <RigidBody />
          <BoxCollider width={30} height={48} />
          <Player />
        </Entity>
      </World>
    </Game>
  )
}
```

## Links

- [Documentation](https://cubeforge.dev)
- [Examples](https://github.com/1homsi/cubeforge-examples) — 10 runnable games
- [GitHub](https://github.com/1homsi/cubeforge)

## License

MIT
