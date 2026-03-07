# findByTag

Returns all entity IDs that have the given tag. A convenience wrapper over `world.query('Tag')` with tag filtering.

## Signature

```ts
function findByTag(world: ECSWorld, tag: string): EntityId[]
```

## Example

```ts
import { findByTag } from 'cubeforge'

// In a Script update function:
const enemies = findByTag(world, 'enemy')
for (const eid of enemies) {
  const t = world.getComponent<TransformComponent>(eid, 'Transform')!
  const dist = Math.hypot(t.x - myX, t.y - myY)
  if (dist < 100) triggerAlert()
}
```

## Notes

- Returns a new array every call. Cache the result if you call it multiple times per frame.
- Only finds entities with a `Tag` component created via `<Entity tags={['...']}>`
- For spatial queries, see `overlapBox` and `raycast`.
