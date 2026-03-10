# useTopDownMovement

Attaches 4-directional top-down movement to an entity using WASD and arrow keys. For top-down games the entity's `<RigidBody>` should have `gravityScale={0}`.

## Signature

```ts
function useTopDownMovement(
  entityId: EntityId,
  opts?: TopDownMovementOptions,
): void
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `speed` | number | `200` | Movement speed in pixels per second |
| `normalizeDiagonal` | boolean | `true` | Normalise diagonal movement so it isn't ~41% faster |

## Controls

| Key | Direction |
|---|---|
| Arrow Left / A | Left |
| Arrow Right / D | Right |
| Arrow Up / W | Up |
| Arrow Down / S | Down |

## Example

```tsx
import { Entity, Transform, Sprite, RigidBody, BoxCollider, useEntity, useTopDownMovement } from 'cubeforge'

function PlayerController() {
  const id = useEntity()
  useTopDownMovement(id, { speed: 180, normalizeDiagonal: true })
  return null
}

function TopDownPlayer({ x, y }: { x: number; y: number }) {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={x} y={y} />
      <Sprite width={24} height={24} color="#4fc3f7" />
      <RigidBody gravityScale={0} />
      <BoxCollider width={22} height={22} />
      <PlayerController />
    </Entity>
  )
}
```

## Diagonal normalisation

Without normalisation, moving diagonally (e.g. up + right) results in a velocity of `(speed, -speed)`, whose magnitude is `speed * √2 ≈ 1.41 * speed`. With `normalizeDiagonal={true}`, the direction vector is normalised to length 1 before multiplying by speed, ensuring consistent speed in all directions.

## Notes

- The entity must have a `<RigidBody>` for the hook to work.
- Set `friction={0}` on `<RigidBody>` so the entity stops immediately when keys are released — friction is designed for platformers where ground deceleration is desired.
- The hook registers a `Script` component. Compose with any additional logic using a single Script if needed.
