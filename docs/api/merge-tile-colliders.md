# mergeTileColliders

Takes a 2D boolean grid representing solid tiles and returns an optimized array of merged AABB rectangles. Use this to reduce the number of colliders needed for tilemap collision from one-per-tile to a small set of merged rects.

## Signature

```ts
function mergeTileColliders(
  grid: boolean[][],   // grid[row][col] — true = solid
  cellSize: number,    // pixel size of each tile cell
): MergedRect[]
```

## MergedRect

| Property | Type | Description |
|---|---|---|
| `x` | `number` | Left edge in pixels |
| `y` | `number` | Top edge in pixels |
| `width` | `number` | Width in pixels |
| `height` | `number` | Height in pixels |

## Example

```tsx
import { mergeTileColliders } from 'cubeforge'

const TILE = 32

// 1 = solid, 0 = air
const level = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [1, 1, 0, 1, 1],
  [1, 1, 1, 1, 1],
]

const grid = level.map(row => row.map(v => v === 1))
const rects = mergeTileColliders(grid, TILE)

function Level() {
  return (
    <>
      {rects.map((r, i) => (
        <Entity key={i}>
          <Transform x={r.x + r.width / 2} y={r.y + r.height / 2} />
          <BoxCollider width={r.width} height={r.height} />
          <RigidBody type="static" />
        </Entity>
      ))}
    </>
  )
}
```

## Notes

- The algorithm merges horizontally first, then vertically, producing the fewest possible rectangles.
- `x` and `y` on `MergedRect` represent the top-left corner, not the center. Offset by half the width/height when setting `Transform` position.
- Works with any `cellSize` value. Rectangular (non-square) cells are not supported -- use a square cell size.
