import { useMemo } from 'react'
import { InputBuffer } from '@cubeforge/input'
import type { InputBufferOptions } from '@cubeforge/input'

/**
 * Returns a stable `InputBuffer` instance that persists across renders.
 *
 * Call `buffer.record(action)` when an action is pressed, and
 * `buffer.consume(action)` to check & consume a buffered input.
 * The buffer auto-prunes expired entries via `update()` — call it
 * once per frame (e.g., at the top of a `<Script update>`).
 *
 * @example
 * ```tsx
 * function Player() {
 *   const buffer = useInputBuffer({ bufferWindow: 0.15 })
 *
 *   return (
 *     <Script update={(id, world, input, dt) => {
 *       buffer.update()
 *       if (input.justPressed('Space')) buffer.record('jump')
 *       if (canJump && buffer.consume('jump')) doJump()
 *     }} />
 *   )
 * }
 * ```
 */
export function useInputBuffer(opts?: InputBufferOptions): InputBuffer {
  return useMemo(() => new InputBuffer(opts), [])
}

export type { InputBufferOptions }
