# overlapBox / raycast

Physics-backed spatial queries for use in Script update functions and game logic.

## overlapBox

Returns all entities whose `BoxCollider` AABB overlaps the given rectangle.

```ts
function overlapBox(
  world: ECSWorld,
  cx: number,    // center X of test rectangle
  cy: number,    // center Y of test rectangle
  hw: number,    // half-width
  hh: number,    // half-height
  opts?: {
    tag?: string       // only include entities with this tag
    layer?: string     // only include entities on this BoxCollider layer
    exclude?: EntityId[] // skip these entity IDs
  }
): EntityId[]
```

### Example

```ts
import { overlapBox } from 'cubeforge'

// Sword hit-detection in a Script update:
const hits = overlapBox(world, swordX, swordY, 20, 20, {
  tag: 'enemy',
  exclude: [playerId],
})
for (const eid of hits) {
  dealDamage(eid)
}
```

---

## raycast

Casts a ray and returns the closest `BoxCollider` hit, or `null`.

```ts
function raycast(
  world: ECSWorld,
  origin: { x: number; y: number },
  direction: { x: number; y: number },  // does not need to be normalized
  maxDistance: number,
  opts?: {
    tag?: string
    layer?: string
    exclude?: EntityId[]
    includeTriggers?: boolean  // default false
  }
): RaycastHit | null
```

### RaycastHit

```ts
interface RaycastHit {
  entityId: EntityId
  distance: number                       // pixels from origin to hit point
  point: { x: number; y: number }       // world-space hit position
  normal: { x: number; y: number }      // surface normal (axis-aligned unit vector)
}
```

### Example

```ts
import { raycast } from 'cubeforge'

// Line-of-sight check:
const hit = raycast(world, { x: enemyX, y: enemyY }, { x: dx, y: dy }, 400, {
  tag: 'wall',
})
const canSeePlayer = hit === null

// Ground check (downward raycast):
const ground = raycast(world, { x: transform.x, y: transform.y }, { x: 0, y: 1 }, 100)
if (ground && ground.distance < 5) console.log('nearly grounded')
```

## Notes

- Both functions check all entities with `Transform` + `BoxCollider` — they are O(n) in the number of collider entities.
- Raycast uses the **AABB slab method** for accurate intersection at any angle.
- Triggers are skipped by default in `raycast`. Set `includeTriggers: true` to include them.
- `overlapBox` includes triggers unless you filter by layer.
- Use `exclude: [myEntityId]` to avoid self-hits.
