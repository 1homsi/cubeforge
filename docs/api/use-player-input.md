# usePlayerInput

Creates a per-player input map with its own device assignment. Useful for split-screen or co-op games.

## Signature

```ts
function usePlayerInput(
  playerId: number | string,
  bindings: ActionBindings,
): PlayerInput
```

## PlayerInput

Same interface as `useInputMap` — provides `isActionDown`, `isActionPressed`, `isActionReleased`, and `getAxis`.

## Example

```tsx
import { usePlayerInput } from 'cubeforge'

function Player1() {
  const input = usePlayerInput(1, {
    left:  ['ArrowLeft'],
    right: ['ArrowRight'],
    jump:  ['ArrowUp'],
  })

  return (
    <Script update={() => {
      if (input.isActionDown('right')) { /* move right */ }
    }} />
  )
}

function Player2() {
  const input = usePlayerInput(2, {
    left:  ['KeyA'],
    right: ['KeyD'],
    jump:  ['KeyW'],
  })
  // ...
}
```

## Notes

- Player 1 defaults to keyboard, Player 2 to gamepad index 0.
- You can also use `useLocalMultiplayer` to set up multiple players at once.
