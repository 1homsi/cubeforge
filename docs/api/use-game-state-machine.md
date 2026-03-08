# useGameStateMachine

A lightweight typed state machine for top-level game flow (menu → playing → paused → game over).

`onUpdate` callbacks run automatically inside the ScriptSystem tick — they respect pause and deterministic mode with no extra wiring.

## Signature

```ts
function useGameStateMachine<S extends string>(
  states: Record<S, GameState>,
  initial: S,
): GameStateMachineResult<S>
```

## GameState

Each state object can define:

| Callback | Description |
|---|---|
| `onEnter()` | Called once when this state becomes active. |
| `onExit()` | Called once when leaving this state. |
| `onUpdate(dt)` | Called every frame while this state is active. Runs automatically — no manual wiring needed. |

## GameStateMachineResult

| Field / Method | Description |
|---|---|
| `state` | The currently active state name. |
| `transition(to)` | Switch to a new state: calls `onExit` then `onEnter`. |

## Example

```tsx
import { useGameStateMachine } from 'cubeforge'

type Flow = 'playing' | 'paused' | 'dead'

function App() {
  const { state, transition } = useGameStateMachine<Flow>({
    playing: {
      onEnter: () => console.log('Game started'),
      onUpdate: (dt) => { /* runs every frame automatically */ },
    },
    paused: {
      onEnter: () => console.log('Paused'),
    },
    dead: {
      onEnter: () => console.log('Game over'),
    },
  }, 'playing')

  return (
    <Game>
      {state === 'dead' && <GameOverScreen onRestart={() => transition('playing')} />}
    </Game>
  )
}
```

## Notes

- `onEnter` is called for the initial state on mount.
- Transitioning to the current state is a no-op (no callbacks fired).
- The `onUpdate` script entity is destroyed when the component unmounts.
