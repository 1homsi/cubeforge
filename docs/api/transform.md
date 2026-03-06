# Transform

Defines an entity's position, rotation, and scale in world space. Required by both the physics system and the render system — any entity that moves or renders needs a Transform.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `x` | number | `0` | Horizontal position in world pixels (right is positive) |
| `y` | number | `0` | Vertical position in world pixels (down is positive) |
| `rotation` | number | `0` | Rotation in radians |
| `scaleX` | number | `1` | Horizontal scale factor |
| `scaleY` | number | `1` | Vertical scale factor |

## Example

```tsx
<Entity>
  <Transform x={200} y={300} rotation={0} scaleX={1} scaleY={1} />
  <Sprite width={32} height={32} color="#ff6b35" />
</Entity>
```

## Reading and writing Transform in a Script

Transform values are stored as a mutable `TransformComponent`. Read and modify them directly inside Script update functions:

```tsx
<Script update={(id, world, input, dt) => {
  const t = world.getComponent<TransformComponent>(id, 'Transform')
  if (!t) return

  // Manual movement without physics
  if (input.isDown('ArrowRight')) t.x += 200 * dt
  if (input.isDown('ArrowLeft'))  t.x -= 200 * dt

  // Rotate entity
  t.rotation += 1 * dt
}} />
```

## Coordinate system

- `x` increases rightward
- `y` increases downward (canvas coordinate system)
- Rotation is in radians, clockwise

## Prop sync

If you pass `x` or `y` as React props (e.g. from state), changes are synced to the ECS component each render. However, for physics-driven entities, the physics system overwrites `x` and `y` every frame — external prop changes won't have visible effect until physics is paused or the entity is static.

For moving a physics entity externally, set `vx`/`vy` on the `RigidBody` rather than the Transform position directly.
