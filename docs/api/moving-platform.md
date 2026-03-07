# MovingPlatform

A pre-built composite component that creates a static platform oscillating between two points. Internally it combines `Entity`, `Transform`, `Sprite`, `RigidBody`, `BoxCollider`, and `Script`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `x1` | number | — | **Required.** Start position X |
| `y1` | number | — | **Required.** Start position Y |
| `x2` | number | — | **Required.** End position X |
| `y2` | number | — | **Required.** End position Y |
| `width` | number | `120` | Platform width in pixels |
| `height` | number | `18` | Platform height in pixels |
| `duration` | number | `3` | Seconds for a full round trip |
| `color` | string | `'#37474f'` | Platform fill colour |

## Example

```tsx
{/* Horizontal platform */}
<MovingPlatform x1={200} y1={350} x2={450} y2={350} width={120} duration={2.5} />

{/* Vertical lift */}
<MovingPlatform x1={600} y1={200} x2={600} y2={400} width={80} duration={4} />

{/* Diagonal */}
<MovingPlatform x1={100} y1={300} x2={400} y2={150} width={100} duration={3} color="#546e7a" />
```

## Motion curve

The platform uses a sine wave for smooth easing between endpoints. At `t=0` it sits at `(x1, y1)`, accelerates toward `(x2, y2)`, and eases back — no abrupt direction changes.

Position at time `t`:
```
alpha = (sin(phase) + 1) / 2   // 0..1
x = x1 + (x2 - x1) * alpha
y = y1 + (y2 - y1) * alpha
```

## Player interaction

The platform is a static `RigidBody` with a `BoxCollider`. The physics system tracks the platform's position delta each fixed step. When a dynamic entity lands on the platform, its position is shifted by the platform's movement that step — horizontal movement is always carried; upward vertical movement is also applied, while downward movement lets gravity keep the entity grounded.

No special code is needed in your player script for carry to work.

## Notes

- The platform is `isStatic=true` — it is not affected by gravity or other collisions.
- Phase state is stored per entity in a module-level `Map`, so multiple instances are independent.
- To stop the platform, unmount the component. To pause it, conditionally render with `duration={Infinity}` (it will stop at the current position).
