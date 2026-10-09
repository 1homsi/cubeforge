import { afterEach, describe, expect, it, vi } from 'vitest'
import { ECSWorld } from '@xip/core'
import { RenderSystem } from '../webglRenderSystem'
import { createCamera2D, type Camera2DComponent } from '../components/camera2d'

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
  const gl = new Proxy({} as Record<string, unknown>, {
    get(_t, p: string) {
      if (/^[A-Z_0-9]+$/.test(p)) return p
      if (p === 'isContextLost') return () => false
      if (p.startsWith('get') || p.startsWith('create')) return () => ({})
      if (p === 'drawArraysInstanced') return (_m: unknown, _f: unknown, _c: unknown, n: number) => draws.push(n)
      if (p === 'bufferSubData')
        return (_t: unknown, _o: unknown, data: Float32Array, src: number, len: number) =>
          uploads.push(data.slice(src, src + len))
      if (p === 'getShaderParameter' || p === 'getProgramParameter') return () => true
      return () => true
    },
  })
  const canvas = { width: 200, height: 100, clientWidth: 200, clientHeight: 100, getContext: () => gl }
  const rs = new RenderSystem(canvas as unknown as HTMLCanvasElement, new Map())
  return { rs, world: new ECSWorld(), draws, uploads }
}

describe('RenderSystem camera bounds', () => {
  it('centres the camera when the bounds are smaller than the view (instead of pinning top-left)', () => {
    const { rs, world } = setup()
    const id = world.createEntity()
    // 200 x 100 canvas at zoom 1 looking at a 20 x 20 world.
    world.addComponent(id, createCamera2D({ x: 3, y: 4, bounds: { x: 0, y: 0, width: 20, height: 20 } }))
    rs.update(world, 1 / 60)
    const cam = world.getComponent<Camera2DComponent>(id, 'Camera2D')!
    expect([cam.x, cam.y]).toEqual([10, 10])
  })
})
