# useDestroyEntity

Returns a stable callback that destroys the current entity on the next ECS update. Must be called inside an `<Entity>`.

## Signature

```ts
function useDestroyEntity(): () => void
```

## Usage

```tsx
import { useDestroyEntity, useTriggerEnter } from 'cubeforge'

function CoinPickup() {
  const destroy = useDestroyEntity()

  useTriggerEnter(() => {
    collectCoin()
    destroy()
  }, { tag: 'player' })

  return null
}
```

## Notes

- The returned function is safe to call multiple times — it checks `hasEntity` before destroying, so calling it after the entity is already gone is a no-op.
- The callback is stable across renders (memoized with `useCallback`).
- Must be used inside both `<Game>` and `<Entity>`.

## See also

- [useEntity](/api/use-entity) — read the current entity's numeric ID
- [useTriggerEnter / useTriggerExit](/api/use-trigger) — detect trigger overlaps
- [useCollisionEnter / useCollisionExit](/api/use-collision) — detect solid collisions
