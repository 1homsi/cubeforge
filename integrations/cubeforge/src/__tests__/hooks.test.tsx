// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, act } from '@testing-library/react'
import { ECSWorld, EventBus, AssetManager } from '@cubeforge/core'
import { EngineContext, EntityContext } from '../context'
import type { EngineState } from '../context'
import { createTimer } from '@cubeforge/core'
import { useHealth } from '@cubeforge/gameplay'
import { useInputMap } from '../hooks/useInputMap'

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

function Wrapper({ engine, entityId, children }: { engine: EngineState; entityId?: number; children: React.ReactNode }) {
  const eid = entityId ?? 0
  return (
    <EngineContext.Provider value={engine}>
      <EntityContext.Provider value={eid}>
        {children}
      </EntityContext.Provider>
    </EngineContext.Provider>
  )
}

// ── createTimer ───────────────────────────────────────────────────────────────

describe('createTimer', () => {
  it('does not run until started', () => {
    const cb = vi.fn()
    const t = createTimer(1.0, cb)
    t.update(0.5)
    t.update(0.6)
    expect(cb).not.toHaveBeenCalled()
  })

  it('fires onComplete after elapsed >= duration', () => {
    const cb = vi.fn()
    const t = createTimer(1.0, cb)
    t.restart()
    t.update(0.6)
    t.update(0.5)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('does not fire again after completing', () => {
    const cb = vi.fn()
    const t = createTimer(0.5, cb)
    t.restart()
    t.update(1.0)
    t.update(1.0)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('progress goes from 0 to 1', () => {
    const t = createTimer(1.0)
    t.restart()
    t.update(0.5)
    expect(t.progress).toBeCloseTo(0.5)
    t.update(0.5)
    expect(t.progress).toBe(1)
  })

  it('restart resets elapsed', () => {
    const t = createTimer(2.0)
    t.restart()
    t.update(1.0)
    t.restart()
    expect(t.elapsed).toBe(0)
    expect(t.running).toBe(true)
  })

  it('remaining is clamped to 0', () => {
    const t = createTimer(0.5)
    t.restart()
    t.update(1.0)
    expect(t.remaining).toBe(0)
  })
})

// ── useHealth ─────────────────────────────────────────────────────────────────

describe('useHealth', () => {
  let engine: EngineState
  let entityId: number

  beforeEach(() => {
    engine = makeEngine()
    entityId = engine.ecs.createEntity()
  })

  it('initializes with full HP', async () => {
    let health!: ReturnType<typeof useHealth>
    function TestComp() {
      health = useHealth(5, { iFrames: 0 })
      return null
    }
    await act(async () => {
      render(<Wrapper engine={engine} entityId={entityId}><TestComp /></Wrapper>)
    })
    expect(health.hp).toBe(5)
    expect(health.maxHp).toBe(5)
    expect(health.isDead).toBe(false)
  })

  it('takeDamage reduces HP', async () => {
    let health!: ReturnType<typeof useHealth>
    function TestComp() {
      health = useHealth(5, { iFrames: 0 })
      return null
    }
    await act(async () => {
      render(<Wrapper engine={engine} entityId={entityId}><TestComp /></Wrapper>)
    })
    health.takeDamage(2)
    expect(health.hp).toBe(3)
  })

  it('isDead is true when HP reaches 0', async () => {
    let health!: ReturnType<typeof useHealth>
    function TestComp() {
      health = useHealth(3, { iFrames: 0 })
      return null
    }
    await act(async () => {
      render(<Wrapper engine={engine} entityId={entityId}><TestComp /></Wrapper>)
    })
    health.takeDamage(3)
    expect(health.isDead).toBe(true)
  })

  it('heal restores HP clamped to maxHp', async () => {
    let health!: ReturnType<typeof useHealth>
    function TestComp() {
      health = useHealth(5, { iFrames: 0 })
      return null
    }
    await act(async () => {
      render(<Wrapper engine={engine} entityId={entityId}><TestComp /></Wrapper>)
    })
    health.takeDamage(3)
    health.heal(10)
    expect(health.hp).toBe(5)
  })

  it('onDeath fires when HP hits 0', async () => {
    const onDeath = vi.fn()
    let health!: ReturnType<typeof useHealth>
    function TestComp() {
      health = useHealth(2, { iFrames: 0, onDeath })
      return null
    }
    await act(async () => {
      render(<Wrapper engine={engine} entityId={entityId}><TestComp /></Wrapper>)
    })
    health.takeDamage(2)
    expect(onDeath).toHaveBeenCalledTimes(1)
  })
})

// ── useInputMap ───────────────────────────────────────────────────────────────

describe('useInputMap', () => {
  it('isActionDown returns true when key is pressed', async () => {
    // Create a fake input with isDown returning true for Space
    const mockInput = { isDown: (k: string) => k === 'Space', isPressed: () => false, isReleased: () => false } as never
    const fakeEngine: EngineState = {
      ...makeEngine(),
      input: mockInput,
    }

    let actions!: ReturnType<typeof useInputMap>
    function TestComp() {
      actions = useInputMap({ jump: ['Space', 'ArrowUp'] })
      return null
    }
    await act(async () => {
      render(<EngineContext.Provider value={fakeEngine}><TestComp /></EngineContext.Provider>)
    })
    expect(actions.isActionDown('jump')).toBe(true)
    expect(actions.isActionDown('left')).toBe(false)
  })

  it('isActionPressed returns true only for pressed key', async () => {
    const mockInput = { isDown: () => false, isPressed: (k: string) => k === 'ArrowLeft', isReleased: () => false } as never
    const fakeEngine: EngineState = { ...makeEngine(), input: mockInput }

    let actions!: ReturnType<typeof useInputMap>
    function TestComp() {
      actions = useInputMap({ left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'] })
      return null
    }
    await act(async () => {
      render(<EngineContext.Provider value={fakeEngine}><TestComp /></EngineContext.Provider>)
    })
    expect(actions.isActionPressed('left')).toBe(true)
    expect(actions.isActionPressed('right')).toBe(false)
  })
})
