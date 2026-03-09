# Polygon

Renders a polygon from an array of points relative to the entity's transform position. Supports both filled and stroked rendering.

## Usage

```tsx
import { Polygon } from 'cubeforge'

<Polygon
  points={[
    { x: 0, y: -20 },
    { x: 20, y: 20 },
    { x: -20, y: 20 },
  ]}
  fill="#4fc3f7"
/>
```

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `points` | `{ x: number; y: number }[]` | — | **Required.** Array of vertex positions relative to the entity's transform |
| `fill` | `string` | `'#ffffff'` | Fill colour. Set to `'transparent'` for outline only. |
| `stroke` | `string` | — | Stroke (outline) colour |
| `strokeWidth` | `number` | `1` | Width of the stroke outline |
| `zIndex` | `number` | `0` | Draw order — higher values render on top |
| `visible` | `boolean` | `true` | If false, the polygon is not drawn |
| `layer` | `string` | `'default'` | Render layer name |

## Example

```tsx
import { Entity, Transform, Polygon } from 'cubeforge'

// Triangle enemy
function TriangleEnemy({ x, y }) {
  return (
    <Entity tags={['enemy']}>
      <Transform x={x} y={y} />
      <Polygon
        points={[
          { x: 0, y: -16 },
          { x: 14, y: 12 },
          { x: -14, y: 12 },
        ]}
        fill="#f44336"
        stroke="#b71c1c"
        strokeWidth={2}
      />
    </Entity>
  )
}
```

### Hexagonal tile

```tsx
const hexPoints = Array.from({ length: 6 }, (_, i) => {
  const angle = (Math.PI / 3) * i - Math.PI / 6
  return { x: Math.cos(angle) * 20, y: Math.sin(angle) * 20 }
})

<Polygon points={hexPoints} fill="#2e7d32" stroke="#1b5e20" />
```
