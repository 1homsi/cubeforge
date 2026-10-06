import { afterEach, describe, expect, it, vi } from 'vitest'
import { ECSWorld, createTransform } from '@cubeforge/core'
import { RenderSystem } from '../webglRenderSystem'
import { createCamera2D } from '../components/camera2d'
import { createTrail } from '../components/trail'

afterEach(() => vi.restoreAllMocks())

function setup() {
  const ctx2d = new Proxy({} as Record<string, unknown>, {
    get: (t, p: string) => (p in t ? t[p] : () => ({ addColorStop: () => {} })),
    set: (t, p: string, v) => ((t[p] = v), true),
  })
  const createElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = createElement(tag)
    if (tag === 'canvas') Object.defineProperty(el, 'getContext', { value: () => ctx2d })
    return el
  })
  const draws: number[] = []
  const gl = new Proxy({} as Record<string, unknown>, {
    get(_t, p: string) {
      if (/^[A-Z_0-9]+$/.test(p)) return p
      if (p === 'isContextLost') return () => false
      if (p.startsWith('get') || p.startsWith('create')) return () => ({})
      if (p === 'drawArraysInstanced') return (_m: unknown, _f: unknown, _c: unknown, n: number) => draws.push(n)
      return () => true
    },
  })
  const canvas = { width: 200, height: 100, clientWidth: 200, clientHeight: 100, getContext: () => gl }
  const rs = new RenderSystem(canvas as unknown as HTMLCanvasElement, new Map())
  const world = new ECSWorld()
  world.addComponent(world.createEntity(), createCamera2D({}))
  return { rs, world, draws }
}

describe('Trail batching', () => {
  it('draws all trails in one instanced call', () => {
    const { rs, world, draws } = setup()
    for (let i = 0; i < 20; i++) {
      const e = world.createEntity()
      world.addComponent(e, createTransform(i, 0))
      world.addComponent(e, createTrail({ length: 5 }))
    }
    for (let f = 0; f < 4; f++) {
      draws.length = 0
      rs.update(world, 1 / 60)
    }
    // frame 4: 4 points per trail so far, 20 trails
    expect(draws).toEqual([80])
    expect(rs.stats.drawCalls).toBe(1)
  })
})
