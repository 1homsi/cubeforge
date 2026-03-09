# SpatialHash

A broad-phase spatial index for fast region queries. Divides the world into a uniform grid and tracks which entities occupy each cell, making area queries much cheaper than brute-force iteration.

## Constructor

```ts
new SpatialHash(cellSize: number)
```

| Param | Type | Description |
|---|---|---|
| `cellSize` | number | Width and height of each grid cell in pixels |

## Methods

| Method | Signature | Description |
|---|---|---|
| `insert` | `(id: number, x: number, y: number, w: number, h: number) => void` | Insert an entity's AABB into the grid |
| `remove` | `(id: number) => void` | Remove an entity from the grid |
| `queryRect` | `(x: number, y: number, w: number, h: number) => number[]` | Return entity IDs whose cells overlap the given rectangle |
| `queryCircle` | `(cx: number, cy: number, r: number) => number[]` | Return entity IDs whose cells overlap the given circle |
| `clear` | `() => void` | Remove all entries from the grid |

## Example

```ts
import { SpatialHash } from 'cubeforge'

const grid = new SpatialHash(64)

// Insert entities by their bounding boxes
grid.insert(1, 100, 200, 32, 32)
grid.insert(2, 400, 200, 48, 48)
grid.insert(3, 110, 210, 20, 20)

// Query a rectangular area
const nearby = grid.queryRect(80, 180, 60, 60)
// => [1, 3]

// Query a circular area
const inRadius = grid.queryCircle(100, 200, 50)
// => [1, 3]

// Clean up
grid.clear()
```

## Notes

- `SpatialHash` is a low-level utility. The built-in physics system already uses one internally for collision broadphase.
- Choose a `cellSize` roughly 2-4x the size of your average entity for best performance.
- `queryRect` and `queryCircle` return candidate IDs — you still need narrow-phase checks for exact overlap.
- Entity positions must be re-inserted after movement. Call `remove` then `insert`, or `clear` and re-insert all entities each frame.
