import { useState, useRef, useCallback, useEffect, useContext } from 'react'
import { createScript } from '@cubeforge/core'
import { EngineContext } from '@cubeforge/context'

export interface GameState {
  onEnter?(): void
  onExit?(): void
  onUpdate?(dt: number): void
}

export interface GameStateMachineResult<S extends string> {
  readonly state: S
  transition(to: S): void
}

export function useGameStateMachine<S extends string>(
  states: Record<S, GameState>,
  initial: S,
): GameStateMachineResult<S> {
  const engine = useContext(EngineContext)!
  const [state, setState] = useState<S>(initial)
  const stateRef = useRef<S>(initial)
  const statesRef = useRef(states)
  statesRef.current = states

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
