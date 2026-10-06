import { afterEach, describe, expect, it, vi } from 'vitest'
import { ECSWorld } from '@cubeforge/core'
import { RenderSystem } from '../webglRenderSystem'
import { SpriteLayer, SPRITE_SWAY } from '../spriteLayer'

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
  const uploads: Float32Array[] = []
  const uniforms: Record<string, number[]> = {}
  const gl = new Proxy({} as Record<string, unknown>, {
    get(_t, p: string) {
      if (/^[A-Z_0-9]+$/.test(p)) return p
      if (p === 'isContextLost') return () => false
      if (p === 'getUniformLocation') return (_prog: unknown, name: string) => name
      if (p === 'uniform1f') return (loc: string, a: number) => (uniforms[loc] = [a])
      if (p === 'uniform2f') return (loc: string, a: number, b: number) => (uniforms[loc] = [a, b])
      if (p.startsWith('get') || p.startsWith('create')) return () => ({})
      if (p === 'bufferSubData')
        return (_t: unknown, _o: unknown, data: Float32Array, src: number, len: number) =>
          uploads.push(data.slice(src, src + len))
      if (p === 'getShaderParameter' || p === 'getProgramParameter') return () => true
      return () => true
    },
  })
  const canvas = { width: 200, height: 100, clientWidth: 200, clientHeight: 100, getContext: () => gl }
  const rs = new RenderSystem(canvas as unknown as HTMLCanvasElement, new Map())
  return { rs, world: new ECSWorld(), uploads, uniforms }
}

describe('SpriteLayer GPU sway', () => {
  it('writes the sway amplitude only for flagged sprites in a layer with wind', () => {
    const { rs, world, uploads, uniforms } = setup()
    const layer = new SpriteLayer({ wind: { amplitude: 0.1, speed: 2, frequency: 0.5 } })
    const a = layer.add(10, 10, 8, 16)
    layer.add(20, 10, 8, 16)
    layer.flags[a] |= SPRITE_SWAY
    const scale = layer.ensureSwayScale()
    scale[a] = 2
    rs.addSpriteLayer(layer)
    rs.update(world, 0.25)
    const d = uploads[uploads.length - 1]
    expect(d[18]).toBeCloseTo(0.2) // 0.1 x per-sprite scale 2
    expect(d[20 + 18]).toBe(0) // unflagged sprite does not sway
    expect(uniforms.u_wind).toEqual([2, 0.5])
    expect(uniforms.u_time[0]).toBeCloseTo(0.25)
    rs.update(world, 0.25)
    expect(uniforms.u_time[0]).toBeCloseTo(0.5)
  })

  it('does nothing without a wind, and defaults amplitude to 0.04', () => {
    const { rs, world, uploads } = setup()
    const layer = new SpriteLayer()
    const i = layer.add(10, 10, 8, 16)
    layer.flags[i] |= SPRITE_SWAY
    rs.addSpriteLayer(layer)
    rs.update(world, 1 / 60)
    expect(uploads[uploads.length - 1][18]).toBe(0)
    layer.wind = {}
    rs.update(world, 1 / 60)
    expect(uploads[uploads.length - 1][18]).toBeCloseTo(0.04)
  })

  it('keeps the per-sprite scale through grow, swap-remove and add', () => {
    const layer = new SpriteLayer({ capacity: 16 })
    for (let i = 0; i < 4; i++) layer.add(0, 0, 1, 1)
    const s = layer.ensureSwayScale()
    s[3] = 0.5
    layer.removeAt(0) // last (0.5) moves into slot 0
    expect(layer.swayScale![0]).toBe(0.5)
    for (let i = 0; i < 40; i++) layer.add(0, 0, 1, 1) // forces growth
    expect(layer.swayScale![0]).toBe(0.5)
    expect(layer.swayScale![10]).toBe(1)
    expect(layer.swayScale!.length).toBe(layer.capacity)
  })

  it('a wind keeps the scene hash changing so idle-frame skip does not freeze it', () => {
    const { rs, world, uploads } = setup()
    rs.setIdleFrameSkip(true)
    const layer = new SpriteLayer({ wind: {} })
    layer.flags[layer.add(10, 10, 8, 16)] |= SPRITE_SWAY
    rs.addSpriteLayer(layer)
    rs.update(world, 1 / 60)
    const n = uploads.length
    rs.update(world, 1 / 60)
    rs.update(world, 1 / 60)
    expect(uploads.length).toBe(n + 2)
  })
})
