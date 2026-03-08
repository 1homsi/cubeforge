# Post-Processing Effects

Apply full-screen visual effects after the scene has been rendered. Effects run in screen space and can draw overlays or manipulate pixel data.

## Built-in Effects

### `vignetteEffect(intensity?)`

Draws a radial gradient that darkens the edges of the screen.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `intensity` | `number` | `0.4` | Opacity of the vignette (0 = invisible, 1 = full black) |

### `scanlineEffect(gap?, opacity?)`

Draws horizontal scanlines across the screen for a retro CRT look.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `gap` | `number` | `3` | Pixel spacing between lines |
| `opacity` | `number` | `0.15` | Opacity of each scanline |

### `chromaticAberrationEffect(offset?)`

Shifts the red channel left and the blue channel right, producing an RGB split / chromatic aberration effect.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `offset` | `number` | `2` | Pixel shift amount |

> **Note:** This effect reads and writes `ImageData`, which can be expensive on large canvases. Use sparingly or on smaller canvas sizes.

## `usePostProcess(effect)`

React hook that registers a post-processing effect for the lifetime of the component.

```tsx
import { usePostProcess, vignetteEffect } from 'cubeforge'
import { useMemo } from 'react'

function Atmosphere() {
  const vignette = useMemo(() => vignetteEffect(0.5), [])
  usePostProcess(vignette)
  return null
}
```

| Param | Type | Description |
|-------|------|-------------|
| `effect` | `PostProcessEffect` | A function `(ctx, width, height, dt) => void` |

The effect is added on mount and removed on unmount.

## `createPostProcessStack()`

Creates a standalone post-processing stack. This is used internally by the engine but can also be useful for advanced scenarios.

```ts
import { createPostProcessStack, scanlineEffect } from 'cubeforge'

const stack = createPostProcessStack()
stack.add(scanlineEffect())
stack.apply(ctx, canvas.width, canvas.height, dt)
stack.clear()
```

### Methods

| Method | Description |
|--------|-------------|
| `add(effect)` | Append an effect to the stack |
| `remove(effect)` | Remove an effect from the stack |
| `apply(ctx, w, h, dt)` | Run all effects in order |
| `clear()` | Remove all effects |

## Custom Effects

A `PostProcessEffect` is a plain function. Write your own:

```ts
import type { PostProcessEffect } from 'cubeforge'

const tintEffect = (color: string, opacity: number): PostProcessEffect => {
  return (ctx, width, height) => {
    ctx.fillStyle = color
    ctx.globalAlpha = opacity
    ctx.fillRect(0, 0, width, height)
    ctx.globalAlpha = 1
  }
}
```

## Combining Effects

Stack multiple effects by calling `usePostProcess` multiple times. Effects run in mount order.

```tsx
function RetroLook() {
  const scanlines = useMemo(() => scanlineEffect(2, 0.1), [])
  const vignette = useMemo(() => vignetteEffect(0.3), [])
  const aberration = useMemo(() => chromaticAberrationEffect(1), [])

  usePostProcess(scanlines)
  usePostProcess(vignette)
  usePostProcess(aberration)

  return null
}
```

## Types

```ts
type PostProcessEffect = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dt: number,
) => void

interface PostProcessStack {
  add(effect: PostProcessEffect): void
  remove(effect: PostProcessEffect): void
  apply(ctx: CanvasRenderingContext2D, width: number, height: number, dt: number): void
  clear(): void
}
```
