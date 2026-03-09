// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, act } from '@testing-library/react'
import { ECSWorld, EventBus, AssetManager } from '@cubeforge/core'
import { EngineContext, EntityContext } from '../context'
import { Entity } from '../components/Entity'
import type { EngineState } from '../context'

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

function Wrapper({ engine, children }: { engine: EngineState; children: React.ReactNode }) {
  return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>
}

describe('Entity lifecycle', () => {
  let engine: EngineState

  beforeEach(() => {
    engine = makeEngine()
  })

  it('registers string ID in entityIds map on mount', async () => {
    await act(async () => {
      render(
        <Wrapper engine={engine}>
          <Entity id="player" />
        </Wrapper>,
      )
    })
    expect(engine.entityIds.has('player')).toBe(true)
  })

  it('removes string ID from entityIds map on unmount', async () => {
    let unmount: () => void
    await act(async () => {
      const result = render(
        <Wrapper engine={engine}>
          <Entity id="hero" />
        </Wrapper>,
      )
      unmount = result.unmount
    })
    expect(engine.entityIds.has('hero')).toBe(true)
    await act(async () => {
      unmount()
    })
    expect(engine.entityIds.has('hero')).toBe(false)
  })

  it('adds Tag component when tags are provided', async () => {
    await act(async () => {
      render(
        <Wrapper engine={engine}>
          <Entity tags={['enemy', 'damageable']} />
        </Wrapper>,
      )
    })
    const tagged = engine.ecs.query('Tag')
    expect(tagged.length).toBeGreaterThan(0)
    const tagComp = engine.ecs.getComponent<{ type: 'Tag'; tags: string[] }>(tagged[0], 'Tag')!
    expect(tagComp.tags).toContain('enemy')
    expect(tagComp.tags).toContain('damageable')
  })

  it('destroys the ECS entity on unmount', async () => {
    let unmount: () => void
    await act(async () => {
      const result = render(
        <Wrapper engine={engine}>
          <Entity id="temp" />
        </Wrapper>,
      )
      unmount = result.unmount
    })
    const idBefore = engine.entityIds.get('temp')
    expect(idBefore).toBeDefined()
    await act(async () => {
      unmount()
    })
    expect(engine.ecs.hasEntity(idBefore!)).toBe(false)
  })

  it('exposes entityId via EntityContext to children', async () => {
    let capturedId: number | null = null
    function Child() {
      const id = React.useContext(EntityContext)
      React.useEffect(() => {
        capturedId = id
      }, [id])
      return null
    }
    await act(async () => {
      render(
        <Wrapper engine={engine}>
          <Entity id="parent">
            <Child />
          </Entity>
        </Wrapper>,
      )
    })
    expect(capturedId).not.toBeNull()
    expect(capturedId).toBe(engine.entityIds.get('parent'))
  })

  it('multiple entities get unique ECS ids', async () => {
    await act(async () => {
      render(
        <Wrapper engine={engine}>
          <Entity id="a" />
          <Entity id="b" />
          <Entity id="c" />
        </Wrapper>,
      )
    })
    const ids = ['a', 'b', 'c'].map((k) => engine.entityIds.get(k))
    const unique = new Set(ids)
    expect(unique.size).toBe(3)
  })
})
