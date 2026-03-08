# AnimatedSprite

Convenience component that combines [`<Sprite>`](/api/sprite) and [`<Animation>`](/api/animation) into a single element. Supports both a simple single-clip API and a multi-clip state machine with type-safe clip names.

## Multi-clip API (recommended)

Use `defineAnimations()` to create a reusable, type-safe set of clips. The `current` prop gets autocomplete for all clip names.

```tsx
const playerAnims = defineAnimations({
  idle:   { frames: [0],          fps: 1  },
  walk:   { frames: [1, 2, 3, 4], fps: 10 },
  run:    { frames: [5, 6, 7, 8], fps: 14 },
  jump:   { frames: [9],          fps: 1, loop: false },
  attack: { frames: [10, 11, 12], fps: 16, loop: false, next: 'idle' },
})

// In your component — `current` is typed as 'idle' | 'walk' | 'run' | 'jump' | 'attack'
<AnimatedSprite
  src="/hero.png"
  width={32} height={48}
  frameWidth={32} frameHeight={48} frameColumns={8}
  animations={playerAnims}
  current={playerState}
  flipX={facingLeft}
/>
```

Define the animations object **outside** your component (or in a shared file) so it's stable across renders and reusable across all instances of the same entity type.

### Clip options

| Field | Type | Default | Description |
|---|---|---|---|
| `frames` | number[] | — | **Required.** Frame indices to cycle through |
| `fps` | number | `12` | Animation speed |
| `loop` | boolean | `true` | Whether to loop |
| `next` | string | — | Auto-transition to this clip when finished (non-looping only) |
| `onComplete` | `() => void` | — | Called when a non-looping clip finishes |

## Simple API

For quick prototyping, pass `frames` directly:

```tsx
<AnimatedSprite
  src="/hero.png"
  width={32} height={32}
  frameWidth={32} frameHeight={32} frameColumns={8}
  frames={[0, 1, 2, 3]}
  fps={10}
/>
```

## Props

### Sprite props (both modes)

| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | string | — | **Required.** Path to the sprite sheet |
| `width` | number | — | **Required.** Display width |
| `height` | number | — | **Required.** Display height |
| `frameWidth` | number | — | Width of a single frame |
| `frameHeight` | number | — | Height of a single frame |
| `frameColumns` | number | — | Columns in the sprite sheet |
| `flipX` | boolean | `false` | Flip horizontally |
| `zIndex` | number | `0` | Draw order |
| `visible` | boolean | `true` | Visibility |
| `anchorX` / `anchorY` | number | `0.5` | Anchor point |
| `sampling` | Sampling | — | Texture filtering |

### Simple mode only

| Prop | Type | Default | Description |
|---|---|---|---|
| `frames` | number[] | — | Frame indices |
| `fps` | number | `12` | Speed |
| `loop` | boolean | `true` | Loop |
| `playing` | boolean | `true` | Playback control |
| `onComplete` | `() => void` | — | Finish callback |
| `frameEvents` | `Record<number, () => void>` | — | Per-frame callbacks |

### Multi-clip mode only

| Prop | Type | Description |
|---|---|---|
| `animations` | `AnimationSet<S>` | Map of named clips (from `defineAnimations()`) |
| `current` | `S` | Active clip name (typed to the clip keys) |

## defineAnimations

```tsx
import { defineAnimations } from 'cubeforge'

const anims = defineAnimations({
  idle: { frames: [0], fps: 1 },
  walk: { frames: [1, 2, 3, 4], fps: 10 },
})
```

Zero runtime cost — it's an identity function that exists purely for TypeScript inference. The returned object is a `Record<S, AnimationClip>` where `S` is the union of your clip names.
