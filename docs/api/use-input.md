# useInput

Returns the `InputManager` directly. Use this to check keyboard and mouse state outside of a `<Script>` update callback — for example, in a React event handler or a `useEffect`. Must be called inside a `<Game>` descendant.

## Signature

```ts
function useInput(): InputManager
```

## Example

```tsx
import { useInput } from 'cubeforge'
import { useEffect } from 'react'

function PauseOnEscape({ onPause }: { onPause: () => void }) {
  const input = useInput()

  useEffect(() => {
    const check = setInterval(() => {
      if (input.isPressed('Escape')) onPause()
    }, 16)
    return () => clearInterval(check)
  }, [input, onPause])

  return null
}
```

## InputManager API

| Method | Description |
|---|---|
| `input.isDown(key)` | `true` every frame while the key is held |
| `input.isPressed(key)` | `true` only on the first frame the key is pressed |
| `input.isReleased(key)` | `true` only on the frame the key is released |
| `input.mouse.x` | Cursor X relative to canvas |
| `input.mouse.y` | Cursor Y relative to canvas |
| `input.mouse.isDown(button)` | Mouse button held (0=left, 1=middle, 2=right) |
| `input.mouse.isPressed(button)` | Mouse button just clicked |
| `input.mouse.isReleased(button)` | Mouse button just released |

Key values follow `KeyboardEvent.code` (`'Space'`, `'ArrowLeft'`, `'KeyA'`) or `KeyboardEvent.key` for printable characters (`'a'`, `'d'`).

## Notes

- Inside `<Script>` update callbacks, `input` is passed as the third argument — you don't need `useInput` there.
- `isPressed` and `isReleased` are only `true` for one tick. If your polling interval is slower than the game loop, you may miss them. For event-driven input outside the game loop, subscribe to `EventBus` events instead.
- Throws if called outside of a `<Game>` context.
