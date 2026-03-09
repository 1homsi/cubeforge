# Gradient

Applies a linear or radial gradient fill to an entity's rendered area. Can be used as a standalone visual or combined with other shape components.

## Usage

```tsx
import { Gradient } from 'cubeforge'

<Gradient
  type="linear"
  from={{ x: 0, y: 0 }}
  to={{ x: 0, y: 1 }}
  stops={[
    { offset: 0, color: '#ff6b6b' },
    { offset: 1, color: '#4ecdc4' },
  ]}
  width={200}
  height={100}
/>
```

## Props

### Common props

| Prop | Type | Default | Description |
|---|---|---|---|
| `type` | `'linear' \| 'radial'` | — | **Required.** Gradient type |
| `stops` | `GradientStop[]` | — | **Required.** Array of colour stops |
| `width` | `number` | — | **Required.** Width of the gradient area |
| `height` | `number` | — | **Required.** Height of the gradient area |
| `zIndex` | `number` | `0` | Draw order |
| `visible` | `boolean` | `true` | If false, the gradient is not drawn |
| `layer` | `string` | `'default'` | Render layer name |

### Linear gradient props

| Prop | Type | Default | Description |
|---|---|---|---|
| `from` | `{ x: number; y: number }` | `{ x: 0, y: 0 }` | Start point (normalized 0-1) |
| `to` | `{ x: number; y: number }` | `{ x: 1, y: 0 }` | End point (normalized 0-1) |

### Radial gradient props

| Prop | Type | Default | Description |
|---|---|---|---|
| `center` | `{ x: number; y: number }` | `{ x: 0.5, y: 0.5 }` | Center point (normalized 0-1) |
| `radius` | `number` | `0.5` | Gradient radius (normalized 0-1) |

### GradientStop

| Field | Type | Description |
|---|---|---|
| `offset` | `number` | Position along the gradient (0 to 1) |
| `color` | `string` | CSS colour string |

## Example

### Sky background

```tsx
import { Entity, Transform, Gradient } from 'cubeforge'

function Sky() {
  return (
    <Entity>
      <Transform x={400} y={300} />
      <Gradient
        type="linear"
        from={{ x: 0, y: 0 }}
        to={{ x: 0, y: 1 }}
        stops={[
          { offset: 0,   color: '#1a237e' },
          { offset: 0.6, color: '#4fc3f7' },
          { offset: 1,   color: '#b3e5fc' },
        ]}
        width={800}
        height={600}
        layer="background"
        zIndex={-10}
      />
    </Entity>
  )
}
```

### Radial spotlight

```tsx
<Gradient
  type="radial"
  center={{ x: 0.5, y: 0.5 }}
  radius={0.5}
  stops={[
    { offset: 0, color: 'rgba(255, 255, 200, 0.8)' },
    { offset: 1, color: 'rgba(0, 0, 0, 0)' },
  ]}
  width={200}
  height={200}
/>
```
