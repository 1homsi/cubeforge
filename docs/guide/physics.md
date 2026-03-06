# Physics

Cubeforge uses a custom AABB (axis-aligned bounding box) physics system. It runs at a fixed 60 Hz timestep regardless of render frame rate, with a spatial broadphase grid for performance.

## RigidBody

Add `<RigidBody>` to an entity to make it participate in physics:

```tsx
<Entity id="player">
  <Transform x={100} y={300} />
  <RigidBody gravityScale={1} friction={0.85} bounce={0} />
  <BoxCollider width={32} height={48} />
</Entity>
```

**Key props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `isStatic` | boolean | `false` | Immovable body — platforms, walls, floors |
| `gravityScale` | number | `1` | Multiplier on world gravity. Use `0` for top-down games. |
| `mass` | number | `1` | Affects collision response |
| `friction` | number | `0.85` | Horizontal velocity damping when on the ground (0–1) |
| `bounce` | number | `0` | Coefficient of restitution — 0 is no bounce, 1 is full |
| `vx` | number | `0` | Initial horizontal velocity |
| `vy` | number | `0` | Initial vertical velocity |

## Static bodies

Set `isStatic` for any entity that should never move — platforms, walls, ground:

```tsx
<Entity tags={['ground']}>
  <Transform x={400} y={480} />
  <Sprite width={800} height={32} color="#37474f" />
  <RigidBody isStatic />
  <BoxCollider width={800} height={32} />
</Entity>
```

Static bodies participate in collision detection but are never moved by the physics solver.

## Checking onGround

`rb.onGround` is `true` when the entity is resting on a solid surface. Use it to gate jumps:

```tsx
<Script update={(id, world, input) => {
  const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
  if (!rb) return
  if (input.isPressed('Space') && rb.onGround) {
    rb.vy = -520
  }
}} />
```

`onGround` resets to `false` every frame and is set back to `true` by the physics system if a downward collision was resolved.

## Coyote time with isNearGround

`rb.isNearGround` is `true` whenever the entity is within ~2 px of solid ground — even if `onGround` is `false` (e.g. the first frame after walking off a ledge). Use it to implement forgiving coyote-time jumps without manual frame-counting:

```tsx
<Script update={(id, world, input) => {
  const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  if (input.isPressed('Space') && rb.isNearGround) {
    rb.vy = -520
  }
}} />
```

## Slopes

Add a `slope` prop to `<BoxCollider>` to create a ramp. The value is the surface angle in degrees; positive = rises left to right:

```tsx
<Entity tags={['ramp']}>
  <Transform x={300} y={400} />
  <Sprite width={200} height={40} color="#795548" />
  <RigidBody isStatic />
  <BoxCollider width={200} height={40} slope={30} />
</Entity>
```

Slope colliders:
- Are skipped during the X-pass so entities can smoothly walk up/down them
- Push the riding entity up to the surface line in the Y-pass
- Set `onGround = true` on the riding entity, applying normal friction

## Top-down movement

For top-down games, disable gravity per-entity with `gravityScale={0}`:

```tsx
<Entity id="player">
  <Transform x={100} y={100} />
  <RigidBody gravityScale={0} friction={0} />
  <BoxCollider width={24} height={24} />
</Entity>
```

Then use `useTopDownMovement` or set `rb.vx`/`rb.vy` directly in a Script.

## Triggers

Set `isTrigger` on a `<BoxCollider>` to create a zone that fires an event without blocking movement:

```tsx
<Entity>
  <Transform x={500} y={400} />
  <BoxCollider width={64} height={64} isTrigger />
</Entity>
```

When another entity's collider overlaps a trigger, the physics system emits a `trigger` event on the `EventBus`:

```tsx
const { events } = useGame()
useEffect(() => {
  return events.on<{ a: number; b: number }>('trigger', ({ a, b }) => {
    console.log('overlap between entities', a, 'and', b)
  })
}, [events])
```

Or use the `useEvent` hook for automatic cleanup:

```tsx
useEvent<{ a: number; b: number }>('trigger', ({ a, b }) => {
  // handle trigger overlap
})
```

## Fixed timestep

The physics system runs at exactly 60 steps per second, regardless of render FPS. If a frame takes 32ms (i.e. 30 FPS), the physics system runs two 16ms steps. This keeps physics deterministic and prevents tunneling at low frame rates.

## Collision layers

`<BoxCollider layer="...">` groups colliders into named layers. By default all colliders are in the `"default"` layer. The current physics system resolves all colliders — layer-based filtering is reserved for trigger event identification and tilemap generation.

## Broadphase grid

The physics broadphase uses a 128-pixel cell spatial grid. Only entities in the same or adjacent cells are compared in the narrow phase. This keeps collision checks efficient for large worlds without manual spatial partitioning.
