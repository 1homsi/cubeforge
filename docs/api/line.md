# Line

Renders a line from the entity's transform position to an endpoint. A primitive shape component for drawing lines, laser beams, debug visuals, and more.

## Usage

```tsx
import { Line } from 'cubeforge'

<Line endX={100} endY={50} color="#ff0000" lineWidth={2} />
```

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `endX` | `number` | — | **Required.** X coordinate of the line endpoint (relative to the entity's position) |
| `endY` | `number` | — | **Required.** Y coordinate of the line endpoint (relative to the entity's position) |
| `color` | `string` | `'#ffffff'` | Line colour |
| `lineWidth` | `number` | `1` | Thickness of the line in pixels |
| `zIndex` | `number` | `0` | Draw order — higher values render on top |
| `visible` | `boolean` | `true` | If false, the line is not drawn |
| `layer` | `string` | `'default'` | Render layer name |

## Example

```tsx
import { Entity, Transform, Line } from 'cubeforge'

function LaserBeam({ x, y, targetX, targetY }) {
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Line
        endX={targetX - x}
        endY={targetY - y}
        color="#ff0000"
        lineWidth={3}
      />
    </Entity>
  )
}
```

### Crosshair

```tsx
function Crosshair({ x, y, size = 10 }) {
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Line endX={size} endY={0} color="#00ff00" lineWidth={1} />
      <Line endX={-size} endY={0} color="#00ff00" lineWidth={1} />
      <Line endX={0} endY={size} color="#00ff00" lineWidth={1} />
      <Line endX={0} endY={-size} color="#00ff00" lineWidth={1} />
    </Entity>
  )
}
```
