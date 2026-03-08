# useSave

Persistent save/load helper backed by `localStorage` and JSON serialization. Supports versioning and migration for evolving save formats.

## Signature

```ts
function useSave<T>(
  key: string,
  defaultValue: T,
  opts?: SaveOptions<T>,
): SaveControls<T>
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `version` | number | `1` | Data version stored alongside the save |
| `migrate` | (oldData, savedVersion) => T | — | Called when loading data with an older version |

## SaveControls

| Method / Property | Description |
|---|---|
| `data` | Current in-memory value (same reference passed to `save()`). |
| `save(value)` | Persist `value` to localStorage as JSON. |
| `load()` | Load from localStorage. Returns `defaultValue` if not found. |
| `clear()` | Delete the save slot from localStorage. |
| `exists()` | Returns `true` if a save slot exists. |

## Example

```tsx
import { useSave } from 'cubeforge'
import { useEffect } from 'react'

interface Progress { level: number; score: number }

function Game() {
  const save = useSave<Progress>('my-game', { level: 1, score: 0 })

  useEffect(() => {
    // Load save on mount
    save.load()
  }, [])

  function onCheckpoint() {
    save.save({ level: 3, score: 4200 })
  }

  return <World>{/* ... */}</World>
}
```

## Migration Example

```ts
const save = useSave<V2Progress>('my-game', defaults, {
  version: 2,
  migrate: (old, savedVersion) => {
    if (savedVersion === 1) {
      // Upgrade v1 → v2
      const v1 = old as V1Progress
      return { ...v1, highScore: v1.score }
    }
    return old as V2Progress
  },
})
```
