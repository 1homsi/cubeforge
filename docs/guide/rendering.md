# Rendering

Cubeforge renders to a Canvas 2D context. The render system draws all sprites sorted by `zIndex` each frame, after physics updates.

## Sprite

`<Sprite>` is the primary visual component. It can render a solid colour, a plain image, or a frame from a sprite sheet.

### Solid colour

```tsx
<Sprite width={32} height={48} color="#4fc3f7" />
```

### Image

```tsx
<Sprite width={64} height={64} src="/player.png" />
```

Images are loaded asynchronously via `AssetManager`. The sprite renders as a solid colour until the image is ready.

### Sprite sheet (frameIndex)

To display a specific frame from a grid sprite sheet:

```tsx
<Sprite
  width={32}
  height={48}
  src="/player-sheet.png"
  frameWidth={32}
  frameHeight={48}
  frameColumns={8}
  frameIndex={3}   // 4th frame (0-based)
/>
```

`frameWidth` and `frameHeight` define each frame's size in pixels. `frameColumns` is how many frames per row. `frameIndex` is the frame to display.

### Anchor

The anchor defines the pivot point for positioning and rotation. Default is `(0.5, 0.5)` — the entity's transform position is the sprite's center.

```tsx
<Sprite
  width={32}
  height={48}
  anchorX={0.5}   // 0 = left edge, 1 = right edge
  anchorY={1}     // 1 = bottom edge (useful for characters standing on ground)
/>
```

### Flip and visibility

```tsx
<Sprite width={32} height={48} flipX={facingLeft} visible={isAlive} />
```

## Animation

`<Animation>` drives frame-by-frame sprite sheet animations. It reads the sprite sheet layout from the sibling `<Sprite>` and advances `frameIndex` automatically.

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
  <Animation
    frames={[0, 1, 2, 3]}   // frame indices to cycle through
    fps={12}
    loop
    playing={isMoving}
  />
</Entity>
```

Switch between named animations by tracking which `frames` array you pass in:

```tsx
const frames = isOnGround
  ? (Math.abs(vx) > 10 ? [0, 1, 2, 3] : [4])   // run or idle
  : [5]                                           // jump frame

<Animation frames={frames} fps={12} />
```

## Sprite atlas

For cleaner code, use `createAtlas` to map frame names to indices:

```tsx
import { createAtlas } from 'cubeforge'

const playerAtlas = createAtlas([
  'idle', 'run-1', 'run-2', 'run-3', 'jump', 'fall',
], 6)

// Then reference frames by name:
<Sprite atlas={playerAtlas} frame="run-1" ... />
```

## ParallaxLayer

`<ParallaxLayer>` renders a background image that scrolls at a fraction of the camera speed, creating a sense of depth.

```tsx
<ParallaxLayer src="/bg/sky.png"       speedX={0.1} repeatX zIndex={-20} />
<ParallaxLayer src="/bg/mountains.png" speedX={0.3} repeatX zIndex={-15} />
<ParallaxLayer src="/bg/trees.png"     speedX={0.6} repeatX zIndex={-5}  />
```

`speedX={0}` means the layer never moves (fully fixed background). `speedX={1}` means it moves exactly with the camera (effectively a foreground). Values between 0 and 1 create the parallax effect.

Use negative `zIndex` values to render layers behind entities.

## SquashStretch

`<SquashStretch>` adds automatic squash-and-stretch based on the entity's velocity. This is a visual-only effect — it modifies `Transform.scaleX` and `scaleY` each frame.

```tsx
<Entity id="player">
  <Transform x={100} y={300} />
  <Sprite width={32} height={48} src="/player.png" />
  <RigidBody />
  <BoxCollider width={32} height={48} />
  <SquashStretch intensity={0.2} recovery={8} />
</Entity>
```

`intensity` controls the maximum squash/stretch amount. `recovery` is the lerp speed back to `(1, 1)` — higher values snap back faster.

## ParticleEmitter

`<ParticleEmitter>` attaches a particle system to an entity. Particles spawn at the entity's transform position and move based on configured speed, spread, and gravity.

```tsx
<Entity>
  <Transform x={200} y={300} />
  <ParticleEmitter
    active={isBurning}
    rate={30}
    speed={60}
    spread={Math.PI * 0.3}
    angle={-Math.PI / 2}   // upward
    particleLife={1.2}
    particleSize={3}
    color="#ff6b35"
    gravity={-100}          // particles float up
    maxParticles={150}
  />
</Entity>
```

Toggle `active` to start and stop emission without unmounting the component.

### Presets

Named presets give you sensible defaults for common effects:

```tsx
<ParticleEmitter preset="dust" active={isLanding} />
<ParticleEmitter preset="sparks" active={isHit} />
<ParticleEmitter preset="smoke" active={isOnFire} />
```

You can override any preset value with explicit props:

```tsx
<ParticleEmitter preset="sparks" color="#4fc3f7" rate={50} />
```

## WebGL renderer

For sprite-heavy scenes, `@cubeforge/webgl-renderer` provides a WebGL2 instanced renderer as a drop-in replacement. See the [WebGL Renderer guide](/guide/webgl-renderer) for full details.

```bash
bun add @cubeforge/webgl-renderer
```

```tsx
import { WebGLRenderSystem } from '@cubeforge/webgl-renderer'

<Game renderer={WebGLRenderSystem} />
```

The Canvas2D renderer remains the default — no change required for existing games.

## zIndex and draw order

All rendered entities are sorted by their `Sprite.zIndex` before drawing. Higher values render on top.

```tsx
<Sprite zIndex={-10} />   // background
<Sprite zIndex={0} />     // default
<Sprite zIndex={10} />    // foreground / UI
```

`<ParallaxLayer>` defaults to `zIndex={-10}`. Set explicit values to control layering precisely.
