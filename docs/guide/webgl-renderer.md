# Renderers

Cubeforge uses **WebGL2 instanced rendering by default** — no configuration needed. For compatibility, pixel art, or custom pipelines you can opt into the Canvas2D renderer or write your own.

## Default: WebGL2

`<Game>` automatically uses WebGL2:

```tsx
<Game width={800} height={600}>
  <World>
    {/* WebGL2 instanced rendering — no prop needed */}
  </World>
</Game>
```

If WebGL2 is unavailable in the browser (very rare in modern browsers), Cubeforge automatically falls back to Canvas2D with a console warning.

## Opt-in: Canvas2D

Pass `renderer={Canvas2DRenderSystem}` (or the string `'canvas2d'`) to use the Canvas2D renderer:

```tsx
import { Canvas2DRenderSystem } from 'cubeforge'

<Game renderer={Canvas2DRenderSystem} width={800} height={600}>
  <World>
    {/* Canvas2D rendering */}
  </World>
</Game>
```

Good reasons to use Canvas2D:
- Pixel-art games with `scale="pixel"` where you want explicit control
- Environments that disable WebGL (some browser extensions, headless test environments)
- Debugging rendering behaviour with familiar Canvas2D APIs

## Custom renderers

The `renderer` prop accepts any class that implements the `System` interface and takes `(canvas: HTMLCanvasElement, entityIds: Map<string, EntityId>)`:

```ts
import type { System, ECSWorld } from '@cubeforge/core'

class MyRenderer implements System {
  constructor(
    private canvas: HTMLCanvasElement,
    private entityIds: Map<string, number>,
  ) {}

  update(world: ECSWorld, dt: number): void {
    // custom rendering logic
  }
}

<Game renderer={MyRenderer} />
```

## What the WebGL2 renderer supports

Everything the Canvas2D renderer does:

- Solid color quads and textured sprites
- Sprite sheets (`frameIndex`, `frameWidth`, `frameHeight`, `frameColumns`)
- Legacy `frame` rect (atlas-style)
- Camera follow, smoothing, dead zone, bounds clamping, shake
- Rotation, flipX, anchor, offset, scaleX/Y
- SquashStretch modifier
- Animation system (same frame-advance logic)
- Particle pools (rendered as instanced color quads)
- Parallax layers (tiled fullscreen quads with UV offset)
- Text components (rendered via offscreen Canvas2D texture, cached)
- Trail components (rendered as fading instanced quads)

## How batching works

Each frame, all sprites are sorted by `(zIndex, textureSrc)`. Consecutive sprites with the same texture are emitted as a single `drawArraysInstanced` call with up to 8192 instances per batch. Solid-color sprites (no image) are grouped separately.

This means a scene with 500 identical tree sprites (same texture) = **1 draw call**.

## Debug overlay

`<Game debug>` always works regardless of renderer. When WebGL2 is active, the debug wireframes are drawn on a transparent `<canvas>` overlay positioned on top of the WebGL canvas — so they never interfere with WebGL state.

## WebGL2 browser support

Supported in all modern browsers: Safari 15+, Chrome 56+, Firefox 51+.
