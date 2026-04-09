// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { ECSWorld, EventBus, AssetManager, createTransform } from '@cubeforge/core'
import { EngineContext, EntityContext } from '../context'
import type { EngineState } from '../context'
import { RigidBody } from '../components/RigidBody'

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

describe('RigidBody component', () => {
  let engine: EngineState
  let entityId: number

  beforeEach(() => {
    engine = makeEngine()
    entityId = engine.ecs.createEntity()
    engine.ecs.addComponent(entityId, createTransform(0, 0))
  })

  function renderRB(props: Record<string, unknown> = {}) {
    return render(
      <EngineContext.Provider value={engine}>
        <EntityContext.Provider value={entityId}>
          <RigidBody {...props} />
        </EntityContext.Provider>
      </EngineContext.Provider>,
    )
  }

  function getRigidBody<T extends object = { type: string }>(): T {
    return engine.ecs.getComponent(entityId, 'RigidBody') as unknown as T
  }

  it('registers a RigidBody component', async () => {
    await act(async () => {
      renderRB()
    })
    const rb = getRigidBody()
    expect(rb).toBeDefined()
    expect(rb.type).toBe('RigidBody')
  })

  it('sets mass prop', async () => {
    await act(async () => {
      renderRB({ mass: 10 })
    })
    const rb = getRigidBody<{ mass: number }>()
    expect(rb.mass).toBe(10)
  })

  it('sets isStatic prop', async () => {
    await act(async () => {
      renderRB({ isStatic: true })
    })
    const rb = getRigidBody<{ isStatic: boolean }>()
    expect(rb.isStatic).toBe(true)
  })

  it('sets linearDamping prop', async () => {
    // friction was removed in 0.5.0 in favor of per-collider friction. Use
    // linearDamping as a proxy for "a scalar that adjusts how motion attenuates".
    await act(async () => {
      renderRB({ linearDamping: 0.3 })
    })
    const rb = getRigidBody<{ linearDamping: number }>()
    expect(rb.linearDamping).toBe(0.3)
  })

  it('sets gravityScale prop', async () => {
    await act(async () => {
      renderRB({ gravityScale: 0 })
    })
    const rb = getRigidBody<{ gravityScale: number }>()
    expect(rb.gravityScale).toBe(0)
  })

  it('sets ccd prop', async () => {
    await act(async () => {
      renderRB({ ccd: true })
    })
    const rb = getRigidBody<{ ccd: boolean }>()
    expect(rb.ccd).toBe(true)
  })

  it('removes RigidBody on unmount', async () => {
    let unmount: () => void
    await act(async () => {
      const result = renderRB()
      unmount = result.unmount
    })
    expect(engine.ecs.getComponent(entityId, 'RigidBody')).toBeDefined()
    await act(async () => {
      unmount()
    })
    expect(engine.ecs.getComponent(entityId, 'RigidBody')).toBeUndefined()
  })

  it('sets default friction to 0.85', async () => {
    await act(async () => {
      renderRB()
    })
    const rb = getRigidBody<{ friction: number }>()
    expect(rb.friction).toBe(0.85)
  })

  it('sets lockRotation', async () => {
    await act(async () => {
      renderRB({ lockRotation: false })
    })
    const rb = getRigidBody<{ lockRotation: boolean }>()
    expect(rb.lockRotation).toBe(false)
  })

  it('sets density', async () => {
    await act(async () => {
      renderRB({ density: 2.5 })
    })
    const rb = getRigidBody<{ density: number }>()
    expect(rb.density).toBe(2.5)
  })
})
