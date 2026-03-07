# RigidBody

Makes an entity participate in physics. The physics system reads `RigidBody` and `Transform` components to simulate gravity, integrate velocity, and resolve collisions.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `mass` | number | `1` | Body mass — affects collision impulse magnitude |
| `gravityScale` | number | `1` | Multiplier on world gravity. Use `0` for top-down games. |
| `isStatic` | boolean | `false` | Immovable body. Physics cannot move it. Use for platforms, walls, floors. |
| `bounce` | number | `0` | Coefficient of restitution (0 = no bounce, 1 = perfect bounce) |
| `friction` | number | `0.85` | Horizontal velocity damping applied each frame when on the ground |
| `vx` | number | `0` | Initial horizontal velocity |
| `vy` | number | `0` | Initial vertical velocity |
| `lockX` | boolean | `false` | Freeze horizontal position — velocity is zeroed each frame and the entity cannot move left/right |
| `lockY` | boolean | `false` | Freeze vertical position — velocity is zeroed each frame and gravity is not applied |

## Runtime properties

These properties are set by the physics system each frame and can be read inside Scripts:

| Property | Type | Description |
|---|---|---|
| `rb.vx` | number | Current horizontal velocity |
| `rb.vy` | number | Current vertical velocity |
| `rb.onGround` | boolean | `true` if the entity collided with a solid surface from below this frame |
| `rb.isNearGround` | boolean | `true` if the entity is within ~2 px of solid ground even if not strictly touching. Useful for implementing coyote time. |

## Example

```tsx
// Dynamic physics body (player, enemy, projectile)
<RigidBody mass={1} gravityScale={1} friction={0.85} />

// Static body (platform, wall)
<RigidBody isStatic />

// Top-down (no gravity)
<RigidBody gravityScale={0} friction={0} />

// Bouncy ball
<RigidBody bounce={0.85} friction={0} />

// Endless-runner player — prevent horizontal drift while keeping vertical physics
<RigidBody lockX />

// Lock both axes — body participates in collision events but never moves
<RigidBody lockX lockY />
```

## Reading and writing velocity

Modify `vx` and `vy` directly inside a Script update:

```tsx
<Script update={(id, world, input) => {
  const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
  if (!rb) return

  rb.vx = input.isDown('ArrowLeft') ? -200 : input.isDown('ArrowRight') ? 200 : 0

  if (input.isPressed('Space') && rb.onGround) {
    rb.vy = -520  // jump
  }
}} />
```

## Coyote time with isNearGround

```tsx
<Script update={(id, world) => {
  const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  // Allow jumping for a couple of frames after walking off a ledge
  if (rb.isNearGround && input.isPressed('Space')) {
    rb.vy = -520
  }
}} />
```

## Notes

- `onGround` is reset to `false` every frame by the physics system and only set back to `true` if a downward collision is resolved in that frame.
- `isNearGround` is also `true` whenever `onGround` is true, so you can replace most `onGround` checks with `isNearGround` for more forgiving feel.
- Static bodies must also have a `BoxCollider` to participate in collision detection.
- The physics system runs at a fixed 60 Hz timestep. `vx` and `vy` are in pixels per second.
