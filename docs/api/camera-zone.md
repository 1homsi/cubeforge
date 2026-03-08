# CameraZone

An invisible region that overrides the `Camera2D` follow target when a tagged entity enters it. When the entity exits, the camera restores its previous follow target.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `x` | number | — | Left edge of the zone (world space) |
| `y` | number | — | Top edge of the zone (world space) |
| `width` | number | — | Zone width |
| `height` | number | — | Zone height |
| `followTag` | string | — | Tag of the entity to watch (e.g. `'player'`) |
| `fixedX` | number | — | Camera X to use while inside the zone |
| `fixedY` | number | — | Camera Y to use while inside the zone |

## Example

```tsx
import { CameraZone } from 'cubeforge'

function BossArena() {
  return (
    <>
      {/* Lock camera to center of arena while player is here */}
      <CameraZone
        x={0} y={0} width={1600} height={900}
        followTag="player"
        fixedX={800} fixedY={450}
      />
      <Boss />
    </>
  )
}
```

## Notes

- Uses a 16ms polling interval internally rather than physics events, so there may be up to one frame of latency on entry/exit.
- Multiple `CameraZone` components can coexist; last entry wins.
