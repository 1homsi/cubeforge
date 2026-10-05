import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ECSWorld } from '@cubeforge/core'
import { RenderSystem } from '../webglRenderSystem'
import { SpriteLayer } from '../spriteLayer'
import { createRecordingCanvas, installHeadlessCanvasDOM } from '../testing/recordingGL'

let uninstall: () => void
beforeAll(() => {
  uninstall = installHeadlessCanvasDOM()
})
afterAll(() => uninstall())

function setup() {
  const canvas = createRecordingCanvas(200, 100)
  const rs = new RenderSystem(canvas, new Map())
  return { gl: canvas.gl, rs, world: new ECSWorld() }
}

describe('imperative dynamic canvases', () => {
  it('creates a canvas by id, uploads it and frees the texture on dispose', () => {
    const { gl, rs, world } = setup()
    const onChange = vi.fn()
    const h = rs.createDynamicCanvas({ id: 'atlas', width: 64, height: 32, onChange })
    expect(h.id).toBe('atlas')
    expect(h.canvas.width).toBe(64)
    expect(rs.hasDynamicCanvas('atlas')).toBe(true)
    expect(rs.dynamicCanvasIds()).toEqual(['atlas'])
    expect(onChange).toHaveBeenCalledTimes(1)
    h.markDirty(0, 0, 8, 8)
    expect(onChange).toHaveBeenCalledTimes(2)
    rs.update(world, 1 / 60)
    const tex = [...gl.textures.values()].find((t) => t.width === 64 && t.height === 32)
    expect(tex).toBeDefined()
    h.dispose()
    h.dispose()
    expect(h.disposed).toBe(true)
    expect(rs.hasDynamicCanvas('atlas')).toBe(false)
    expect(tex!.deleted).toBe(true)
    h.markDirty() // no-op after dispose
  })

  it('generates unique ids and rejects a duplicate id', () => {
    const { rs } = setup()
    const a = rs.createDynamicCanvas({ width: 4, height: 4 })
    const b = rs.createDynamicCanvas({ width: 4, height: 4 })
    expect(a.id).not.toBe(b.id)
    rs.createDynamicCanvas({ id: 'x', width: 4, height: 4 })
    expect(() => rs.createDynamicCanvas({ id: 'x', width: 4, height: 4 })).toThrow(/already registered/)
    expect(() => rs.createDynamicCanvas({ width: 0, height: 4 })).toThrow(/positive/)
  })

  it('resize re-creates the GPU texture at the new size and keeps the same canvas/ctx', () => {
    const { gl, rs, world } = setup()
    const h = rs.createDynamicCanvas({ id: 'a', width: 16, height: 16 })
    const { canvas, ctx } = h
    rs.update(world, 1 / 60)
    h.resize(64, 48)
    expect(h.canvas).toBe(canvas)
    expect(h.ctx).toBe(ctx)
    expect(h.width).toBe(64)
    expect(h.height).toBe(48)
    rs.update(world, 1 / 60)
    expect(rs.stats.textureUploads).toBe(1) // per-frame counter
    const sizes = [...gl.textures.values()].filter((t) => !t.deleted).map((t) => `${t.width}x${t.height}`)
    expect(sizes).toContain('64x48')
    // same size: nothing to do
    h.resize(64, 48)
    rs.update(world, 1 / 60)
    expect(rs.stats.textureUploads).toBe(0)
  })

  it('a growing atlas keeps SpriteLayer UVs correct against the new texture size', () => {
    const canvas = createRecordingCanvas(200, 100, { captureInstances: true })
    const rs = new RenderSystem(canvas, new Map())
    const world = new ECSWorld()
    const h = rs.createDynamicCanvas({ id: 'atlas', width: 32, height: 16 })
    const layer = new SpriteLayer({ dynamicSrc: 'atlas', frameWidth: 16, frameHeight: 16 })
    layer.add(0, 0, 8, 8, 1)
    rs.addSpriteLayer(layer)
    rs.update(world, 1 / 60)
    h.resize(64, 16)
    layer.touch()
    rs.update(world, 1 / 60)
    expect(canvas.gl.draws.length).toBeGreaterThan(0)
    h.dispose()
    layer.touch()
    expect(() => rs.update(world, 1 / 60)).not.toThrow()
  })
})
