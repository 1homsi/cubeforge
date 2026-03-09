# playClip / setAnimationState / setAnimatorParam

Imperative animation control functions for use inside Script update functions. These let you drive `AnimatedSprite` and `Animator` components without React hooks.

## Functions

### playClip

Switches the active animation clip on an entity's `AnimatedSprite`.

```ts
function playClip(
  world: ECSWorld,
  entityId: EntityId,
  clipName: string,
): void
```

### setAnimationState

Forces a specific state on the entity's `Animator` state machine.

```ts
function setAnimationState(
  world: ECSWorld,
  entityId: EntityId,
  state: string,
): void
```

### setAnimatorParam

Sets a named parameter on the entity's `Animator`, which can trigger state transitions based on the animator's defined conditions.

```ts
function setAnimatorParam(
  world: ECSWorld,
  entityId: EntityId,
  param: string,
  value: number | boolean | string,
): void
```

## Example

```tsx
import { playClip, setAnimationState, setAnimatorParam } from 'cubeforge'

function PlayerController() {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={100} y={300} />
      <AnimatedSprite
        atlas="hero"
        clips={{
          idle: { frames: [0, 1], fps: 4 },
          run: { frames: [2, 3, 4, 5], fps: 10 },
          jump: { frames: [6], fps: 1 },
        }}
        currentClip="idle"
        width={32}
        height={32}
      />
      <Script
        update={(id, world, input, dt) => {
          const rb = world.getComponent(id, 'RigidBody')
          if (!rb) return

          if (!rb.isGrounded) {
            playClip(world, id, 'jump')
          } else if (Math.abs(rb.velocity.x) > 10) {
            playClip(world, id, 'run')
          } else {
            playClip(world, id, 'idle')
          }
        }}
      />
    </Entity>
  )
}
```

```ts
// Using Animator params for state-driven transitions
setAnimatorParam(world, bossId, 'health', bossHP)
setAnimatorParam(world, bossId, 'isEnraged', bossHP < 30)
```

## Notes

- `playClip` is a no-op if the clip is already active, so it is safe to call every frame.
- These functions mutate components in place -- they take effect on the next render frame.
- For the React hook variant, see [`useAnimationController`](./use-animation-controller.md).
- For defining animation state machines, see [`Animator`](./animator.md) and [`defineAnimations`](./define-animations.md).
