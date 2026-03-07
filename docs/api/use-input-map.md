# useInputMap

A hook that returns a pre-bound action map for responding to named input actions inside `<Game>`. Replaces verbose multi-key checks with readable action names.

## Signature

```ts
function useInputMap(bindings: ActionBindings): BoundInputMap
```

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `bindings` | `Record<string, string \| string[]>` | Map of action name → key code or array of key codes |

## Returns

| Method | Description |
|---|---|
| `isActionDown(action)` | `true` every frame any bound key is held |
| `isActionPressed(action)` | `true` only on the first frame any bound key was pressed |
| `isActionReleased(action)` | `true` only on the frame any bound key was released |

## Example

```tsx
function MyPlayer() {
  const actions = useInputMap({
    left:  ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    jump:  ['Space', 'ArrowUp', 'KeyW'],
  })

  return (
    <Entity>
      <Script
        update={(id, world, input, dt) => {
          // Note: in Script update, use createInputMap instead
        }}
      />
    </Entity>
  )
}
```

## In Script update functions

Inside Script `update` callbacks, use `createInputMap` instead (which takes the `InputManager` as an argument rather than reading it from context):

```tsx
import { createInputMap } from 'cubeforge'

const actions = createInputMap({
  left:  ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump:  ['Space', 'ArrowUp', 'KeyW'],
})

function playerUpdate(id, world, input, dt) {
  if (actions.isActionDown(input, 'left'))   rb.vx = -SPEED
  if (actions.isActionDown(input, 'right'))  rb.vx =  SPEED
  if (actions.isActionPressed(input, 'jump')) rb.vy = JUMP_FORCE
}
```

## Notes

- `bindings` is read once on mount. Pass a stable object reference (module-level `const`) to avoid issues.
- Key codes follow the Web `KeyboardEvent.code` and `KeyboardEvent.key` conventions: `'Space'`, `'ArrowLeft'`, `'KeyA'`, `'a'`, etc.
