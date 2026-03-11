// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { ECSWorld, EventBus, AssetManager } from '@cubeforge/core'
import { EngineContext, EntityContext } from '@cubeforge/context'
import type { EngineState } from '@cubeforge/context'
import { useHealth } from '../hooks/useHealth'

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

function wrapper(engine: EngineState, entityId: number) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      EngineContext.Provider,
      { value: engine },
      React.createElement(EntityContext.Provider, { value: entityId }, children),
    )
}

describe('useHealth', () => {
  let engine: EngineState
  let entityId: number

  beforeEach(() => {
    engine = makeEngine()
    entityId = engine.ecs.createEntity()
  })

  it('initializes with maxHp', () => {
    const { result } = renderHook(() => useHealth(100), {
      wrapper: wrapper(engine, entityId),
    })
    expect(result.current.hp).toBe(100)
    expect(result.current.maxHp).toBe(100)
    expect(result.current.isDead).toBe(false)
  })

  it('takeDamage reduces hp', () => {
    const { result } = renderHook(() => useHealth(100, { iFrames: 0 }), {
      wrapper: wrapper(engine, entityId),
    })
    act(() => {
      result.current.takeDamage(25)
    })
    expect(result.current.hp).toBe(75)
  })

  it('takeDamage with default amount is 1', () => {
    const { result } = renderHook(() => useHealth(10, { iFrames: 0 }), {
      wrapper: wrapper(engine, entityId),
    })
    act(() => {
      result.current.takeDamage()
    })
    expect(result.current.hp).toBe(9)
  })

  it('hp does not go below 0', () => {
    const { result } = renderHook(() => useHealth(5, { iFrames: 0 }), {
      wrapper: wrapper(engine, entityId),
    })
    act(() => {
      result.current.takeDamage(100)
    })
    expect(result.current.hp).toBe(0)
  })

  it('isDead is true when hp reaches 0', () => {
    const { result } = renderHook(() => useHealth(5, { iFrames: 0 }), {
      wrapper: wrapper(engine, entityId),
    })
    act(() => {
      result.current.takeDamage(5)
    })
    expect(result.current.isDead).toBe(true)
  })

  it('calls onDeath when hp reaches 0', () => {
    const onDeath = vi.fn()
    const { result } = renderHook(() => useHealth(5, { iFrames: 0, onDeath }), {
      wrapper: wrapper(engine, entityId),
    })
    act(() => {
      result.current.takeDamage(5)
    })
    expect(onDeath).toHaveBeenCalledOnce()
  })

  it('calls onDamage with amount and current hp', () => {
    const onDamage = vi.fn()
    const { result } = renderHook(() => useHealth(100, { iFrames: 0, onDamage }), {
      wrapper: wrapper(engine, entityId),
    })
    act(() => {
      result.current.takeDamage(30)
    })
    expect(onDamage).toHaveBeenCalledWith(30, 70)
  })

  it('heal increases hp up to maxHp', () => {
    const { result } = renderHook(() => useHealth(100, { iFrames: 0 }), {
      wrapper: wrapper(engine, entityId),
    })
    act(() => {
      result.current.takeDamage(50)
    })
    expect(result.current.hp).toBe(50)
    act(() => {
      result.current.heal(30)
    })
    expect(result.current.hp).toBe(80)
  })

  it('heal does not exceed maxHp', () => {
    const { result } = renderHook(() => useHealth(100, { iFrames: 0 }), {
      wrapper: wrapper(engine, entityId),
    })
    act(() => {
      result.current.heal(999)
    })
    expect(result.current.hp).toBe(100)
  })

  it('setHp clamps between 0 and maxHp', () => {
    const { result } = renderHook(() => useHealth(100, { iFrames: 0 }), {
      wrapper: wrapper(engine, entityId),
    })
    act(() => {
      result.current.setHp(50)
    })
    expect(result.current.hp).toBe(50)

    act(() => {
      result.current.setHp(-10)
    })
    expect(result.current.hp).toBe(0)

    act(() => {
      result.current.setHp(200)
    })
    expect(result.current.hp).toBe(100)
  })

  it('invincibility frames prevent damage', () => {
    const { result } = renderHook(() => useHealth(100, { iFrames: 1.0 }), {
      wrapper: wrapper(engine, entityId),
    })
    act(() => {
      result.current.takeDamage(10)
    })
    expect(result.current.hp).toBe(90)
    expect(result.current.isInvincible).toBe(true)

    // Second damage should be blocked
    act(() => {
      result.current.takeDamage(10)
    })
    expect(result.current.hp).toBe(90)
  })

  it('invincibility wears off after timer expires', () => {
    const { result } = renderHook(() => useHealth(100, { iFrames: 1.0 }), {
      wrapper: wrapper(engine, entityId),
    })
    act(() => {
      result.current.takeDamage(10)
    })
    expect(result.current.isInvincible).toBe(true)

    // Advance the timer past iFrame duration
    act(() => {
      result.current.update(1.1)
    })
    expect(result.current.isInvincible).toBe(false)

    // Now damage should work again
    act(() => {
      result.current.takeDamage(10)
    })
    expect(result.current.hp).toBe(80)
  })

  it('does not take damage when already dead', () => {
    const onDeath = vi.fn()
    const { result } = renderHook(() => useHealth(5, { iFrames: 0, onDeath }), {
      wrapper: wrapper(engine, entityId),
    })
    act(() => {
      result.current.takeDamage(5)
    })
    act(() => {
      result.current.takeDamage(5)
    })
    // onDeath should only fire once
    expect(onDeath).toHaveBeenCalledOnce()
  })
})
