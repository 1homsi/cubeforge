# useDropThrough

Lets a player temporarily pass through one-way platforms (e.g. press Down + Jump to drop down).

## Signature

```ts
function useDropThrough(frames?: number): { dropThrough(): void }
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `frames` | number | `8` | How many physics frames the entity ignores one-way platforms |

## Example

```tsx
import { Script, useInputMap, useDropThrough } from 'cubeforge'

function PlayerController() {
  const input = useInputMap({ drop: ['ArrowDown', 'KeyS'] })
  const { dropThrough } = useDropThrough()

  return (
    <Script update={() => {
      if (input.isActionPressed('drop')) {
        dropThrough()
      }
    }} />
  )
}
```

## Notes

- The entity must have a `RigidBody`. One-way platforms must have `BoxCollider` with `oneWay={true}`.
- Each call to `dropThrough()` sets a frame counter on the `RigidBody`; the counter decrements each physics step, restoring normal platform collision automatically.
