# useAISteering

Returns stable references to all autonomous steering behavior functions. All behaviors are pure — they return a velocity vector and leave the caller responsible for applying it.

## Signature

```ts
function useAISteering(): AISteering
```

## AISteering

| Method | Returns | Description |
|---|---|---|
| `seek(pos, target, speed)` | `Vec2Like` | Move toward `target` at full `speed`. |
| `flee(pos, threat, speed)` | `Vec2Like` | Move away from `threat` at full `speed`. |
| `arrive(pos, target, speed, slowRadius)` | `Vec2Like` | Move toward `target`, slowing within `slowRadius`. |
| `patrol(pos, waypoints, speed, currentIdx, threshold?)` | `{ vel, nextIdx }` | Move along waypoints in a loop. |
| `wander(pos, angle, speed, jitter)` | `{ vel, newAngle }` | Random smooth drift. Store `newAngle` and pass it back each frame. |

## Example

```tsx
import { useAISteering } from 'cubeforge'
import { useRef } from 'react'

const PATROL_POINTS = [{ x: 200, y: 400 }, { x: 600, y: 400 }]

function PatrolEnemy() {
  const ai = useAISteering()
  const idxRef = useRef(0)

  return (
    <Script update={(_id, world, _input, dt) => {
      const t = world.getComponent(_id, 'Transform')!
      const { vel, nextIdx } = ai.patrol(t, PATROL_POINTS, 80, idxRef.current)
      idxRef.current = nextIdx
      t.x += vel.x * dt
      t.y += vel.y * dt
    }} />
  )
}
```

## Notes

- Combine with `usePathfinding` for grid-aware movement: pathfind to get waypoints, then `seek` toward the next waypoint each frame.
- All functions are re-exported from `cubeforge` as plain functions too (`seek`, `flee`, `arrive`, `patrol`, `wander`).
