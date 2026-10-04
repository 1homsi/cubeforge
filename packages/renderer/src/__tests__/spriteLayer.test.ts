import { afterEach, describe, expect, it, vi } from 'vitest'
import { ECSWorld } from '@cubeforge/core'
import { RenderSystem } from '../webglRenderSystem'
import { SpriteLayer, SPRITE_HIDDEN } from '../spriteLayer'

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
  return { rs, world: new ECSWorld(), draws }
}

describe('SpriteLayer', () => {
  it('grows, swap-removes and picks the topmost sprite', () => {
    const layer = new SpriteLayer({ capacity: 16 })
    for (let i = 0; i < 40; i++) layer.add(i * 10, 0, 10, 10, 0, 100 + i)
    expect(layer.count).toBe(40)
    expect(layer.capacity).toBeGreaterThanOrEqual(40)
    expect(layer.pick(12, 0)).toBe(101)
    layer.add(12, 0, 10, 10, 0, 999)
    expect(layer.pick(12, 0)).toBe(999)
    layer.flags[layer.count - 1] = SPRITE_HIDDEN
    expect(layer.pick(12, 0)).toBe(101)
    layer.removeAt(0)
    expect(layer.ids[0]).toBe(999)
    expect(layer.pick(-100, 0)).toBe(-1)
  })

  it('draws visible sprites in one instanced call and culls the rest', () => {
    const { rs, world, draws } = setup()
    const layer = new SpriteLayer()
    layer.add(0, 0, 4, 4)
    layer.add(10, 10, 4, 4)
    layer.add(5000, 0, 4, 4)
    rs.addSpriteLayer(layer)
    rs.update(world, 1 / 60)
    expect(draws).toEqual([2])
    rs.removeSpriteLayer(layer)
    draws.length = 0
    rs.update(world, 1 / 60)
    expect(draws).toEqual([])
  })
})
