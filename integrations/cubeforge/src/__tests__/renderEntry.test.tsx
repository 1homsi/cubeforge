// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import type { EngineState } from '../context'

vi.mock('@cubeforge/renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cubeforge/renderer')>()
  class FakeRenderSystem {
    update() {}
    setDefaultSampling() {}
  }
  return { ...actual, RenderSystem: FakeRenderSystem }
})

import * as renderEntry from 'cubeforge/render'
import * as mainEntry from 'cubeforge'

const SYMBOLS = [
  'Game',
  'World',
  'Entity',
  'Camera2D',
  'Transform',
  'Sprite',
  'useEntity',
  'useGame',
  'useDynamicCanvas',
  'useCamera',
  'useGestures',
] as const

async function mountAndGetEngine(Game: typeof renderEntry.Game): Promise<EngineState> {
  let engine: EngineState | null = null
  function Probe() {
    engine = renderEntry.useGame()
    return null
  }
  await act(async () => {
    render(
      <Game asyncAssets>
        <Probe />
      </Game>,
    )
  })
  expect(engine).not.toBeNull()
  return engine!
}

describe('cubeforge/render entry', () => {
  it('exports the data-driven game symbols', () => {
    for (const name of SYMBOLS) expect(typeof renderEntry[name], name).toBe('function')
  })

  it('shares hooks and components with the main entry', () => {
    for (const name of SYMBOLS) {
      if (name === 'Game') continue
      expect(renderEntry[name]).toBe(mainEntry[name])
    }
  })

  it('mounts a Game without a physics system', async () => {
    const engine = await mountAndGetEngine(renderEntry.Game)
    expect(engine.physics).toBeUndefined()
    expect(engine.systemTimings).toBeInstanceOf(Map)
  })

  it('main entry Game still includes physics', async () => {
    const engine = await mountAndGetEngine(mainEntry.Game)
    expect(engine.physics).toBeDefined()
  })
})
