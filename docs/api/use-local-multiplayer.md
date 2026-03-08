# useLocalMultiplayer

Sets up input maps for multiple local players at once.

## Signature

```ts
function useLocalMultiplayer(
  count: number,
  bindingsPerPlayer: ActionBindings[],
): PlayerInput[]
```

## Example

```tsx
import { useLocalMultiplayer } from 'cubeforge'

const P1_BINDINGS = { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'] }
const P2_BINDINGS = { left: ['KeyA'],      right: ['KeyD'],       jump: ['KeyW']     }

function GameScene() {
  const [p1, p2] = useLocalMultiplayer(2, [P1_BINDINGS, P2_BINDINGS])

  return (
    <>
      <Player input={p1} x={100} y={400} />
      <Player input={p2} x={700} y={400} />
    </>
  )
}
```

## Notes

- Returns a stable array of `PlayerInput` objects — the array length equals `count`.
- Each `PlayerInput` has the same API as `useInputMap` (isActionDown, isActionPressed, getAxis).
