# usePlatformerController

Attaches full platformer movement to an entity. Handles horizontal movement, jumping, coyote time, jump buffering, and sprite flip. Must be called inside a component that is a descendant of `<Entity>`.

## Signature

```ts
function usePlatformerController(
  entityId: EntityId,
  opts?: PlatformerControllerOptions,
): void
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `speed` | number | `200` | Horizontal move speed in pixels per second |
| `jumpForce` | number | `-500` | Vertical velocity applied on jump (negative = upward) |
| `maxJumps` | number | `1` | Maximum consecutive jumps. Use `2` for double jump. |
| `coyoteTime` | number | `0.08` | Seconds after leaving a platform edge the player can still jump |
| `jumpBuffer` | number | `0.08` | Seconds a jump input is buffered before landing |

## Controls

| Key | Action |
|---|---|
| Arrow Left / A | Move left |
| Arrow Right / D | Move right |
| Space / Arrow Up / W | Jump |

## Example

```tsx
import { Entity, Transform, Sprite, RigidBody, BoxCollider, useEntity, usePlatformerController } from '@cubeforge/react'

function PlayerController() {
  const id = useEntity()
  usePlatformerController(id, {
    speed: 220,
    jumpForce: -520,
    maxJumps: 2,
    coyoteTime: 0.08,
    jumpBuffer: 0.08,
  })
  return null
}

function Player({ x, y }: { x: number; y: number }) {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={x} y={y} />
      <Sprite width={32} height={48} color="#4fc3f7" />
      <RigidBody />
      <BoxCollider width={30} height={46} />
      <PlayerController />
    </Entity>
  )
}
```

## Coyote time

Coyote time allows the player to jump for a brief window after walking off a ledge. The timer starts when the entity leaves the ground (`onGround` goes false) and expires after `coyoteTime` seconds.

## Jump buffer

Jump buffer queues a jump when the player presses the jump key before landing. If the player presses jump `jumpBuffer` seconds before touching the ground, the jump fires immediately on landing.

## Variable jump height

Releasing the jump key early cuts the upward arc. If `vy < -120` and the jump key is not held, an additional `800 px/s²` downward force is applied — making short taps produce lower jumps and held presses produce full-height jumps.

## Sprite flip

The hook automatically flips the sibling `<Sprite>` component's `flipX` when the player changes direction.

## Notes

- The entity must have a `<RigidBody>` component — the hook reads `rb.onGround` and writes `rb.vx`/`rb.vy`.
- The hook registers a `Script` component. An entity can only have one `Script` at a time — if you also use `<Script>` on the same entity, compose your logic into a single callback.
- Input uses `isDown` for movement and `isPressed`/buffered for jumping.
