# RigidBody

Makes an entity participate in physics. The physics system reads `RigidBody` and `Transform` components to simulate gravity, integrate velocity, and resolve collisions using a sequential impulse constraint solver.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `mass` | number | `0` | Explicit mass override. `0` = auto-compute from collider density × area. |
| `density` | number | `1` | Density for auto mass computation (mass = density × collider area) |
| `gravityScale` | number | `1` | Multiplier on world gravity. Use `0` for top-down games. |
| `isStatic` | boolean | `false` | Immovable body. Physics cannot move it. Use for platforms, walls, floors. |
| `isKinematic` | boolean | `false` | Kinematic bodies skip gravity/integration but resolve collisions without responding to impulses. |
| `restitution` | number | `0` | Coefficient of restitution (0 = no bounce, 1 = perfect bounce) |
| `friction` | number | `0.85` | **Deprecated** — use `friction` on BoxCollider instead. Kept for backward compat. |
| `bounce` | number | `0` | **Deprecated** — use `restitution` on BoxCollider instead. |
| `vx` | number | `0` | Initial horizontal velocity |
| `vy` | number | `0` | Initial vertical velocity |
| `lockX` | boolean | `false` | Freeze horizontal position — velocity is zeroed each frame |
| `lockY` | boolean | `false` | Freeze vertical position — gravity is not applied |
| `lockRotation` | boolean | `true` | Lock rotation — angular velocity is always 0. Most 2D games want this. Set `false` for bodies that should spin (balls, debris). |
| `ccd` | boolean | `false` | Enable continuous collision detection to prevent tunneling through thin colliders |
| `angularVelocity` | number | `0` | Angular velocity in radians per second |
| `angularDamping` | number | `0` | Angular damping (0–1): fraction of angular velocity removed each fixed step |
| `linearDamping` | number | `0` | Linear damping (0–1): velocity reduction applied every fixed step — acts as air resistance |
| `dominance` | number | `0` | Dominance group (-127 to 127). Higher dominance acts as infinite mass in contacts. |

## Runtime properties

These properties are set by the physics system each frame and can be read inside Scripts:

| Property | Type | Description |
|---|---|---|
| `rb.vx` | number | Current horizontal velocity |
| `rb.vy` | number | Current vertical velocity |
| `rb.onGround` | boolean | `true` if the entity collided with a solid surface from below this frame |
| `rb.isNearGround` | boolean | `true` if the entity is within ~2 px of solid ground even if not strictly touching. Useful for implementing coyote time. |
| `rb.angularVelocity` | number | Current angular velocity in radians per second. Set it in scripts to spin entities. |
| `rb.sleeping` | boolean | Whether this body is sleeping (skipped in physics). Disabled by default. |

## Example

```tsx
// Dynamic physics body (player, enemy, projectile)
<RigidBody />

// Static body (platform, wall)
<RigidBody isStatic />

// Top-down (no gravity)
<RigidBody gravityScale={0} />

// Bouncy ball that spins
<RigidBody lockRotation={false} />

// Endless-runner player — prevent horizontal drift while keeping vertical physics
<RigidBody lockX />

// Lock both axes — body participates in collision events but never moves
<RigidBody lockX lockY />

// Spinning projectile with air resistance
<RigidBody lockRotation={false} angularVelocity={6} angularDamping={0.02} linearDamping={0.01} />

// Floaty top-down character with air drag
<RigidBody gravityScale={0} linearDamping={0.1} />

// Heavy body that dominates contacts (pushes everything)
<RigidBody dominance={10} />
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

## Mass computation

When `mass` is `0` (default), mass is auto-computed from `density × collider area`. For a 32×48 BoxCollider with density 1, mass = 1536. Gravity acceleration is independent of mass (heavier bodies feel the same gravity), but mass affects collision impulse magnitude — heavier bodies push lighter ones more.

Set `mass` explicitly if you need a specific value:

```tsx
<RigidBody mass={10} />
```

## Notes

- `onGround` is reset to `false` every frame by the physics system and only set back to `true` if a downward collision is resolved in that frame.
- `isNearGround` is also `true` whenever `onGround` is true, so you can replace most `onGround` checks with `isNearGround` for more forgiving feel.
- Static bodies must also have a collider (BoxCollider, CircleCollider, etc.) to participate in collision detection.
- The physics system runs at a fixed 60 Hz timestep. `vx` and `vy` are in pixels per second.
- `lockRotation` defaults to `true` because most 2D game characters should not rotate. Set `lockRotation={false}` for balls, debris, or ragdoll-like objects.
- Sleep is disabled by default (sleepThreshold=0). Enable it for scenes with many resting bodies to improve performance.
