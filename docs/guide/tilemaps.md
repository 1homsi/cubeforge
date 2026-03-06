# Tilemaps

The `<Tilemap>` component loads a [Tiled](https://www.mapeditor.org/) JSON export and renders tiles, generates collision entities, handles trigger zones, animates tiles, and spawns objects — all from a single component.

## Basic usage

```tsx
<Tilemap src="/levels/level1.json" />
```

This loads the map, renders all visible tile layers as sprites, and auto-generates invisible solid `BoxCollider` entities for any layer named `"collision"`.

## Collision layers

Any tile layer named `"collision"` (or with a Tiled property `collision: true`) is treated as a solid collision layer. Tiles in this layer don't render — they create invisible static `BoxCollider` entities instead.

Adjacent filled tiles in the same row are merged into a single wide collider, reducing entity count.

In Tiled, name your layer `"collision"` or add a boolean custom property `collision = true`.

You can override the layer name:

```tsx
<Tilemap src="/level1.json" collisionLayer="solid" />
```

## Trigger layers

Layers named `"triggers"` (or with property `trigger: true`) create trigger `BoxCollider` entities — zones that fire events without blocking movement:

```tsx
<Tilemap src="/level1.json" triggerLayer="triggers" />
```

Listen for trigger events on the `EventBus`:

```tsx
useEvent<{ a: number; b: number }>('trigger', ({ a, b }) => {
  // a and b are entity IDs that overlapped
})
```

## Spawning objects from object layers

Use `onSpawnObject` to convert Tiled object layer entries into React entities:

```tsx
<Tilemap
  src="/level1.json"
  onSpawnObject={(obj, layer) => {
    if (obj.type === 'player') return <Player key={obj.id} x={obj.x} y={obj.y} />
    if (obj.type === 'coin')   return <Coin   key={obj.id} x={obj.x} y={obj.y} />
    if (obj.type === 'enemy')  return <Enemy  key={obj.id} x={obj.x} y={obj.y} />
    return null
  }}
/>
```

In Tiled, set the `Type` field on each object to a string your handler recognises. The `obj` argument contains `id`, `name`, `type`, `x`, `y`, `width`, `height`, and any custom properties.

## Tile properties and callbacks

Use `onTileProperty` to react to tiles that have custom Tiled properties. This runs once per tile that has properties, when the map loads:

```tsx
<Tilemap
  src="/level1.json"
  onTileProperty={(tileId, properties, x, y) => {
    if (properties.spawnEnemy) {
      // schedule an enemy to spawn at (x, y)
      spawnPoints.push({ x, y, type: properties.enemyType as string })
    }
    if (properties.hazard) {
      hazardZones.push({ x, y })
    }
  }}
/>
```

Properties are defined in Tiled's tileset editor under each tile's custom properties.

## Animated tiles

Tiles with animation data in the Tiled tileset are automatically animated. Cubeforge reads the `animation` array (list of `{ tileid, duration }` pairs) from the tileset JSON and advances frames on a per-tile script.

No additional setup is needed — export your Tiled map with embedded tileset data and animated tiles work out of the box.

## Layer filtering

Skip specific layers entirely with `layerFilter`:

```tsx
<Tilemap
  src="/level1.json"
  layerFilter={(layer) => layer.name !== 'editor-notes'}
/>
```

Return `false` to skip a layer. Hidden layers (Tiled's eye icon off) are always skipped regardless of this filter.

## zIndex

All visual tile sprites share a single `zIndex`. Default is `0`. Use a negative value to render tiles behind entities:

```tsx
<Tilemap src="/background.json" zIndex={-5} />
<Tilemap src="/foreground.json" zIndex={10} />
```

## Full example

```tsx
import { Game, World, Camera2D, Tilemap } from '@cubeforge/react'

function Level() {
  const [playerPos, setPlayerPos] = useState({ x: 100, y: 200 })

  return (
    <Game width={800} height={500} gravity={980}>
      <World background="#0d1b2a">
        <Camera2D
          followEntity="player"
          smoothing={0.9}
          bounds={{ x: 0, y: 0, width: 3200, height: 900 }}
        />

        <Tilemap
          src="/levels/world1-1.json"
          collisionLayer="collision"
          triggerLayer="triggers"
          onSpawnObject={(obj) => {
            if (obj.type === 'player_start') {
              setPlayerPos({ x: obj.x, y: obj.y })
              return null
            }
            if (obj.type === 'coin') return <Coin key={obj.id} x={obj.x} y={obj.y} />
            if (obj.type === 'goomba') return <Goomba key={obj.id} x={obj.x} y={obj.y} />
            return null
          }}
        />

        <Player x={playerPos.x} y={playerPos.y} />
      </World>
    </Game>
  )
}
```

## Tileset image paths

Tiled embeds a relative image path in the tileset. `<Tilemap>` resolves it relative to the `src` URL. If your map is at `/levels/level1.json` and the tileset references `../tilesets/world.png`, it resolves to `/tilesets/world.png`.

Absolute paths (starting with `/`) are used as-is.
