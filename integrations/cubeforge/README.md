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
- **Physics** — two-pass AABB, kinematic bodies, one-way platforms, 60 Hz fixed timestep
- **Renderer** — WebGL2 instanced renderer by default
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

## Large tile worlds: `<TileLayer>`

`<Tilemap>` loads Tiled maps and creates one entity + sprite per tile, which is fine for small levels.
For big, mostly static grids (hundreds of thousands of tiles) use `<TileLayer>`: the tiles live in one
typed array and are drawn by the GPU, never as entities.

```tsx
import { TileLayer, useTileLayer, Camera2D } from 'cubeforge'

function Ground({ sim }) {
  const ground = useTileLayer({
    width: 600,
    height: 300, // 180k tiles, Uint16Array; 0 = empty, id n = atlas tile n - 1
    tileset: { src: '/tiles.png', tileWidth: 16, tileHeight: 16, columns: 32, spacing: 0, margin: 0 },
    animations: { 12: { frames: [12, 13, 14, 13], duration: 0.2 } }, // water shimmer
  })
  useEffect(() => {
    sim.onTileChanged = (x, y, id) => ground.setTile(x, y, id) // no React re-render
    sim.onSeason = (tiles) => ground.setTiles(tiles)
  }, [ground])
  return <TileLayer layer={ground} zIndex={0} />
}
// <Camera2D pixelSnap /> keeps pixel art crisp while panning at any zoom / devicePixelRatio.
```

Cost model:

| Operation | Cost |
|---|---|
| Draw (WebGL2) | One quad per visible 4096x4096-tile page (one draw for a 600x300 map); per-pixel cost only for on-screen pixels. Off-screen tiles cost nothing. |
| `setTile(x, y, id)` | O(1). Next frame uploads the dirty rect of each touched 32x32 chunk (`texSubImage2D`, one texel for a single edit). |
| `setTiles(array)` / `fill(id)` | O(tiles) copy + one full index upload (360 KB for 600x300 Uint16). |
| Animated tiles | O(animations) per frame on the CPU and a tiny lookup-table upload when a frame flips; zero per-tile work. |
| Idle frame | No uploads, no allocation. |

Tile layers draw after parallax backgrounds and before all sprites, ordered by `zIndex` among
themselves. Sampling uses `texelFetch` on exact atlas texels, so there is no bleeding or seams at
fractional zoom. GPU textures are freed the frame after the layer unmounts and rebuilt after a GL
context restore. Without WebGL, `TileLayerCanvasRenderer` draws the same layer onto any 2D context
with cached chunk canvases.

## Links

- [Documentation](https://cubeforge.dev)
- [Examples](https://github.com/1homsi/cubeforge-examples) — 10 runnable games
- [GitHub](https://github.com/1homsi/cubeforge)

## License

MIT
