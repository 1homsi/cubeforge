# Trail

Renders a fading polyline trail behind an entity, updated each frame.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `length` | number | — | Maximum number of position samples to keep |
| `color` | string | — | CSS color string (e.g. `'#4fc3f7'`) |
| `width` | number | — | Line width in pixels |

## Example

```tsx
import { Entity, Transform, Sprite, Trail } from 'cubeforge'

function Bullet({ x, y }) {
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite width={8} height={8} color="#fff" />
      <Trail length={20} color="rgba(255,200,50,0.7)" width={3} />
    </Entity>
  )
}
```

## Notes

- Trail points are collected in world space each frame by the render system.
- Alpha fades linearly from 1 at the tip to 0 at the tail.
- `<Trail>` must be inside an entity that also has a `<Transform>`.
