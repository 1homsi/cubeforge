# useProfiler

Returns live performance data from the engine. Useful for debugging performance bottlenecks or building an in-game FPS counter. Updates every 500 ms to avoid excessive re-renders.

## Signature

```ts
function useProfiler(): ProfilerData
```

## ProfilerData

| Property | Type | Description |
|---|---|---|
| `fps` | `number` | Frames per second (averaged over the last 500 ms window) |
| `frameTime` | `number` | Average frame time in milliseconds |
| `entityCount` | `number` | Total number of live ECS entities |
| `systemTimings` | `Map<string, number>` | Per-system execution time in ms (keys: `"ScriptSystem"`, `"PhysicsSystem"`, `"RenderSystem"`, etc.) |

## Example -- on-screen FPS counter

```tsx
import { useProfiler } from 'cubeforge'

function DebugOverlay() {
  const { fps, frameTime, entityCount, systemTimings } = useProfiler()

  return (
    <div style={{ position: 'absolute', top: 8, left: 8, color: '#0f0', fontFamily: 'monospace', fontSize: 12 }}>
      <div>FPS: {fps}</div>
      <div>Frame: {frameTime} ms</div>
      <div>Entities: {entityCount}</div>
      {[...systemTimings].map(([name, ms]) => (
        <div key={name}>{name}: {ms.toFixed(2)} ms</div>
      ))}
    </div>
  )
}
```

## Example -- log slow frames

```tsx
import { useProfiler } from 'cubeforge'
import { useEffect } from 'react'

function SlowFrameLogger() {
  const { frameTime, systemTimings } = useProfiler()

  useEffect(() => {
    if (frameTime > 16.67) {
      console.warn('Slow frame:', frameTime.toFixed(1), 'ms', Object.fromEntries(systemTimings))
    }
  }, [frameTime, systemTimings])

  return null
}
```

## Notes

- Must be used inside a `<Game>` component.
- The data is sampled via `requestAnimationFrame` and state is updated every 500 ms, so the values represent a rolling average rather than instantaneous readings.
- `systemTimings` reflects the timings recorded by the engine's `timedSystem` wrapper. Plugin systems registered via `<Game plugins={[...]}>` also appear here under the plugin name.

## See also

- [Game](/api/game) -- the `debug` prop enables a built-in wireframe and FPS overlay
