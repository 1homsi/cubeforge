# useAnimationController

Manages named animation states with optional auto-transitions. Returns props that spread directly onto `<Animation>`.

## Signature

```ts
function useAnimationController<S extends string>(
  states: Record<S, AnimationClip>,
  initial: S,
): AnimationControllerResult<S>
```

## AnimationClip

| Field | Type | Default | Description |
|---|---|---|---|
| `frames` | `number[]` | — | **Required.** Frame indices into the sprite sheet |
| `fps` | number | `12` | Frames per second |
| `loop` | boolean | `true` | Whether the clip loops |
| `next` | string | — | State to auto-transition to when this clip finishes (requires `loop: false`) |
| `onComplete` | `() => void` | — | Called when this clip completes, before auto-transitioning |

## AnimationControllerResult

| Property | Type | Description |
|---|---|---|
| `state` | `S` | Currently active state name |
| `setState(next)` | `(s: S) => void` | Switch to a different state. No-op if already active. Safe to call from Script `update`. |
| `animProps` | object | Spread onto `<Animation {...anim.animProps} />` |

## Example

```tsx
import { useAnimationController, Animation, Script } from 'cubeforge'
import type { RigidBodyComponent } from 'cubeforge'

function Player() {
  const anim = useAnimationController({
    idle:  { frames: [0, 1],           fps: 6  },
    run:   { frames: [2, 3, 4, 5],     fps: 12 },
    jump:  { frames: [6],              fps: 4, loop: false, next: 'idle' },
    death: { frames: [7, 8, 9],        fps: 8, loop: false },
  }, 'idle')

  return (
    <Entity id="player" tags={['player']}>
      <Transform x={100} y={400} />
      <Sprite
        src="/player-sheet.png"
        width={32} height={48}
        frameWidth={32} frameHeight={48} frameColumns={10}
      />
      <Animation {...anim.animProps} />
      <RigidBody />
      <BoxCollider width={28} height={48} />
      <Script update={(id, world, input, dt) => {
        const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
        if (!rb.isGrounded) {
          anim.setState('jump')
        } else if (Math.abs(rb.vx) > 10) {
          anim.setState('run')
        } else {
          anim.setState('idle')
        }
      }} />
    </Entity>
  )
}
```

## Auto-transitions

Set `loop: false` and `next` on a clip to automatically transition to another state when the clip ends:

```tsx
const anim = useAnimationController({
  attack: { frames: [10, 11, 12], fps: 10, loop: false, next: 'idle' },
  idle:   { frames: [0, 1],       fps: 6 },
}, 'idle')

// Trigger once:
anim.setState('attack')
// → plays attack frames, then automatically returns to idle
```

## Notes

- `setState` is safe to call every frame from a Script `update` — React bails out when the value is unchanged, so it only re-renders when the state actually changes.
- `animProps` updates automatically when state changes. No manual wiring needed.
- Works with any `<Animation>` + `<Sprite>` setup, including atlas-based frames.

## See also

- [Animation](/api/animation) — the underlying frame animation component
- [Sprite](/api/sprite) — sprite sheet setup
