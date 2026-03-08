# Renderer

Cubeforge uses **WebGL2 instanced rendering** — no configuration needed.

## Usage

`<Game>` automatically sets up the WebGL2 renderer:

```tsx
<Game width={800} height={600}>
  <World>
    {/* WebGL2 instanced rendering */}
  </World>
</Game>
```

No `renderer` prop or extra configuration is required.

## What the WebGL2 renderer supports

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

`<Game debug>` renders collider wireframes and performance stats on a transparent `<canvas>` overlay positioned on top of the WebGL canvas — they never interfere with WebGL state.

## WebGL2 browser support

Supported in all modern browsers: Safari 15+, Chrome 56+, Firefox 51+.
