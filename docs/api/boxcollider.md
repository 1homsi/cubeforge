# BoxCollider

Adds an axis-aligned bounding box (AABB) collider to an entity. The physics system uses this shape for both solid collision resolution and trigger detection. Requires a `Transform` component on the same entity.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `width` | number | — | **Required.** Collider width in pixels |
| `height` | number | — | **Required.** Collider height in pixels |
| `offsetX` | number | `0` | Horizontal offset from the entity's transform position |
| `offsetY` | number | `0` | Vertical offset from the entity's transform position |
| `isTrigger` | boolean | `false` | If true, fires a trigger event on overlap but does not block movement |
| `layer` | string | `'default'` | Collision layer name |
| `slope` | number | `0` | Slope angle in degrees. `0` = flat box. Positive = surface rises left→right. The sloped top face is used for collision; entities riding it are pushed up along the slope. |

## Example

```tsx
// Solid collider matching sprite size
<Entity>
  <Transform x={100} y={300} />
  <Sprite width={32} height={48} color="#4fc3f7" />
  <RigidBody />
  <BoxCollider width={32} height={48} />
</Entity>

// Slightly smaller collider to allow forgiving ledge grabs
<BoxCollider width={28} height={46} offsetY={2} />

// Trigger zone
<BoxCollider width={64} height={64} isTrigger />
```

## Trigger events

When a non-trigger collider overlaps a trigger collider, the engine emits a `trigger` event on the EventBus:

```tsx
useEvent<{ a: number; b: number }>('trigger', ({ a, b }) => {
  console.log('entities', a, 'and', b, 'overlapped')
})
```

`a` and `b` are entity IDs. The order is not guaranteed.

## Debug visualisation

With `<Game debug>`, all BoxCollider shapes are rendered as wireframe outlines over the canvas. Solid colliders appear in one colour, triggers in another. This is the easiest way to verify collider sizes and positions.

## Slopes

```tsx
// A ramp that rises 30° from left to right
<Entity tags={['ramp']}>
  <Transform x={300} y={400} />
  <Sprite width={200} height={40} color="#795548" />
  <RigidBody isStatic />
  <BoxCollider width={200} height={40} slope={30} />
</Entity>
```

Slope colliders are skipped in the X-pass; only the Y-pass pushes entities up the slope surface. This allows smooth left-to-right traversal. The bounding box (AABB) is still used for the broadphase check before slope math runs.

## Notes

- A BoxCollider without a `RigidBody` on a non-static entity will not move but will still participate in collision events.
- The physics system merges adjacent static tiles into single wide colliders when loading tilemaps, reducing entity count significantly.
- Colliders are AABB only — no circles, capsules, or rotated rectangles.
