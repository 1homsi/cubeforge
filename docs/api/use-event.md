# useEvent

Subscribes to an engine event with automatic cleanup on component unmount. Must be called inside a `<Game>` descendant.

## Signature

```ts
function useEvent<T>(event: string, handler: (data: T) => void): void
```

## Example

```tsx
import { useEvent } from 'cubeforge'

function ScoreTracker({ onScore }: { onScore: (n: number) => void }) {
  useEvent<{ amount: number }>('coin-collected', ({ amount }) => {
    onScore(prev => prev + amount)
  })
  return null
}
```

## Common events

These events are emitted by the engine:

| Event | Payload | Description |
|---|---|---|
| `'trigger'` | `{ a: number, b: number }` | Two entities' colliders overlapped — `a` and `b` are entity IDs |

You can emit custom events from Scripts using the EventBus:

```tsx
<Script update={(id, world, input, dt) => {
  // ...
}} init={(id, world) => {
  // access events via useGame in a component, or capture from closure
}} />
```

## Emitting events from Scripts

To emit events from inside a Script, capture the EventBus via closure:

```tsx
function Player() {
  const { events } = useGame()

  return (
    <Script update={(id, world, input) => {
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
      if (!rb) return
      if (rb.vy > 800) {
        events.emit('player-fell', { entityId: id })
      }
    }} />
  )
}
```

Then receive it anywhere:

```tsx
useEvent<{ entityId: number }>('player-fell', ({ entityId }) => {
  setLives(l => l - 1)
})
```

## useEvents (raw EventBus)

If you need the raw `EventBus` (to manually subscribe and unsubscribe), use `useEvents`:

```ts
function useEvents(): EventBus
```

```tsx
const events = useEvents()

useEffect(() => {
  const unsub = events.on<{ amount: number }>('score-update', ({ amount }) => {
    setScore(s => s + amount)
  })
  return unsub  // cleanup on unmount
}, [events])
```

## Notes

- `useEvent` handles the `useEffect` and cleanup automatically — prefer it over raw `useEvents` for most cases.
- The `handler` function is re-registered if `event` changes between renders. Keep it stable with `useCallback` if the handler closes over state.
- Events are synchronous — the handler runs inline when `events.emit()` is called.
