// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
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

  it('registers a RigidBody component', async () => {
    await act(async () => {
      renderRB()
    })
    const rb = engine.ecs.getComponent(entityId, 'RigidBody')
    expect(rb).toBeDefined()
    expect(rb!.type).toBe('RigidBody')
  })

  it('sets mass prop', async () => {
    await act(async () => {
      renderRB({ mass: 10 })
    })
    const rb = engine.ecs.getComponent(entityId, 'RigidBody') as { mass: number }
    expect(rb.mass).toBe(10)
  })

  it('sets isStatic prop', async () => {
    await act(async () => {
      renderRB({ isStatic: true })
    })
    const rb = engine.ecs.getComponent(entityId, 'RigidBody') as { isStatic: boolean }
    expect(rb.isStatic).toBe(true)
  })

  it('sets friction prop', async () => {
    await act(async () => {
      renderRB({ friction: 0.5 })
    })
    const rb = engine.ecs.getComponent(entityId, 'RigidBody') as { friction: number }
    expect(rb.friction).toBe(0.5)
  })

  it('sets gravityScale prop', async () => {
    await act(async () => {
      renderRB({ gravityScale: 0 })
    })
    const rb = engine.ecs.getComponent(entityId, 'RigidBody') as { gravityScale: number }
    expect(rb.gravityScale).toBe(0)
  })

  it('sets ccd prop', async () => {
    await act(async () => {
      renderRB({ ccd: true })
    })
    const rb = engine.ecs.getComponent(entityId, 'RigidBody') as { ccd: boolean }
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
    const rb = engine.ecs.getComponent(entityId, 'RigidBody') as { friction: number }
    expect(rb.friction).toBe(0.85)
  })

  it('sets lockRotation', async () => {
    await act(async () => {
      renderRB({ lockRotation: false })
    })
    const rb = engine.ecs.getComponent(entityId, 'RigidBody') as { lockRotation: boolean }
    expect(rb.lockRotation).toBe(false)
  })

  it('sets density', async () => {
    await act(async () => {
      renderRB({ density: 2.5 })
    })
    const rb = engine.ecs.getComponent(entityId, 'RigidBody') as { density: number }
    expect(rb.density).toBe(2.5)
  })
})
