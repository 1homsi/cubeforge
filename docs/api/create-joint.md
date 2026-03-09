# createJoint

Factory function that creates a `JointComponent` for connecting two physics entities. Attach the returned component to an entity to constrain its movement relative to another body.

## Signature

```ts
function createJoint(
  type: 'distance' | 'spring' | 'revolute' | 'rope',
  config: JointConfig,
): JointComponent
```

## Joint Types

### distance

Maintains a fixed distance between two anchor points.

| Property | Type | Description |
|---|---|---|
| `entityA` | `string` | Entity ID of the first body |
| `entityB` | `string` | Entity ID of the second body |
| `distance` | `number` | Fixed distance in pixels between anchors |
| `anchorA` | `{ x: number; y: number }` | Local offset on entity A (optional, defaults to center) |
| `anchorB` | `{ x: number; y: number }` | Local offset on entity B (optional, defaults to center) |

### spring

Like distance but with elastic behavior.

| Property | Type | Description |
|---|---|---|
| `entityA` | `string` | Entity ID of the first body |
| `entityB` | `string` | Entity ID of the second body |
| `restLength` | `number` | Rest length in pixels |
| `stiffness` | `number` | Spring constant (higher = stiffer) |
| `damping` | `number` | Damping factor (0-1, higher = less oscillation) |

### revolute

Allows free rotation around a shared anchor point.

| Property | Type | Description |
|---|---|---|
| `entityA` | `string` | Entity ID of the first body |
| `entityB` | `string` | Entity ID of the second body |
| `anchor` | `{ x: number; y: number }` | World-space pivot point |
| `minAngle` | `number` | Minimum rotation in radians (optional) |
| `maxAngle` | `number` | Maximum rotation in radians (optional) |

### rope

Like distance but only enforces a maximum length (bodies can be closer).

| Property | Type | Description |
|---|---|---|
| `entityA` | `string` | Entity ID of the first body |
| `entityB` | `string` | Entity ID of the second body |
| `maxLength` | `number` | Maximum distance in pixels |

## Example

```tsx
import { createJoint } from 'cubeforge'

function SwingingPlatform() {
  const joint = createJoint('revolute', {
    entityA: 'ceiling-hook',
    entityB: 'swing-platform',
    anchor: { x: 400, y: 50 },
  })

  return (
    <>
      <Entity id="ceiling-hook">
        <Transform x={400} y={50} />
        <RigidBody type="static" />
        <BoxCollider width={16} height={16} />
      </Entity>
      <Entity id="swing-platform">
        <Transform x={400} y={150} />
        <RigidBody type="dynamic" />
        <BoxCollider width={96} height={16} />
        <Joint value={joint} />
      </Entity>
    </>
  )
}
```

```tsx
// Spring connection between two entities
const spring = createJoint('spring', {
  entityA: 'anchor',
  entityB: 'ball',
  restLength: 80,
  stiffness: 200,
  damping: 0.3,
})
```

## Notes

- Joints are resolved by the physics system each frame after collision resolution.
- At least one of the two connected entities should have a `RigidBody` with `type: "dynamic"`.
- For the declarative JSX component, see [`Joint`](./joint.md).
