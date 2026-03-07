# useGamepad

Polls the browser Gamepad API every frame and returns the current state of a connected controller.

## Signature

```ts
function useGamepad(playerIndex?: number): GamepadState
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `playerIndex` | number | `0` | Which gamepad slot to read (0–3) |

## GamepadState

| Property | Type | Description |
|---|---|---|
| `connected` | boolean | Whether a gamepad is connected at this player index |
| `axes` | `readonly number[]` | Normalised axis values (−1 to +1). Index 0 = left stick X, 1 = left stick Y, 2 = right stick X, 3 = right stick Y |
| `buttons` | `readonly boolean[]` | Button pressed states. Standard mapping: 0=A/Cross, 1=B/Circle, 2=X/Square, 3=Y/Triangle, 4=LB, 5=RB, 12=D-Pad Up, 13=D-Pad Down, 14=D-Pad Left, 15=D-Pad Right |

## Example

```tsx
import { useGamepad } from 'cubeforge'

function GamepadMovement() {
  const gp = useGamepad()

  if (!gp.connected) return null

  const moveX = gp.axes[0]   // -1 (left) to +1 (right)
  const jump  = gp.buttons[0] // A / Cross button

  // use moveX and jump in your Script update fn...
  return null
}
```

## Combining with keyboard input

```tsx
function Player() {
  const input = useInput()
  const gp = useGamepad()

  const moveX = input.isHeld('ArrowRight') ? 1
              : input.isHeld('ArrowLeft')  ? -1
              : gp.axes[0] ?? 0

  const jump = input.isPressed('Space') || gp.buttons[0]
  // ...
}
```

## Notes

- `useGamepad` polls via `requestAnimationFrame` — it runs at the display refresh rate independent of the game loop.
- Axis values vary by browser and controller. Test with a physical device.
- On browsers that do not support the Gamepad API, `connected` is always `false` and `axes`/`buttons` are empty arrays.
