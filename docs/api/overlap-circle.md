# overlapCircle

Returns all entities whose `BoxCollider` overlaps the given circle. Useful for explosion radii, proximity detection, and area-of-effect abilities.

## Signature

```ts
function overlapCircle(
  world: ECSWorld,
  cx: number,       // center X of the circle
  cy: number,       // center Y of the circle
  radius: number,   // radius in pixels
  opts?: {
    tag?: string          // only include entities with this tag
    layer?: string        // only include entities on this BoxCollider layer
    exclude?: EntityId[]  // skip these entity IDs
  },
): EntityId[]
```

## Example

```ts
import { overlapCircle } from 'cubeforge'

// Explosion: damage all enemies within 120px
const victims = overlapCircle(world, bomb.x, bomb.y, 120, {
  tag: 'enemy',
  exclude: [playerId],
})

for (const eid of victims) {
  applyKnockback(eid, bomb.x, bomb.y)
  dealDamage(eid, 25)
}
```

```ts
// Proximity alert: detect the player entering a 200px radius
const nearby = overlapCircle(world, guardX, guardY, 200, { tag: 'player' })
if (nearby.length > 0) {
  triggerAlarm()
}
```

## Notes

- Tests against each entity's `BoxCollider` AABB -- not a circle-to-circle test.
- O(n) in the number of colliders in the world.
- Returns an empty array when there are no overlaps.
- See also: [`overlapBox`](./spatial-queries.md) for rectangular area queries, [`raycast`](./spatial-queries.md) for line queries.
