# useKinematicBody

Controls an entity with a kinematic `RigidBody` — gravity and physics impulses are ignored, but collisions are still resolved. Useful for AI-controlled characters and scripted objects.

## Signature

```ts
function useKinematicBody(): KinematicBodyControls
```

## KinematicBodyControls

| Method | Description |
|---|---|
| `moveAndCollide(dx, dy)` | Move by `(dx, dy)` pixels and resolve collisions. Returns the actual `{ dx, dy }` after collision response. |
| `setVelocity(vx, vy)` | Set the stored velocity on the RigidBody component (useful for animation blending). |

## Setup

Add `isKinematic={true}` to the entity's `<RigidBody>`:

```tsx
<RigidBody isKinematic />
```

## Example

```tsx
import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script, useKinematicBody } from 'cubeforge'

function PatrolEnemy({ x, y }) {
  const kb = useKinematicBody()

  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite width={32} height={32} color="#f38ba8" />
      <RigidBody isKinematic />
      <BoxCollider width={32} height={32} />
      <Script update={(_id, _world, _input, dt) => {
        kb.moveAndCollide(60 * dt, 0)
      }} />
    </Entity>
  )
}
```

## Notes

- `useKinematicBody` must be used inside an `<Entity>`.
- The entity's `RigidBody` must have `isKinematic={true}`; otherwise the physics system will apply gravity normally.
