import { afterEach, describe, expect, it, vi } from 'vitest'
import { ECSWorld } from '@xip/core'
import { RenderSystem } from '../webglRenderSystem'
import { createCamera2D } from '../components/camera2d'

afterEach(() => vi.restoreAllMocks())

function setup() {
  const drawn: unknown[][] = []
  const ctx2d = new Proxy({} as Record<string, unknown>, {
    get: (t, p: string) =>
      p in t ? t[p] : p === 'drawImage' ? (...a: unknown[]) => drawn.push(a) : () => ({ addColorStop: () => {} }),
    set: (t, p: string, v) => ((t[p] = v), true),
  })
  const createElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = createElement(tag)
    if (tag === 'canvas') Object.defineProperty(el, 'getContext', { value: () => ctx2d })
    return el
  })
  const calls: string[] = []
  const gl = new Proxy({} as Record<string, unknown>, {
    get(_t, p: string) {
      if (/^[A-Z_0-9]+$/.test(p)) return p
      if (p === 'isContextLost') return () => false
      if (p.startsWith('get') || p.startsWith('create')) return () => ({})
      return () => {
        calls.push(p)
        return true
      }
    },
  })
  const canvas = { width: 200, height: 100, clientWidth: 200, clientHeight: 100, getContext: () => gl }
  const rs = new RenderSystem(canvas as unknown as HTMLCanvasElement, new Map())
  const world = new ECSWorld()
  world.addComponent(world.createEntity(), createCamera2D({}))
  return { rs, world, calls, drawn, ctx2d }
}

describe('usePostProcess / postProcessStack on WebGL', () => {
  it('runs the effects on a copy of the frame and draws the result back', () => {
    const { rs, world, calls, drawn, ctx2d } = setup()
    const effect = vi.fn()
    rs.postProcessStack.add(effect)
    rs.update(world, 1 / 60)
    expect(drawn).toHaveLength(1) // the screen was copied to the 2D canvas
    expect(effect).toHaveBeenCalledTimes(1)
    const [ctx, w, h, dt] = effect.mock.calls[0]
    expect(ctx).toBe(ctx2d)
    expect([w, h, dt]).toEqual([200, 100, 1 / 60])
    expect(calls.filter((c) => c === 'texImage2D' || c === 'texSubImage2D').length).toBeGreaterThan(0)
    rs.update(world, 1 / 60)
    expect(effect).toHaveBeenCalledTimes(2)
  })

  it('costs nothing while the stack is empty, and stops after remove', () => {
    const { rs, world, drawn } = setup()
    rs.update(world, 1 / 60)
    expect(drawn).toHaveLength(0)
    const effect = vi.fn()
    rs.postProcessStack.add(effect)
    rs.update(world, 1 / 60)
    rs.postProcessStack.remove(effect)
    rs.update(world, 1 / 60)
    expect(effect).toHaveBeenCalledTimes(1)
    expect(drawn).toHaveLength(1)
  })

  it('does not take the idle shortcut while effects are registered', () => {
    const { rs, world } = setup()
    rs.setIdleFrameSkip(true)
    const effect = vi.fn()
    rs.postProcessStack.add(effect)
    for (let i = 0; i < 3; i++) rs.update(world, 1 / 60)
    expect(effect).toHaveBeenCalledTimes(3)
  })
})
