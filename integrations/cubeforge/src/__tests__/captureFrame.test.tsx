// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useContext } from 'react'
import { act, render } from '@testing-library/react'
import { ECSWorld, createTransform } from '@cubeforge/core'
import { RenderSystem, createSprite, createRecordingCanvas, installHeadlessCanvasDOM } from '@cubeforge/renderer'
import { captureFrame } from '../utils/capture'
import { Game } from '../components/Game'
import { EngineContext, type EngineState } from '../context'
import { useCaptureFrame } from '../hooks/useCaptureFrame'

interface FakeCopy {
  width: number
  height: number
  draws: unknown[][]
  smoothing: boolean | undefined
  encoded: { mime: string; quality: number }[]
}

let log: string[]
let copies: FakeCopy[]
let uninstall: () => void
let fakeCopies = true

beforeEach(() => {
  uninstall = installHeadlessCanvasDOM()
  log = []
  copies = []
  fakeCopies = true
  const real = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas' || !fakeCopies) return real(tag)
    const copy: FakeCopy = { width: 0, height: 0, draws: [], smoothing: undefined, encoded: [] }
    copies.push(copy)
    const ctx = new Proxy(
      {
        set imageSmoothingEnabled(v: boolean) {
          copy.smoothing = v
        },
        drawImage: (...a: unknown[]) => {
          log.push('copy')
          copy.draws.push(a.slice(1))
        },
      } as Record<string, unknown>,
      { get: (t, k: string) => (k in t ? t[k] : () => ({ addColorStop() {} })) },
    )
    return Object.assign(copy, {
      getContext: () => ctx,
      toBlob: (cb: (b: Blob | null) => void, mime: string, quality: number) => {
        log.push('encode')
        copy.encoded.push({ mime, quality })
        // Real toBlob is asynchronous.
        queueMicrotask(() => {
          log.push('encoded')
          cb(new Blob(['x'], { type: mime }))
        })
      },
    })
  }) as typeof document.createElement)
  vi.stubGlobal('createImageBitmap', async (src: unknown) => {
    log.push('bitmap')
    return { src } as unknown as ImageBitmap
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  uninstall()
})

function target(w = 100, h = 50) {
  const canvas = createRecordingCanvas(w, h)
  const render = vi.fn(() => log.push('render'))
  return { canvas: canvas as unknown as HTMLCanvasElement, render, rec: canvas }
}

describe('captureFrame', () => {
  it('renders, copies synchronously, then encodes a PNG blob by default', async () => {
    const t = target()
    const p = captureFrame(t)
    // Everything that needs the live drawing buffer has happened before the first await.
    expect(log).toEqual(['render', 'copy', 'encode'])
    const blob = (await p) as Blob
    expect(log).toEqual(['render', 'copy', 'encode', 'encoded'])
    expect(blob.type).toBe('image/png')
    expect(copies[0]).toMatchObject({ width: 100, height: 50, encoded: [{ mime: 'image/png', quality: 0.92 }] })
    expect(copies[0].draws[0]).toEqual([0, 0, 100, 50, 0, 0, 100, 50])
  })

  it('returns a bitmap or a detached canvas copy', async () => {
    const t = target()
    const bmp = await captureFrame(t, { type: 'bitmap' })
    expect(log).toEqual(['render', 'copy', 'bitmap'])
    expect((bmp as unknown as { src: unknown }).src).toBe(copies[0])
    const cv = await captureFrame(t, { type: 'canvas' })
    expect(cv).toBe(copies[1])
    expect(cv).not.toBe(t.canvas)
  })

  it('passes mimeType and quality to the encoder', async () => {
    await captureFrame(target(), { mimeType: 'image/jpeg', quality: 0.5 })
    expect(copies[0].encoded).toEqual([{ mime: 'image/jpeg', quality: 0.5 }])
  })

  it('skips the render when asked', async () => {
    const t = target()
    await captureFrame(t, { render: false })
    expect(t.render).not.toHaveBeenCalled()
  })

  it('scales to a size keeping aspect from one side, stretching with both', async () => {
    await captureFrame(target(100, 50), { width: 40, type: 'canvas' })
    expect(copies[0]).toMatchObject({ width: 40, height: 20, smoothing: true })
    await captureFrame(target(100, 50), { height: 100, type: 'canvas' })
    expect(copies[1]).toMatchObject({ width: 200, height: 100, smoothing: false })
    await captureFrame(target(100, 50), { width: 10, height: 30, type: 'canvas' })
    expect(copies[2]).toMatchObject({ width: 10, height: 30 })
    expect(copies[2].draws[0]).toEqual([0, 0, 100, 50, 0, 0, 10, 30])
    await captureFrame(target(100, 50), { width: 200, smoothing: true, type: 'canvas' })
    expect(copies[3].smoothing).toBe(true)
  })

  it('rejects invalid sizes and types', async () => {
    await expect(captureFrame(target(), { width: 0 })).rejects.toThrow(RangeError)
    await expect(captureFrame(target(), { height: NaN })).rejects.toThrow(RangeError)
    await expect(captureFrame(target(), { type: 'gif' as never })).rejects.toThrow(TypeError)
  })

  it('rejects when the browser cannot encode', async () => {
    const t = target()
    vi.mocked(document.createElement).mockImplementationOnce((() => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage() {} }),
      toBlob: (cb: (b: Blob | null) => void) => cb(null),
    })) as never)
    await expect(captureFrame(t)).rejects.toThrow(/could not encode/)
  })

  it('rejects on a lost WebGL context', async () => {
    const t = target()
    t.rec.gl.isContextLost = () => true
    await expect(captureFrame(t)).rejects.toThrow(/context is lost/)
    expect(t.render).not.toHaveBeenCalled()
  })

  it('works on a 2D-context canvas', async () => {
    const draws: unknown[] = []
    const canvas = {
      width: 64,
      height: 32,
      clientWidth: 64,
      clientHeight: 32,
      getContext: (k: string) => (k === '2d' ? { drawImage: (...a: unknown[]) => draws.push(a) } : null),
    } as unknown as HTMLCanvasElement
    const render = vi.fn()
    const out = (await captureFrame({ canvas, render }, { type: 'canvas' })) as unknown as FakeCopy
    expect(render).toHaveBeenCalledTimes(1)
    expect(out).toMatchObject({ width: 64, height: 32 })
  })

  describe('renderAtSize', () => {
    it('renders at the target resolution, then restores the size and repaints', async () => {
      const t = target(100, 50)
      const sizes: string[] = []
      t.render.mockImplementation(() => sizes.push(`${t.canvas.width}x${t.canvas.height}`))
      await captureFrame(t, { width: 300, renderAtSize: true, type: 'canvas' })
      expect(sizes).toEqual(['300x150', '100x50'])
      expect(t.canvas.width).toBe(100)
      expect(t.canvas.height).toBe(50)
      expect(copies[0].draws[0]).toEqual([0, 0])
    })

    it('restores the size even if rendering throws', async () => {
      const t = target(100, 50)
      t.render.mockImplementationOnce(() => {
        throw new Error('boom')
      })
      await expect(captureFrame(t, { width: 300, renderAtSize: true })).rejects.toThrow('boom')
      expect(t.canvas.width).toBe(100)
      expect(t.render).toHaveBeenCalledTimes(2)
    })

    it('falls back to scaling when the canvas is not laid out', async () => {
      const t = target(100, 50)
      ;(t.canvas as unknown as { clientWidth: number }).clientWidth = 0
      await captureFrame(t, { width: 300, renderAtSize: true, type: 'canvas' })
      expect(t.render).toHaveBeenCalledTimes(1)
      expect(copies[0].draws[0]).toEqual([0, 0, 100, 50, 0, 0, 300, 150])
    })
  })
})

describe('captureFrame with the real RenderSystem on RecordingGL', () => {
  it('draws the scene right before the copy', async () => {
    const canvas = createRecordingCanvas(80, 40)
    const rs = new RenderSystem(canvas, new Map())
    const world = new ECSWorld()
    const e = world.createEntity()
    world.addComponent(e, createTransform(0, 0))
    world.addComponent(e, createSprite({ width: 8, height: 8, color: '#ff0000' }))
    const before = canvas.gl.draws.length
    await captureFrame(
      { canvas: canvas as unknown as HTMLCanvasElement, render: () => rs.update(world, 0) },
      { type: 'canvas' },
    )
    expect(canvas.gl.draws.length).toBeGreaterThan(before)
    expect(rs.stats.instances).toBe(1)
  })
})

describe('<Game> engine.captureFrame', () => {
  it('re-renders the world with dt 0 and returns an image, via the engine and the hook', async () => {
    let engine: EngineState | null = null
    let capture!: ReturnType<typeof useCaptureFrame>
    function Probe() {
      engine = useContext(EngineContext)
      capture = useCaptureFrame()
      return null
    }
    const update = vi.spyOn(RenderSystem.prototype, 'update').mockImplementation(() => log.push('render'))
    vi.spyOn(RenderSystem.prototype, 'dispose').mockImplementation(() => {})
    const getContext = HTMLCanvasElement.prototype.getContext
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      kind: string,
    ) {
      if (kind !== 'webgl2') return getContext.call(this, kind as '2d')
      return createRecordingCanvas(this.width, this.height).gl as never
    } as never)
    fakeCopies = false
    await act(async () => {
      render(
        <Game width={120} height={60} mode="onDemand" asyncAssets>
          <Probe />
        </Game>,
      )
    })
    fakeCopies = true
    update.mockClear()
    log.length = 0
    const blob = await engine!.captureFrame!()
    expect(blob).toBeInstanceOf(Blob)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][1]).toBe(0)
    expect(update.mock.calls[0][0]).toBe(engine!.ecs)
    expect(log).toEqual(['render', 'copy', 'encode', 'encoded'])
    const small = await capture({ type: 'canvas', width: 30 })
    expect(small).toMatchObject({ width: 30, height: 15 })
  })
})
