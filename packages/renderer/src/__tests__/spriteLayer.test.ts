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
  const uploads: Float32Array[] = []
  const tex: string[] = []
  const gl = new Proxy({} as Record<string, unknown>, {
    get(_t, p: string) {
      if (/^[A-Z_0-9]+$/.test(p)) return p
      if (p === 'isContextLost') return () => false
      if (p.startsWith('get') || p.startsWith('create')) return () => ({})
      if (p === 'drawArraysInstanced') return (_m: unknown, _f: unknown, _c: unknown, n: number) => draws.push(n)
      if (p === 'bufferSubData')
        return (_t: unknown, _o: unknown, data: Float32Array, src: number, len: number) =>
          uploads.push(data.slice(src, src + len))
      if (p === 'texImage2D' || p === 'texSubImage2D') return () => tex.push(p)
      if (p === 'getShaderParameter' || p === 'getProgramParameter') return () => true
      return () => true
    },
  })
  const canvas = { width: 200, height: 100, clientWidth: 200, clientHeight: 100, getContext: () => gl }
  const rs = new RenderSystem(canvas as unknown as HTMLCanvasElement, new Map())
  return { rs, world: new ECSWorld(), draws, uploads, tex }
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

  it('draws several atlases in one batch, ordered by sortKey', () => {
    const { rs, world, draws, uploads } = setup()
    const img = (w: number) =>
      ({ width: w, height: 16, naturalWidth: w, naturalHeight: 16 }) as unknown as HTMLImageElement
    const layer = new SpriteLayer({
      atlases: [
        { image: img(64), frameWidth: 16, frameHeight: 16 },
        { image: img(32), frameWidth: 16, frameHeight: 16 },
      ],
      sortByKey: true,
    })
    const ys = [30, 10, 20]
    ys.forEach((y, i) => {
      const k = layer.add(0, y, 8, 8, i, 100 + i)
      layer.atlas[k] = i % 2
      layer.sortKey[k] = y
    })
    rs.addSpriteLayer(layer)
    uploads.length = 0
    rs.update(world, 1 / 60)
    expect(draws).toEqual([3])
    const data = uploads[uploads.length - 1]
    const drawn = [0, 1, 2].map((n) => ({ y: data[n * 20 + 1], atlas: data[n * 20 + 17] }))
    expect(drawn.map((d) => d.y)).toEqual([10, 20, 30])
    expect(drawn.map((d) => d.atlas)).toEqual([1, 0, 0])
    // pick follows draw order: the y=30 sprite is drawn last, so it wins on overlap
    layer.y[1] = 30
    layer.sortKey[1] = 31
    expect(layer.pick(0, 30)).toBe(101)
    layer.sortKey[1] = 29
    expect(layer.pick(0, 30)).toBe(100)
  })

  it('calls onChange for every mutation path, including atlas setters and touch()', () => {
    const layer = new SpriteLayer()
    const onChange = vi.fn()
    layer.onChange = onChange
    layer.add(0, 0, 4, 4)
    layer.set(0, 1, 1)
    layer.resize(3)
    layer.removeAt(0)
    layer.touch()
    layer.clear()
    layer.dynamicSrc = 'x'
    layer.image = undefined
    layer.markAtlasDirty()
    expect(onChange).toHaveBeenCalledTimes(9)
    layer.onChange = null
    expect(() => layer.touch()).not.toThrow()
  })

  it('re-uploads an image atlas after markAtlasDirty, once, and not before', () => {
    const { rs, world, tex } = setup()
    const img = { width: 16, height: 16, naturalWidth: 16, naturalHeight: 16 } as unknown as HTMLCanvasElement
    const layer = new SpriteLayer({ image: img, frameWidth: 16, frameHeight: 16 })
    layer.add(0, 0, 8, 8)
    rs.addSpriteLayer(layer)
    rs.update(world, 1 / 60)
    const sub = () => tex.filter((t) => t === 'texSubImage2D').length
    expect(tex.filter((t) => t === 'texImage2D').length).toBeGreaterThan(0)
    expect(sub()).toBe(0)
    rs.update(world, 1 / 60)
    expect(sub()).toBe(0)
    layer.markAtlasDirty()
    rs.update(world, 1 / 60)
    expect(sub()).toBe(1)
    rs.update(world, 1 / 60)
    expect(sub()).toBe(1)
  })
})
