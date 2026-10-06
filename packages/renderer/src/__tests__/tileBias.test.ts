import { describe, expect, it } from 'vitest'
import { TileLayerData, createTileLayerComponent } from '../tileLayer'
import { TileLayerRenderer } from '../tileLayerGL'

function fakeGL() {
  const calls: [string, unknown[]][] = []
  const consts = new Map<string, number>()
  let next = 1
  const gl = new Proxy({ canvas: { width: 800, height: 600 } } as Record<string, unknown>, {
    get(t, p) {
      if (typeof p !== 'string') return undefined
      if (p in t) return t[p]
      if (/^[A-Z0-9_]+$/.test(p)) {
        if (!consts.has(p)) consts.set(p, 0x1000 + consts.size)
        return consts.get(p)
      }
      return (...args: unknown[]) => {
        calls.push([p, args])
        if (p.startsWith('create')) return { id: next++, kind: p }
        if (p === 'getShaderParameter' || p === 'getProgramParameter') return true
        if (p === 'getParameter') return 4096
        if (p === 'getUniformLocation') return { name: args[1] }
        return undefined
      }
    },
  })
  return { gl: gl as unknown as WebGL2RenderingContext, calls }
}

function make(opts: Partial<ConstructorParameters<typeof TileLayerData>[0]> = {}) {
  const l = new TileLayerData({
    width: 70,
    height: 40,
    chunkSize: 32,
    tileset: {
      image: { width: 32, height: 16 } as unknown as HTMLCanvasElement,
      tileWidth: 16,
      tileHeight: 16,
      columns: 2,
    },
    ...opts,
  })
  l.fill(1)
  return l
}

const world = (l: TileLayerData) =>
  ({
    query: () => [1],
    getComponent: () => createTileLayerComponent(l),
  }) as unknown as import('@cubeforge/core').ECSWorld

describe('TileLayer additive bias', () => {
  it('is off until enabled; setBias writes rgb and dirties only its chunk', () => {
    const l = make()
    expect(l.biases).toBeNull()
    l.clearDirty()
    l.setBias(40, 5, 0x102030)
    expect(l.biases).not.toBeNull()
    expect(Array.from(l.biases!.subarray((5 * 70 + 40) * 4, (5 * 70 + 40) * 4 + 4))).toEqual([0x10, 0x20, 0x30, 255])
    expect(l.dirtyCount).toBe(1)
    expect(l.biasVersion).toBe(1)
    l.setBias(-1, 0, 1)
    l.setBias(70, 0, 1)
    expect(l.dirtyCount).toBe(1)
  })

  it('setBiases checks the length and bumps the version', () => {
    const l = make({ biased: true })
    expect(() => l.setBiases(new Uint8Array(3))).toThrow(/bias bytes/)
    const v = l.biasVersion
    l.setBiases(new Uint8Array(70 * 40 * 4).fill(9))
    expect(l.biasVersion).toBe(v + 1)
  })

  it('uploads the bias plane once, then only dirty chunks, and sets u_hasBias', () => {
    const l = make({ biased: true })
    const { gl, calls } = fakeGL()
    const r = new TileLayerRenderer(gl)
    const w = world(l)
    r.prepare(w, 0)
    r.render(0, 0, 1, 800, 600, 0, 0)
    const biasUploads = () => calls.filter((c) => c[0] === 'texSubImage2D' && c[1][8] === l.biases).length
    expect(biasUploads()).toBe(1) // one page at 70x40
    expect(
      calls.filter((c) => c[0] === 'uniform1i' && (c[1][0] as { name: string }).name === 'u_hasBias').at(-1)![1][1],
    ).toBe(1)
    calls.length = 0
    r.prepare(w, 0)
    expect(biasUploads()).toBe(0)
    l.setBias(2, 2, 0xffffff)
    r.prepare(w, 0)
    expect(biasUploads()).toBe(1)
    // a same-frame fill() must not drop the bias set before it
    calls.length = 0
    l.setBias(3, 3, 0x0000ff)
    l.fill(1)
    r.prepare(w, 0)
    expect(biasUploads()).toBeGreaterThanOrEqual(1)
  })

  it('layers without biases bind no bias texture data and set u_hasBias to 0', () => {
    const l = make()
    const { gl, calls } = fakeGL()
    const r = new TileLayerRenderer(gl)
    r.prepare(world(l), 0)
    r.render(0, 0, 1, 800, 600, 0, 0)
    expect(
      calls.filter((c) => c[0] === 'uniform1i' && (c[1][0] as { name: string }).name === 'u_hasBias').at(-1)![1][1],
    ).toBe(0)
  })
})
