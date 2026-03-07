# WebGL Renderer

`@cubeforge/webgl-renderer` is an optional drop-in replacement for the default Canvas2D render system. It uses **WebGL2 instanced rendering** — sprites sharing the same texture are drawn in a single GPU draw call, which dramatically increases throughput for sprite-heavy scenes.

## Install

```bash
bun add @cubeforge/webgl-renderer
# or
npm install @cubeforge/webgl-renderer
```

## Usage

Pass the `WebGLRenderSystem` constructor to `<Game renderer>`:

```tsx
import { WebGLRenderSystem } from '@cubeforge/webgl-renderer'

<Game renderer={WebGLRenderSystem} width={800} height={600}>
  <World>
    {/* your entities */}
  </World>
</Game>
```

The Canvas2D renderer remains the default — no change needed for existing games.

## What it supports

Everything the Canvas2D renderer does:

- Solid color quads and textured sprites
- Sprite sheets (`frameIndex`, `frameWidth`, `frameHeight`, `frameColumns`)
- Legacy `frame` rect (atlas-style)
- Camera follow, smoothing, dead zone, bounds clamping, shake
- Rotation, flipX, anchor, offset, scaleX/Y
- SquashStretch modifier
- Animation system (same frame-advance logic)
- Particle pools (rendered as instanced color quads)

## How batching works

Each frame, all sprites are sorted by `(zIndex, textureSrc)`. Consecutive sprites with the same texture are emitted as a single `drawArraysInstanced` call with up to 8192 instances per batch. Solid-color sprites (no image) are grouped separately into color batches.

This means a scene with 500 identical tree sprites (same texture) = **1 draw call**.

## Limitations

- **No parallax layers** — `<ParallaxLayer>` uses Canvas2D tiling patterns that aren't available in WebGL. Use the default renderer if you need parallax.
- **No debug overlay** — the `debug` prop is silently ignored when using a custom `renderer`. Use browser DevTools for GPU debugging.
- **WebGL2 required** — supported in all modern browsers. Safari 15+, Chrome 56+, Firefox 51+.

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
