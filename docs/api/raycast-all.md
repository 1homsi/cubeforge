# raycastAll

Casts a ray and returns **all** `BoxCollider` hits sorted by distance (closest first). This is the multi-hit variant of `raycast`, which returns only the first hit.

## Signature

```ts
function raycastAll(
  world: ECSWorld,
  origin: { x: number; y: number },
  direction: { x: number; y: number },  // does not need to be normalized
  distance: number,
  opts?: {
    tag?: string            // only include entities with this tag
    layer?: string          // only include entities on this BoxCollider layer
    exclude?: EntityId[]    // skip these entity IDs
    includeTriggers?: boolean  // default false
  },
): RaycastHit[]
```

## RaycastHit

| Property | Type | Description |
|---|---|---|
| `entityId` | `EntityId` | The entity that was hit |
| `distance` | `number` | Pixels from origin to the hit point |
| `point` | `{ x: number; y: number }` | World-space hit position |
| `normal` | `{ x: number; y: number }` | Surface normal (axis-aligned unit vector) |

## Example

```ts
import { raycastAll } from 'cubeforge'

// Pierce laser through all enemies in a line
const hits = raycastAll(world, { x: gunX, y: gunY }, { x: 1, y: 0 }, 600, {
  tag: 'enemy',
})

for (const hit of hits) {
  // Damage falls off with distance
  const dmg = Math.max(1, 10 - Math.floor(hit.distance / 60))
  dealDamage(hit.entityId, dmg)
}
```

## Notes

- Returns an empty array when there are no hits.
- The `direction` vector is normalized internally; you do not need to normalize it yourself.
- Triggers are skipped by default. Set `includeTriggers: true` to include them.
- Uses the AABB slab method for intersection, same as `raycast`.
- See also: [`raycast`](./spatial-queries.md) for single-hit variant, [`overlapBox`](./spatial-queries.md) and [`overlapCircle`](./overlap-circle.md) for area queries.
