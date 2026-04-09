import React from 'react'
import { Game } from './Game'

type GameProps = React.ComponentProps<typeof Game>

/**
 * Stage is an alias for {@link Game} tuned for static, puzzle, turn-based, and
 * editor-style scenes. It defaults to:
 *
 * - `mode="onDemand"` — the loop sleeps until input arrives or a component calls
 *   `engine.loop.markDirty()`. Saves battery and CPU.
 * - `gravity={0}` — no downward acceleration. Most non-action scenes don't need it.
 *
 * Every other prop behaves identically to `<Game>`. Use `<Stage>` when you're
 * building something that isn't an action game: a level editor, a card game, a
 * match-3 puzzle, a visual novel, a node-graph tool, etc.
 *
 * @example
 * ```tsx
 * <Stage width={800} height={600}>
 *   <Entity>
 *     <Transform x={100} y={100} />
 *     <Sprite src="card.png" width={80} height={120} />
 *   </Entity>
 * </Stage>
 * ```
 */
export function Stage(props: GameProps) {
  return <Game mode="onDemand" gravity={0} {...props} />
}
