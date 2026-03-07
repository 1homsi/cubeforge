# createInputMap

Creates a named action → key binding map. Use this inside `Script` update functions where you have an `InputManager` argument.

## Signature

```ts
function createInputMap(bindings: ActionBindings): InputMap
```

`ActionBindings` is `Record<string, string | string[]>`.

## InputMap methods

| Method | Description |
|---|---|
| `isActionDown(input, action)` | `true` every frame any bound key is held |
| `isActionPressed(input, action)` | `true` only on the first frame any bound key was pressed |
| `isActionReleased(input, action)` | `true` only on the frame any bound key was released |

## Example

```tsx
import { createInputMap } from 'cubeforge'

// Define once at module level — stable reference
const actions = createInputMap({
  left:  ['ArrowLeft', 'KeyA', 'a'],
  right: ['ArrowRight', 'KeyD', 'd'],
  jump:  ['Space', 'ArrowUp', 'KeyW', 'w'],
  attack: 'Space',
})

function playerUpdate(id: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!

  if (actions.isActionDown(input, 'left'))    rb.vx = -SPEED
  if (actions.isActionDown(input, 'right'))   rb.vx =  SPEED
  if (actions.isActionPressed(input, 'jump')) rb.vy = JUMP_FORCE
}
```

## Notes

- Define `createInputMap` at module level (outside any component or function) so the binding map is created once.
- For use inside React components, prefer `useInputMap` which binds the `InputManager` automatically.
- Key codes use `KeyboardEvent.code` (`'KeyA'`, `'Space'`, `'ArrowLeft'`) or `KeyboardEvent.key` (`'a'`, `'A'`, `' '`). Cubeforge tracks both, so either works.
