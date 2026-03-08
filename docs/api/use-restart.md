# useRestart

Returns a `restartKey` and `restart()` function. Pass `restartKey` as the `key` prop on a component to force React to fully unmount and remount it on `restart()`.

## Signature

```ts
function useRestart(): RestartControls
```

## RestartControls

| Field / Method | Description |
|---|---|
| `restartKey` | A number that increments on each `restart()` call. |
| `restart()` | Increment `restartKey`, causing keyed components to remount. |

## Example

```tsx
import { useRestart } from 'cubeforge'

function App() {
  const { restartKey, restart } = useRestart()

  return (
    <Game>
      {/* Key the World so the entire scene remounts on restart */}
      <World key={restartKey}>
        <Player onDied={restart} />
        <Level />
      </World>
    </Game>
  )
}
```

## Notes

- Remounting resets all entity state, React state, and `useRef` values inside the keyed subtree — equivalent to a fresh scene load.
- For lighter resets (just resetting scores), prefer local state mutations rather than a full remount.
