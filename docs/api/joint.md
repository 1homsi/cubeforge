# Joint

Connects two entities with a physics constraint. Supports distance, spring, revolute, and rope joint types for chains, ragdolls, swinging platforms, and more.

## Usage

```tsx
import { Joint } from 'cubeforge'

<Joint type="spring" target="anchor" stiffness={200} damping={10} />
```

## Props

### Common props

| Prop | Type | Default | Description |
|---|---|---|---|
| `type` | `'distance' \| 'spring' \| 'revolute' \| 'rope'` | — | **Required.** Joint constraint type |
| `target` | `string` | — | **Required.** Entity ID of the other body to connect to |
| `anchorX` | `number` | `0` | Local X offset on this entity for the attachment point |
| `anchorY` | `number` | `0` | Local Y offset on this entity for the attachment point |
| `targetAnchorX` | `number` | `0` | Local X offset on the target entity |
| `targetAnchorY` | `number` | `0` | Local Y offset on the target entity |

### Distance joint

Keeps two entities at a fixed distance.

| Prop | Type | Default | Description |
|---|---|---|---|
| `distance` | `number` | auto | Fixed distance between anchors. Defaults to the initial distance. |

### Spring joint

Applies a spring force between two entities.

| Prop | Type | Default | Description |
|---|---|---|---|
| `stiffness` | `number` | `100` | Spring constant (higher = stiffer) |
| `damping` | `number` | `5` | Damping factor to reduce oscillation |
| `restLength` | `number` | auto | Natural length of the spring |

### Revolute joint

Allows rotation around a shared pivot point.

| Prop | Type | Default | Description |
|---|---|---|---|
| `minAngle` | `number` | — | Minimum rotation angle in radians (optional limit) |
| `maxAngle` | `number` | — | Maximum rotation angle in radians (optional limit) |

### Rope joint

Constrains the maximum distance (entities can be closer but not farther).

| Prop | Type | Default | Description |
|---|---|---|---|
| `maxLength` | `number` | auto | Maximum distance between anchors |

## Example

```tsx
import { Entity, Transform, Sprite, RigidBody, Joint } from 'cubeforge'

function SwingingPlatform() {
  return (
    <>
      <Entity id="pivot">
        <Transform x={400} y={100} />
      </Entity>
      <Entity id="platform">
        <Transform x={400} y={250} />
        <Sprite width={120} height={16} color="#8d6e63" />
        <RigidBody mass={2} />
        <Joint type="rope" target="pivot" maxLength={150} />
      </Entity>
    </>
  )
}
```
