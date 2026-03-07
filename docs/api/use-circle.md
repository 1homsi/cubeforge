# useCircleEnter / useCircleExit

Fire once when `CircleCollider` entities start or stop overlapping. Also fires when a `CircleCollider` overlaps a `BoxCollider`.

## Signatures

```ts
function useCircleEnter(
  handler: (other: EntityId) => void,
  opts?: ContactOpts
): void

function useCircleExit(
  handler: (other: EntityId) => void,
  opts?: ContactOpts
): void
```

## ContactOpts

| Option | Type | Description |
|---|---|---|
| `tag` | string | Only fire if the other entity has this tag |
| `layer` | string | Only fire if the other entity's collider is on this layer |

## Examples

### Projectile hit detection

```tsx
import { useCircleEnter, useDestroyEntity } from 'cubeforge'

function Bullet() {
  const destroy = useDestroyEntity()

  useCircleEnter((other) => {
    dealDamage(other)
    destroy()
  }, { tag: 'enemy' })

  return null
}
```

### Pickup radius

```tsx
function MagnetPickup() {
  const destroy = useDestroyEntity()

  useCircleEnter(() => {
    collectItem()
    destroy()
  }, { tag: 'player' })

  return null
}
```

### Enter / exit area

```tsx
function DangerZone() {
  useCircleEnter((other) => {
    applyBurn(other)
  })

  useCircleExit((other) => {
    removeBurn(other)
  })

  return null
}
```

## Notes

- Both hooks must be used inside `<Entity>`.
- Use `<CircleCollider>` on the entity. Overlap detection also works between a `CircleCollider` and a `BoxCollider`.
- Handlers are called with the `EntityId` of the other entity.
- Use the `tag` filter to avoid filtering manually inside the handler.

## See also

- [useTriggerEnter / useTriggerExit](/api/use-trigger) — trigger overlaps for box colliders
- [useCollisionEnter / useCollisionExit](/api/use-collision) — solid body collisions
- [useDestroyEntity](/api/use-destroy-entity) — destroy the current entity from a contact handler
