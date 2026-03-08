# CapsuleCollider

A pill-shaped collider (two semicircles joined by a rectangle). Ideal for characters — avoids corner-catching on platforms.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `width` | number | — | Width of the capsule (diameter of the circular ends) |
| `height` | number | — | Total height including both caps |
| `offsetX` | number | `0` | Horizontal offset from the entity transform |
| `offsetY` | number | `0` | Vertical offset from the entity transform |
| `isTrigger` | boolean | `false` | When true, fires contact events but does not block movement |
| `layer` | string | `'default'` | Collision layer name |
| `mask` | string \| string[] | `'default'` | Layer(s) this collider reacts to |

## Example

```tsx
import { Entity, Transform, Sprite, RigidBody, CapsuleCollider } from 'cubeforge'

function Player({ x, y }) {
  return (
    <Entity id="player">
      <Transform x={x} y={y} />
      <Sprite width={28} height={48} color="#4fc3f7" />
      <RigidBody />
      <CapsuleCollider width={24} height={48} />
    </Entity>
  )
}
```

## Notes

- Physics resolves capsule collisions as a compound shape (two circles + a box body) to avoid corner-catching on tile edges.
- Use `layer` / `mask` to filter which objects this capsule interacts with.
