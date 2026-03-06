# Sprite

Renders the entity as a coloured rectangle, a plain image, or a frame from a sprite sheet. The render system draws all sprites sorted by `zIndex` each frame.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `width` | number | — | **Required.** Sprite width in pixels |
| `height` | number | — | **Required.** Sprite height in pixels |
| `color` | string | `'#ffffff'` | Fill colour when no image is loaded, or used as tint fallback |
| `src` | string | — | Image URL. Loaded asynchronously; renders as `color` until ready. |
| `frameIndex` | number | `0` | Which frame to display from a sprite sheet (0-based) |
| `frameWidth` | number | — | Width of each frame in the sprite sheet |
| `frameHeight` | number | — | Height of each frame in the sprite sheet |
| `frameColumns` | number | — | Number of frames per row in the sprite sheet |
| `atlas` | SpriteAtlas | — | Name-to-index atlas object (from `createAtlas`) |
| `frame` | string | — | Frame name to look up in `atlas` |
| `offsetX` | number | `0` | Horizontal draw offset relative to transform position |
| `offsetY` | number | `0` | Vertical draw offset relative to transform position |
| `zIndex` | number | `0` | Draw order — higher values render on top |
| `visible` | boolean | `true` | If false, the sprite is not drawn |
| `flipX` | boolean | `false` | Mirror the sprite horizontally |
| `anchorX` | number | `0.5` | Horizontal anchor (0 = left edge, 0.5 = centre, 1 = right edge) |
| `anchorY` | number | `0.5` | Vertical anchor (0 = top edge, 0.5 = centre, 1 = bottom edge) |

## Examples

### Solid colour

```tsx
<Sprite width={32} height={48} color="#4fc3f7" />
```

### Image

```tsx
<Sprite width={64} height={64} src="/sprites/coin.png" />
```

### Sprite sheet with frameIndex

```tsx
<Sprite
  width={32}
  height={48}
  src="/sprites/player-sheet.png"
  frameWidth={32}
  frameHeight={48}
  frameColumns={8}
  frameIndex={3}
/>
```

### Atlas (named frames)

```tsx
import { createAtlas } from 'cubeforge'

const atlas = createAtlas(['idle', 'run-1', 'run-2', 'run-3', 'jump'], 5)

<Sprite
  width={32}
  height={48}
  src="/sprites/player-sheet.png"
  frameWidth={32}
  frameHeight={48}
  frameColumns={5}
  atlas={atlas}
  frame="run-1"
/>
```

### Bottom-anchored sprite (character on ground)

```tsx
<Sprite
  width={32}
  height={48}
  color="#4fc3f7"
  anchorX={0.5}
  anchorY={1}    // anchor at bottom
/>
```

## Mutable props

`color`, `visible`, `flipX`, `zIndex`, and `frameIndex` (or `frame`) are synced every render — you can drive them from React state. `width`, `height`, `src`, `anchorX`, `anchorY`, `offsetX`, and `offsetY` are set on mount and not updated dynamically.
