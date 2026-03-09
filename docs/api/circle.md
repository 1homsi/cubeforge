# Circle

Renders the entity as a circle. A primitive shape component for drawing circular visuals without needing an image asset.

## Usage

```tsx
import { Circle } from 'cubeforge'

<Circle radius={16} color="#4fc3f7" />
```

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `radius` | `number` | — | **Required.** Circle radius in pixels |
| `color` | `string` | `'#ffffff'` | Fill colour |
| `stroke` | `string` | — | Stroke (outline) colour. If omitted, no outline is drawn. |
| `strokeWidth` | `number` | `1` | Width of the stroke outline |
| `zIndex` | `number` | `0` | Draw order — higher values render on top |
| `visible` | `boolean` | `true` | If false, the circle is not drawn |
| `layer` | `string` | `'default'` | Render layer name |

## Example

```tsx
import { Entity, Transform, Circle } from 'cubeforge'

function Coin({ x, y }) {
  return (
    <Entity tags={['collectible']}>
      <Transform x={x} y={y} />
      <Circle radius={10} color="#ffd700" stroke="#b8860b" strokeWidth={2} />
    </Entity>
  )
}
```

### Outline only

```tsx
<Circle radius={32} color="transparent" stroke="#ff0000" strokeWidth={2} />
```
