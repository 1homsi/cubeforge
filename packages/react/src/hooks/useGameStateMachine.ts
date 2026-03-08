import { useState, useRef, useCallback, useEffect, useContext } from 'react'
import { createScript } from '@cubeforge/core'
import { EngineContext } from '../context'

export interface GameState {
  /** Called once when this state becomes active. */
  onEnter?(): void
  /** Called once when leaving this state. */
  onExit?(): void
  /**
   * Called every frame while this state is active.
   * Runs automatically inside the ScriptSystem tick — no manual wiring needed.
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
}

/**
 * Lightweight game state machine for top-level game flow (menu → playing → paused → dead).
 *
 * `onUpdate` callbacks run automatically inside the ScriptSystem tick — they
 * respect pause and deterministic mode without any manual wiring.
 *
 * @example
 * ```tsx
 * const { state, transition } = useGameStateMachine({
 *   playing: {
 *     onEnter: () => console.log('game started'),
 *     onUpdate: (dt) => { moveEnemies(dt) },
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
  const engine = useContext(EngineContext)!
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

  // Register a Script entity so onUpdate runs inside the ScriptSystem tick —
  // respects pause and deterministic stepping without any caller wiring.
  useEffect(() => {
    const eid = engine.ecs.createEntity()
    engine.ecs.addComponent(eid, createScript((_id, _world, _input, dt) => {
      statesRef.current[stateRef.current]?.onUpdate?.(dt)
    }))
    return () => {
      if (engine.ecs.hasEntity(eid)) engine.ecs.destroyEntity(eid)
    }
  }, [engine.ecs])

  return { state, transition }
}
