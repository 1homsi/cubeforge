# Animation

Drives frame-based sprite sheet animation. Each frame, it advances through a list of `frameIndex` values at the given `fps` and updates the sibling `<Sprite>` component's current frame.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `frames` | number[] | — | **Required.** Array of frame indices to cycle through |
| `fps` | number | `12` | Animation speed in frames per second |
| `loop` | boolean | `true` | If true, restarts from the first frame after the last |
| `playing` | boolean | `true` | Control playback — set to `false` to pause on the current frame |

## Example

```tsx
<Entity id="player">
  <Transform x={100} y={300} />
  <Sprite
    width={32}
    height={48}
    src="/player-sheet.png"
    frameWidth={32}
    frameHeight={48}
    frameColumns={8}
  />
  <Animation frames={[0, 1, 2, 3]} fps={12} loop playing={isMoving} />
</Entity>
```

## Switching animations

Pass different `frames` arrays based on game state. React will sync the change on the next render:

```tsx
const frames = useMemo(() => {
  if (!isOnGround) return [6]          // falling
  if (Math.abs(vx) > 10) return [0, 1, 2, 3]  // running
  return [4]                           // idle
}, [isOnGround, vx])

<Animation frames={frames} fps={12} loop />
```

You can track velocity by reading from the RigidBody component inside a Script and storing it in a ref.

## One-shot animations

Set `loop={false}` for animations that play once and stop on the last frame:

```tsx
<Animation frames={[8, 9, 10, 11]} fps={16} loop={false} playing={justHit} />
```

## Notes

- `playing`, `fps`, and `loop` are synced every render — you can toggle them from state.
- `frames` changes are synced too, but the animation resets to `currentIndex=0` only if the frames array itself changes reference.
- The animation timer continues counting even when `playing` is false — set `playing={false}` then back to `true` to resume from where it paused.
