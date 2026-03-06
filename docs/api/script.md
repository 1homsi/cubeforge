# Script

Attaches per-entity logic that runs every frame. The Script system calls your `update` function after a fixed-timestep physics tick, passing the entity ID, ECS world, input manager, and delta time.

## Props

| Prop | Type | Description |
|---|---|---|
| `update` | `(id, world, input, dt) => void` | **Required.** Called every frame. |
| `init` | `(id, world) => void` | Called once when the entity mounts. Use to attach additional ECS components. |

## Callback signature

```ts
update(
  id:    EntityId,     // numeric ECS entity ID
  world: ECSWorld,     // query, read, write components
  input: InputManager, // keyboard and mouse state
  dt:    number,       // delta time in seconds (typically ~0.016)
): void
```

## Example

```tsx
<Script
  init={(id, world) => {
    // Attach custom data once
    world.addComponent(id, { type: 'Health', current: 100, max: 100 })
  }}
  update={(id, world, input, dt) => {
    if (!world.hasEntity(id)) return

    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
    if (!rb) return

    // Horizontal movement
    if (input.isDown('ArrowLeft'))       rb.vx = -200
    else if (input.isDown('ArrowRight')) rb.vx =  200
    else                                 rb.vx *= 0.8

    // Jump
    if (input.isPressed('Space') && rb.onGround) rb.vy = -520
  }}
/>
```

## Querying other entities

Inside `update`, use `world.query()` to read or modify other entities:

```tsx
<Script update={(id, world) => {
  const enemies = world.query('Tag')
  for (const eid of enemies) {
    const tag = world.getComponent<{ type: 'Tag'; tags: string[] }>(eid, 'Tag')
    if (!tag?.tags.includes('enemy')) continue
    const t = world.getComponent<TransformComponent>(eid, 'Transform')
    if (!t) continue
    // chase logic
  }
}} />
```

## Multiple Scripts per entity

You can add multiple `<Script>` components to the same entity. Each registers its own ECS script component. However, only the last one registered is stored (the ECS stores one component per type per entity). For multiple update functions, compose them into a single update callback, or use the `init` / closure pattern.

## Keeping state between frames

Use closure variables — they persist across frames since the callback is set up once in `useEffect`:

```tsx
function Enemy() {
  const patrolState = useRef({ direction: 1, timer: 0 })

  return (
    <Script update={(id, world, input, dt) => {
      const state = patrolState.current
      state.timer += dt
      if (state.timer > 2) {
        state.direction *= -1
        state.timer = 0
      }
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
      if (rb) rb.vx = state.direction * 80
    }} />
  )
}
```

## Notes

- Avoid capturing stale React state in the `update` closure — use `useRef` for values that change over time.
- Errors in `update` do not crash the game loop. Errors in `init` are caught and logged.
- The `update` function is registered once on mount. Passing a new function reference via re-render does not update the registered callback — use `useRef` if you need the latest value.
