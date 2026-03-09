# useTouch

Hook for tracking touch input on the game canvas. Provides multi-touch point tracking with support for touch start, move, and end events.

## Usage

```tsx
import { useTouch } from 'cubeforge'

const touch = useTouch()
```

## Signature

```ts
function useTouch(): TouchState
```

## Return value

`TouchState`

| Field | Type | Description |
|---|---|---|
| `touches` | `TouchPoint[]` | Array of currently active touch points |
| `count` | `number` | Number of active touch points |
| `isTouching` | `boolean` | Whether any touch is active |

### TouchPoint

| Field | Type | Description |
|---|---|---|
| `id` | `number` | Unique identifier for the touch point |
| `x` | `number` | World-space X coordinate |
| `y` | `number` | World-space Y coordinate |
| `startX` | `number` | X coordinate where the touch began |
| `startY` | `number` | Y coordinate where the touch began |
| `deltaX` | `number` | X distance moved since last frame |
| `deltaY` | `number` | Y distance moved since last frame |
| `isNew` | `boolean` | Whether the touch started this frame |
| `isEnded` | `boolean` | Whether the touch ended this frame |

## Example

```tsx
import { useTouch } from 'cubeforge'

function TouchControls() {
  const touch = useTouch()

  return (
    <Script update={(id, world) => {
      if (!touch.isTouching) return

      const t = world.getComponent(id, 'Transform')
      // Move entity towards the first touch point
      const point = touch.touches[0]
      t.x += (point.x - t.x) * 0.1
      t.y += (point.y - t.y) * 0.1
    }} />
  )
}
```

### Multi-touch pinch-to-zoom

```tsx
const touch = useTouch()

if (touch.count >= 2) {
  const [a, b] = touch.touches
  const dist = Math.hypot(a.x - b.x, a.y - b.y)
  // Use dist to drive camera zoom
}
```
