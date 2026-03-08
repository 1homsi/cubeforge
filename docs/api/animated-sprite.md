# AnimatedSprite

Convenience component that combines [`<Sprite>`](/api/sprite) and [`<Animation>`](/api/animation) into a single element. Supports both a simple single-clip API and a multi-clip state machine.

## Simple API

Pass `frames` directly — equivalent to composing `<Sprite>` + `<Animation>` manually:

```tsx
<AnimatedSprite
  src="/hero.png"
  width={32} height={48}
  frameWidth={32} frameHeight={48} frameColumns={8}
  frames={[0, 1, 2, 3]}
  fps={10}
/>
```

## Multi-clip API

Define named animation states in `animations` and switch between them with `current`:

```tsx
<AnimatedSprite
  src="/hero.png"
  width={32} height={48}
  frameWidth={32} frameHeight={48} frameColumns={8}
  animations={{
    idle: { frames: [0],          fps: 1  },
    walk: { frames: [1, 2, 3, 4], fps: 10 },
    run:  { frames: [5, 6, 7, 8], fps: 14 },
    jump: { frames: [9],          fps: 1, loop: false },
  }}
  current={playerState}
  flipX={facingLeft}
/>
```

Adding new states (attack, dash, climb, etc.) is just another key in the `animations` map.

### Clip options

Each clip in the `animations` map accepts:

| Field | Type | Default | Description |
|---|---|---|---|
| `frames` | number[] | — | **Required.** Frame indices to cycle through |
| `fps` | number | `12` | Animation speed |
| `loop` | boolean | `true` | Whether to loop |
| `next` | string | — | Clip to auto-transition to when this one finishes (non-looping only) |
| `onComplete` | `() => void` | — | Called when a non-looping clip finishes |

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
| `animations` | `Record<string, AnimationClip>` | Map of named clips |
| `current` | string | Active clip name |
