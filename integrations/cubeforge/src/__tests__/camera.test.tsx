// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, act } from '@testing-library/react'
import { ECSWorld, EventBus, AssetManager } from '@cubeforge/core'
import { EngineContext } from '../context'
import type { EngineState } from '../context'
import { Camera2D } from '../components/Camera2D'
import type { Camera2DComponent } from '@cubeforge/renderer'

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

function getCameraComponent(engine: EngineState): Camera2DComponent | undefined {
  const entities = engine.ecs.query('Camera2D')
  if (entities.length === 0) return undefined
  return engine.ecs.getComponent<Camera2DComponent>(entities[0], 'Camera2D')
}

describe('Camera2D component', () => {
  let engine: EngineState

  beforeEach(() => {
    engine = makeEngine()
  })

  it('creates a Camera2D entity on mount', () => {
    act(() => {
      render(
        <Wrapper engine={engine}>
          <Camera2D />
        </Wrapper>,
      )
    })
    const entities = engine.ecs.query('Camera2D')
    expect(entities.length).toBe(1)
  })

  it('sets followEntityId from followEntity prop', () => {
    act(() => {
      render(
        <Wrapper engine={engine}>
          <Camera2D followEntity="player" />
        </Wrapper>,
      )
    })
    const cam = getCameraComponent(engine)
    expect(cam?.followEntityId).toBe('player')
  })

  it('sets zoom prop', () => {
    act(() => {
      render(
        <Wrapper engine={engine}>
          <Camera2D zoom={2} />
        </Wrapper>,
      )
    })
    const cam = getCameraComponent(engine)
    expect(cam?.zoom).toBe(2)
  })

  it('sets smoothing prop', () => {
    act(() => {
      render(
        <Wrapper engine={engine}>
          <Camera2D smoothing={0.87} />
        </Wrapper>,
      )
    })
    const cam = getCameraComponent(engine)
    expect(cam?.smoothing).toBe(0.87)
  })

  it('sets background prop', () => {
    act(() => {
      render(
        <Wrapper engine={engine}>
          <Camera2D background="#000000" />
        </Wrapper>,
      )
    })
    const cam = getCameraComponent(engine)
    expect(cam?.background).toBe('#000000')
  })

  it('sets bounds prop', () => {
    const bounds = { x: 0, y: 0, width: 2000, height: 1000 }
    act(() => {
      render(
        <Wrapper engine={engine}>
          <Camera2D bounds={bounds} />
        </Wrapper>,
      )
    })
    const cam = getCameraComponent(engine)
    expect(cam?.bounds).toEqual(bounds)
  })

  it('sets initial position', () => {
    act(() => {
      render(
        <Wrapper engine={engine}>
          <Camera2D x={100} y={200} />
        </Wrapper>,
      )
    })
    const cam = getCameraComponent(engine)
    expect(cam?.x).toBe(100)
    expect(cam?.y).toBe(200)
  })

  it('destroys camera entity on unmount', () => {
    let unmount: () => void
    act(() => {
      const result = render(
        <Wrapper engine={engine}>
          <Camera2D />
        </Wrapper>,
      )
      unmount = result.unmount
    })
    expect(engine.ecs.query('Camera2D').length).toBe(1)
    act(() => {
      unmount()
    })
    expect(engine.ecs.query('Camera2D').length).toBe(0)
  })

  it('sets followOffset props', () => {
    act(() => {
      render(
        <Wrapper engine={engine}>
          <Camera2D followOffsetX={50} followOffsetY={-30} />
        </Wrapper>,
      )
    })
    const cam = getCameraComponent(engine)
    expect(cam?.followOffsetX).toBe(50)
    expect(cam?.followOffsetY).toBe(-30)
  })

  it('uses default values when no props given', () => {
    act(() => {
      render(
        <Wrapper engine={engine}>
          <Camera2D />
        </Wrapper>,
      )
    })
    const cam = getCameraComponent(engine)
    expect(cam?.x).toBe(0)
    expect(cam?.y).toBe(0)
    expect(cam?.zoom).toBe(1)
    expect(cam?.smoothing).toBe(0)
    expect(cam?.background).toBe('#1a1a2e')
  })
})
