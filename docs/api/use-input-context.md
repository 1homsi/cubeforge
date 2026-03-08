# useInputContext

Manages a stack of named input contexts (e.g. `'gameplay'`, `'pause'`, `'ui'`). Useful for disabling player controls during menus or cutscenes.

## Signature

```ts
function useInputContext(ctx?: string): InputContextControls
```

Pass a context name to automatically push it on mount and pop it on unmount.

## InputContextControls

| Method / Property | Description |
|---|---|
| `active` | The currently active context name (top of stack). |
| `push(ctx)` | Push a context onto the stack, making it active. |
| `pop(ctx)` | Remove a specific context from the stack. |

## Example

```tsx
import { useInputContext } from 'cubeforge'

// Automatically active while this component is mounted
function PauseMenu() {
  useInputContext('pause') // pushed on mount, popped on unmount

  return <div>Pause Menu</div>
}

// Manual control
function App() {
  const ctx = useInputContext()

  return (
    <button onClick={() => ctx.push('ui')}>
      Open Menu (active: {ctx.active})
    </button>
  )
}
```

## Notes

- The global context singleton is also exported as `globalInputContext` for use outside React.
- Check `ctx.active` in your input handlers to selectively ignore input: `if (ctx.active !== 'gameplay') return`.
