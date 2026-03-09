# createTimeline

Sequences multiple tweens into a single timeline that can be played, paused, and seeked. Each entry runs after the previous one completes (plus any additional `delay`).

## Signature

```ts
function createTimeline(entries: TimelineEntry[]): TweenTimeline
```

## TimelineEntry

| Property | Type | Description |
|---|---|---|
| `target` | `object` | The object whose properties will be tweened |
| `props` | `Record<string, number>` | Target values for each property to tween toward |
| `duration` | `number` | Duration of this segment in seconds |
| `ease` | `EaseFn` | Easing function (optional, defaults to linear) |
| `delay` | `number` | Extra delay in seconds before this entry starts (optional, defaults to 0) |

## TweenTimeline

| Member | Type | Description |
|---|---|---|
| `play()` | method | Start or resume playback |
| `pause()` | method | Pause playback at the current position |
| `reset()` | method | Reset the timeline to the beginning |
| `seek(t)` | method | Jump to time `t` (in seconds) and apply all intermediate values |
| `update(dt)` | method | Advance the timeline by `dt` seconds. Call this every frame. |
| `isComplete` | `boolean` | `true` once all entries have finished |
| `totalDuration` | `number` | Sum of all entry durations and delays |

## Example

```tsx
import { createTimeline, Ease } from 'cubeforge'

function Cutscene() {
  let timeline: TweenTimeline | null = null

  return (
    <Entity id="npc">
      <Transform x={100} y={300} />
      <Sprite width={32} height={32} color="orange" />
      <Script
        init={(id, world) => {
          const t = world.getComponent(id, 'Transform')
          if (!t) return

          timeline = createTimeline([
            { target: t, props: { x: 300 }, duration: 1.0, ease: Ease.easeInOutQuad },
            { target: t, props: { y: 150 }, duration: 0.6, ease: Ease.easeOutQuad, delay: 0.2 },
            { target: t, props: { x: 100, y: 300 }, duration: 1.2, ease: Ease.easeInOutQuad },
          ])
          timeline.play()
        }}
        update={(id, world, input, dt) => {
          timeline?.update(dt)
        }}
      />
    </Entity>
  )
}
```

## Notes

- Like `tween`, you must call `update(dt)` yourself each frame from a Script or callback.
- `seek(t)` applies all property changes up to time `t` instantly, which is useful for scrubbing or previewing.
- `reset()` also resets all target properties to their original values.
- Entries are sequential by default. For parallel tweens, use multiple `tween()` calls instead.
- See also: [`tween`](./tween.md) for single-value tweens, [`useTween`](./use-tween.md) for the React hook variant.
