# CompoundCollider

Attaches multiple collider shapes to a single entity. Use this when a character or object can't be represented by a single box or circle — for example a vehicle with separate body and wheel hitboxes.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `shapes` | `ColliderShape[]` | — | **Required.** Array of shapes that make up the compound collider |

### ColliderShape

| Field | Type | Default | Description |
|---|---|---|---|
| `type` | `'box' \| 'circle'` | — | **Required.** Shape type |
| `offsetX` | number | `0` | Horizontal offset from the entity's transform |
| `offsetY` | number | `0` | Vertical offset from the entity's transform |
| `width` | number | — | Width in pixels (box only) |
| `height` | number | — | Height in pixels (box only) |
| `radius` | number | — | Radius in pixels (circle only) |

## Example

```tsx
import { Entity, Transform, Sprite, RigidBody, CompoundCollider } from 'cubeforge'

function Car({ x, y }: { x: number; y: number }) {
  return (
    <Entity id="car">
      <Transform x={x} y={y} />
      <Sprite src="/sprites/car.png" width={80} height={32} />
      <RigidBody />
      <CompoundCollider
        shapes={[
          { type: 'box', width: 80, height: 20, offsetY: -6 },
          { type: 'circle', radius: 10, offsetX: -28, offsetY: 10 },
          { type: 'circle', radius: 10, offsetX: 28, offsetY: 10 },
        ]}
      />
    </Entity>
  )
}
```

## Notes

- Each shape is resolved independently during the physics step; collision events include the shape index.
- `CompoundCollider` replaces a `BoxCollider` or `CircleCollider` on the same entity — do not combine them.
- All offsets are relative to the entity's `Transform` position.
- Layer and mask filtering is set per-entity, not per-shape.
