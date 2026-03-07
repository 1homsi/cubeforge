# Multiplayer

`@cubeforge/net` provides transport-agnostic helpers for building multiplayer games. It does not dictate a networking backend — you bring your own WebSocket, WebRTC, or any other transport.

## Install

```bash
bun add @cubeforge/net
# or
npm install @cubeforge/net
```

## Concepts

| Helper | Purpose |
|---|---|
| `createWebSocketTransport` | Wraps a WebSocket into a `NetTransport` |
| `Room` | Connection lifecycle, message routing, peer tracking |
| `syncEntity` | Broadcasts component state from owner → receivers each tick |
| `useNetworkInput` | Collects local key state, broadcasts at ~20 Hz, accumulates remote inputs |
| `ClientPrediction` | Snapshot-based rollback for client prediction |

## Quick start — syncing a player entity

```tsx
import { createWebSocketTransport, Room, syncEntity } from '@cubeforge/net'
import { useEffect } from 'react'
import { useGame, useEntity } from 'cubeforge'

function NetworkedPlayer() {
  const { ecs } = useGame()
  const id = useEntity()

  useEffect(() => {
    const transport = createWebSocketTransport('wss://your-server.com/game')
    const room = new Room({ transport, roomId: 'level-1', peerId: 'player-1' })
    room.connect()

    const stopSync = syncEntity({
      room,
      world: ecs,
      entityId: id,
      components: ['Transform', 'RigidBody'],
      isOwner: true,
      tickRate: 20,
    })

    return () => {
      stopSync()
      room.disconnect()
    }
  }, [])

  return null
}
```

Remote peers call `syncEntity` with `isOwner: false` to receive and apply the state.

## Transport interface

Any object implementing `NetTransport` works:

```ts
interface NetTransport {
  send(data: string): void
  onMessage(handler: (data: string) => void): () => void
  onOpen(handler: () => void): () => void
  onClose(handler: () => void): () => void
  close(): void
}
```

## `Room`

Manages connection lifecycle and JSON-framed messages:

```ts
const room = new Room({ transport, roomId: 'game-1', peerId: 'p1' })
room.connect()

room.onMessage((msg) => {
  console.log(msg.type, msg.peerId, msg.payload)
})

room.send({ type: 'shoot', payload: { x: 100, y: 200 } })
room.broadcast({ type: 'jump' })

room.disconnect()
```

## `syncEntity`

Marks which components to replicate. The owner peer broadcasts the component data at `tickRate` Hz. Receivers apply incoming data via `Object.assign` onto the existing ECS component objects.

```ts
const stop = syncEntity({
  room,
  world,
  entityId: id,
  components: ['Transform', 'Sprite'],
  isOwner: true,     // false on remote peers
  tickRate: 20,      // Hz (default 20)
})

stop() // call to remove listeners
```

## `useNetworkInput`

Broadcasts local key state and accumulates remote player inputs:

```tsx
import { useNetworkInput } from '@cubeforge/net'

const { localInput, remoteInputs } = useNetworkInput({
  room,
  keys: ['ArrowLeft', 'ArrowRight', 'Space'],
})

// localInput.ArrowLeft — boolean, true while held
// remoteInputs['player-2'].Space — remote peer's key state
```

## `ClientPrediction`

Snapshot-based rollback using `world.getSnapshot()` / `world.restoreSnapshot()`:

```ts
import { ClientPrediction } from '@cubeforge/net'

const prediction = new ClientPrediction(world, 60) // 60-frame buffer

// In your game loop:
prediction.saveFrame(frameNumber)

// On receiving a correction from the server:
prediction.applyCorrection(serverSnapshot, frameNumber)
// This rolls back to the corrected frame and re-runs forward
```

## Notes

- `@cubeforge/net` works best with `<Game deterministic seed={n} />` — deterministic physics makes rollback reliable.
- The package is transport-agnostic. It works with WebSockets, WebRTC data channels, Partykit, or any service that can `send` and `receive` strings.
- `syncEntity` uses `Object.assign` instead of `addComponent`, so existing ECS component references stay valid on receivers.
