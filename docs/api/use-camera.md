# useCamera

Returns controls for the active `Camera2D` in the scene. Must be used inside `<Game>`.

## Signature

```ts
function useCamera(): CameraControls
```

## Returns

| Method | Signature | Description |
|---|---|---|
| `shake` | `(intensity: number, duration: number) => void` | Trigger a screen-shake effect |
| `setFollowOffset` | `(x: number, y: number) => void` | World-space offset added to the camera's follow target position |
| `setPosition` | `(x: number, y: number) => void` | Instantly move camera center (bypasses smoothing) |
| `setZoom` | `(zoom: number) => void` | Change camera zoom level |

## Example

```tsx
function HUD() {
  const camera = useCamera()

  return (
    <button onClick={() => camera.shake(8, 0.4)}>
      Shake!
    </button>
  )
}

// In a game component — shake on player hurt
function PlayerHitFeedback() {
  const camera = useCamera()

  useCollisionEnter(() => {
    camera.shake(6, 0.3)
  }, { tag: 'enemy' })

  return null
}
```

## Look-ahead follow offset

```tsx
// Shift camera 80px ahead of the player's facing direction
camera.setFollowOffset(facingRight ? 80 : -80, 0)
```

You can also set `followOffsetX` / `followOffsetY` directly as props on `<Camera2D>`:

```tsx
<Camera2D followEntity="player" followOffsetX={80} smoothing={0.9} />
```

## Notes

- `shake` requires the default Canvas2D renderer. It has no effect when using a custom WebGL renderer (the `renderer` prop on `<Game>`).
- `setPosition` is useful for instant scene cuts — call it before un-pausing the game to avoid the camera lerping from its old position.
- `setZoom` updates the `Camera2D` ECS component directly; the next rendered frame will use the new zoom.
