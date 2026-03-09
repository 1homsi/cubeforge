# useParent

Returns the parent entity's ID when called inside a nested `<Entity>`. Useful for hierarchy systems where child entities need to reference or interact with their parent.

## Signature

```ts
function useParent(): EntityId | null
```

## Returns

| Value | Description |
|---|---|
| `EntityId` | The numeric entity ID of the parent entity |
| `null` | The entity has no parent (it is a root entity) |

## Example

```tsx
import { Entity, Transform, Sprite, Script, useParent } from 'cubeforge'

function Turret() {
  const parentId = useParent()

  return (
    <Entity>
      <Transform x={0} y={-20} />
      <Sprite width={12} height={20} color="#f44" />
      <Script
        update={(id, world, input, dt) => {
          if (parentId == null) return
          const parentTx = world.getComponent(parentId, 'Transform')
          // aim relative to parent position
        }}
      />
    </Entity>
  )
}

function Tank({ x, y }: { x: number; y: number }) {
  return (
    <Entity id="tank">
      <Transform x={x} y={y} />
      <Sprite width={40} height={24} color="#4a7" />
      <Turret />
    </Entity>
  )
}
```

## Notes

- `useParent` must be called inside a component rendered within a nested `<Entity>`.
- Returns `null` for top-level entities that have no parent.
- Works together with the `HierarchySystem` to propagate world transforms from parent to child.
