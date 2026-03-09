// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, act } from '@testing-library/react'
import { ECSWorld, EventBus, AssetManager } from '@cubeforge/core'
import { EngineContext } from '../context'
import type { EngineState } from '../context'
import { useTimer } from '../hooks/useTimer'
import type { TimerControls } from '../hooks/useTimer'

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

// ── useTimer ─────────────────────────────────────────────────────────────────

describe('useTimer', () => {
  let engine: EngineState

  beforeEach(() => {
    engine = makeEngine()
  })

  it('does not run by default', async () => {
    let timer!: TimerControls
    function TestComp() {
      timer = useTimer(1.0)
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })
    tickScripts(engine, 0.5)
    tickScripts(engine, 0.6)
    expect(timer.isRunning).toBe(false)
    expect(timer.elapsed).toBe(0)
  })

  it('counts down correctly after start', async () => {
    let timer!: TimerControls
    function TestComp() {
      timer = useTimer(2.0)
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })
    timer.start()
    tickScripts(engine, 0.5)
    expect(timer.elapsed).toBeCloseTo(0.5)
    expect(timer.remaining).toBeCloseTo(1.5)
  })

  it('fires onComplete when elapsed >= duration', async () => {
    const cb = vi.fn()
    let timer!: TimerControls
    function TestComp() {
      timer = useTimer(1.0, cb)
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })
    timer.start()
    tickScripts(engine, 0.6)
    expect(cb).not.toHaveBeenCalled()
    tickScripts(engine, 0.5)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('stop pauses the timer', async () => {
    let timer!: TimerControls
    function TestComp() {
      timer = useTimer(2.0)
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })
    timer.start()
    tickScripts(engine, 0.5)
    timer.stop()
    tickScripts(engine, 1.0)
    expect(timer.elapsed).toBeCloseTo(0.5)
    expect(timer.isRunning).toBe(false)
  })

  it('start resumes after stop', async () => {
    let timer!: TimerControls
    function TestComp() {
      timer = useTimer(2.0)
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })
    timer.start()
    tickScripts(engine, 0.5)
    timer.stop()
    timer.start()
    tickScripts(engine, 0.3)
    expect(timer.elapsed).toBeCloseTo(0.8)
  })

  it('reset sets elapsed to 0 and stops', async () => {
    let timer!: TimerControls
    function TestComp() {
      timer = useTimer(2.0)
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })
    timer.start()
    tickScripts(engine, 1.0)
    timer.reset()
    expect(timer.elapsed).toBe(0)
    expect(timer.isRunning).toBe(false)
  })

  it('loop mode repeats after completion', async () => {
    const cb = vi.fn()
    let timer!: TimerControls
    function TestComp() {
      timer = useTimer(1.0, cb, { loop: true })
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })
    timer.start()
    // Complete first cycle
    tickScripts(engine, 1.0)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(timer.isRunning).toBe(true)
    // Complete second cycle
    tickScripts(engine, 1.0)
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('progress goes from 0 to 1', async () => {
    let timer!: TimerControls
    function TestComp() {
      timer = useTimer(1.0)
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })
    expect(timer.progress).toBe(0)
    timer.start()
    tickScripts(engine, 0.5)
    expect(timer.progress).toBeCloseTo(0.5)
    tickScripts(engine, 0.5)
    expect(timer.progress).toBe(1)
  })

  it('autoStart begins running immediately', async () => {
    let timer!: TimerControls
    function TestComp() {
      timer = useTimer(2.0, undefined, { autoStart: true })
      return null
    }
    await act(async () => {
      render(React.createElement(Wrapper, { engine }, React.createElement(TestComp)))
    })
    expect(timer.isRunning).toBe(true)
    tickScripts(engine, 0.5)
    expect(timer.elapsed).toBeCloseTo(0.5)
  })
})
