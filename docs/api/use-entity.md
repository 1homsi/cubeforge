# useEntity

Returns the numeric ECS entity ID for the current `<Entity>` context. Use this inside a component that is rendered as a child of `<Entity>` to access the entity's ID — for passing to hooks like `usePlatformerController` or reading component data via `useGame`.

## Signature

```ts
function useEntity(): EntityId
```

## Example

```tsx
import { useEntity, usePlatformerController } from 'cubeforge'

function PlayerController() {
  const id = useEntity()   // numeric ECS entity ID
  usePlatformerController(id, { speed: 220, jumpForce: -520 })
  return null
}

function Player() {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={100} y={300} />
      <Sprite width={32} height={48} color="#4fc3f7" />
      <RigidBody />
      <BoxCollider width={32} height={48} />
      <PlayerController />
    </Entity>
  )
}
```

## Reading component data

```tsx
function HealthDisplay() {
  const id = useEntity()
  const { ecs } = useGame()
  const [hp, setHp] = useState(100)

  useEffect(() => {
    const interval = setInterval(() => {
      const h = ecs.getComponent<{ type: 'Health'; current: number }>(id, 'Health')
      if (h) setHp(h.current)
    }, 100)
    return () => clearInterval(interval)
  }, [id, ecs])

  return <div>HP: {hp}</div>
}
```

## Notes

- Throws an error if called outside of an `<Entity>` context.
- The returned ID is a stable integer assigned when the entity is created. It does not change for the lifetime of the entity.
- Do not store the ID in state — it is always available synchronously via `useEntity()` in any child component.
