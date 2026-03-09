# Mask

Clips the parent entity's sprite rendering to a defined shape. Only the portion of the sprite within the mask shape is visible.

## Usage

```tsx
import { Mask } from 'cubeforge'

<Mask shape="circle" radius={32} />
```

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `shape` | `'rect' \| 'circle'` | — | **Required.** Clipping shape type |
| `width` | `number` | — | Mask width (required when `shape` is `'rect'`) |
| `height` | `number` | — | Mask height (required when `shape` is `'rect'`) |
| `radius` | `number` | — | Mask radius (required when `shape` is `'circle'`) |
| `offsetX` | `number` | `0` | Horizontal offset from the entity's position |
| `offsetY` | `number` | `0` | Vertical offset from the entity's position |

## Example

### Circular portrait

```tsx
import { Entity, Transform, Sprite, Mask } from 'cubeforge'

function Avatar({ x, y, src }) {
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite width={64} height={64} src={src} />
      <Mask shape="circle" radius={32} />
    </Entity>
  )
}
```

### Rectangular viewport

```tsx
<Entity>
  <Transform x={400} y={300} />
  <Sprite width={800} height={600} src="/world-map.png" />
  <Mask shape="rect" width={200} height={150} />
</Entity>
```
