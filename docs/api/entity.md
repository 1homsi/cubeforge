# Entity

Creates an ECS entity. Child components (Transform, Sprite, RigidBody, etc.) attach themselves to this entity. When the component unmounts, the entity and all its components are automatically destroyed.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | string | — | Optional string identifier. Other components can reference this entity by ID (e.g. `Camera2D.followEntity`). Must be unique across all live entities. |
| `tags` | string[] | `[]` | Tags for grouping and querying. Stored as a `Tag` component. |
| `children` | ReactNode | — | Component children (Transform, Sprite, Script, etc.) |

## Example

```tsx
<Entity id="player" tags={['player', 'hero']}>
  <Transform x={100} y={300} />
  <Sprite width={32} height={48} color="#4fc3f7" />
  <RigidBody />
  <BoxCollider width={32} height={48} />
  <Script update={playerUpdate} />
</Entity>
```

## Looking up entities by ID

The `id` string maps to a numeric ECS entity ID. You can retrieve it via the engine:

```tsx
const { entityIds, ecs } = useGame()
const playerId = entityIds.get('player')
if (playerId !== undefined) {
  const transform = ecs.getComponent<TransformComponent>(playerId, 'Transform')
}
```

## Querying by tag

Inside a Script or `useGame`, query entities with a specific tag:

```tsx
const tagged = world.query('Tag')
for (const eid of tagged) {
  const tag = world.getComponent<{ type: 'Tag'; tags: string[] }>(eid, 'Tag')
  if (tag?.tags.includes('enemy')) {
    // process enemy
  }
}
```

## Notes

- Duplicate string IDs log a warning and replace the previous mapping.
- Entity IDs are monotonically increasing integers. After `reset()`, they restart from 0.
- Child components render as `null` — they only register ECS data via `useEffect`.
