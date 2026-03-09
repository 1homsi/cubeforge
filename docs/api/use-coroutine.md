# useCoroutine

Hook for running generator-based coroutines inside game entities. Coroutines let you write sequential, frame-spanning logic in a linear style using `yield` instead of state machines.

## Usage

```tsx
import { useCoroutine, wait, waitFrames, waitUntil } from 'cubeforge'

useCoroutine(function* () {
  yield wait(1000)              // pause for 1 second
  console.log('1 second later')
  yield waitFrames(60)          // pause for 60 frames
  yield waitUntil(() => hp <= 0) // pause until condition is true
})
```

## Signature

```ts
function useCoroutine(
  generator: () => Generator<YieldInstruction, void, void>,
  deps?: any[]
): CoroutineControls
```

## Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `generator` | `() => Generator` | — | **Required.** Generator function containing the coroutine logic |
| `deps` | `any[]` | `[]` | Dependency array — the coroutine restarts when deps change |

## Yield instructions

| Function | Signature | Description |
|---|---|---|
| `wait` | `wait(ms: number)` | Pause execution for the given number of milliseconds |
| `waitFrames` | `waitFrames(n: number)` | Pause execution for `n` game frames |
| `waitUntil` | `waitUntil(predicate: () => boolean)` | Pause until the predicate returns `true` |

## Return value

`CoroutineControls`

| Field | Type | Description |
|---|---|---|
| `cancel` | `() => void` | Stop the coroutine immediately |
| `restart` | `() => void` | Cancel and re-run from the beginning |
| `isRunning` | `boolean` | Whether the coroutine is currently active |

## Example

```tsx
import { useCoroutine, wait, waitUntil } from 'cubeforge'

function Boss({ onDefeated }) {
  useCoroutine(function* () {
    // Phase 1: charge attack
    yield wait(2000)
    startChargeAttack()

    // Phase 2: wait until charge finishes, then rest
    yield waitUntil(() => chargeComplete)
    yield wait(1500)

    // Phase 3: shoot projectiles
    for (let i = 0; i < 5; i++) {
      shootProjectile()
      yield wait(300)
    }

    // Loop back to phase 1
  })

  // ...
}
```

### Cancellable cutscene

```tsx
function Cutscene() {
  const { cancel } = useCoroutine(function* () {
    yield* panCameraTo(300, 200)
    yield wait(1000)
    showDialogue('Watch out!')
    yield wait(2000)
    hideDialogue()
  })

  // Allow skipping
  useEvent('skipCutscene', cancel)
}
```
