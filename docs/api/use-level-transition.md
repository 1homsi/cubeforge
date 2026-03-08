# useLevelTransition

Manages level transitions with optional fade-to-black animation.

## Signature

```ts
function useLevelTransition(initial: string): LevelTransitionControls
```

## LevelTransitionControls

| Field / Method | Description |
|---|---|
| `currentLevel` | The currently active level identifier. |
| `isTransitioning` | True while a transition animation is running. |
| `transitionTo(level, opts?)` | Begin a transition to `level`. |
| `overlayRef` | Attach to a full-screen `<div>` to enable fade animations. |

## TransitionOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `duration` | number | `0.4` | Total transition duration in seconds |
| `type` | `'fade'` \| `'instant'` | `'fade'` | Transition style |

## Example

```tsx
import { useLevelTransition } from 'cubeforge'
import { useState } from 'react'

function App() {
  const { currentLevel, transitionTo, overlayRef } = useLevelTransition('world-1')

  return (
    <Game>
      <World>
        {currentLevel === 'world-1' && (
          <Level1 onExit={() => transitionTo('world-2', { duration: 0.5 })} />
        )}
        {currentLevel === 'world-2' && <Level2 />}
      </World>
      {/* Mount the overlay div to enable fade animation */}
      <div ref={overlayRef} />
    </Game>
  )
}
```

## Notes

- If `overlayRef` is not mounted, `transitionTo` falls back to an instant swap.
- The fade overlay has `zIndex: 9998` and `pointerEvents: none`.
- Use `isTransitioning` to block input or show a loading indicator during the transition.
