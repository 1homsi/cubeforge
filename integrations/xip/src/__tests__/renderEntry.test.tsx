// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import type { EngineState } from '../context'

vi.mock('@xip/renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xip/renderer')>()
  class FakeRenderSystem {
    update() {}
    setDefaultSampling() {}
  }
  return { ...actual, RenderSystem: FakeRenderSystem }
})

import * as renderEntry from 'xipjs/render'
import * as mainEntry from 'xipjs'

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

async function mountAndGetEngine(Game: typeof renderEntry.Game | typeof mainEntry.Game): Promise<EngineState> {
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

describe('xipjs/render entry', () => {
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

  it('main entry Game attaches physics only once a physics component exists', async () => {
    const engine = await mountAndGetEngine(mainEntry.Game)
    const { getPhysicsFactory } = await import('@xip/core')
    if (!getPhysicsFactory()) {
      await new Promise((r) => setTimeout(r, 50))
      expect(engine.physics).toBeUndefined()
    }
    const { createRigidBody } = await import('@xip/physics')
    createRigidBody()
    await vi.waitFor(() => expect(engine.physics).toBeDefined(), { timeout: 1000 })
  })
})
