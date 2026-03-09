// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, act } from '@testing-library/react'
import { ECSWorld, EventBus, AssetManager } from '@cubeforge/core'
import { EngineContext } from '../context'
import type { EngineState } from '../context'
import { useCoroutine, wait, waitFrames, waitUntil } from '../hooks/useCoroutine'
import type { CoroutineControls } from '../hooks/useCoroutine'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEngine(): EngineState {
  const ecs = new ECSWorld()
  const events = new EventBus()
  return {
    ecs,
    events,
    assets: new AssetManager(),
    input: {} as never,
    physics: { setGravity: vi.fn() } as never,
    loop: {} as never,
    canvas: document.createElement('canvas'),
    entityIds: new Map(),
    systemTimings: new Map(),
    postProcessStack: { add: vi.fn(), remove: vi.fn(), apply: vi.fn(), clear: vi.fn() },
  }
}

function Wrapper({ engine, children }: { engine: EngineState; children?: React.ReactNode }) {
  return React.createElement(EngineContext.Provider, { value: engine }, children)
}

/** Simulate N frames by calling every Script component's update */
function tickScripts(engine: EngineState, dt: number, frames = 1) {
  for (let i = 0; i < frames; i++) {
    for (const eid of engine.ecs.query('Script')) {
      const script = engine.ecs.getComponent(eid, 'Script') as unknown as {
        update: (id: number, world: ECSWorld, input: unknown, dt: number) => void
      }
      script.update(eid, engine.ecs, {}, dt)
    }
  }
}

// ── useCoroutine ─────────────────────────────────────────────────────────────

describe('useCoroutine', () => {
  let engine: EngineState

  beforeEach(() => {
    engine = makeEngine()
  })

  it('wait() pauses for specified seconds', async () => {
    let co!: CoroutineControls
    const log: string[] = []

    function TestComp() {
      co = useCoroutine()
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })

    co.start(function* () {
      log.push('a')
      yield wait(0.5)
      log.push('b')
    })

    // First tick: runs until yield wait(0.5)
    tickScripts(engine, 1 / 60)
    expect(log).toEqual(['a'])

    // Not enough time has passed
    tickScripts(engine, 0.3)
    expect(log).toEqual(['a'])

    // Now enough time passed (0.3 + 0.3 > 0.5)
    tickScripts(engine, 0.3)
    expect(log).toEqual(['a', 'b'])
  })

  it('waitFrames() pauses for specified frames', async () => {
    let co!: CoroutineControls
    const log: string[] = []

    function TestComp() {
      co = useCoroutine()
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })

    co.start(function* () {
      log.push('start')
      yield waitFrames(3)
      log.push('end')
    })

    // Frame 1: runs generator, gets waitFrames(3)
    tickScripts(engine, 1 / 60)
    expect(log).toEqual(['start'])

    // Frames 2, 3, 4: waiting 3 frames
    tickScripts(engine, 1 / 60)
    expect(log).toEqual(['start'])
    tickScripts(engine, 1 / 60)
    expect(log).toEqual(['start'])
    tickScripts(engine, 1 / 60)
    expect(log).toEqual(['start', 'end'])
  })

  it('waitUntil() resumes when condition is true', async () => {
    let co!: CoroutineControls
    const log: string[] = []
    let ready = false

    function TestComp() {
      co = useCoroutine()
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })

    co.start(function* () {
      log.push('waiting')
      yield waitUntil(() => ready)
      log.push('done')
    })

    tickScripts(engine, 1 / 60)
    expect(log).toEqual(['waiting'])

    tickScripts(engine, 1 / 60)
    expect(log).toEqual(['waiting'])

    ready = true
    tickScripts(engine, 1 / 60)
    expect(log).toEqual(['waiting', 'done'])
  })

  it('yield null waits one frame', async () => {
    let co!: CoroutineControls
    const log: string[] = []

    function TestComp() {
      co = useCoroutine()
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })

    co.start(function* () {
      log.push('a')
      yield null
      log.push('b')
    })

    // Frame 1: runs until yield null
    tickScripts(engine, 1 / 60)
    expect(log).toEqual(['a'])

    // Frame 2: one frame wait
    tickScripts(engine, 1 / 60)
    expect(log).toEqual(['a', 'b'])
  })

  it('cancel() stops a running coroutine', async () => {
    let co!: CoroutineControls
    const log: string[] = []

    function TestComp() {
      co = useCoroutine()
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })

    const id = co.start(function* () {
      log.push('a')
      yield wait(1.0)
      log.push('b')
    })

    tickScripts(engine, 1 / 60)
    expect(log).toEqual(['a'])

    co.cancel(id)
    tickScripts(engine, 2.0)
    expect(log).toEqual(['a']) // 'b' never happens
    expect(co.activeCount).toBe(0)
  })

  it('cancelAll() stops everything', async () => {
    let co!: CoroutineControls
    const log: string[] = []

    function TestComp() {
      co = useCoroutine()
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })

    co.start(function* () {
      log.push('a1')
      yield wait(1.0)
      log.push('a2')
    })

    co.start(function* () {
      log.push('b1')
      yield wait(1.0)
      log.push('b2')
    })

    tickScripts(engine, 1 / 60)
    expect(log).toEqual(['a1', 'b1'])
    expect(co.activeCount).toBe(2)

    co.cancelAll()
    tickScripts(engine, 2.0)
    expect(log).toEqual(['a1', 'b1'])
    expect(co.activeCount).toBe(0)
  })

  it('multiple coroutines run concurrently', async () => {
    let co!: CoroutineControls
    const log: string[] = []

    function TestComp() {
      co = useCoroutine()
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })

    co.start(function* () {
      log.push('fast-start')
      yield wait(0.2)
      log.push('fast-end')
    })

    co.start(function* () {
      log.push('slow-start')
      yield wait(0.5)
      log.push('slow-end')
    })

    // First tick: both start
    tickScripts(engine, 1 / 60)
    expect(log).toEqual(['fast-start', 'slow-start'])

    // After 0.3s: fast finishes
    tickScripts(engine, 0.3)
    expect(log).toEqual(['fast-start', 'slow-start', 'fast-end'])
    expect(co.activeCount).toBe(1)

    // After 0.3s more: slow finishes
    tickScripts(engine, 0.3)
    expect(log).toEqual(['fast-start', 'slow-start', 'fast-end', 'slow-end'])
    expect(co.activeCount).toBe(0)
  })

  it('completed coroutines are cleaned up', async () => {
    let co!: CoroutineControls

    function TestComp() {
      co = useCoroutine()
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })

    co.start(function* () {
      // Immediate completion, no yields
    })

    tickScripts(engine, 1 / 60)
    expect(co.activeCount).toBe(0)
  })
})
