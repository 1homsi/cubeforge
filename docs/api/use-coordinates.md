# useCoordinates

Converts between world-space and screen-space (canvas pixel) coordinates, accounting for camera position and zoom.

## Signature

```ts
function useCoordinates(): CoordinateHelpers
```

## CoordinateHelpers

| Method | Description |
|---|---|
| `worldToScreen(wx, wy)` | Convert world-space `(wx, wy)` to canvas pixel coordinates `{ x, y }`. |
| `screenToWorld(sx, sy)` | Convert canvas pixel `(sx, sy)` to world-space coordinates `{ x, y }`. |

## Example

```tsx
import { useCoordinates } from 'cubeforge'

function Minimap() {
  const { worldToScreen } = useCoordinates()

  const handleMouseClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    // no need to convert — sx/sy are already canvas pixels
    console.log('clicked world:', useCoordinates().screenToWorld(sx, sy))
  }

  return null
}
```

## Notes

- Reads from the active `Camera2D` component each frame — results are current as of the last render.
- Requires a `Camera2D` to be present in the scene; without one, camera position is `(0, 0)` and zoom is `1`.
