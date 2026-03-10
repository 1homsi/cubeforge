# BoxCollider

Adds an axis-aligned bounding box (AABB) collider to an entity. The physics system uses this shape for both solid collision resolution and trigger detection. Requires a `Transform` component on the same entity.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `width` | number | — | **Required.** Collider width in pixels |
| `height` | number | — | **Required.** Collider height in pixels |
| `offsetX` | number | `0` | Horizontal offset from the entity's transform position |
| `offsetY` | number | `0` | Vertical offset from the entity's transform position |
| `isTrigger` | boolean | `false` | If true, fires trigger events on overlap but does not block movement |
| `layer` | string | `'default'` | Collision layer this collider belongs to |
| `mask` | `string \| string[]` | `'*'` | Which layers this collider interacts with. `'*'` = all. Both colliders must allow the other's layer (AND semantics). |
| `oneWay` | boolean | `false` | One-way platform: only blocks entities falling onto the top surface. Entities approaching from below pass through freely. |
| `slope` | number | `0` | Slope angle in degrees. `0` = flat box. Positive = surface rises left→right. The sloped top face is used for collision; entities riding it are pushed up along the slope. |
| `friction` | number | `0` | Per-collider friction coefficient (0–1). Controls how much sliding velocity is reduced on contact. Default `0` = no solver friction (characters control movement via scripts). Set higher values on floors/walls for physics-based deceleration. |
| `restitution` | number | `0` | Per-collider bounciness (0–1). `0` = no bounce, `1` = full bounce. |
| `frictionCombineRule` | string | `'average'` | How to combine friction with the other collider: `'average'`, `'min'`, `'max'`, or `'multiply'`. |
| `restitutionCombineRule` | string | `'average'` | How to combine restitution with the other collider. |
| `enabled` | boolean | `true` | Whether this collider is active. Disabled colliders skip all detection. |
| `group` | string | `''` | Collision group — entities in the same non-empty group do not collide with each other. |

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

The recommended way to respond to trigger overlaps is with the contact hooks:

```tsx
function CoinPickup() {
  useTriggerEnter((other) => {
    collectCoin()
  }, { tag: 'player' }) // only fire if the other entity has the 'player' tag
  return null
}
```

The physics system also emits raw EventBus events (`triggerEnter`, `trigger`, `triggerExit`, `collisionEnter`, `collision`, `collisionExit`) with payload `{ a: EntityId, b: EntityId }` for lower-level access via `useEvent`.

## Layer / mask filtering

```tsx
// Player can only interact with 'solid' and 'enemy' layers
<BoxCollider width={28} height={40} layer="player" mask={['solid', 'enemy']} />

// Static wall — default mask '*' so it interacts with everything
<BoxCollider width={20} height={200} layer="solid" />
```

Both sides of a collision must allow each other's layer. If either mask excludes the other, the pair is ignored entirely (no physics resolution AND no trigger events).

## One-way platforms

```tsx
// Jump through from below, land from above
<BoxCollider width={120} height={12} oneWay />
```

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
- The engine also supports CircleCollider, CapsuleCollider, ConvexCollider, TriangleCollider, SegmentCollider, HeightFieldCollider, HalfSpaceCollider, and TriMeshCollider.
