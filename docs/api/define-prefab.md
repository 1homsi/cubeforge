# definePrefab

Registers a reusable entity template (prefab) and returns a React component that can be instantiated with optional prop overrides.

## Signature

```ts
function definePrefab<P extends object>(
  name: string,
  component: React.FC<P>,
): React.FC<Partial<P> & { id?: string }>
```

| Param | Type | Description |
|---|---|---|
| `name` | string | Unique name for the prefab, used for debugging and serialisation |
| `component` | `React.FC<P>` | A React component that describes the entity's default composition |

## Returns

A React component that accepts all of the original component's props as optional overrides, plus an `id` prop for the entity identifier.

## Example

```tsx
import { definePrefab, Entity, Transform, Sprite, RigidBody, BoxCollider } from 'cubeforge'

// Define a reusable crate prefab
const Crate = definePrefab('Crate', ({ x = 0, y = 0, size = 32 }: {
  x?: number
  y?: number
  size?: number
}) => (
  <Entity tags={['crate']}>
    <Transform x={x} y={y} />
    <Sprite src="/sprites/crate.png" width={size} height={size} />
    <RigidBody mass={2} />
    <BoxCollider width={size} height={size} />
  </Entity>
))

// Instantiate with defaults
<Crate id="crate1" x={200} y={400} />

// Override size
<Crate id="crate2" x={500} y={400} size={48} />

// Scatter many crates
{positions.map((pos, i) => (
  <Crate key={i} id={`crate-${i}`} x={pos.x} y={pos.y} />
))}
```

## Notes

- `definePrefab` is a convenience wrapper — under the hood it returns a standard React component with default props applied.
- The `name` parameter is stored on the entity's metadata for use with dev tools and scene serialisation.
- Prefabs compose with all existing components (`Script`, `Animation`, `CircleCollider`, etc.).
- Call `definePrefab` at module scope, not inside a render function.
