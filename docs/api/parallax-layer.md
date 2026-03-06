# ParallaxLayer

Renders a background image that scrolls at a fraction of the camera's speed to create a sense of depth. Wraps an internal entity with Transform and a custom `ParallaxLayer` ECS component.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | string | — | **Required.** Image URL |
| `speedX` | number | `0.5` | Horizontal scroll speed relative to camera (0 = fixed, 1 = moves with camera) |
| `speedY` | number | `0` | Vertical scroll speed relative to camera |
| `repeatX` | boolean | `true` | Tile the image horizontally |
| `repeatY` | boolean | `false` | Tile the image vertically |
| `zIndex` | number | `-10` | Draw order. Use negative values to render behind entities. |
| `offsetX` | number | `0` | Manual horizontal offset in pixels |
| `offsetY` | number | `0` | Manual vertical offset in pixels |

## Example

```tsx
<Game width={800} height={500}>
  <World>
    <Camera2D followEntity="player" smoothing={0.9} />

    {/* Background layers, back to front */}
    <ParallaxLayer src="/bg/sky.png"       speedX={0.05} repeatX zIndex={-30} />
    <ParallaxLayer src="/bg/mountains.png" speedX={0.2}  repeatX zIndex={-20} />
    <ParallaxLayer src="/bg/trees.png"     speedX={0.5}  repeatX zIndex={-10} />

    {/* Entities in front */}
    <Player />
    <Ground />
  </World>
</Game>
```

## Speed values

| speedX | Effect |
|---|---|
| `0` | Fully fixed — never moves regardless of camera |
| `0.2` | Slow scroll — distant mountains |
| `0.5` | Medium scroll — midground trees |
| `0.8` | Fast scroll — near foreground |
| `1` | Moves exactly with camera — effectively a fixed foreground |

## Tiling

Set `repeatX` to tile the image horizontally so it fills the full canvas width as the camera moves:

```tsx
<ParallaxLayer src="/bg/clouds.png" speedX={0.15} repeatX={true} />
```

The render system tiles the image as many times as needed to cover the canvas, offset by the camera and parallax speed.

## Notes

- `<ParallaxLayer>` creates its own entity internally — do not wrap it in `<Entity>`.
- All props are synced on every render.
- Use the `zIndex` prop to control layering relative to sprites. Default `zIndex={-10}` places layers behind entities at `zIndex={0}`.
