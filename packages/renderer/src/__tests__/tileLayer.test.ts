import { describe, expect, it, vi } from 'vitest'
import { TileLayerData, createTileLayerComponent, visibleChunkRange, visibleTileRange } from '../tileLayer'
import { TileLayerRenderer } from '../tileLayerGL'
import { TileLayerCanvasRenderer } from '../tileLayerCanvas2D'
import { RenderSystem } from '../webglRenderSystem'

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
        if (p === 'isContextLost') return false
        if (p === 'getUniformLocation') return { name: args[1] }
        if (p === 'getContext') return null
        return undefined
      }
    },
  })
  const count = (name: string) => calls.filter((c) => c[0] === name).length
  const reset = () => (calls.length = 0)
  return { gl: gl as unknown as WebGL2RenderingContext, calls, count, reset }
}

function readyImage() {
  return { width: 64, height: 64 } as unknown as HTMLCanvasElement
}

function makeLayer(opts: Partial<ConstructorParameters<typeof TileLayerData>[0]> = {}) {
  return new TileLayerData({
    width: 600,
    height: 300,
    tileset: { image: readyImage(), tileWidth: 16, tileHeight: 16, columns: 4 },
    ...opts,
  })
}

function worldWith(...layers: TileLayerData[]) {
  const comps = new Map(layers.map((l, i) => [i + 1, createTileLayerComponent(l)]))
  return {
    comps,
    query: () => [...comps.keys()],
    getComponent: (id: number) => comps.get(id),
  } as unknown as import('@cubeforge/core').ECSWorld & { comps: typeof comps }
}

describe('TileLayerData', () => {
  it('setTile dirties only the containing chunk and tracks a tight rect', () => {
    const l = makeLayer({ chunkSize: 32 })
    expect(l.chunksX).toBe(19)
    expect(l.chunksY).toBe(10)
    l.setTile(40, 5, 3)
    l.setTile(45, 9, 3)
    expect(l.dirtyCount).toBe(1)
    const c = l.dirtyList[0]
    expect(c).toBe(1)
    expect(Array.from(l.dirtyRect.subarray(c * 4, c * 4 + 4))).toEqual([40, 5, 45, 9])
    expect(l.chunkVersion[1]).toBe(2)
    expect(l.chunkVersion[0]).toBe(0)
    expect(l.getTile(40, 5)).toBe(3)
  })

  it('ignores unchanged and out-of-bounds writes', () => {
    const l = makeLayer()
    const rev = l.revision
    expect(l.setTile(0, 0, 0)).toBe(false)
    expect(l.setTile(-1, 0, 1)).toBe(false)
    expect(l.setTile(600, 0, 1)).toBe(false)
    expect(l.revision).toBe(rev)
    expect(l.getTile(999, 999)).toBe(0)
  })

  it('setTiles replaces everything and bumps the full version', () => {
    const l = makeLayer()
    l.setTile(1, 1, 2)
    const next = new Uint16Array(600 * 300).fill(7)
    l.setTiles(next)
    expect(l.fullVersion).toBe(1)
    expect(l.dirtyCount).toBe(0)
    expect(l.getTile(599, 299)).toBe(7)
    expect(() => l.setTiles([1, 2, 3])).toThrow(/expected 180000/)
  })

  it('supports 32-bit ids', () => {
    const l = makeLayer({ wideIds: true })
    expect(l.tiles).toBeInstanceOf(Uint32Array)
    l.setTile(0, 0, 100000)
    expect(l.getTile(0, 0)).toBe(100000)
  })

  it('animation table advances per animation, not per tile', () => {
    const l = makeLayer({ animations: { 5: { frames: [5, 6, 7], duration: 0.25 } } })
    expect(l.isAnimated(5)).toBe(true)
    expect(l.isAnimated(6)).toBe(false)
    expect(l.resolveTile(5)).toBe(5)
    expect(l.resolveTile(9)).toBe(9)
    const v = l.lutVersion
    expect(l.updateAnimations(0.1)).toBe(false)
    expect(l.updateAnimations(0.3)).toBe(true)
    expect(l.resolveTile(5)).toBe(6)
    expect(l.updateAnimations(0.6)).toBe(true)
    expect(l.resolveTile(5)).toBe(7)
    expect(l.updateAnimations(0.8)).toBe(true)
    expect(l.resolveTile(5)).toBe(5)
    expect(l.lutVersion).toBe(v + 3)
    l.setAnimations({})
    expect(l.lut).toBeNull()
    expect(l.updateAnimations(10)).toBe(false)
  })
})

describe('culling math', () => {
  it('clips the view to the layer in tile and chunk coords', () => {
    const l = makeLayer({ x: 100, y: 50, chunkSize: 32 })
    const r = new Int32Array(4)
    expect(visibleTileRange(l, 100, 50, 180, 82, r)).toBe(true)
    expect(Array.from(r)).toEqual([0, 0, 5, 2])
    expect(visibleTileRange(l, 0, 0, 125, 60, r)).toBe(true)
    expect(Array.from(r)).toEqual([0, 0, 2, 1])
    expect(visibleTileRange(l, -1000, -1000, 99, 49, r)).toBe(false)
    expect(visibleTileRange(l, 100 + 600 * 16, 50, 1e6, 1e6, r)).toBe(false)
    expect(visibleChunkRange(l, 100 + 16 * 31, 50, 100 + 16 * 33, 60, r)).toBe(true)
    expect(Array.from(r)).toEqual([0, 0, 2, 1])
    expect(visibleChunkRange(l, -1e9, -1e9, 1e9, 1e9, r)).toBe(true)
    expect(Array.from(r)).toEqual([0, 0, 19, 10])
  })
})

describe('TileLayerRenderer (WebGL2)', () => {
  it('uploads the whole layer once, then nothing while idle', () => {
    const { gl, count, reset } = fakeGL()
    const r = new TileLayerRenderer(gl)
    const l = makeLayer()
    const world = worldWith(l)
    expect(r.prepare(world, 1 / 60)).toBe(true)
    expect(r.stats.indexUploads).toBe(1)
    expect(r.stats.uploadedTexels).toBe(180000)
    r.render(0, 0, 1, 800, 600, 0, 0)
    reset()
    expect(r.prepare(world, 1 / 60)).toBe(false)
    expect(r.stats.indexUploads).toBe(0)
    expect(count('texSubImage2D')).toBe(0)
  })

  it('perf: 10 setTile calls per frame upload at most a couple of chunk rects', () => {
    const { gl } = fakeGL()
    const r = new TileLayerRenderer(gl)
    const l = makeLayer({ chunkSize: 32 })
    const world = worldWith(l)
    r.prepare(world, 0)
    let maxUploads = 0
    let maxTexels = 0
    for (let frame = 0; frame < 300; frame++) {
      // a cluster of edits (e.g. one villager building), drifting across the map
      const bx = (frame * 7) % 590
      const by = (frame * 3) % 290
      for (let k = 0; k < 10; k++) l.setTile(bx + (k % 4), by + (k >> 2), 1 + ((frame + k) % 8))
      expect(r.prepare(world, 1 / 60)).toBe(true)
      r.render(bx * 16, by * 16, 1, 800, 600, 0, 0)
      maxUploads = Math.max(maxUploads, r.stats.indexUploads)
      maxTexels = Math.max(maxTexels, r.stats.uploadedTexels)
    }
    expect(maxUploads).toBeLessThanOrEqual(4)
    expect(maxTexels).toBeLessThanOrEqual(64)
  })

  it('uploads dirty rects with row-length/skip unpacking from the shared array', () => {
    const { gl, calls, reset } = fakeGL()
    const r = new TileLayerRenderer(gl)
    const l = makeLayer()
    const world = worldWith(l)
    r.prepare(world, 0)
    reset()
    l.setTile(70, 40, 9)
    r.prepare(world, 0)
    const sub = calls.filter((c) => c[0] === 'texSubImage2D')
    expect(sub).toHaveLength(1)
    expect(sub[0][1].slice(2, 6)).toEqual([70, 40, 1, 1])
    expect(sub[0][1][8]).toBe(l.tiles)
    const stores = calls.filter((c) => c[0] === 'pixelStorei').map((c) => c[1][1])
    expect(stores).toContain(600)
    expect(stores).toContain(70)
    expect(stores).toContain(40)
  })

  it('setTiles re-uploads each page once', () => {
    const { gl } = fakeGL()
    const r = new TileLayerRenderer(gl)
    const l = makeLayer()
    const world = worldWith(l)
    r.prepare(world, 0)
    for (let i = 0; i < 50; i++) l.setTile(i * 10, i, 3)
    l.setTiles(new Uint16Array(600 * 300).fill(2))
    r.prepare(world, 0)
    expect(r.stats.indexUploads).toBe(1)
    expect(r.stats.uploadedTexels).toBe(180000)
  })

  it('draws one quad per visible page, culled and clipped to the view', () => {
    const { gl, calls, reset } = fakeGL()
    const r = new TileLayerRenderer(gl)
    const l = makeLayer()
    const world = worldWith(l)
    r.prepare(world, 0)
    reset()
    r.render(400, 300, 2, 800, 600, 0, 0)
    expect(r.stats.drawCalls).toBe(1)
    const rect = calls.find((c) => c[0] === 'uniform4f' && (c[1][0] as { name: string }).name === 'u_rect')!
    // view at zoom 2: x 200..600, y 150..450 → tiles 12.5..37.5, 9.375..28.125
    expect(rect[1].slice(1)).toEqual([12, 9, 38, 29])
    reset()
    r.render(-5000, -5000, 1, 800, 600, 0, 0)
    expect(r.stats.drawCalls).toBe(0)
  })

  it('splits big layers into pages and only draws visible ones', () => {
    const { gl } = fakeGL()
    const r = new TileLayerRenderer(gl)
    const l = new TileLayerData({
      width: 5000,
      height: 10,
      tileset: { image: readyImage(), tileWidth: 1, tileHeight: 1, columns: 1 },
    })
    const world = worldWith(l)
    r.prepare(world, 0)
    expect(r.stats.indexUploads).toBe(2)
    r.render(4090, 5, 1, 20, 10, 0, 0)
    expect(r.stats.drawCalls).toBe(2)
    r.render(100, 5, 1, 20, 10, 0, 0)
    expect(r.stats.drawCalls).toBe(1)
  })

  it('skips layers whose tileset is not loaded yet', () => {
    const { gl } = fakeGL()
    const r = new TileLayerRenderer(gl)
    const l = makeLayer({ tileset: { tileWidth: 16, tileHeight: 16, columns: 4, src: '/t.png' } })
    r.prepare(worldWith(l), 0)
    r.render(0, 0, 1, 800, 600, 0, 0)
    expect(r.stats.drawCalls).toBe(0)
  })

  it('uploads the animation LUT only when a frame changes', () => {
    const { gl } = fakeGL()
    const r = new TileLayerRenderer(gl)
    const l = makeLayer({ animations: { 3: { frames: [3, 4], duration: 0.5 } } })
    const world = worldWith(l)
    r.prepare(world, 0.1)
    expect(r.stats.lutUploads).toBe(1)
    r.render(0, 0, 1, 800, 600, 0, 0)
    expect(r.prepare(world, 0.1)).toBe(false)
    expect(r.stats.lutUploads).toBe(0)
    expect(r.prepare(world, 0.4)).toBe(true)
    expect(r.stats.lutUploads).toBe(1)
    expect(r.stats.indexUploads).toBe(0)
  })

  it('frees textures when a layer leaves the world, and rebuilds after context restore', () => {
    const { gl, count, reset } = fakeGL()
    const r = new TileLayerRenderer(gl)
    const l = makeLayer({ animations: { 3: { frames: [3, 4], duration: 0.5 } } })
    const world = worldWith(l)
    r.prepare(world, 0)
    r.render(0, 0, 1, 800, 600, 0, 0)
    reset()
    r.contextRestored()
    expect(r.prepare(world, 0)).toBe(true)
    expect(count('createProgram')).toBe(1)
    expect(r.stats.indexUploads).toBe(1)
    expect(r.stats.lutUploads).toBe(1)
    r.render(0, 0, 1, 800, 600, 0, 0)
    reset()
    world.comps.clear()
    expect(r.prepare(world, 0)).toBe(true)
    // index page + LUT + atlas
    expect(count('deleteTexture')).toBe(3)
  })
})

describe('TileLayerCanvasRenderer (Canvas2D fallback)', () => {
  function fakeCtx() {
    const draws: number[][] = []
    const ctx = {
      globalAlpha: 1,
      imageSmoothingEnabled: true,
      getTransform: () => ({ a: 1.5, b: 0, c: 0, d: 1.5, e: 0.3, f: 0.7 }),
      setTransform: vi.fn(),
      drawImage: (_img: unknown, ...args: number[]) => draws.push(args),
    }
    return { ctx: ctx as unknown as CanvasRenderingContext2D, draws }
  }
  function fakeCanvasFactory() {
    const made: { tileDraws: number }[] = []
    const create = (w: number, h: number) => {
      const rec = { tileDraws: 0 }
      made.push(rec)
      return {
        width: w,
        height: h,
        getContext: () => ({ clearRect: () => {}, drawImage: () => rec.tileDraws++ }),
      } as unknown as HTMLCanvasElement
    }
    return { create, made }
  }

  it('caches chunks, redraws only dirty ones, and snaps chunk edges to device pixels', () => {
    const l = makeLayer({ width: 64, height: 64, chunkSize: 32 })
    l.fill(1)
    const { create, made } = fakeCanvasFactory()
    const r = new TileLayerCanvasRenderer({ createCanvas: create })
    const { ctx, draws } = fakeCtx()
    r.draw(ctx, l, 0, 0, 1024, 1024)
    expect(made).toHaveLength(4)
    expect(r.stats.chunkRedraws).toBe(4)
    expect(made[0].tileDraws).toBe(32 * 32)
    // adjacent chunks share exact integer edges
    const [a, b] = [draws[0], draws[1]]
    expect(Number.isInteger(a[0]) && Number.isInteger(a[2])).toBe(true)
    expect(a[0] + a[2]).toBe(b[0])

    r.draw(ctx, l, 0, 0, 1024, 1024)
    expect(r.stats.chunkRedraws).toBe(0)
    l.setTile(40, 3, 2)
    r.draw(ctx, l, 0, 0, 1024, 1024)
    expect(r.stats.chunkRedraws).toBe(1)
    // culled: only one chunk visible
    r.draw(ctx, l, 0, 0, 100, 100)
    expect(r.stats.chunksDrawn).toBe(1)
  })

  it('redraws only chunks that contain animated tiles when the frame changes', () => {
    const l = makeLayer({ width: 64, height: 32, chunkSize: 32, animations: { 2: { frames: [2, 3], duration: 1 } } })
    l.fill(1)
    l.setTile(40, 0, 2)
    const { create } = fakeCanvasFactory()
    const r = new TileLayerCanvasRenderer({ createCanvas: create })
    const { ctx } = fakeCtx()
    r.draw(ctx, l, 0, 0, 1024, 1024, 0)
    expect(r.stats.chunkRedraws).toBe(2)
    r.draw(ctx, l, 0, 0, 1024, 1024, 1.5)
    expect(r.stats.chunkRedraws).toBe(1)
  })
})

describe('RenderSystem integration', () => {
  it('renders tile layers through the main WebGL renderer and honours pixelSnap', () => {
    const fake = fakeGL()
    const canvas = {
      width: 1000,
      height: 600,
      clientWidth: 500,
      clientHeight: 300,
      getContext: () => fake.gl,
    } as unknown as HTMLCanvasElement
    const noop2d = new Proxy({}, { get: () => () => ({ addColorStop: () => {} }) })
    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = createElement(tag)
      if (tag === 'canvas') Object.defineProperty(el, 'getContext', { value: () => noop2d })
      return el
    })
    const rs = new RenderSystem(canvas, new Map())
    vi.restoreAllMocks()
    const l = makeLayer()
    const cam = {
      type: 'Camera2D',
      x: 100.3,
      y: 50.2,
      zoom: 1.5,
      smoothing: 0,
      background: '#000',
      shakeIntensity: 0,
      shakeDuration: 0,
      shakeTimer: 0,
      pixelSnap: true,
    }
    const comps = new Map<number, Record<string, unknown>>([
      [1, { TileLayer: createTileLayerComponent(l) }],
      [2, { Camera2D: cam }],
    ])
    const world = {
      typeId: (n: string) => n,
      rng: () => 0.5,
      query: (...names: string[]) => [...comps.keys()].filter((id) => names.every((n) => n in comps.get(id)!)),
      queryOne: (n: string) => [...comps.keys()].find((id) => n in comps.get(id)!),
      getComponent: (id: number, n: string) => comps.get(id)?.[n],
    } as unknown as import('@cubeforge/core').ECSWorld
    rs.update(world, 1 / 60)
    expect(rs.tileLayerStats.drawCalls).toBe(1)
    expect(rs.tileLayerStats.indexUploads).toBe(1)
    const camUniform = fake.calls.filter(
      (c) => c[0] === 'uniform2f' && (c[1][0] as { name: string }).name === 'u_camPos',
    )[0]
    const [, cx, cy] = camUniform[1] as number[]
    const s = 1.5 * 2
    expect(Math.abs(500 - cx * s - Math.round(500 - cx * s))).toBeLessThan(1e-9)
    expect(Math.abs(300 - cy * s - Math.round(300 - cy * s))).toBeLessThan(1e-9)
    expect(Math.abs(cx - 100.3)).toBeLessThanOrEqual(0.5 / s)
  })
})
