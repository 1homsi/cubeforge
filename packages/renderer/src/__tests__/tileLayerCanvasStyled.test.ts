import { describe, expect, it, vi } from 'vitest'
import { TileLayerData, tileHash } from '../tileLayer'
import { StyledTileLayerCanvasRenderer } from '../tileLayerCanvasStyled'
import { makeCtx, type Op } from './fakeCanvas2D'

function setup(layerOpts: Partial<ConstructorParameters<typeof TileLayerData>[0]> = {}) {
  const image = { width: 64, height: 16, complete: true } as unknown as HTMLCanvasElement
  const layer = new TileLayerData({
    width: 8,
    height: 4,
    chunkSize: 4,
    tileset: { image, tileWidth: 16, tileHeight: 16, columns: 4 },
    ...layerOpts,
  })
  const canvases: { width: number; height: number; ops: Op[]; getContext: () => unknown }[] = []
  const create = (w: number, h: number) => {
    const c = makeCtx()
    const el = { width: w, height: h, ops: c.ops, getContext: () => c.ctx }
    canvases.push(el)
    return el as unknown as HTMLCanvasElement
  }
  const r = new StyledTileLayerCanvasRenderer({ createCanvas: create })
  const main = makeCtx()
  const draw = () => r.draw(main.ctx, layer, 0, 0, 1000, 1000)
  // chunk canvases are created first (one per visible chunk), scratch tiles later
  const chunkOps = (i: number) => canvases[i].ops.filter((o) => o.name === 'drawImage')
  return { layer, r, draw, canvases, chunkOps, image, main }
}

describe('StyledTileLayerCanvasRenderer', () => {
  it('draws plain tiles with a single drawImage each', () => {
    const { layer, draw, chunkOps, image } = setup()
    layer.fill(2)
    draw()
    expect(chunkOps(0)).toHaveLength(16)
    expect(chunkOps(0)[0].args).toEqual([image, 16, 0, 16, 16, 0, 0, 16, 16])
    expect(chunkOps(0).every((o) => o.alpha === 1 && o.comp === 'source-over')).toBe(true)
  })

  it('multiplies tinted tiles through a cached copy and applies the tint alpha', () => {
    const { layer, r, draw, canvases, chunkOps } = setup({ tinted: true })
    layer.fill(1)
    layer.setTint(0, 0, 0xff000080)
    layer.setTint(1, 0, 0xff0000ff)
    draw()
    // 2 chunk canvases and one scratch tile shared by both red tiles
    expect(canvases).toHaveLength(3)
    const scratch = canvases[1] // created while the first chunk draws
    expect(scratch.ops.some((o) => o.comp === 'multiply' && o.name === 'fillRect' && o.fill === 'rgb(255,0,0)')).toBe(
      true,
    )
    expect(scratch.ops.some((o) => o.comp === 'destination-in')).toBe(true)
    const tiles = chunkOps(0)
    expect(tiles[0].args[0]).toBe(scratch)
    expect(tiles[0].alpha).toBeCloseTo(128 / 255)
    expect(tiles[1].args[0]).toBe(scratch)
    expect(tiles[1].alpha).toBe(1)
    expect(tiles[2].args[0]).not.toBe(scratch) // untinted white tiles draw straight
    expect(r.stats.chunkRedraws).toBe(2)
  })

  it('redraws only the touched chunk for one tint and every chunk for a replaced tint layer', () => {
    const { layer, r, draw } = setup({ tinted: true })
    layer.fill(1)
    draw()
    layer.setTint(6, 1, 0x00ff00ff)
    draw()
    expect(r.stats.chunkRedraws).toBe(1)
    layer.setTints(new Uint8Array(8 * 4 * 4).fill(200))
    draw()
    expect(r.stats.chunkRedraws).toBe(2)
    draw()
    expect(r.stats.chunkRedraws).toBe(0)
  })

  it('picks variants by cell hash', () => {
    const { layer, draw, chunkOps } = setup({ variants: { 1: [2, 3, 4] } })
    layer.fill(1)
    draw()
    const srcX = chunkOps(0).map((o) => o.args[1])
    const expected: number[] = []
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) expected.push([16, 32, 48][tileHash(x, y) % 3])
    expect(srcX).toEqual(expected)
    expect(new Set(srcX).size).toBeGreaterThan(1)
  })

  it('redraws when variants change', () => {
    const { layer, r, draw } = setup()
    layer.fill(1)
    draw()
    layer.setVariants({ 1: [2, 3] })
    draw()
    expect(r.stats.chunkRedraws).toBe(2)
  })

  it('applies hash-driven brightness jitter: darker tiles multiply, brighter ones add', () => {
    const { layer, draw, canvases, chunkOps, r } = setup({ jitter: 1 })
    layer.fill(1)
    draw()
    const ops = chunkOps(0)
    const lighter = ops.filter((o) => o.comp === 'lighter')
    const factors: number[] = []
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) factors.push(Math.round((1 + (((tileHash(x, y) >>> 8) & 255) / 255 - 0.5)) * 32) / 32)
    expect(lighter).toHaveLength(factors.filter((f) => f > 1).length)
    expect(lighter.length).toBeGreaterThan(0)
    expect(lighter.length).toBeLessThan(16)
    for (const o of lighter) expect(o.alpha).toBeGreaterThan(0)
    // darker tiles come from gray multiplies
    const grays = canvases.flatMap((c) => c.ops.filter((o) => o.name === 'fillRect' && o.comp === 'multiply'))
    expect(grays.length).toBeGreaterThan(0)
    layer.jitter = 0
    draw()
    expect(r.stats.chunkRedraws).toBe(2)
  })

  it('redraws when the tileset image is swapped and smooths when zoomed far out', () => {
    const { layer, r, draw, main } = setup()
    layer.fill(1)
    draw()
    layer.tileset = {
      ...layer.tileset,
      image: { width: 64, height: 16, complete: true } as unknown as HTMLCanvasElement,
    }
    draw()
    expect(r.stats.chunkRedraws).toBe(2)
    const set = vi.fn()
    Object.defineProperty(main.ctx, 'imageSmoothingEnabled', { set, get: () => true, configurable: true })
    main.ctx.setTransform(0.2, 0, 0, 0.2, 0, 0)
    r.draw(main.ctx, layer, 0, 0, 1000, 1000)
    expect(set).toHaveBeenCalledWith(true)
  })
})
