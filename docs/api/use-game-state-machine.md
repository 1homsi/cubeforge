# useGameStateMachine

A lightweight typed state machine for top-level game flow (menu → playing → paused → game over).

## Signature

```ts
function useGameStateMachine<S extends string>(
  states: Record<S, GameStateDefinition>,
  initial: S,
): GameStateMachineResult<S>
```

## GameStateDefinition

Each state object can define:

| Callback | Description |
|---|---|
| `onEnter()` | Called once when this state becomes active. |
| `onExit()` | Called once when leaving this state. |
| `onUpdate(dt)` | Called each frame while this state is active (via `update(dt)`). |

## GameStateMachineResult

| Field / Method | Description |
|---|---|
| `state` | The currently active state name. |
| `transition(to)` | Switch to a new state: calls `onExit` then `onEnter`. |
| `update(dt)` | Advance the current state by `dt`. Call from a Script or game loop. |

## Example

```tsx
import { useGameStateMachine } from 'cubeforge'

type GameState = 'playing' | 'paused' | 'dead'

function App() {
  const gsm = useGameStateMachine<GameState>({
    playing: {
      onEnter: () => console.log('Game started'),
      onUpdate: (dt) => { /* tick game logic */ },
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
      <Script update={(_id, _world, _input, dt) => gsm.update(dt)} />
      {gsm.state === 'dead' && <GameOverScreen onRestart={() => gsm.transition('playing')} />}
    </Game>
  )
}
```

## Notes

- `onEnter` is called for the initial state on mount.
- Transitioning to the current state is a no-op (no callbacks fired).
