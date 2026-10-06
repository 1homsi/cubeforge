import { afterEach, describe, expect, it, vi } from 'vitest'
import { ECSWorld, createTransform } from '@cubeforge/core'
import { RenderSystem } from '../webglRenderSystem'
import { SpriteLayer } from '../spriteLayer'
import { createSprite } from '../components/sprite'
import { createCamera2D } from '../components/camera2d'

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
  rs.registerDynamicCanvas('map', { width: 64, height: 64 } as unknown as HTMLCanvasElement)
  const n = (name: string) => calls.filter(([c]) => c === name).length
  const minFilterSets = () =>
    calls.filter(([c, a]) => c === 'texParameteri' && a[1] === 'TEXTURE_MIN_FILTER' && a[2] === 'LINEAR_MIPMAP_LINEAR')
      .length
  calls.length = 0
  return { calls, rs, world, n, minFilterSets }
}

describe('mipmap sampling', () => {
  it('SpriteLayer: generates mipmaps once per texture version and sets parameters only when they change', () => {
    const { rs, world, n, minFilterSets } = setup()
    const layer = new SpriteLayer({ dynamicSrc: 'map', sampling: 'linear-mipmap-linear' })
    layer.add(0, 0, 8, 8)
    rs.addSpriteLayer(layer)
    for (let i = 0; i < 4; i++) {
      layer.touch()
      rs.update(world, 1 / 60)
    }
    expect(n('generateMipmap')).toBe(1)
    expect(minFilterSets()).toBe(1)
    // The canvas changed: its mip chain is stale, regenerate exactly once.
    rs.markDynamicCanvasDirty('map', 0, 0, 8, 8)
    for (let i = 0; i < 3; i++) {
      layer.touch()
      rs.update(world, 1 / 60)
    }
    expect(n('generateMipmap')).toBe(2)
    expect(minFilterSets()).toBe(1)
  })

  it('Sprite entities: one generateMipmap for many frames', () => {
    const { rs, world, n, minFilterSets } = setup()
    const cam = world.createEntity()
    world.addComponent(cam, createCamera2D({}))
    const e = world.createEntity()
    world.addComponent(e, createTransform(0, 0))
    world.addComponent(e, createSprite({ width: 8, height: 8, dynamicSrc: 'map', sampling: 'linear-mipmap-linear' }))
    for (let i = 0; i < 4; i++) {
      world.getComponent<{ x: number }>(e, 'Transform')!.x = i
      rs.update(world, 1 / 60)
    }
    expect(n('generateMipmap')).toBe(1)
    expect(minFilterSets()).toBe(1)
  })
})
