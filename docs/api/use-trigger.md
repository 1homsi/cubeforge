# useTriggerEnter / useTriggerExit

Hooks that subscribe to physics trigger overlap events. Must be used inside an `<Entity>`.

## Signatures

```ts
function useTriggerEnter(handler: (other: EntityId) => void, opts?: ContactOpts): void
function useTriggerExit(handler: (other: EntityId) => void, opts?: ContactOpts): void
```

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `handler` | `(other: EntityId) => void` | Called with the other entity's ID |
| `opts.tag` | `string?` | Only fire if the other entity has this tag |
| `opts.layer` | `string?` | Only fire if the other entity's BoxCollider is on this layer |

## Example

```tsx
// Coin that collects when a player-tagged entity enters it
function CoinCollector() {
  const entityId = useEntity()
  const collected = useRef(false)

  useTriggerEnter((other) => {
    if (collected.current) return
    collected.current = true
    onCollect?.(entityId)
  }, { tag: 'player' })

  return null
}

// Inside <Entity>:
function Coin({ x, y, onCollect }) {
  return (
    <Entity tags={['coin']}>
      <Transform x={x} y={y} />
      <Sprite width={16} height={16} color="#ffd54f" />
      <BoxCollider width={16} height={16} isTrigger />
      <CoinCollector onCollect={onCollect} />
    </Entity>
  )
}
```

## Behaviour

- `useTriggerEnter` fires **once** on the first physics step where the overlap begins.
- `useTriggerExit` fires **once** on the step the overlap ends (including when an entity is destroyed mid-overlap).
- For continuous per-frame events while overlapping, listen to the raw `'trigger'` EventBus event via `useEvent`.

## Requirements

- The entity must have a `BoxCollider isTrigger` **or** the other entity must have one — at least one side must be a trigger.
- Works for both static trigger zones (e.g. Checkpoint) and dynamic triggers.
- Must be rendered inside an `<Entity>` component (uses `EntityContext` internally).

## See also

- [useCollisionEnter / useCollisionExit](/api/use-collision) — for solid body contact events
- [BoxCollider](/api/boxcollider) — isTrigger prop and layer/mask filtering
