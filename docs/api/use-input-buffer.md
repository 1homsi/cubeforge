# useInputBuffer

Hook for buffering player inputs over a short window, making controls feel more responsive. Commonly used for jump buffering (allowing a jump press slightly before landing) and coyote time patterns.

## Usage

```tsx
import { useInputBuffer } from 'cubeforge'

const jumpBuffer = useInputBuffer('jump', { window: 100 })
```

## Signature

```ts
function useInputBuffer(
  action: string,
  options?: InputBufferOptions
): InputBuffer
```

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `action` | `string` | The action name to buffer (as defined in your input map) |
| `options` | `InputBufferOptions` | Configuration options |

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `window` | `number` | `150` | Buffer window in milliseconds — how long the input stays buffered |

## Return value

`InputBuffer`

| Field | Type | Description |
|---|---|---|
| `buffered` | `boolean` | Whether a press is currently buffered (within the window) |
| `consume` | `() => void` | Consume the buffered input (clears the buffer) |
| `clear` | `() => void` | Clear the buffer without consuming |

## Example

### Jump buffering

```tsx
import { useInputBuffer } from 'cubeforge'

function PlayerController() {
  const jumpBuffer = useInputBuffer('jump', { window: 120 })

  return (
    <Script update={(id, world) => {
      const rb = world.getComponent(id, 'RigidBody')

      // Player can press jump slightly before landing
      if (rb.isGrounded && jumpBuffer.buffered) {
        rb.velocityY = -500
        jumpBuffer.consume()
      }
    }} />
  )
}
```

### Coyote time with input buffer

```tsx
const jumpBuffer = useInputBuffer('jump', { window: 100 })

// In Script update:
const canJump = rb.isGrounded || coyoteTimer > 0

if (canJump && jumpBuffer.buffered) {
  rb.velocityY = -500
  jumpBuffer.consume()
}
```
