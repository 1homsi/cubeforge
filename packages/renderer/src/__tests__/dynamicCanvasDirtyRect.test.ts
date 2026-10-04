import { afterEach, describe, expect, it, vi } from 'vitest'
import { ECSWorld } from '@cubeforge/core'
import { RenderSystem } from '../webglRenderSystem'

function recordingGL(calls: [string, unknown[]][]): WebGL2RenderingContext {
  return new Proxy({} as Record<string, unknown>, {
    get(_t, p: string) {
      if (/^[A-Z_0-9]+$/.test(p)) return p
      if (p === 'isContextLost') return () => false
      if (p.startsWith('get') || p.startsWith('create')) return () => ({})
      return (...args: unknown[]) => {
        calls.push([p, args])
        return true
      }
    },
  }) as unknown as WebGL2RenderingContext
}

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
  const calls: [string, unknown[]][] = []
  const gl = recordingGL(calls)
  const glCanvas = { width: 320, height: 240, clientWidth: 320, clientHeight: 240, getContext: () => gl }
  const rs = new RenderSystem(glCanvas as unknown as HTMLCanvasElement, new Map())
  const world = new ECSWorld()
  const source = { width: 4800, height: 2400 } as unknown as HTMLCanvasElement
  rs.registerDynamicCanvas('map', source)
  calls.length = 0
  const uploads = () => calls.filter(([name]) => name === 'texSubImage2D' || name === 'texImage2D')
  return { calls, rs, world, source, uploads }
}

describe('dynamic canvas dirty rects', () => {
  it('uploads only the union of the marked rects', () => {
    const { rs, world, source, uploads } = setup()
    rs.markDynamicCanvasDirty('map', 10, 20, 8, 8)
    rs.markDynamicCanvasDirty('map', 100, 50, 8, 8)
    rs.update(world, 1 / 60)
    expect(uploads()).toEqual([['texSubImage2D', ['TEXTURE_2D', 0, 10, 20, 98, 38, 'RGBA', 'UNSIGNED_BYTE', source]]])
  })

  it('uploads the whole canvas when marked without a rect', () => {
    const { rs, world, source, uploads } = setup()
    rs.markDynamicCanvasDirty('map', 10, 20, 8, 8)
    rs.markDynamicCanvasDirty('map')
    rs.update(world, 1 / 60)
    expect(uploads()).toEqual([['texSubImage2D', ['TEXTURE_2D', 0, 0, 0, 'RGBA', 'UNSIGNED_BYTE', source]]])
  })

  it('reallocates the texture when the canvas was resized', () => {
    const { rs, world, source, uploads } = setup()
    ;(source as { width: number }).width = 100
    rs.markDynamicCanvasDirty('map', 0, 0, 8, 8)
    rs.update(world, 1 / 60)
    expect(uploads()).toEqual([['texImage2D', ['TEXTURE_2D', 0, 'RGBA', 'RGBA', 'UNSIGNED_BYTE', source]]])
  })

  it('does not upload when nothing is dirty', () => {
    const { rs, world, uploads } = setup()
    rs.update(world, 1 / 60)
    expect(uploads()).toEqual([])
  })
})

describe('texture LRU', () => {
  it('never evicts a registered dynamic canvas texture', () => {
    const { rs, calls } = setup()
    const touch = (rs as unknown as { touchTexture(k: string): void }).touchTexture.bind(rs)
    for (let i = 0; i < 1100; i++) touch(`img${i}`)
    expect(calls.filter(([n]) => n === 'deleteTexture').length).toBe(0)
    ;(rs as unknown as { _frame: number })._frame++
    touch('one-more')
    expect(calls.filter(([n]) => n === 'deleteTexture').length).toBe(0)
  })
})
