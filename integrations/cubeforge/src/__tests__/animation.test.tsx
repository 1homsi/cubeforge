// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, act } from '@testing-library/react'
import { ECSWorld, EventBus, AssetManager } from '@cubeforge/core'
import { EngineContext, EntityContext } from '../context'
import { Animation } from '../components/Animation'
import type { EngineState } from '../context'
import type { AnimationStateComponent } from '@cubeforge/renderer'

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
  }
}

function Wrapper({ engine, entityId, children }: { engine: EngineState; entityId: number; children: React.ReactNode }) {
  return (
    <EngineContext.Provider value={engine}>
      <EntityContext.Provider value={entityId}>
        {children}
      </EntityContext.Provider>
    </EngineContext.Provider>
  )
}

describe('Animation component', () => {
  let engine: EngineState
  let entityId: number

  beforeEach(() => {
    engine = makeEngine()
    entityId = engine.ecs.createEntity()
  })

  it('mounts AnimationState component on entity', async () => {
    await act(async () => {
      render(
        <Wrapper engine={engine} entityId={entityId}>
          <Animation frames={[0, 1, 2]} fps={12} />
        </Wrapper>,
      )
    })
    const anim = engine.ecs.getComponent<AnimationStateComponent>(entityId, 'AnimationState')
    expect(anim).toBeDefined()
    expect(anim!.frames).toEqual([0, 1, 2])
    expect(anim!.fps).toBe(12)
    expect(anim!.playing).toBe(true)
    expect(anim!.loop).toBe(true)
  })

  it('removes AnimationState on unmount', async () => {
    let unmount: () => void
    await act(async () => {
      const result = render(
        <Wrapper engine={engine} entityId={entityId}>
          <Animation frames={[0, 1]} fps={8} />
        </Wrapper>,
      )
      unmount = result.unmount
    })
    expect(engine.ecs.getComponent(entityId, 'AnimationState')).toBeDefined()
    await act(async () => { unmount() })
    expect(engine.ecs.getComponent(entityId, 'AnimationState')).toBeUndefined()
  })

  it('defaults: loop=true, playing=true', async () => {
    await act(async () => {
      render(
        <Wrapper engine={engine} entityId={entityId}>
          <Animation frames={[0]} />
        </Wrapper>,
      )
    })
    const anim = engine.ecs.getComponent<AnimationStateComponent>(entityId, 'AnimationState')!
    expect(anim.loop).toBe(true)
    expect(anim.playing).toBe(true)
  })

  it('respects loop=false', async () => {
    await act(async () => {
      render(
        <Wrapper engine={engine} entityId={entityId}>
          <Animation frames={[0, 1]} loop={false} />
        </Wrapper>,
      )
    })
    const anim = engine.ecs.getComponent<AnimationStateComponent>(entityId, 'AnimationState')!
    expect(anim.loop).toBe(false)
  })

  it('updates playing prop when prop changes', async () => {
    let rerender: (ui: React.ReactElement) => void
    await act(async () => {
      const result = render(
        <Wrapper engine={engine} entityId={entityId}>
          <Animation frames={[0, 1, 2]} playing={true} />
        </Wrapper>,
      )
      rerender = result.rerender
    })
    await act(async () => {
      rerender(
        <Wrapper engine={engine} entityId={entityId}>
          <Animation frames={[0, 1, 2]} playing={false} />
        </Wrapper>,
      )
    })
    const anim = engine.ecs.getComponent<AnimationStateComponent>(entityId, 'AnimationState')!
    expect(anim.playing).toBe(false)
  })

  it('resets animation state when frames prop changes', async () => {
    let rerender: (ui: React.ReactElement) => void
    await act(async () => {
      const result = render(
        <Wrapper engine={engine} entityId={entityId}>
          <Animation frames={[0, 1, 2]} />
        </Wrapper>,
      )
      rerender = result.rerender
    })

    // Manually advance the animation index
    const anim = engine.ecs.getComponent<AnimationStateComponent>(entityId, 'AnimationState')!
    anim.currentIndex = 2
    anim._completed = true

    await act(async () => {
      rerender(
        <Wrapper engine={engine} entityId={entityId}>
          <Animation frames={[3, 4]} />
        </Wrapper>,
      )
    })

    const updated = engine.ecs.getComponent<AnimationStateComponent>(entityId, 'AnimationState')!
    expect(updated.currentIndex).toBe(0)
    expect(updated._completed).toBe(false)
  })

  it('stores onComplete callback on AnimationState', async () => {
    const onComplete = vi.fn()
    await act(async () => {
      render(
        <Wrapper engine={engine} entityId={entityId}>
          <Animation frames={[0, 1]} loop={false} onComplete={onComplete} />
        </Wrapper>,
      )
    })
    const anim = engine.ecs.getComponent<AnimationStateComponent>(entityId, 'AnimationState')!
    expect(anim.onComplete).toBe(onComplete)
  })
})
