# AnimatedSprite

Convenience component that combines [`<Sprite>`](/api/sprite) and [`<Animation>`](/api/animation) into a single element. Use it when you want a sprite sheet animation without composing two separate components.

## Props

Accepts all props from both `<Sprite>` (except `frameIndex`) and `<Animation>`:

| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | string | — | **Required.** Path to the sprite sheet image |
| `width` | number | — | **Required.** Display width |
| `height` | number | — | **Required.** Display height |
| `frames` | number[] | — | **Required.** Frame indices to cycle through |
| `frameWidth` | number | — | Width of a single frame in the sheet |
| `frameHeight` | number | — | Height of a single frame in the sheet |
| `frameColumns` | number | — | Number of columns in the sprite sheet |
| `fps` | number | `12` | Animation speed |
| `loop` | boolean | `true` | Whether to loop |
| `playing` | boolean | `true` | Whether currently playing |
| `flipX` | boolean | `false` | Flip horizontally |
| `onComplete` | `() => void` | — | Called when a non-looping animation finishes |
| `frameEvents` | `Record<number, () => void>` | — | Callbacks for specific frame indices |

Plus all other `<Sprite>` props: `color`, `offsetX/Y`, `zIndex`, `visible`, `anchorX/Y`, `atlas`, `frame`, `tileX/Y`, `tileSizeX/Y`, `sampling`.

## Example

```tsx
<Entity id="player">
  <Transform x={100} y={300} />
  <AnimatedSprite
    src="/hero.png"
    width={32}
    height={48}
    frameWidth={32}
    frameHeight={48}
    frameColumns={8}
    frames={[0, 1, 2, 3]}
    fps={10}
    flipX={facingLeft}
  />
</Entity>
```

## Compared to Sprite + Animation

These are equivalent:

```tsx
{/* AnimatedSprite */}
<AnimatedSprite src="/hero.png" width={32} height={32}
  frameWidth={32} frameHeight={32} frameColumns={4}
  frames={[0,1,2,3]} fps={8} />

{/* Manual composition */}
<Sprite src="/hero.png" width={32} height={32}
  frameWidth={32} frameHeight={32} frameColumns={4} />
<Animation frames={[0,1,2,3]} fps={8} />
```

Use `AnimatedSprite` for simpler cases. Use separate `<Sprite>` + `<Animation>` when you need independent control over each.
