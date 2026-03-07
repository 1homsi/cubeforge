# useDamageZone

Makes the current entity deal damage to any entity that enters its trigger zone. The target entity must be using `useHealth` to receive the damage.

## Signature

```ts
function useDamageZone(damage: number, opts?: DamageZoneOpts): void
```

## Options

| Option | Type | Description |
|---|---|---|
| `tag` | string | Only damage entities with this tag |
| `layer` | string | Only damage entities with this collider layer |

## Example

```tsx
import { useDamageZone } from 'cubeforge'

// A lava pool — deals 1 damage to anything tagged 'player' that enters
function LavaPool({ x, y }: { x: number; y: number }) {
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite width={200} height={20} color="#ef5350" />
      <BoxCollider width={200} height={20} isTrigger />
      <LavaDamage />
    </Entity>
  )
}

function LavaDamage() {
  useDamageZone(1, { tag: 'player' })
  return null
}
```

## How it works

`useDamageZone` registers a `useTriggerEnter` handler. On contact, it emits a `damage:<entityId>` event on the engine EventBus. `useHealth` on the other entity listens for that event and calls `takeDamage` automatically.

This means the damage zone and the health component are fully decoupled — the damage zone doesn't import or reference the player component at all.

## Notes

- The entity must have a `<BoxCollider isTrigger>`.
- The damaged entity must be using `useHealth`.
- Must be used inside `<Entity>` and `<Game>`.
- For continuous damage (e.g. lava deals 1 HP per second), set a high `iFrames` value on `useHealth` or use a `createTimer` in a Script to control the rate.

## See also

- [useHealth](/api/use-health) — HP and i-frame management on the receiving entity
- [useTriggerEnter / useTriggerExit](/api/use-trigger) — raw trigger contact events
