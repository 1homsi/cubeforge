# Camera2D

Defines the camera view. Follows an entity, applies zoom and smoothing, constrains to world bounds, and sets the background colour. There should be at most one `<Camera2D>` in the world at a time.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `followEntity` | string | — | String ID of the entity to follow. Must match an `<Entity id="...">` |
| `x` | number | `0` | Initial camera X position in world space. Ignored once `followEntity` takes over. |
| `y` | number | `0` | Initial camera Y position in world space. Ignored once `followEntity` takes over. |
| `followOffsetX` | number | `0` | World-space X offset applied on top of the follow target (look-ahead, horizontal bias). |
| `followOffsetY` | number | `0` | World-space Y offset applied on top of the follow target (vertical bias, e.g. look up/down). |
| `zoom` | number | `1` | Camera zoom level. `2` makes everything appear twice as large. |
| `smoothing` | number | `0` | Lerp factor per frame (0 = instant snap, higher values = smoother follow). Values around 0.85–0.95 work well. |
| `background` | string | `'#1a1a2e'` | Canvas clear colour drawn each frame before rendering |
| `bounds` | `{ x, y, width, height }` | — | World bounds. Camera clamps so it never shows outside this rectangle. |
| `deadZone` | `{ w, h }` | — | The entity must leave this region around the camera centre to trigger movement |

## Example

```tsx
<Camera2D
  followEntity="player"
  zoom={1}
  smoothing={0.9}
  background="#0d1b2a"
  bounds={{ x: 0, y: 0, width: 3200, height: 900 }}
  deadZone={{ w: 80, h: 40 }}
/>
```

## Smooth follow

`smoothing` is applied as a lerp factor per frame. A value of `0.9` means the camera moves 10% of the remaining distance per frame toward the target:

```
cameraX = lerp(cameraX, targetX, 1 - smoothing)
```

- `smoothing={0}` — instant snap, no lag
- `smoothing={0.85}` — smooth, slight lag
- `smoothing={0.95}` — very smooth, noticeable lag on fast movement

## World bounds

Set `bounds` to prevent the camera from scrolling beyond the level edges:

```tsx
<Camera2D
  followEntity="player"
  smoothing={0.9}
  bounds={{ x: 0, y: 0, width: 6400, height: 480 }}
/>
```

The camera clamps its viewport so no area outside the bounds rectangle is visible. Leave `bounds` unset for an unbounded, infinite-feeling world.

## Dead zone

The dead zone is a rectangle centred on the current camera position. The camera only moves if the followed entity exits this rectangle. Use it to prevent jitter on small movements:

```tsx
<Camera2D
  followEntity="player"
  deadZone={{ w: 60, h: 30 }}
/>
```

## Follow offset

Use `followOffsetX` / `followOffsetY` to bias the camera away from the entity centre — useful for look-ahead (shift the view forward in the direction of travel) or vertical bias (keep the player in the lower third of the screen):

```tsx
// Show more of the level ahead of the player (shift right)
<Camera2D followEntity="player" followOffsetX={120} />

// Keep player in lower portion of screen
<Camera2D followEntity="player" followOffsetY={-80} />
```

## Static position

Omit `followEntity` and set `x` / `y` to position the camera at a fixed world coordinate:

```tsx
// Centre the view on world position (400, 300)
<Camera2D x={400} y={300} />
```

## Notes

- `<Camera2D>` creates its own internal entity in the ECS world. You do not wrap it in `<Entity>`.
- Prop changes (smoothing, zoom, bounds, background, followEntity, followOffsetX, followOffsetY) are synced every render.
- With `<Game debug>`, the debug overlay renders in screen space (on top of the camera transform).
- Use `useCamera()` to control shake, zoom, and follow offset programmatically at runtime.
