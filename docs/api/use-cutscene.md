# useCutscene

Orchestrates scripted sequences by running an array of steps in order. Steps can move entities, wait, or call arbitrary functions.

## Signature

```ts
function useCutscene(steps: CutsceneStep[]): CutsceneControls
```

## Types

```ts
type CutsceneStep =
  | { type: 'move'; entityId: string; to: { x: number; y: number }; duration: number }
  | { type: 'wait'; duration: number }
  | { type: 'call'; fn: () => void | Promise<void> }

interface CutsceneControls {
  /** Start playing the cutscene from the first step */
  play: () => void
  /** Whether the cutscene is currently running */
  isPlaying: boolean
  /** Cancel the cutscene immediately */
  cancel: () => void
}
```

## Example

```tsx
import { useCutscene } from 'cubeforge'

function BossCutscene() {
  const cutscene = useCutscene([
    { type: 'move', entityId: 'player', to: { x: 400, y: 300 }, duration: 1.2 },
    { type: 'wait', duration: 0.5 },
    { type: 'call', fn: () => console.log('Boss appears!') },
    { type: 'move', entityId: 'boss', to: { x: 500, y: 300 }, duration: 0.8 },
    { type: 'wait', duration: 1.0 },
    { type: 'call', fn: () => console.log('Fight begins') },
  ])

  useEvent('bossRoomEnter', () => {
    cutscene.play()
  })

  return null
}
```

## Notes

- `move` steps lerp the entity's `Transform` position over the given duration in seconds.
- `call` steps support both sync and async functions. The next step waits for the promise to resolve.
- Calling `cancel()` stops the sequence immediately; entities remain at their current position.
- Player input is not automatically disabled during a cutscene. Use `useInputContext` or a flag in your movement script to block input while `isPlaying` is true.
- Must be called inside `<Game>`.
