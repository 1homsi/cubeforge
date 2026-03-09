# createCompoundCollider

Creates a `CompoundCollider` component made up of multiple primitive shapes (boxes and circles). Useful for entities with complex hitboxes that can't be represented by a single AABB.

## Usage

```tsx
import { createCompoundCollider } from 'cubeforge'
```

## Signature

```ts
function createCompoundCollider(
  shapes: ColliderShape[],
  opts?: Partial<Omit<CompoundColliderComponent, 'type' | 'shapes'>>
): CompoundColliderComponent
```

## Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `shapes` | `ColliderShape[]` | — | **Required.** Array of primitive shapes that make up the collider |
| `opts` | `object` | `{}` | Optional overrides for trigger, layer, and mask settings |

### Options

| Field | Type | Default | Description |
|---|---|---|---|
| `isTrigger` | `boolean` | `false` | If true, the collider detects overlaps but does not resolve collisions |
| `layer` | `string` | `'default'` | Collision layer name |
| `mask` | `string \| string[]` | `'*'` | Which layers this collider interacts with |

## ColliderShape

Each shape in the array has the following fields:

| Field | Type | Description |
|---|---|---|
| `type` | `'box' \| 'circle'` | **Required.** Shape primitive type |
| `offsetX` | `number` | **Required.** Horizontal offset from the entity's transform position |
| `offsetY` | `number` | **Required.** Vertical offset from the entity's transform position |
| `width` | `number` | Box width (required when `type` is `'box'`) |
| `height` | `number` | Box height (required when `type` is `'box'`) |
| `radius` | `number` | Circle radius (required when `type` is `'circle'`) |

## CompoundColliderComponent

The returned component has the `'CompoundCollider'` type string and can be added to an entity via the ECS world directly.

| Field | Type | Description |
|---|---|---|
| `type` | `'CompoundCollider'` | Component type identifier |
| `shapes` | `ColliderShape[]` | The array of primitive shapes |
| `isTrigger` | `boolean` | Whether this is a trigger collider |
| `layer` | `string` | Collision layer |
| `mask` | `string \| string[]` | Interaction mask |

## Example

```tsx
import { createCompoundCollider } from 'cubeforge'

// L-shaped collider from two boxes
const collider = createCompoundCollider([
  { type: 'box', offsetX: 0, offsetY: -16, width: 32, height: 32 },   // top block
  { type: 'box', offsetX: 16, offsetY: 16, width: 64, height: 32 },   // bottom bar
])

// Character with a body box and a circular head
const characterCollider = createCompoundCollider(
  [
    { type: 'box',    offsetX: 0, offsetY: 8,   width: 24, height: 32 },
    { type: 'circle', offsetX: 0, offsetY: -12, radius: 14 },
  ],
  { layer: 'player' },
)
```

### Using with Script init

```tsx
import { createCompoundCollider } from 'cubeforge'

function init(entityId, world) {
  world.addComponent(entityId, createCompoundCollider([
    { type: 'box', offsetX: -20, offsetY: 0, width: 16, height: 48 },
    { type: 'box', offsetX:  20, offsetY: 0, width: 16, height: 48 },
  ], { isTrigger: true }))
}
```
