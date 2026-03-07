# usePause

Controls the game loop pause state from inside a `<Game>` tree.

## Signature

```ts
function usePause(): PauseControls
```

## PauseControls

| Property / Method | Type | Description |
|---|---|---|
| `paused` | boolean | Whether the game loop is currently paused |
| `pause()` | `() => void` | Stop the game loop |
| `resume()` | `() => void` | Restart the game loop |
| `toggle()` | `() => void` | Toggle between paused and running |

## Examples

### Pause menu button

```tsx
import { usePause } from 'cubeforge'

function PauseButton() {
  const { paused, toggle } = usePause()

  return (
    <button onClick={toggle}>
      {paused ? 'Resume' : 'Pause'}
    </button>
  )
}
```

### Pause on Escape key (from inside a Script)

```tsx
function PauseOnEscape() {
  const { toggle } = usePause()
  const input = useInput()

  useEffect(() => {
    // usePause works in React event handlers, not Script update fns.
    // For in-game key handling, read from the Script instead:
  }, [])

  return null
}
```

### Pause from a Script update function

When you need to pause from inside a `Script` `update` callback, call the game controls obtained from `onReady`:

```tsx
function App() {
  const controls = useRef<GameControls | null>(null)

  return (
    <Game onReady={(c) => { controls.current = c }}>
      <World>
        <Entity>
          <Script update={(id, world, input) => {
            if (input.isPressed('Escape')) controls.current?.pause()
          }} />
        </Entity>
      </World>
    </Game>
  )
}
```

## Notes

- `usePause` must be used inside `<Game>`.
- It does not need to be inside an `<Entity>`.
- `paused` is React state — it re-renders the component when the game pauses or resumes.
