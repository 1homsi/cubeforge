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
| `markDirtyRect(x, y, w, h)` | After writing `layer.tiles` in place: clipped to the layer, queues each overlapped chunk with its part of the rect, like `setTile` for an area. |
| `touch()` | After writing `layer.tiles` in place when the area is unknown: marks everything dirty (same cost as `setTiles`, without the copy). |
| `setTiles(array)` / `fill(id)` | O(tiles) copy + one full index upload (360 KB for 600x300 Uint16). |
| Animated tiles | O(animations) per frame on the CPU and a tiny lookup-table upload when a frame flips; zero per-tile work. |
| Idle frame | No uploads, no allocation. |
| `setTint(x, y, 0xRRGGBBAA)` | O(1), shares the tile dirty rects. `setTints(bytes)` re-uploads the tint layer once. |

Variation and colour, all evaluated per pixel in the shader:

```ts
useTileLayer({
  ...,
  variants: { 5: [5, 21, 22, 23] }, // grass: per-cell pick by tileHash(x, y)
  jitter: 0.12,                      // hashed per-tile brightness variation
  tinted: true,                      // RGBA per tile, multiplied with the tile colour
})
water.setTints(colourFromDepthAndBiome) // width * height * 4 bytes
ground.visualTile(x, y)                 // the id actually drawn (variant + animation)
```

Variants share the tile id space with the atlas (`0` is empty, id `n` is atlas tile `n - 1`). A cell
holding `id` draws `variants[id][tileHash(x, y) % min(255, list.length)]`, then its animation frame.
The pick depends only on the cell coordinates, so it is stable across edits, and lists are capped at
255 entries. `tileHash` is exported, and `layer.variantAt(x, y)` returns the id picked at a cell
(before animation) so CPU models need not replicate the hash.

Writing `layer.tiles` directly is allowed; tell the layer afterwards:

```ts
ground.tiles[y * ground.width + x] = id
ground.markDirtyRect(x, y, 1, 1)  // or markDirtyRect(x0, y0, w, h) for a block
ground.touch()                     // unknown extent: re-upload everything
```

`visible`, `x`, `y`, `zIndex`, `opacity`, `tileset`, `tileWorldWidth` and `tileWorldHeight` are
setters that wake an on-demand loop (they call `layer.onChange`). `<TileLayer>` wires `onChange` to
`engine.loop.markDirty()`; for a layer added to the world imperatively use
`createTileLayerComponent(layer, () => engine.loop.markDirty())`.

Below about 2 device pixels per tile (e.g. zoom 0.05 with 16 px tiles) each tile is drawn with its
atlas tile's average colour, so far zoom doesn't shimmer.

Tile layers draw after parallax backgrounds and before all sprites, ordered by `zIndex` among
themselves. Sampling uses `texelFetch` on exact atlas texels, so there is no bleeding or seams at
fractional zoom. GPU textures are freed the frame after the layer unmounts and rebuilt after a GL
context restore. Without WebGL, `TileLayerCanvasRenderer` draws the same layer onto any 2D context
with cached chunk canvases.

## Thousands of sprites: `useSpriteLayer`

For crowds driven by simulation data (people, animals, buildings) use a sprite layer instead of one
`<Entity>` per object: typed arrays, no React node or entity per sprite.

```tsx
const crowd = useSpriteLayer({
  atlases: [
    { src: '/people.png', frameWidth: 16, frameHeight: 16 },
    { src: '/buildings.png', frameWidth: 32, frameHeight: 32 },
  ],
  sortByKey: true, // draw by sortKey (e.g. y) so people and buildings interleave by depth
  zIndex: 5,
})

// per simulation tick
crowd.resize(sim.count)
for (let i = 0; i < sim.count; i++) {
  crowd.x[i] = sim.x[i]
  crowd.y[i] = sim.y[i] + Math.sin(t + i) * 2 // e.g. fish bobbing
  crowd.w[i] = crowd.h[i] = 16 * sim.scale[i]
  crowd.atlas[i] = sim.isBuilding[i] ? 1 : 0
  crowd.frame[i] = sim.frame[i]
  crowd.color[i] = 0xffffff00 | Math.round(255 * sim.alpha[i]) // tint + alpha (fade on death)
  crowd.sortKey[i] = sim.y[i]
  crowd.ids[i] = sim.organismId[i]
}
crowd.touch()

const id = crowd.pick(worldX, worldY) // your id of the topmost sprite, -1 if none
```

Up to 8 atlases draw in one instanced call. The y-sort is incremental (near-linear when keys drift
between frames): about 0.13 ms CPU per frame for 3,000 moving, re-sorted sprites. `pick` walks the
draw order from the top and ignores rotation.

## Overlays and camera

- `useScreenTint().set(r, g, b, strength, mode)`: full-view tint drawn after sprites and layers and
  before text. Use `'multiply'` for day/night, `'normal'` for fog or weather, `'additive'` for a flash.
- Emotes and bubbles: a second sprite layer with a higher `zIndex`, positioned above each person.
  Text labels are `<Text>` entities (one cached texture per unique string).
- Hazard overlays: a second `TileLayer` with semi-transparent tiles or a tint layer.
- `useCameraPanZoom({ minZoom, maxZoom, wheelSpeed, inertia, friction, onTap })`: drag to pan with
  mouse or touch, inertia, wheel and pinch zoom around the cursor, and `onTap` (with world
  coordinates) for click-to-select. Combine with `<Camera2D pixelSnap />`.
- `<Camera2D followPoint={() => ({ x, y })} />` follows any point (return null to hold) and
  `<Camera2D followSprite={{ layer, index }} />` (or `{ layer, id }`) follows a sprite layer sprite;
  a hidden or removed sprite holds the camera. Both share the smoothing, dead zone, offset and
  bounds of `followEntity`. Priority: `followPoint` > `followSprite` > `followEntity`.
- `useCamera().zoomAt(screenX, screenY, zoom)` and `useCoordinates()` work in canvas CSS pixels at
  any devicePixelRatio.

## Bundle size

The package ships one ESM file per module and declares `"sideEffects": false`,
so bundlers keep only what you import. Importing `Game`, `World`, `Entity`,
`Camera2D`, `Sprite` and a few hooks costs about 33 kB gzip. Physics is attached
automatically the first time a physics component (`RigidBody`, any collider,
`Joint`) is created, so it is only bundled when you use it. The debug overlay and
devtools load on demand when the `debug` or `devtools` prop is set.

`cubeforge/render` is a smaller barrel with just the rendering, camera, layer and
core hooks; its `Game` does not support the `debug` or `devtools` props.

## Links

- [Documentation](https://cubeforge.dev)
- [Examples](https://github.com/1homsi/cubeforge-examples) — 10 runnable games
- [GitHub](https://github.com/1homsi/cubeforge)

## License

MIT
