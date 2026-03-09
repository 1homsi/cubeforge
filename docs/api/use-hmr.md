# useHMR

Hook for preserving game state across hot module replacement (HMR) updates during development. Prevents the game from resetting every time you save a file.

## Usage

```tsx
import { useHMR } from 'cubeforge'

useHMR()
```

## Signature

```ts
function useHMR(options?: HMROptions): void
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `preserveState` | `boolean` | `true` | Whether to preserve ECS state across reloads |
| `preserveCamera` | `boolean` | `true` | Whether to preserve camera position and zoom |
| `preserveInput` | `boolean` | `false` | Whether to preserve input map bindings |
| `onBeforeReload` | `() => void` | — | Callback fired just before state is saved |
| `onAfterReload` | `() => void` | — | Callback fired after state is restored |

## Example

### Basic usage

```tsx
import { Game, World, useHMR } from 'cubeforge'

function MyGame() {
  useHMR()

  return (
    <Game width={800} height={600}>
      <World>
        {/* Your game content — state persists across HMR */}
      </World>
    </Game>
  )
}
```

### Custom save/restore hooks

```tsx
useHMR({
  onBeforeReload: () => {
    console.log('Saving state before HMR...')
  },
  onAfterReload: () => {
    console.log('State restored after HMR!')
  },
})
```

::: tip
Only use `useHMR` during development. It has no effect in production builds where HMR is not available.
:::
