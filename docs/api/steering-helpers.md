# Steering Helpers

Standalone AI steering functions that return `Vec2` velocity vectors. Use them inside Script update functions to drive NPC movement without the `useAISteering` hook.

## Functions

All functions are imported from `cubeforge` and return a `Vec2` (velocity vector).

| Function | Signature | Description |
|---|---|---|
| `seek` | `seek(pos: Vec2, target: Vec2, speed: number): Vec2` | Returns a velocity pointing from `pos` toward `target` at the given `speed`. |
| `flee` | `flee(pos: Vec2, threat: Vec2, speed: number): Vec2` | Returns a velocity pointing away from `threat` at the given `speed`. |
| `arrive` | `arrive(pos: Vec2, target: Vec2, speed: number, slowRadius: number): Vec2` | Like `seek` but decelerates smoothly when within `slowRadius` pixels of the target. |
| `patrol` | `patrol(pos: Vec2, waypoints: Vec2[], speed: number, currentIdx: number): Vec2` | Steers toward `waypoints[currentIdx]`. Advance `currentIdx` yourself when the entity reaches each waypoint. |
| `wander` | `wander(pos: Vec2, angle: number, speed: number, jitter: number): Vec2` | Returns a velocity based on a slowly drifting `angle`. Pass the previous angle back each frame; `jitter` controls how much the angle changes per call (radians). |

## Example

```tsx
import { seek, flee, arrive, patrol, wander } from 'cubeforge'

function EnemyAI() {
  let waypointIdx = 0
  const waypoints = [
    { x: 100, y: 300 },
    { x: 400, y: 300 },
    { x: 400, y: 100 },
  ]

  return (
    <Entity id="enemy" tags={['enemy']}>
      <Transform x={100} y={300} />
      <Sprite width={24} height={24} color="red" />
      <Script
        update={(id, world, input, dt) => {
          const t = world.getComponent(id, 'Transform')
          if (!t) return

          const pos = { x: t.x, y: t.y }

          // Patrol between waypoints
          const vel = patrol(pos, waypoints, 80, waypointIdx)
          t.x += vel.x * dt
          t.y += vel.y * dt

          // Advance waypoint when close enough
          const wp = waypoints[waypointIdx]
          const dx = wp.x - t.x, dy = wp.y - t.y
          if (Math.sqrt(dx * dx + dy * dy) < 4) {
            waypointIdx = (waypointIdx + 1) % waypoints.length
          }
        }}
      />
    </Entity>
  )
}
```

## Notes

- All functions are stateless (pure) except `wander`, which depends on the angle you pass in.
- Combine multiple steering results by adding the returned `Vec2` vectors and clamping to a max speed.
- For the React hook variant, see [`useAISteering`](./use-ai-steering.md).
