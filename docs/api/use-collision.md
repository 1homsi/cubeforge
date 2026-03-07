# useCollisionEnter / useCollisionExit

Hooks that subscribe to physics solid-body collision events. Must be used inside an `<Entity>`.

## Signatures

```ts
function useCollisionEnter(handler: (other: EntityId) => void, opts?: ContactOpts): void
function useCollisionExit(handler: (other: EntityId) => void, opts?: ContactOpts): void
```

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `handler` | `(other: EntityId) => void` | Called with the other entity's ID |
| `opts.tag` | `string?` | Only fire if the other entity has this tag |
| `opts.layer` | `string?` | Only fire if the other entity's BoxCollider is on this layer |

## Example

```tsx
// Mushroom that fires an event when the player walks into it
function MushroomPickup() {
  const collected = useRef(false)

  useCollisionEnter(() => {
    if (collected.current) return
    collected.current = true
    gameEvents.onMushroomGet?.()
  }, { tag: 'player' })

  return null
}
```

## Behaviour

- Fires only when **two solid dynamic bodies** first touch (not for static vs dynamic).
- `useCollisionEnter` fires **once** on the first frame of contact.
- `useCollisionExit` fires **once** when the two bodies separate or one is destroyed.
- For every-frame events during contact, use `useEvent('collision', ...)`.

## Requirements

- Both entities must have solid `BoxCollider` components (not `isTrigger`).
- Both entities must have `RigidBody` components.
- Must be rendered inside an `<Entity>`.

## See also

- [useTriggerEnter / useTriggerExit](/api/use-trigger) — for trigger overlap events (static zones, pickups)
