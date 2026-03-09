# defineAnimations

Creates a reusable, type-safe set of animation clips for use with [`<AnimatedSprite>`](/api/animated-sprite). This is an identity function with zero runtime cost — it exists purely to give TypeScript the information it needs to infer clip names.

## Usage

```tsx
import { defineAnimations } from 'cubeforge'

const playerAnims = defineAnimations({
  idle:   { frames: [0],          fps: 1  },
  walk:   { frames: [1, 2, 3, 4], fps: 10 },
  run:    { frames: [5, 6, 7, 8], fps: 14 },
  jump:   { frames: [9],          fps: 1, loop: false },
  attack: { frames: [10, 11, 12], fps: 16, loop: false, next: 'idle' },
})
```

## Signature

```ts
function defineAnimations<S extends string>(
  clips: Record<S, AnimationClip>
): AnimationSet<S>
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `clips` | `Record<S, AnimationClip>` | An object mapping clip names to their animation clip definitions |

### Returns

`AnimationSet<S>` — the same object, typed so that `S` is the union of all clip name keys.

## AnimationClip fields

| Field | Type | Default | Description |
|---|---|---|---|
| `frames` | `number[]` | — | **Required.** Frame indices to cycle through |
| `fps` | `number` | `12` | Playback speed in frames per second |
| `loop` | `boolean` | `true` | Whether the clip loops |
| `next` | `string` | — | Clip name to auto-transition to when a non-looping clip finishes |
| `onComplete` | `() => void` | — | Callback fired when a non-looping clip finishes |

## AnimationSet type

```ts
type AnimationSet<S extends string = string> = Record<S, AnimationClip>
```

The generic parameter `S` is inferred from the keys you pass to `defineAnimations()`. When used with `<AnimatedSprite>`, the `current` prop is typed as `S`, giving you autocomplete and compile-time safety.

## Example

```tsx
import { defineAnimations, AnimatedSprite, Entity, Transform } from 'cubeforge'

// Define outside the component so the reference is stable
const slimeAnims = defineAnimations({
  idle:   { frames: [0, 1],       fps: 4 },
  bounce: { frames: [2, 3, 4, 5], fps: 12 },
  hurt:   { frames: [6, 7],       fps: 8, loop: false, next: 'idle' },
})

function Slime({ x, y, state }: { x: number; y: number; state: 'idle' | 'bounce' | 'hurt' }) {
  return (
    <Entity id="slime">
      <Transform x={x} y={y} />
      <AnimatedSprite
        src="/sprites/slime.png"
        width={32} height={32}
        frameWidth={32} frameHeight={32} frameColumns={8}
        animations={slimeAnims}
        current={state}   // ← type-checked against 'idle' | 'bounce' | 'hurt'
      />
    </Entity>
  )
}
```

::: tip
Define your animation sets **outside** the component (or in a shared file) so the object reference is stable across renders and reusable across all instances of the same entity type.
:::
