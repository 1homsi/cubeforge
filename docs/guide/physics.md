# Physics

Cubeforge uses a custom impulse-based 2D physics system with a sequential impulse constraint solver. It runs at a fixed 60 Hz timestep regardless of render frame rate, with a spatial broadphase grid for performance.

## RigidBody

Add `<RigidBody>` to an entity to make it participate in physics:

```tsx
<Entity id="player">
  <Transform x={100} y={300} />
  <RigidBody />
  <BoxCollider width={32} height={48} />
</Entity>
```

**Key props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `isStatic` | boolean | `false` | Immovable body — platforms, walls, floors |
| `isKinematic` | boolean | `false` | Kinematic body — moves via velocity, not affected by impulses |
| `gravityScale` | number | `1` | Multiplier on world gravity. Use `0` for top-down games. |
| `mass` | number | `0` | `0` = auto-compute from density × collider area |
| `density` | number | `1` | Used for auto mass computation |
| `lockRotation` | boolean | `true` | Lock angular velocity. Most 2D characters want this. |
| `restitution` | number | `0` | Bounciness (0–1) |
| `vx` | number | `0` | Initial horizontal velocity |
| `vy` | number | `0` | Initial vertical velocity |

## Collider friction and restitution

Friction and restitution are per-collider properties, not per-body:

```tsx
// Icy floor — low friction
<BoxCollider width={200} height={20} friction={0.1} />

// Bouncy wall
<BoxCollider width={20} height={200} restitution={0.8} />
```

Collider friction defaults to `0`. This means no solver friction is applied unless you explicitly set it. Most platformer characters control movement via Script (`rb.vx = SPEED`), so solver friction would fight that.

Set friction on surfaces (floors, walls) when you want physics-based deceleration:

```tsx
// Sticky floor that slows sliding objects
<BoxCollider width={800} height={32} friction={0.8} />
```

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

## Top-down movement

For top-down games, disable gravity per-entity with `gravityScale={0}`:

```tsx
<Entity id="player">
  <Transform x={100} y={100} />
  <RigidBody gravityScale={0} />
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

`<BoxCollider layer="...">` groups colliders into named layers. Use `mask` to control which layers a collider interacts with:

```tsx
// Player collides with everything
<BoxCollider width={32} height={48} layer="player" />

// Enemy only collides with player and world layers
<BoxCollider width={32} height={32} layer="enemy" mask={['player', 'world']} />
```

## Broadphase grid

The physics broadphase uses a 128-pixel cell spatial grid. Only entities in the same or adjacent cells are compared in the narrow phase. This keeps collision checks efficient for large worlds without manual spatial partitioning.
