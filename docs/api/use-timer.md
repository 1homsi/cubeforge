# useTimer

Hook for managing timers within a game entity. Provides countdown or count-up timers with controls for starting, stopping, resetting, and querying progress.

## Usage

```tsx
import { useTimer } from 'cubeforge'

const timer = useTimer({
  duration: 3000,
  onComplete: () => console.log('Done!'),
  autoStart: true,
})
```

## Signature

```ts
function useTimer(options: TimerOptions): TimerControls
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `duration` | `number` | — | **Required.** Timer duration in milliseconds |
| `onComplete` | `() => void` | — | Callback fired when the timer reaches zero |
| `autoStart` | `boolean` | `false` | Start the timer immediately on mount |
| `loop` | `boolean` | `false` | Restart automatically when finished |

## Return value

`TimerControls`

| Field | Type | Description |
|---|---|---|
| `start` | `() => void` | Start or resume the timer |
| `stop` | `() => void` | Pause the timer at its current position |
| `reset` | `() => void` | Reset the timer to its initial duration (does not auto-start) |
| `remaining` | `number` | Milliseconds remaining |
| `elapsed` | `number` | Milliseconds elapsed since start |
| `progress` | `number` | Normalized progress from `0` (just started) to `1` (complete) |

## Example

```tsx
import { Entity, Transform, Sprite, useTimer } from 'cubeforge'

function Bomb({ x, y, onExplode }) {
  const timer = useTimer({
    duration: 2000,
    autoStart: true,
    onComplete: onExplode,
  })

  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite width={24} height={24} color={timer.progress > 0.8 ? '#ff0000' : '#ff9800'} />
    </Entity>
  )
}
```

### Looping timer

```tsx
const spawner = useTimer({
  duration: 5000,
  loop: true,
  autoStart: true,
  onComplete: () => spawnEnemy(),
})

// Stop spawning when the player reaches a checkpoint
if (reachedCheckpoint) spawner.stop()
```

## See also

- [createTimer](/api/create-timer) — lower-level timer utility for use in Script components
