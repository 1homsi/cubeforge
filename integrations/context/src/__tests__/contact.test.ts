// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { ECSWorld, EventBus, AssetManager, createTag } from '@cubeforge/core'
import { createBoxCollider } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'
import type { EngineState } from '../context'
import {
  useTriggerEnter,
  useTriggerExit,
  useCollisionEnter,
  useCollisionExit,
  useTriggerStay,
  useCollisionStay,
  useCircleEnter,
  useCircleExit,
  useCircleStay,
} from '../useContact'

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

function contactWrapper(engine: EngineState, entityId: number) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      EngineContext.Provider,
      { value: engine },
      React.createElement(EntityContext.Provider, { value: entityId }, children),
    )
}

/** Shorthand: matcher for the ContactData object — just checks it's an object with numbers */
const anyContact = expect.objectContaining({ normalX: expect.any(Number), normalY: expect.any(Number) })

describe('useContact hooks', () => {
  let engine: EngineState
  let entityA: number
  let entityB: number

  beforeEach(() => {
    engine = makeEngine()
    entityA = engine.ecs.createEntity()
    entityB = engine.ecs.createEntity()
  })

  describe('useTriggerEnter', () => {
    it('fires when triggerEnter event includes this entity as A', () => {
      const handler = vi.fn()
      renderHook(() => useTriggerEnter(handler), {
        wrapper: contactWrapper(engine, entityA),
      })

      act(() => {
        engine.events.emit('triggerEnter', { a: entityA, b: entityB })
      })
      expect(handler).toHaveBeenCalledWith(entityB, anyContact)
    })

    it('fires when triggerEnter event includes this entity as B', () => {
      const handler = vi.fn()
      renderHook(() => useTriggerEnter(handler), {
        wrapper: contactWrapper(engine, entityB),
      })

      act(() => {
        engine.events.emit('triggerEnter', { a: entityA, b: entityB })
      })
      expect(handler).toHaveBeenCalledWith(entityA, anyContact)
    })

    it('does not fire for unrelated entities', () => {
      const entityC = engine.ecs.createEntity()
      const handler = vi.fn()
      renderHook(() => useTriggerEnter(handler), {
        wrapper: contactWrapper(engine, entityA),
      })

      act(() => {
        engine.events.emit('triggerEnter', { a: entityB, b: entityC })
      })
      expect(handler).not.toHaveBeenCalled()
    })

    it('filters by tag', () => {
      engine.ecs.addComponent(entityB, createTag('player'))
      const handler = vi.fn()
      renderHook(() => useTriggerEnter(handler, { tag: 'player' }), {
        wrapper: contactWrapper(engine, entityA),
      })

      act(() => {
        engine.events.emit('triggerEnter', { a: entityA, b: entityB })
      })
      expect(handler).toHaveBeenCalledWith(entityB, anyContact)
    })

    it('does not fire when tag does not match', () => {
      engine.ecs.addComponent(entityB, createTag('enemy'))
      const handler = vi.fn()
      renderHook(() => useTriggerEnter(handler, { tag: 'player' }), {
        wrapper: contactWrapper(engine, entityA),
      })

      act(() => {
        engine.events.emit('triggerEnter', { a: entityA, b: entityB })
      })
      expect(handler).not.toHaveBeenCalled()
    })

    it('filters by layer', () => {
      engine.ecs.addComponent(entityB, createBoxCollider(10, 10, { layer: 'enemies' }))
      const handler = vi.fn()
      renderHook(() => useTriggerEnter(handler, { layer: 'enemies' }), {
        wrapper: contactWrapper(engine, entityA),
      })

      act(() => {
        engine.events.emit('triggerEnter', { a: entityA, b: entityB })
      })
      expect(handler).toHaveBeenCalledWith(entityB, anyContact)
    })

    it('does not fire when layer does not match', () => {
      engine.ecs.addComponent(entityB, createBoxCollider(10, 10, { layer: 'terrain' }))
      const handler = vi.fn()
      renderHook(() => useTriggerEnter(handler, { layer: 'enemies' }), {
        wrapper: contactWrapper(engine, entityA),
      })

      act(() => {
        engine.events.emit('triggerEnter', { a: entityA, b: entityB })
      })
      expect(handler).not.toHaveBeenCalled()
    })

    it('orients normalX toward self — entity A gets flipped normal', () => {
      const handler = vi.fn()
      renderHook(() => useTriggerEnter(handler), {
        wrapper: contactWrapper(engine, entityA),
      })

      // Event has normalX=1 (A→B direction). Entity A should receive normalX=-1 (B→A = toward A)
      act(() => {
        engine.events.emit('triggerEnter', { a: entityA, b: entityB, normalX: 1, normalY: 0 })
      })
      const call = (handler as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(call[0]).toBe(entityB)
      expect(call[1].normalX).toBeCloseTo(-1)
      expect(call[1].normalY).toBeCloseTo(0)
    })

    it('orients normalX toward self — entity B keeps normal as-is', () => {
      const handler = vi.fn()
      renderHook(() => useTriggerEnter(handler), {
        wrapper: contactWrapper(engine, entityB),
      })

      // Event has normalX=1 (A→B direction). Entity B should receive normalX=1 (A→B = toward B)
      act(() => {
        engine.events.emit('triggerEnter', { a: entityA, b: entityB, normalX: 1, normalY: 0 })
      })
      expect(handler).toHaveBeenCalledWith(entityA, expect.objectContaining({ normalX: 1, normalY: 0 }))
    })
  })

  describe('useTriggerExit', () => {
    it('fires on triggerExit event', () => {
      const handler = vi.fn()
      renderHook(() => useTriggerExit(handler), {
        wrapper: contactWrapper(engine, entityA),
      })

      act(() => {
        engine.events.emit('triggerExit', { a: entityA, b: entityB })
      })
      expect(handler).toHaveBeenCalledWith(entityB, anyContact)
    })
  })

  describe('useCollisionEnter', () => {
    it('fires on collisionEnter event', () => {
      const handler = vi.fn()
      renderHook(() => useCollisionEnter(handler), {
        wrapper: contactWrapper(engine, entityA),
      })

      act(() => {
        engine.events.emit('collisionEnter', { a: entityA, b: entityB })
      })
      expect(handler).toHaveBeenCalledWith(entityB, anyContact)
    })
  })

  describe('useCollisionExit', () => {
    it('fires on collisionExit event', () => {
      const handler = vi.fn()
      renderHook(() => useCollisionExit(handler), {
        wrapper: contactWrapper(engine, entityA),
      })

      act(() => {
        engine.events.emit('collisionExit', { a: entityA, b: entityB })
      })
      expect(handler).toHaveBeenCalledWith(entityB, anyContact)
    })
  })

  describe('useTriggerStay', () => {
    it('fires on triggerStay event', () => {
      const handler = vi.fn()
      renderHook(() => useTriggerStay(handler), {
        wrapper: contactWrapper(engine, entityA),
      })

      act(() => {
        engine.events.emit('triggerStay', { a: entityA, b: entityB })
      })
      expect(handler).toHaveBeenCalledWith(entityB, anyContact)
    })
  })

  describe('useCollisionStay', () => {
    it('fires on collisionStay event', () => {
      const handler = vi.fn()
      renderHook(() => useCollisionStay(handler), {
        wrapper: contactWrapper(engine, entityA),
      })

      act(() => {
        engine.events.emit('collisionStay', { a: entityA, b: entityB })
      })
      expect(handler).toHaveBeenCalledWith(entityB, anyContact)
    })
  })

  describe('useCircleEnter', () => {
    it('fires on circleEnter event', () => {
      const handler = vi.fn()
      renderHook(() => useCircleEnter(handler), {
        wrapper: contactWrapper(engine, entityA),
      })

      act(() => {
        engine.events.emit('circleEnter', { a: entityA, b: entityB })
      })
      expect(handler).toHaveBeenCalledWith(entityB, anyContact)
    })
  })

  describe('useCircleExit', () => {
    it('fires on circleExit event', () => {
      const handler = vi.fn()
      renderHook(() => useCircleExit(handler), {
        wrapper: contactWrapper(engine, entityA),
      })

      act(() => {
        engine.events.emit('circleExit', { a: entityA, b: entityB })
      })
      expect(handler).toHaveBeenCalledWith(entityB, anyContact)
    })
  })

  describe('useCircleStay', () => {
    it('fires on circleStay event', () => {
      const handler = vi.fn()
      renderHook(() => useCircleStay(handler), {
        wrapper: contactWrapper(engine, entityA),
      })

      act(() => {
        engine.events.emit('circleStay', { a: entityA, b: entityB })
      })
      expect(handler).toHaveBeenCalledWith(entityB, anyContact)
    })
  })

  describe('handler ref update', () => {
    it('uses the latest handler without re-subscribing', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const { rerender } = renderHook(({ handler }) => useTriggerEnter(handler), {
        wrapper: contactWrapper(engine, entityA),
        initialProps: { handler: handler1 },
      })

      rerender({ handler: handler2 })

      act(() => {
        engine.events.emit('triggerEnter', { a: entityA, b: entityB })
      })
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledWith(entityB, anyContact)
    })
  })
})
