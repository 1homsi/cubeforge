# sweepBox

Performs a swept AABB collision test. Moves a box from its current position by a given displacement and returns the first entity hit along the way, or `null` if the path is clear.

Internally uses the Minkowski sum approach: each target collider is expanded by the sweep box's half-extents, then a ray is cast from the box center through the expanded space.

## Usage

```tsx
import { sweepBox } from 'cubeforge'
```

## Signature

```ts
function sweepBox(
  world: ECSWorld,
  cx: number,
  cy: number,
  w: number,
  h: number,
  dx: number,
  dy: number,
  opts?: RaycastOpts
): RaycastHit | null
```

## Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `world` | `ECSWorld` | — | The ECS world to query against |
| `cx` | `number` | — | Center X of the sweep box in world space |
| `cy` | `number` | — | Center Y of the sweep box in world space |
| `w` | `number` | — | Width of the sweep box |
| `h` | `number` | — | Height of the sweep box |
| `dx` | `number` | — | Horizontal displacement to sweep |
| `dy` | `number` | — | Vertical displacement to sweep |
| `opts` | `RaycastOpts` | `{}` | Optional filters (see below) |

### RaycastOpts

| Field | Type | Default | Description |
|---|---|---|---|
| `tag` | `string` | — | Only test entities with this tag |
| `layer` | `string` | — | Only test entities whose BoxCollider is on this layer |
| `exclude` | `EntityId[]` | — | Entity IDs to skip (e.g. the moving entity itself) |
| `includeTriggers` | `boolean` | `false` | Whether to include trigger colliders |

## Return value

`RaycastHit | null`

| Field | Type | Description |
|---|---|---|
| `entityId` | `EntityId` | The entity that was hit |
| `distance` | `number` | Distance from the start position to the hit point |
| `point` | `{ x: number; y: number }` | World-space point where contact occurred |
| `normal` | `{ x: number; y: number }` | Surface normal at the hit point (axis-aligned) |

Returns `null` if no collision was found within the displacement distance.

## Example

```tsx
import { sweepBox } from 'cubeforge'

// Inside a Script update function
function update(entityId, world, input, dt) {
  const transform = world.getComponent(entityId, 'Transform')
  const rb = world.getComponent(entityId, 'RigidBody')

  const vx = rb.velocityX * dt
  const vy = rb.velocityY * dt

  // Sweep a 30x40 box along velocity
  const hit = sweepBox(world, transform.x, transform.y, 30, 40, vx, vy, {
    exclude: [entityId],
    tag: 'solid',
  })

  if (hit) {
    // Slide along the surface — stop in the blocked axis
    if (hit.normal.x !== 0) rb.velocityX = 0
    if (hit.normal.y !== 0) rb.velocityY = 0
  }
}
```

## See also

- [Spatial Queries](/api/spatial-queries) — `overlapBox`, `overlapCircle`, `raycast`, `raycastAll`
