# NineSlice

Renders a nine-slice sprite that scales without distorting corners or edges. Ideal for UI panels, dialogue boxes, and buttons that need to resize dynamically.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | string | — | **Required.** Path or URL to the source image |
| `width` | number | — | **Required.** Rendered width in pixels |
| `height` | number | — | **Required.** Rendered height in pixels |
| `sliceLeft` | number | — | **Required.** Left inset in pixels |
| `sliceRight` | number | — | **Required.** Right inset in pixels |
| `sliceTop` | number | — | **Required.** Top inset in pixels |
| `sliceBottom` | number | — | **Required.** Bottom inset in pixels |
| `tint` | string | `undefined` | Optional colour tint applied to the sprite |

## Example

```tsx
import { Entity, Transform, NineSlice } from 'cubeforge'

function DialogueBox({ text }: { text: string }) {
  return (
    <Entity>
      <Transform x={100} y={400} />
      <NineSlice
        src="/ui/panel.png"
        width={600}
        height={120}
        sliceLeft={12}
        sliceRight={12}
        sliceTop={12}
        sliceBottom={12}
        tint="#d0e8ff"
      />
    </Entity>
  )
}
```

## How it works

The source image is divided into a 3x3 grid using the four slice values. The four corners are drawn at their original size, the four edges are stretched along one axis, and the center patch fills the remaining area. This lets the element scale to any size without distorting the border art.

## Notes

- `NineSlice` must be placed inside an `<Entity>` with a `<Transform>`.
- The image is loaded through the engine's `AssetManager`, so it benefits from the same caching as `<Sprite>`.
- If `tint` is set, a multiply blend is applied to the final draw.
