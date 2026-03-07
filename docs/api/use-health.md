# useHealth

Manages entity HP, invincibility frames, and integrates with `useDamageZone` via the engine EventBus. Must be used inside `<Entity>`.

## Signature

```ts
function useHealth(maxHp: number, opts?: HealthOptions): HealthControls
```

## HealthOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `iFrames` | number | `1.0` | Invincibility window in seconds after taking damage. Set `0` to disable. |
| `onDeath` | `() => void` | — | Called when HP reaches 0 |
| `onDamage` | `(amount, currentHp) => void` | — | Called each time damage is dealt (after i-frame check) |

## HealthControls

| Property / Method | Type | Description |
|---|---|---|
| `hp` | number | Current HP |
| `maxHp` | number | Max HP set at creation |
| `isDead` | boolean | `true` when HP is 0 |
| `isInvincible` | boolean | `true` during the i-frame window |
| `takeDamage(amount?)` | `(n?: number) => void` | Deal damage (default 1). No-op while invincible or dead. |
| `heal(amount)` | `(n: number) => void` | Restore HP, clamped to `maxHp` |
| `setHp(hp)` | `(n: number) => void` | Set HP directly, clamped to `[0, maxHp]` |
| `update(dt)` | `(dt: number) => void` | Advance the i-frame timer — call from a `Script` `update` each frame |

## Example

```tsx
import { useHealth, useDamageZone, Script } from 'cubeforge'

function Player() {
  const health = useHealth(3, {
    iFrames: 1.5,
    onDeath: () => gameEvents.onPlayerDeath?.(),
    onDamage: (amt, hp) => console.log(`took ${amt} dmg, ${hp} left`),
  })

  return (
    <Entity id="player" tags={['player']}>
      <Transform x={100} y={400} />
      <Sprite width={30} height={42} color="#4fc3f7" />
      <RigidBody />
      <BoxCollider width={28} height={42} />
      <Script update={(id, world, input, dt) => {
        health.update(dt)
        if (health.isDead) respawn()
      }} />
    </Entity>
  )
}
```

## How damage routing works

`useHealth` listens on the engine EventBus for a `damage:<entityId>` event. `useDamageZone` emits that event when the trigger fires. This means damage zones and health components work across entity boundaries with no direct coupling — the entity with `useHealth` doesn't need to know about the damage zone, and vice versa.

You can also deal damage directly:

```tsx
// From a Script update function:
health.takeDamage(2)

// Or emit the event from anywhere you have access to the engine:
engine.events.emit(`damage:${playerId}`, { amount: 1 })
```

## See also

- [useDamageZone](/api/use-damage-zone) — make an entity a damage zone
- [createTimer](/api/create-timer) — for cooldown / timer patterns in Script updates
