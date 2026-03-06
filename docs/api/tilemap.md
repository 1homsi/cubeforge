# Tilemap

Loads a Tiled JSON map file, renders tile layers as sprites, auto-generates collision and trigger entities, spawns objects from object layers, animates tiles, and fires callbacks for tiles with custom properties.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | string | — | **Required.** URL to the Tiled JSON export |
| `collisionLayer` | string | `'collision'` | Name of the tile layer that generates solid static colliders |
| `triggerLayer` | string | `'triggers'` | Name of the tile layer that generates trigger colliders |
| `zIndex` | number | `0` | z-index for all tile sprites |
| `onSpawnObject` | `(obj, layer) => ReactNode` | — | Called for each object in object layers |
| `layerFilter` | `(layer) => boolean` | — | Return false to skip a layer |
| `onTileProperty` | `(tileId, properties, x, y) => void` | — | Called for tiles with custom tileset properties |

## Example

```tsx
<Tilemap
  src="/levels/world1.json"
  collisionLayer="collision"
  triggerLayer="triggers"
  zIndex={0}
  onSpawnObject={(obj, layer) => {
    if (obj.type === 'player') return <Player key={obj.id} x={obj.x} y={obj.y} />
    if (obj.type === 'coin')   return <Coin   key={obj.id} x={obj.x} y={obj.y} />
    if (obj.type === 'enemy')  return <Enemy  key={obj.id} x={obj.x} y={obj.y} />
    return null
  }}
  onTileProperty={(tileId, props, x, y) => {
    if (props.hazard) damageZones.push({ x, y })
  }}
/>
```

## Collision layer

A tile layer named `"collision"` (or with Tiled property `collision = true`) is treated as solid. Tiles in this layer are invisible — they generate static `BoxCollider` entities for the physics system. Adjacent tiles in the same row are merged into one wide collider.

## Object layer spawning

For each object in a Tiled object layer, `onSpawnObject` is called with the object data and the layer it belongs to. Return a React element to spawn it, or `null` to skip.

The `obj` argument shape:

```ts
{
  id: number
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  properties?: TiledProperty[]
}
```

## Animated tiles

Tiles with `animation` data in the tileset are automatically animated. Cubeforge reads the frame list and durations from the Tiled JSON and advances frames using a per-tile Script. No setup required.

## Layer filter

Skip layers by name or other criteria:

```tsx
<Tilemap
  src="/map.json"
  layerFilter={(layer) => {
    if (layer.name === 'dev-notes') return false
    if (!layer.visible) return false
    return true
  }}
/>
```

## Notes

- The `Tilemap` component is not wrapped in `<Entity>` — it manages its own entities internally.
- On unmount, all created entities are destroyed. Re-mounting (e.g. when changing `src`) cleans up old entities and loads the new map.
- Tileset image paths are resolved relative to the `src` URL.
