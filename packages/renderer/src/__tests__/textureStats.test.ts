import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ECSWorld } from '@xip/core'
import { RenderSystem } from '../webglRenderSystem'
import { SpriteLayer } from '../spriteLayer'
import { createRecordingCanvas, installHeadlessCanvasDOM } from '../testing/recordingGL'

let uninstall: () => void
beforeAll(() => {
  uninstall = installHeadlessCanvasDOM()
})
afterAll(() => uninstall())

describe('texture memory stats', () => {
  it('tracks a dynamic canvas through resize (grow and shrink) and dispose', () => {
    const rs = new RenderSystem(createRecordingCanvas(200, 100), new Map())
    const world = new ECSWorld()
    rs.update(world, 1 / 60)
    const base = rs.stats.textureBytes
    const baseCount = rs.stats.textureCount
    const h = rs.createDynamicCanvas({ id: 'a', width: 16, height: 16 })
    rs.update(world, 1 / 60)
    expect(rs.stats.textureBytes).toBe(base + 16 * 16 * 4)
    expect(rs.stats.textureCount).toBe(baseCount + 1)
    h.resize(64, 48)
    rs.update(world, 1 / 60)
    expect(rs.stats.textureBytes).toBe(base + 64 * 48 * 4)
    h.resize(8, 8)
    rs.update(world, 1 / 60)
    expect(rs.stats.textureBytes).toBe(base + 8 * 8 * 4)
    expect(rs.stats.textureCount).toBe(baseCount + 1)
    h.dispose()
    expect(rs.stats.textureBytes).toBe(base)
    expect(rs.stats.textureCount).toBe(baseCount)
  })

  it('a registered canvas whose pixel size changed is re-counted', () => {
    const rs = new RenderSystem(createRecordingCanvas(200, 100), new Map())
    const world = new ECSWorld()
    rs.update(world, 1 / 60)
    const base = rs.stats.textureBytes
    const c = { width: 10, height: 10 } as unknown as HTMLCanvasElement
    rs.registerDynamicCanvas('r', c)
    expect(rs.stats.textureBytes).toBe(base + 400)
    c.width = 20
    rs.markDynamicCanvasDirty('r')
    rs.update(world, 1 / 60)
    expect(rs.stats.textureBytes).toBe(base + 20 * 10 * 4)
  })

  it('counts the mip chain (a third more) once a mipmap filter is used, and drops it on resize', () => {
    const rs = new RenderSystem(createRecordingCanvas(200, 100), new Map())
    const world = new ECSWorld()
    const h = rs.createDynamicCanvas({ id: 'm', width: 30, height: 30 })
    const layer = new SpriteLayer({ dynamicSrc: 'm', sampling: 'linear-mipmap-linear' })
    layer.add(0, 0, 8, 8)
    rs.addSpriteLayer(layer)
    rs.update(world, 1 / 60)
    const withMips = rs.stats.textureBytes
    h.resize(60, 60)
    rs.update(world, 1 / 60)
    layer.touch()
    rs.update(world, 1 / 60)
    // 60x60 plus its mips = base * 4/3, counted exactly once however many frames drew it
    expect(rs.stats.textureBytes - withMips).toBe(
      60 * 60 * 4 + Math.floor((60 * 60 * 4) / 3) - (30 * 30 * 4 + Math.floor((30 * 30 * 4) / 3)),
    )
  })
})

describe('releaseAfterUpload (CPU backing of write-once atlases)', () => {
  it('frees the 2D canvas after the upload; the texture stays and counts', () => {
    const rs = new RenderSystem(createRecordingCanvas(200, 100), new Map())
    const world = new ECSWorld()
    rs.update(world, 1 / 60)
    const base = rs.stats.textureBytes
    const h = rs.createDynamicCanvas({ id: 'atlas', width: 64, height: 32, releaseAfterUpload: true })
    expect(h.backingReleased).toBe(false)
    h.markDirty()
    rs.update(world, 1 / 60)
    expect(h.canvas.width).toBe(0)
    expect(h.backingReleased).toBe(true)
    expect(rs.stats.textureBytes).toBe(base + 64 * 32 * 4) // the GPU copy is still counted
    // marking dirty while released is a harmless no-op
    h.markDirty()
    rs.update(world, 1 / 60)
    expect(rs.stats.textureUploads).toBe(0)
    // acquire, repaint, upload, released again
    h.acquireBacking()
    expect([h.canvas.width, h.canvas.height]).toEqual([64, 32])
    h.markDirty()
    rs.update(world, 1 / 60)
    expect(rs.stats.textureUploads).toBe(1)
    expect(h.canvas.width).toBe(0)
  })

  it('does not release when the option is off, and asks the app to repaint after a context restore', () => {
    const rs = new RenderSystem(createRecordingCanvas(200, 100), new Map())
    const world = new ECSWorld()
    const keep = rs.createDynamicCanvas({ id: 'keep', width: 8, height: 8 })
    keep.markDirty()
    let restored = 0
    const h = rs.createDynamicCanvas({
      id: 'a',
      width: 16,
      height: 16,
      releaseAfterUpload: true,
      onRestore: () => restored++,
    })
    h.markDirty()
    rs.update(world, 1 / 60)
    expect(keep.canvas.width).toBe(8)
    expect(h.canvas.width).toBe(0)
    ;(rs as unknown as { onContextRestored(): void }).onContextRestored()
    expect(restored).toBe(1)
  })
})
