# overlapBox / raycast / raycastAll / overlapCircle / sweepBox

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

---

## raycastAll

Same as `raycast` but returns **all** hits sorted by distance (closest first).

```ts
function raycastAll(
  world: ECSWorld,
  origin: { x: number; y: number },
  direction: { x: number; y: number },
  maxDistance: number,
  opts?: { tag?: string; layer?: string; exclude?: EntityId[]; includeTriggers?: boolean }
): RaycastHit[]
```

### Example

```ts
import { raycastAll } from 'cubeforge'

// Pierce through multiple enemies
const hits = raycastAll(world, origin, dir, 500, { tag: 'enemy' })
for (const hit of hits) {
  dealPierceDamage(hit.entityId, hit.distance)
}
```

---

## overlapCircle

Returns all entities whose `BoxCollider` is within `radius` pixels of `(cx, cy)`.

```ts
function overlapCircle(
  world: ECSWorld,
  cx: number, cy: number,
  radius: number,
  opts?: { tag?: string; layer?: string; exclude?: EntityId[] }
): EntityId[]
```

### Example

```ts
import { overlapCircle } from 'cubeforge'

// Explosion radius check
const victims = overlapCircle(world, explosion.x, explosion.y, 120, { tag: 'enemy' })
```

---

## sweepBox

Sweeps a box along a direction and returns the **first** hit (Minkowski sum expansion), or `null`.

```ts
function sweepBox(
  world: ECSWorld,
  cx: number, cy: number,
  w: number, h: number,
  dx: number, dy: number,
  opts?: { tag?: string; layer?: string; exclude?: EntityId[] }
): RaycastHit | null
```

### Example

```ts
import { sweepBox } from 'cubeforge'

// Safe move-and-stop for a non-physics object
const hit = sweepBox(world, x, y, 32, 32, vx * dt, vy * dt, { layer: 'wall' })
if (hit) {
  // Clamp movement to just before the collision
} else {
  x += vx * dt; y += vy * dt
}
```

---

## Notes

- All functions check entities with `Transform` + `BoxCollider` — O(n) in collider count.
- Raycast uses the **AABB slab method** for accurate intersection at any angle.
- Triggers are skipped by default in ray functions. Set `includeTriggers: true` to include them.
- Use `exclude: [myEntityId]` to avoid self-hits.
