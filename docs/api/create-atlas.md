# createAtlas

Creates a `SpriteAtlas` — a mapping from frame names to frame indices — from a flat list of names in row-major order. Use the atlas with `<Sprite atlas={atlas} frame="name" />` to reference sprite sheet frames by name instead of index.

## Signature

```ts
function createAtlas(names: string[], columns: number): SpriteAtlas
```

## SpriteAtlas type

```ts
type SpriteAtlas = Record<string, number>
```

A plain object mapping frame name strings to zero-based frame index numbers.

## Example

```tsx
import { createAtlas, Sprite, Animation } from 'cubeforge'

// 8 frames per row, names in row-major order
const playerAtlas = createAtlas([
  'idle',
  'run-1', 'run-2', 'run-3', 'run-4',
  'jump',
  'fall',
  'hit',
], 8)

// Use a named frame in Sprite
<Sprite
  width={32}
  height={48}
  src="/player-sheet.png"
  frameWidth={32}
  frameHeight={48}
  frameColumns={8}
  atlas={playerAtlas}
  frame={isOnGround ? 'idle' : 'jump'}
/>
```

## Using atlas indices with Animation

`Animation` takes `frames` as an array of indices. Use the atlas to look up indices:

```tsx
const runFrames = ['run-1', 'run-2', 'run-3', 'run-4'].map(f => playerAtlas[f])

<Animation frames={runFrames} fps={12} loop />
```

Or build a helper:

```tsx
function atlasFrames(atlas: SpriteAtlas, names: string[]): number[] {
  return names.map(name => atlas[name] ?? 0)
}

<Animation frames={atlasFrames(playerAtlas, ['run-1', 'run-2', 'run-3', 'run-4'])} fps={12} />
```

## Notes

- `createAtlas` assigns indices sequentially starting from 0. The `columns` parameter is accepted for future compatibility but does not affect the index assignment in the current implementation.
- Frame names must be unique within a single atlas.
- If a `frame` name is not found in the atlas, the `Sprite` falls back to `frameIndex={0}`.
