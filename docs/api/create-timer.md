# createTimer

A lightweight countdown timer for use inside `Script` update functions. Counts elapsed time, fires a callback on completion, and supports start/stop/restart/reset.

## Signature

```ts
function createTimer(
  duration: number,
  onComplete?: () => void,
  autoStart?: boolean
): GameTimer
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `duration` | number | — | **Required.** Timer duration in seconds |
| `onComplete` | `() => void` | — | Called once when the timer reaches `duration` |
| `autoStart` | boolean | `false` | Start counting immediately on creation |

## GameTimer

| Property / Method | Type | Description |
|---|---|---|
| `update(dt)` | `(dt: number) => void` | Advance the timer. Call this every frame from the Script `update` function. |
| `start()` | `() => void` | Begin or resume counting |
| `stop()` | `() => void` | Pause counting without resetting |
| `reset(duration?)` | `(d?: number) => void` | Reset elapsed time to 0 and stop. Optionally change the duration. |
| `restart()` | `() => void` | Reset elapsed time to 0 and immediately start |
| `running` | boolean | Whether the timer is currently counting |
| `elapsed` | number | Seconds since last reset / restart |
| `remaining` | number | Seconds until completion (clamped to 0) |
| `progress` | number | 0 (just started) → 1 (complete) |

## Example

```tsx
import { createTimer, Script } from 'cubeforge'

// Create outside the Script (module or component scope)
const invincibleTimer = createTimer(2.0, () => {
  state.isInvincible = false
})

const update: ScriptUpdateFn = (id, world, input, dt) => {
  invincibleTimer.update(dt)

  if (tookDamage) {
    state.isInvincible = true
    invincibleTimer.restart()
  }
}
```

### Cooldown

```tsx
const fireCooldown = createTimer(0.25) // 250ms between shots

const update: ScriptUpdateFn = (id, world, input, dt) => {
  fireCooldown.update(dt)

  if (input.isHeld('Space') && !fireCooldown.running) {
    spawnBullet()
    fireCooldown.restart()
  }
}
```

### Progress bar

```tsx
const reloadTimer = createTimer(1.5, () => { state.reloaded = true })

// In your HUD component:
// <div style={{ width: `${reloadTimer.progress * 100}%` }} />
```

## Notes

- `createTimer` is a plain factory function — not a React hook. Create timer instances in module scope, component scope, or inside `Script` `init` callbacks.
- Call `timer.update(dt)` every frame from a `Script` update function. The timer does nothing if `stop()` was called or if it has already completed.
- Calling `restart()` allows the timer to fire `onComplete` multiple times.
