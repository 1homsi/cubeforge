# useGameStore

Global reactive key-value store for sharing state across entities. Values persist across entity mount/unmount cycles, making it suitable for game-wide data like score, lives, or inventory.

## Signature

```ts
function useGameStore<T>(key: string, defaultValue: T): [T, (value: T) => void]
```

## Parameters

| Param | Type | Description |
|---|---|---|
| `key` | string | Unique identifier for the stored value |
| `defaultValue` | `T` | Initial value used when the key has not been set yet |

## Returns

| Index | Type | Description |
|---|---|---|
| `[0]` | `T` | Current value |
| `[1]` | `(value: T) => void` | Setter that updates the value and triggers re-renders in all consumers of the same key |

## Example

```tsx
import { useGameStore } from 'cubeforge'

function ScorePickup() {
  const [score, setScore] = useGameStore('score', 0)

  useTriggerEnter(() => {
    setScore(score + 10)
  }, { tag: 'player' })

  return (
    <Entity tags={['coin']}>
      <Transform x={200} y={300} />
      <Sprite width={16} height={16} color="#ffd54f" />
      <BoxCollider width={16} height={16} isTrigger />
    </Entity>
  )
}

function HUD() {
  const [score] = useGameStore('score', 0)
  const [lives] = useGameStore('lives', 3)

  return (
    <Entity>
      <Transform x={20} y={20} />
      <Text text={`Score: ${score}  Lives: ${lives}`} color="#fff" />
    </Entity>
  )
}
```

## Notes

- The store lives on the `EngineState` and survives entity destruction — a new entity reading the same key will get the latest value.
- Calling the setter triggers a React re-render only in components that call `useGameStore` with the matching key.
- Must be called inside `<Game>`.
