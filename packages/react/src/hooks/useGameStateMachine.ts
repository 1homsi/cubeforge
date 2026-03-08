import { useState, useRef, useCallback, useEffect } from 'react'

export interface GameState {
  /** Called once when this state becomes active. */
  onEnter?(): void
  /** Called once when leaving this state. */
  onExit?(): void
  /**
   * Called every frame while this state is active.
   * Wire this up by calling `update(dt)` from a Script or useEffect loop.
   */
  onUpdate?(dt: number): void
}

export interface GameStateMachineResult<S extends string> {
  /** The currently active state name. */
  readonly state: S
  /**
   * Transition to a new state. Calls `onExit` on the current state and
   * `onEnter` on the new state.
   */
  transition(to: S): void
  /**
   * Advance the current state by `dt` seconds.
   * Call this from a game loop or Script `update` callback.
   */
  update(dt: number): void
}

/**
 * Lightweight game state machine for top-level game flow (menu → playing → paused → dead).
 *
 * @example
 * ```tsx
 * const { state, transition, update } = useGameStateMachine({
 *   playing: {
 *     onEnter: () => console.log('game started'),
 *     onUpdate: (dt) => { ... },
 *   },
 *   paused: {
 *     onEnter: () => console.log('paused'),
 *   },
 *   dead: {
 *     onEnter: () => console.log('game over'),
 *   },
 * }, 'playing')
 * ```
 */
export function useGameStateMachine<S extends string>(
  states: Record<S, GameState>,
  initial: S,
): GameStateMachineResult<S> {
  const [state, setState] = useState<S>(initial)
  const stateRef = useRef<S>(initial)
  const statesRef = useRef(states)
  statesRef.current = states

  // Call onEnter for initial state
  useEffect(() => {
    statesRef.current[initial]?.onEnter?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const transition = useCallback((to: S) => {
    const current = stateRef.current
    if (current === to) return
    statesRef.current[current]?.onExit?.()
    stateRef.current = to
    setState(to)
    statesRef.current[to]?.onEnter?.()
  }, [])

  const update = useCallback((dt: number) => {
    statesRef.current[stateRef.current]?.onUpdate?.(dt)
  }, [])

  return { state, transition, update }
}
