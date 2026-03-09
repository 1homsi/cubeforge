# useLocalMultiplayer

Returns an array of `PlayerInput` objects for local multiplayer. Each player gets their own action bindings, allowing multiple players to share the same keyboard or mix keyboard and gamepad inputs.

## Usage

```tsx
import { useLocalMultiplayer } from 'cubeforge'

const [p1, p2] = useLocalMultiplayer([
  { jump: 'Space', left: 'ArrowLeft', right: 'ArrowRight' },
  { jump: 'KeyW',  left: 'KeyA',      right: 'KeyD' },
])
```

## Signature

```ts
function useLocalMultiplayer(
  bindingsPerPlayer: ActionBindings[]
): PlayerInput[]
```

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `bindingsPerPlayer` | `ActionBindings[]` | Array of binding objects, one per player. Each maps action names to key codes (or arrays of key codes). |

### ActionBindings

```ts
type ActionBindings = Record<string, string | string[] | AxisBinding>
```

Each key is an action name. Each value can be:

- A single key code string (e.g. `'Space'`)
- An array of key code strings (e.g. `['Space', 'ArrowUp']`)
- An `AxisBinding` object (`{ positive: string, negative: string }`)

## Return value

`PlayerInput[]` — one object per player, in the same order as the bindings array.

### PlayerInput

| Method | Signature | Description |
|---|---|---|
| `playerId` | `number` | 1-based player index |
| `isDown` | `(key: string) => boolean` | Whether a raw key is currently held |
| `isPressed` | `(key: string) => boolean` | Whether a raw key was just pressed this frame |
| `isReleased` | `(key: string) => boolean` | Whether a raw key was just released this frame |
| `getAxis` | `(pos: string, neg: string) => number` | Raw axis value from two keys (-1 to 1) |
| `isActionDown` | `(action: string) => boolean` | Whether a named action is currently held |
| `isActionPressed` | `(action: string) => boolean` | Whether a named action was just pressed this frame |
| `isActionReleased` | `(action: string) => boolean` | Whether a named action was just released this frame |

## Example

```tsx
import { Entity, Transform, Sprite, Script, useLocalMultiplayer } from 'cubeforge'

function TwoPlayerGame() {
  const [p1, p2] = useLocalMultiplayer([
    { jump: 'ArrowUp', left: 'ArrowLeft', right: 'ArrowRight', attack: 'Slash' },
    { jump: 'KeyW',    left: 'KeyA',      right: 'KeyD',       attack: 'KeyF' },
  ])

  return (
    <>
      <Player x={200} y={400} input={p1} color="#4fc3f7" />
      <Player x={600} y={400} input={p2} color="#f44336" />
    </>
  )
}

function Player({ x, y, input, color }) {
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite width={32} height={48} color={color} />
      <Script update={(id, world) => {
        const t = world.getComponent(id, 'Transform')
        if (input.isActionDown('left'))  t.x -= 3
        if (input.isActionDown('right')) t.x += 3
        if (input.isActionPressed('jump')) {
          const rb = world.getComponent(id, 'RigidBody')
          if (rb) rb.velocityY = -400
        }
      }} />
    </Entity>
  )
}
```

## See also

- [useInputMap](/api/use-input-map) — single-player named action bindings
- [usePlayerInput](/api/use-player-input) — per-player input with gamepad support
- [createInputMap](/api/create-input-map) — the underlying utility
