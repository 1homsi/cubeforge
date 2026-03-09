# Hot Module Replacement (HMR)

During development, any code change normally triggers a full page refresh,
resetting the entire game back to its initial state. The HMR integration
lets you preserve game state across hot reloads so you can iterate without
losing your place.

## How it works

Cubeforge ships two layers:

1. **`@cubeforge/core` primitives** (`hmrSaveState`, `hmrLoadState`, etc.) --
   a framework-agnostic key/value store backed by a `globalThis` variable that
   survives module re-evaluation.
2. **`useHMR` hook** -- a React hook that wires into Vite's `import.meta.hot`
   API and exposes `onDispose` / `onAccept` callbacks.

## Quick start

```tsx
import { useHMR } from 'cubeforge'

let playerHealth = 100

function PlayerScript() {
  const hmr = useHMR('player')

  hmr.onDispose(() => ({
    health: playerHealth,
  }))

  hmr.onAccept((prev) => {
    if (prev) {
      const s = prev as { health: number }
      playerHealth = s.health
    }
  })

  // ... rest of your script
}
```

### `useHMR(key?: string): HMRControls`

| Member | Description |
|---|---|
| `onDispose(handler)` | Called before the old module is torn down. Return any serializable value to persist. |
| `onAccept(handler)` | Called after the new module loads. Receives the value returned by `onDispose`. |
| `isHotReload` | `true` when this render follows a hot update (vs. the initial page load). |

The optional `key` parameter gives the HMR slot a stable name. If omitted, an
auto-incrementing id is used.

## Low-level API

If you are not using React, import the primitives directly:

```ts
import { hmrSaveState, hmrLoadState, hmrClearState, hmrGetVersion } from '@cubeforge/core'

// Save before module teardown
hmrSaveState('enemy-spawner', { wave: currentWave })

// Restore when module re-runs
const prev = hmrLoadState<{ wave: number }>('enemy-spawner')
if (prev) currentWave = prev.wave
```

## Limitations

- **Component tree changes still require a full reload.** HMR preserves state
  within the same component structure. Adding or removing `<Entity>` nodes
  causes React to remount, which resets ECS state for those entities.
- **Non-serializable values** (functions, class instances, canvas references)
  cannot be stored. Only persist plain data.
- **Production builds** have no `import.meta.hot` -- the hook becomes a no-op
  with zero overhead.
