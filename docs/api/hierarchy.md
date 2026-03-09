# Hierarchy

Utilities for building parent-child entity relationships. The `HierarchySystem` automatically propagates world transforms from parent to child each frame.

## API

```ts
import { createHierarchy, setParent, removeParent, getDescendants } from 'cubeforge'
```

| Function | Signature | Description |
|---|---|---|
| `createHierarchy` | `() => HierarchyPlugin` | Returns a plugin that enables the hierarchy system. Pass it to `<Game plugins={[...]}>` |
| `setParent` | `(world: ECSWorld, child: EntityId, parent: EntityId) => void` | Make `child` a child of `parent` |
| `removeParent` | `(world: ECSWorld, child: EntityId) => void` | Detach `child` from its parent |
| `getDescendants` | `(world: ECSWorld, parent: EntityId) => EntityId[]` | Return all descendants (children, grandchildren, etc.) |

## Example

```tsx
import { createHierarchy, setParent, getDescendants } from 'cubeforge'
import { Entity, Transform, Sprite, Script, Game, World } from 'cubeforge'

const hierarchyPlugin = createHierarchy()

function Shoulder({ x, y }: { x: number; y: number }) {
  return (
    <Entity id="shoulder">
      <Transform x={x} y={y} />
      <Sprite width={12} height={12} color="#888" />
      <Entity id="arm">
        <Transform x={14} y={0} />
        <Sprite width={20} height={8} color="#aaa" />
      </Entity>
    </Entity>
  )
}

function App() {
  return (
    <Game plugins={[hierarchyPlugin]}>
      <World>
        <Shoulder x={200} y={200} />
      </World>
    </Game>
  )
}
```

### Imperative usage in a Script

```tsx
<Script
  init={(id, world) => {
    const weaponId = world.entityIds.get('weapon')
    if (weaponId != null) {
      setParent(world, weaponId, id)
    }
  }}
/>
```

## Notes

- The `HierarchySystem` runs before the render pass so that child world transforms are up to date when drawn.
- `getDescendants` performs a depth-first traversal and returns IDs in top-down order.
- Removing a parent does not destroy the child — it becomes a root entity with its current world transform preserved as its local transform.
- Nested `<Entity>` elements inside JSX automatically call `setParent` on mount when the hierarchy plugin is active.
