// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { ECSWorld, EventBus, AssetManager } from '@cubeforge/core'
import { EngineContext } from '../context'
import type { EngineState } from '../context'
import { useHistory } from '../hooks/useHistory'

function makeEngine(): EngineState {
  const ecs = new ECSWorld()
  const events = new EventBus()
  const loop = {
    markDirty: vi.fn(),
    isRunning: false,
    isPaused: false,
    isOnDemand: false,
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    hitPause: vi.fn(),
  }
  return {
    ecs,
    events,
    assets: new AssetManager(),
    input: {} as never,
    physics: { setGravity: vi.fn() } as never,
    loop: loop as never,
    canvas: document.createElement('canvas'),
    entityIds: new Map(),
    systemTimings: new Map(),
    postProcessStack: { add: vi.fn(), remove: vi.fn(), apply: vi.fn(), clear: vi.fn() },
  }
}

function wrapper(engine: EngineState) {
  return ({ children }: { children: React.ReactNode }) => (
    <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>
  )
}

describe('useHistory', () => {
  let engine: EngineState

  beforeEach(() => {
    engine = makeEngine()
  })

  it('starts with canUndo=false and canRedo=false', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: wrapper(engine) })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
    expect(result.current.length).toBe(0)
  })

  it('push() adds a snapshot and length increases', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: wrapper(engine) })
    act(() => result.current.push())
    expect(result.current.length).toBe(1)
    act(() => result.current.push())
    expect(result.current.length).toBe(2)
  })

  it('canUndo becomes true after two pushes', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: wrapper(engine) })
    act(() => result.current.push())
    expect(result.current.canUndo).toBe(false) // only one snapshot — nothing to undo to
    act(() => result.current.push())
    expect(result.current.canUndo).toBe(true)
  })

  it('undo() restores a previous snapshot and marks dirty', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: wrapper(engine) })
    const eid1 = engine.ecs.createEntity()
    act(() => result.current.push())
    const eid2 = engine.ecs.createEntity()
    act(() => result.current.push())

    expect(engine.ecs.entityCount).toBe(2)
    act(() => result.current.undo())
    // After undo, we should be back to the state with one entity
    expect(engine.ecs.entityCount).toBe(1)
    expect(engine.loop.markDirty).toHaveBeenCalled()
    void eid1
    void eid2
  })

  it('redo() re-applies an undone snapshot', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: wrapper(engine) })
    engine.ecs.createEntity()
    act(() => result.current.push())
    engine.ecs.createEntity()
    act(() => result.current.push())

    act(() => result.current.undo())
    expect(engine.ecs.entityCount).toBe(1)
    expect(result.current.canRedo).toBe(true)

    act(() => result.current.redo())
    expect(engine.ecs.entityCount).toBe(2)
    expect(result.current.canRedo).toBe(false)
  })

  it('push() after undo truncates the redo future', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: wrapper(engine) })
    act(() => result.current.push())
    act(() => result.current.push())
    act(() => result.current.push())
    expect(result.current.length).toBe(3)

    act(() => result.current.undo())
    expect(result.current.canRedo).toBe(true)

    act(() => result.current.push())
    // The redo future is now gone
    expect(result.current.canRedo).toBe(false)
  })

  it('evicts oldest entries when over capacity', () => {
    const { result } = renderHook(() => useHistory({ capacity: 3 }), { wrapper: wrapper(engine) })
    act(() => result.current.push())
    act(() => result.current.push())
    act(() => result.current.push())
    act(() => result.current.push())
    expect(result.current.length).toBe(3)
  })

  it('clear() empties the stack', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: wrapper(engine) })
    act(() => result.current.push())
    act(() => result.current.push())
    act(() => result.current.clear())
    expect(result.current.length).toBe(0)
    expect(result.current.canUndo).toBe(false)
  })

  it('undo/redo are no-ops at the boundaries', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: wrapper(engine) })
    expect(() => act(() => result.current.undo())).not.toThrow()
    expect(() => act(() => result.current.redo())).not.toThrow()
    act(() => result.current.push())
    expect(() => act(() => result.current.undo())).not.toThrow()
  })
})
