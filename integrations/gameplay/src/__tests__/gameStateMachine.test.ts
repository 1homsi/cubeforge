// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { ECSWorld, EventBus, AssetManager } from '@cubeforge/core'
import { EngineContext } from '@cubeforge/context'
import type { EngineState } from '@cubeforge/context'
import { useGameStateMachine } from '../hooks/useGameStateMachine'

function makeEngine(): EngineState {
  const ecs = new ECSWorld()
  const events = new EventBus()
  return {
    ecs,
    events,
    assets: new AssetManager(),
    input: {} as never,
    physics: { setGravity: vi.fn() } as never,
    loop: { start: vi.fn(), stop: vi.fn(), pause: vi.fn(), resume: vi.fn() } as never,
    canvas: document.createElement('canvas'),
    entityIds: new Map(),
    systemTimings: new Map(),
    postProcessStack: { add: vi.fn(), remove: vi.fn(), apply: vi.fn(), clear: vi.fn() },
  }
}

function engineWrapper(engine: EngineState) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(EngineContext.Provider, { value: engine }, children)
}

type GameStates = 'idle' | 'running' | 'jumping'

describe('useGameStateMachine', () => {
  let engine: EngineState

  beforeEach(() => {
    engine = makeEngine()
  })

  it('initializes with the given initial state', () => {
    const states = {
      idle: {},
      running: {},
      jumping: {},
    }
    const { result } = renderHook(() => useGameStateMachine<GameStates>(states, 'idle'), {
      wrapper: engineWrapper(engine),
    })
    expect(result.current.state).toBe('idle')
  })

  it('transitions to a new state', () => {
    const states = {
      idle: {},
      running: {},
      jumping: {},
    }
    const { result } = renderHook(() => useGameStateMachine<GameStates>(states, 'idle'), {
      wrapper: engineWrapper(engine),
    })
    act(() => {
      result.current.transition('running')
    })
    expect(result.current.state).toBe('running')
  })

  it('calls onEnter for initial state', () => {
    const onEnter = vi.fn()
    const states = {
      idle: { onEnter },
      running: {},
      jumping: {},
    }
    renderHook(() => useGameStateMachine<GameStates>(states, 'idle'), {
      wrapper: engineWrapper(engine),
    })
    expect(onEnter).toHaveBeenCalledOnce()
  })

  it('calls onExit on old state and onEnter on new state during transition', () => {
    const onExitIdle = vi.fn()
    const onEnterRunning = vi.fn()
    const states = {
      idle: { onExit: onExitIdle },
      running: { onEnter: onEnterRunning },
      jumping: {},
    }
    const { result } = renderHook(() => useGameStateMachine<GameStates>(states, 'idle'), {
      wrapper: engineWrapper(engine),
    })
    act(() => {
      result.current.transition('running')
    })
    expect(onExitIdle).toHaveBeenCalledOnce()
    expect(onEnterRunning).toHaveBeenCalledOnce()
  })

  it('does nothing when transitioning to the same state', () => {
    const onExit = vi.fn()
    const onEnter = vi.fn()
    const states = {
      idle: { onExit, onEnter },
      running: {},
      jumping: {},
    }
    const { result } = renderHook(() => useGameStateMachine<GameStates>(states, 'idle'), {
      wrapper: engineWrapper(engine),
    })
    // Reset the initial onEnter call count
    onEnter.mockClear()
    act(() => {
      result.current.transition('idle')
    })
    expect(onExit).not.toHaveBeenCalled()
    expect(onEnter).not.toHaveBeenCalled()
    expect(result.current.state).toBe('idle')
  })

  it('transition function is stable', () => {
    const states = { idle: {}, running: {}, jumping: {} }
    const { result, rerender } = renderHook(
      () => useGameStateMachine<GameStates>(states, 'idle'),
      { wrapper: engineWrapper(engine) },
    )
    const fn1 = result.current.transition
    rerender()
    expect(result.current.transition).toBe(fn1)
  })

  it('creates an ECS entity for the update script', () => {
    const states = { idle: {}, running: {}, jumping: {} }
    const entityCountBefore = engine.ecs.query('Script').length
    renderHook(() => useGameStateMachine<GameStates>(states, 'idle'), {
      wrapper: engineWrapper(engine),
    })
    // Should have created at least one entity with a Script component
    expect(engine.ecs.query('Script').length).toBeGreaterThan(entityCountBefore)
  })
})
