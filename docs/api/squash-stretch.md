# SquashStretch

Adds automatic squash-and-stretch to an entity based on its velocity. When the entity moves fast vertically, the sprite stretches in the direction of motion and squashes on the perpendicular axis, then springs back to normal. This is a visual-only effect.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `intensity` | number | `0.2` | Maximum squash/stretch amount. Higher values are more dramatic. |
| `recovery` | number | `8` | How quickly the sprite returns to normal scale (lerp speed). Higher = snappier. |

## Example

```tsx
<Entity id="player">
  <Transform x={100} y={300} />
  <Sprite width={32} height={48} color="#4fc3f7" />
  <RigidBody />
  <BoxCollider width={32} height={48} />
  <SquashStretch intensity={0.25} recovery={10} />
</Entity>
```

## How it works

Each frame, the render system reads the entity's `RigidBody.vy` and applies a scale offset:

- Moving down fast → stretch tall (scaleY > 1, scaleX < 1)
- Moving up fast → stretch tall upward
- Landing (vy goes from negative to onGround) → squash wide momentarily
- `recovery` lerps `currentScaleX` and `currentScaleY` back toward `1.0` each frame

The resulting scale is composed with the entity's Transform scale before drawing.

## Tuning guide

| intensity | Effect |
|---|---|
| `0.1` | Subtle, barely noticeable |
| `0.2` | Natural, game-feel standard |
| `0.35` | Exaggerated, cartoon-style |

| recovery | Effect |
|---|---|
| `4` | Slow, bouncy return |
| `8` | Natural spring-back |
| `14` | Almost instant snap |

## Notes

- `<SquashStretch>` reads `RigidBody.vy` — the entity must have a `<RigidBody>` for the effect to work.
- The effect modifies `Transform.scaleX` and `scaleY` each frame. Avoid also manually setting these from a Script unless you compose the values.
- Does not affect the `BoxCollider` hitbox — only the visual sprite.
