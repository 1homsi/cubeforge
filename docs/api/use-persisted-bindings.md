# usePersistedBindings

Like `useInputMap` but persists key bindings to `localStorage` so they survive page reloads. Provides `rebind` and `reset` for a settings/rebinding screen.

## Signature

```ts
function usePersistedBindings(
  storageKey: string,
  defaults: ActionBindings,
): BindingControls
```

| Parameter | Type | Description |
|---|---|---|
| `storageKey` | string | `localStorage` key used to store custom bindings |
| `defaults` | `ActionBindings` | Default bindings used when nothing is stored |

## BindingControls

| Property / Method | Type | Description |
|---|---|---|
| `bindings` | `ActionBindings` | Current active bindings |
| `isActionDown(action)` | `(s: string) => boolean` | True every frame any bound key is held |
| `isActionPressed(action)` | `(s: string) => boolean` | True on the first frame any bound key was pressed |
| `isActionReleased(action)` | `(s: string) => boolean` | True on the frame any bound key was released |
| `rebind(action, keys)` | `(s, k) => void` | Rebind an action to new key(s). Persists immediately to `localStorage`. |
| `reset()` | `() => void` | Reset all bindings to `defaults`. Removes the `localStorage` entry. |

## Example

```tsx
import { usePersistedBindings } from 'cubeforge'

const DEFAULT_BINDINGS = {
  left:  ['ArrowLeft',  'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump:  ['Space',      'KeyW'],
  fire:  ['KeyX',       'KeyZ'],
}

function Player() {
  const actions = usePersistedBindings('my-game-bindings', DEFAULT_BINDINGS)

  // Use in a Script:
  // actions.isActionDown('left')
  // actions.isActionPressed('jump')

  return <Entity>...</Entity>
}
```

### Settings screen

```tsx
function KeyBindingsMenu() {
  const actions = usePersistedBindings('my-game-bindings', DEFAULT_BINDINGS)
  const [listening, setListening] = useState<string | null>(null)

  const startRebind = (action: string) => setListening(action)

  useEffect(() => {
    if (!listening) return
    const onKey = (e: KeyboardEvent) => {
      actions.rebind(listening, [e.code])
      setListening(null)
    }
    window.addEventListener('keydown', onKey, { once: true })
    return () => window.removeEventListener('keydown', onKey)
  }, [listening, actions])

  return (
    <div>
      {Object.entries(actions.bindings).map(([action, keys]) => (
        <div key={action}>
          <span>{action}</span>
          <button onClick={() => startRebind(action)}>
            {listening === action ? 'Press a key…' : (keys as string[]).join(' / ')}
          </button>
        </div>
      ))}
      <button onClick={actions.reset}>Reset to defaults</button>
    </div>
  )
}
```

## Notes

- On mount, `usePersistedBindings` reads from `localStorage`. If parsing fails or the key doesn't exist, defaults are used silently.
- Only the actions present in the stored JSON are overridden — defaults are merged, so adding new actions to `defaults` works without breaking existing saves.
- `rebind` and `reset` are stable callbacks — safe to use as event handler props.
- `localStorage` access is wrapped in try/catch for environments where it is unavailable (private browsing, SSR).

## See also

- [useInputMap](/api/use-input-map) — non-persisted action map
- [createInputMap](/api/create-input-map) — create a binding map outside React
