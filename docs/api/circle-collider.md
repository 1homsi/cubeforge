# CircleCollider

Adds a circular trigger collider to an entity. The physics system checks circle-circle and circle-AABB overlaps each frame and emits `circleEnter` / `circleExit` events via the EventBus. Circle colliders are **event-only** — they do not resolve positional overlap or block movement. Use `BoxCollider` for solid collision.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `radius` | number | — | **Required.** Circle radius in pixels |
| `offsetX` | number | `0` | Horizontal offset from the entity's transform position |
| `offsetY` | number | `0` | Vertical offset from the entity's transform position |
| `isTrigger` | boolean | `true` | Always true — circle colliders are trigger-only |
| `layer` | string | `'default'` | Collision layer this collider belongs to |
| `mask` | `string \| string[]` | `'*'` | Which layers this collider interacts with |

## Example

```tsx
// Coin pickup with circle overlap
<Entity tags={['coin']}>
  <Transform x={300} y={200} />
  <Sprite width={16} height={16} color="#ffd54f" />
  <CircleCollider radius={10} />
  <Script
    init={(id, world) => {
      world.addComponent(id, { type: 'CoinMeta', onCollect })
    }}
  />
</Entity>

// Explosion radius — hits anything tagged 'enemy' within 80px
<Entity>
  <Transform x={explosionX} y={explosionY} />
  <CircleCollider radius={80} layer="explosion" mask="enemy" />
</Entity>
```

## Reacting to overlaps

Use the `useCircleEnter` and `useCircleExit` hooks inside a component rendered inside the entity:

```tsx
function CoinPickup({ onCollect }: { onCollect: () => void }) {
  const collected = useRef(false)

  useCircleEnter(() => {
    if (collected.current) return
    collected.current = true
    onCollect()
  }, { tag: 'player' })

  return (
    <Entity tags={['coin']}>
      <Transform x={300} y={200} />
      <Sprite width={16} height={16} color="#ffd54f" />
      <CircleCollider radius={10} />
    </Entity>
  )
}
```

Or subscribe via `useEvent` for lower-level access:

```tsx
useEvent('circleEnter', ({ a, b }) => {
  // a and b are the two EntityIds that started overlapping
})
```

## Layer / mask filtering

```tsx
// Player detection zone — only overlaps with entities on the 'enemy' layer
<CircleCollider radius={120} layer="playerSensor" mask="enemy" />

// Enemy that responds to player sensor
<BoxCollider width={28} height={40} layer="enemy" />
```

## Overlap detection internals

- **Circle vs Circle**: overlap when `distance(centerA, centerB) < radiusA + radiusB`
- **Circle vs BoxCollider AABB**: finds the nearest point on the box to the circle center; overlap when `distance < radius`
- Both checks run after physics resolution in the same frame

## Notes

- CircleColliders do not appear in `<Game debug>` wireframes in this version.
- A `CircleCollider` does not require a `RigidBody` — it works on static entities too.
- Use `exclude` in `overlapBox` / `raycast` calls if you need to skip entities that have CircleColliders.

## See also

- [useCircleEnter / useCircleExit](/api/use-collision#usecircleenter--usecircleexit) — hook reference
- [BoxCollider](/api/boxcollider) — solid AABB collider
- [useTriggerEnter / useTriggerExit](/api/use-trigger) — trigger events for BoxCollider
