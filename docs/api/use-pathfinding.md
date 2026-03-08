# usePathfinding

Returns stable references to A\* pathfinding utilities. Builds a navigation grid from tile data and finds world-space paths between points.

## Signature

```ts
function usePathfinding(): PathfindingControls
```

## PathfindingControls

| Method | Description |
|---|---|
| `createGrid(cols, rows, cellSize)` | Create a new `NavGrid`. All cells start walkable. |
| `setWalkable(grid, col, row, walkable)` | Mark a grid cell walkable or blocked. |
| `findPath(grid, start, goal)` | A\* search from `start` to `goal` (world-space coords). Returns `Vec2Like[]` waypoints, or `[]` if no path. |

## Example

```tsx
import { usePathfinding } from 'cubeforge'
import { useRef } from 'react'

function EnemyAI({ playerPos }) {
  const { createGrid, setWalkable, findPath } = usePathfinding()
  const navGrid = useRef(createGrid(20, 15, 32))

  // Block a wall cell
  setWalkable(navGrid.current, 5, 3, false)

  return (
    <Script update={(_id, world) => {
      const t = world.getComponent(_id, 'Transform')!
      const path = findPath(navGrid.current, t, playerPos)
      if (path.length > 1) {
        // Move toward path[1] (next waypoint)
        const next = path[1]
        t.x += Math.sign(next.x - t.x) * 2
        t.y += Math.sign(next.y - t.y) * 2
      }
    }} />
  )
}
```

## Notes

- The nav grid must be created with `cols × rows = map width/height in tiles` and `cellSize = tile size in pixels`.
- Use the `navGrid` prop on `<Tilemap>` to auto-populate blocked cells from the collision layer.
- `findPath` returns **world-space** waypoints (center of each cell), ready to use with steering behaviors.
