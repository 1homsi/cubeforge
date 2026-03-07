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
- [useCircleEnter / useCircleExit](/api/circle-collider) — for circle collider overlap events

---

# useCircleEnter / useCircleExit

Hooks that subscribe to `CircleCollider` overlap events. Must be used inside an `<Entity>` that has a `<CircleCollider>`.

## Signatures

```ts
function useCircleEnter(handler: (other: EntityId) => void, opts?: ContactOpts): void
function useCircleExit(handler: (other: EntityId) => void, opts?: ContactOpts): void
```

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `handler` | `(other: EntityId) => void` | Called with the other entity's ID |
| `opts.tag` | `string?` | Only fire if the other entity has this tag |
| `opts.layer` | `string?` | Only fire if the other entity's collider is on this layer |

## Example

```tsx
function CoinPickup() {
  const collected = useRef(false)

  useCircleEnter(() => {
    if (collected.current) return
    collected.current = true
    gameEvents.onCoinCollect?.()
  }, { tag: 'player' })

  return (
    <Entity tags={['coin']}>
      <Transform x={300} y={200} />
      <Sprite width={16} height={16} color="#ffd54f" />
      <CircleCollider radius={10} />
    </Entity>
  )
}
```

## Behaviour

- `useCircleEnter` fires **once** on the first frame the circles (or circle + box) overlap.
- `useCircleExit` fires **once** when they separate or one entity is destroyed.
- Circle colliders are **event-only** — they do not push entities apart. Use `BoxCollider` for solid blocking.

## See also

- [CircleCollider](/api/circle-collider) — component reference
- [useCollisionEnter / useCollisionExit](/api/use-collision) — for solid AABB collision events
