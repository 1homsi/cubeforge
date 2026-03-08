# useCollidingWith

Returns a live `Set<EntityId>` of all entities currently colliding with or overlapping the current entity. Must be used inside an `<Entity>`.

## Signature

```ts
function useCollidingWith(): Set<EntityId>
```

## Returns

A `Set<EntityId>` that is updated automatically as contacts begin and end. The same Set instance is returned on every render (ref-stable), so mutations are visible immediately without triggering re-renders.

## Example

```tsx
function Player() {
  const touching = useCollidingWith()

  // In a Script update callback you can inspect the set:
  const update = useCallback((id, world, input, dt) => {
    if (touching.size > 0) {
      // player is touching something
    }
  }, [touching])

  return (
    <Entity id="player" tags={['player']}>
      <Transform x={100} y={100} />
      <Sprite width={32} height={32} color="#4fc3f7" />
      <RigidBody />
      <BoxCollider width={32} height={32} />
      <Script update={update} />
    </Entity>
  )
}
```

## Behaviour

- Subscribes to all contact enter/exit event pairs: `collisionEnter`/`collisionExit`, `triggerEnter`/`triggerExit`, and `circleEnter`/`circleExit`.
- The set is cleared when the component unmounts.
- The returned Set is **ref-stable** — it is never replaced, only mutated in place. This means you can read it inside `Script` update callbacks or event handlers without worrying about stale references.

## Requirements

- Must be rendered inside an `<Entity>`.
- The entity (or the entities it collides with) must have collider components (`BoxCollider`, `CircleCollider`, etc.) for contact events to fire.

## See also

- [useCollisionEnter / useCollisionExit](/api/use-collision) — callback-based hooks for individual contact events
- [useTriggerEnter / useTriggerExit](/api/use-trigger) — trigger overlap events
