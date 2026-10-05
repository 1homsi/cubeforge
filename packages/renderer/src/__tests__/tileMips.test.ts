import { afterEach, describe, expect, it, vi } from 'vitest'
import { downsampleTileMips } from '../tileMips'
import { TileLayerData, createTileLayerComponent } from '../tileLayer'
import { TileLayerRenderer } from '../tileLayerGL'

afterEach(() => vi.restoreAllMocks())

/** Atlas of `n` flat 4x4 tiles; tile i has colour colors[i] and full alpha. */
function flatAtlas(colors: number[][], tw = 4, th = 4, spacing = 0, margin = 0) {
  const cols = colors.length
  const iw = margin * 2 + cols * tw + (cols - 1) * spacing
  const ih = margin * 2 + th
  const px = new Uint8Array(iw * ih * 4)
  colors.forEach((c, t) => {
    const ox = margin + t * (tw + spacing)
    for (let y = 0; y < th; y++)
      for (let x = 0; x < tw; x++) px.set([c[0], c[1], c[2], c[3] ?? 255], ((margin + y) * iw + ox + x) * 4)
  })
  return { px, iw, ih }
}

describe('downsampleTileMips', () => {
  it('builds tight per-tile levels down to 1x1 and never mixes neighbouring tiles', () => {
    const { px, iw, ih } = flatAtlas(
      [
        [255, 0, 0],
        [0, 0, 255],
      ],
      4,
      4,
      2,
      1,
    )
    const levels = downsampleTileMips(px, iw, ih, { tileWidth: 4, tileHeight: 4, columns: 2, spacing: 2, margin: 1 })!
    expect(levels.map((l) => [l.w, l.h])).toEqual([
      [8, 4],
      [4, 2],
      [2, 1],
    ])
    for (const l of levels) {
      const half = l.w / 2
      for (let y = 0; y < l.h; y++)
        for (let x = 0; x < l.w; x++) {
          const o = (y * l.w + x) * 4
          const want = x < half ? [255, 0, 0, 255] : [0, 0, 255, 255]
          expect(Array.from(l.data.subarray(o, o + 4))).toEqual(want)
        }
    }
  })

  it('averages colour weighted by alpha so transparent texels do not darken the tile', () => {
    // 2x2 tile: one opaque white texel, three fully transparent black ones
    const px = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const levels = downsampleTileMips(px, 2, 2, { tileWidth: 2, tileHeight: 2, columns: 1 })!
    expect(levels).toHaveLength(2)
    expect(Array.from(levels[1].data)).toEqual([255, 255, 255, 64])
  })

  it('returns null for tiles without a second level', () => {
    expect(downsampleTileMips(new Uint8Array(4), 1, 1, { tileWidth: 1, tileHeight: 1, columns: 1 })).toBeNull()
  })

  it('handles non power-of-two tile sizes (levels stay inside the GL level dimensions)', () => {
    const { px, iw, ih } = flatAtlas(
      [
        [10, 20, 30],
        [40, 50, 60],
        [70, 80, 90],
      ],
      12,
      12,
    )
    const levels = downsampleTileMips(px, iw, ih, { tileWidth: 12, tileHeight: 12, columns: 3 })!
    expect(levels).toHaveLength(4) // 12, 6, 3, 1
    levels.forEach((l, L) => {
      expect(l.w).toBeLessThanOrEqual(Math.max(1, Math.floor(36 / 2 ** L)))
    })
    expect(Array.from(levels[3].data.subarray(0, 4))).toEqual([10, 20, 30, 255])
  })
})

type Call = [string, unknown[]]
function fakeGL() {
  const calls: Call[] = []
  const consts = new Map<string, number>()
  let next = 1
  const target: Record<string, unknown> = { calls, canvas: { width: 800, height: 600 } }
  const gl = new Proxy(target, {
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

function mockAtlasReadback(w: number, h: number) {
  const px = new Uint8ClampedArray(w * h * 4).fill(200)
  const createElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = createElement(tag)
    if (tag === 'canvas')
      Object.defineProperty(el, 'getContext', {
        configurable: true,
        value: () => ({ drawImage() {}, getImageData: () => ({ data: px }) }),
      })
    return el
  })
}

function renderOnce(opts: { minFilter?: 'nearest' | 'mipmap'; farZoomPx?: number }, zoom: number) {
  mockAtlasReadback(32, 16)
  const layer = new TileLayerData({
    width: 8,
    height: 8,
    tileset: {
      image: { width: 32, height: 16 } as unknown as HTMLCanvasElement,
      tileWidth: 16,
      tileHeight: 16,
      columns: 2,
    },
    ...opts,
  })
  layer.fill(1)
  const world = {
    query: () => [1],
    getComponent: () => createTileLayerComponent(layer),
  } as unknown as import('@cubeforge/core').ECSWorld
  const { gl, calls } = fakeGL()
  const r = new TileLayerRenderer(gl)
  r.prepare(world, 0)
  r.render(64, 64, zoom, 800, 600, 0, 0, 1)
  const uni = (name: string) =>
    calls.filter((c) => c[0].startsWith('uniform') && (c[1][0] as { name?: string } | undefined)?.name === name)
  return { calls, uni }
}

describe('TileLayer minFilter mipmap', () => {
  it('draws exactly (lod 0) by default even when zoomed out', () => {
    const { uni, calls } = renderOnce({}, 0.25)
    expect(uni('u_lod').at(-1)![1][1]).toBe(0)
    expect(calls.some((c) => c[0] === 'texStorage2D' && (c[1][2] as number) !== undefined && c[1][1] === 5)).toBe(false)
  })

  it('builds the pyramid on the first minified draw and sets lod from texels per pixel', () => {
    const { uni, calls } = renderOnce({ minFilter: 'mipmap' }, 0.25) // 4 texels per device pixel -> lod 2
    expect(uni('u_lod').at(-1)![1][1]).toBeCloseTo(2)
    const storage = calls.filter((c) => c[0] === 'texStorage2D' && c[1][1] === 5)
    expect(storage).toHaveLength(1)
    expect(storage[0][1].slice(3)).toEqual([32, 16])
    expect(calls.filter((c) => c[0] === 'texSubImage2D' && (c[1][1] as number) >= 1)).toHaveLength(4)
  })

  it('stays exact (lod 0, no pyramid) when magnified or 1:1', () => {
    const { uni, calls } = renderOnce({ minFilter: 'mipmap' }, 1)
    expect(uni('u_lod').at(-1)![1][1]).toBe(0)
    expect(calls.some((c) => c[0] === 'texStorage2D' && c[1][1] === 5)).toBe(false)
  })

  it('clamps lod to the number of levels and farZoomPx controls the average-colour switch', () => {
    const far = renderOnce({ minFilter: 'mipmap', farZoomPx: 0 }, 1 / 64)
    expect(far.uni('u_lod').at(-1)![1][1]).toBe(4)
    expect(far.uni('u_useAvg').at(-1)![1][1]).toBe(0)
    const dflt = renderOnce({}, 1 / 64) // 0.25 px per tile < default 2
    expect(dflt.uni('u_useAvg').at(-1)![1][1]).toBe(1)
    const custom = renderOnce({ farZoomPx: 8 }, 0.25) // 4 px per tile < 8
    expect(custom.uni('u_useAvg').at(-1)![1][1]).toBe(1)
  })
})
