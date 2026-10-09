import { ECSWorld } from '../../packages/core/src/index.ts'
import { RenderSystem } from '../../packages/renderer/src/webglRenderSystem.ts'
import { createCamera2D } from '../../packages/renderer/src/components/camera2d.ts'
import { TileLayerData, createTileLayerComponent } from '../../packages/renderer/src/tileLayer.ts'
import { captureFrame } from '../../integrations/xip/src/utils/capture.ts'

const out: Record<string, unknown> = {}
async function main(): Promise<void> {
  const solid = (colors: string[], size = 16) => {
    const c = document.createElement('canvas')
    c.width = size * colors.length
    c.height = size
    const g = c.getContext('2d')!
    colors.forEach((col, i) => {
      g.fillStyle = col
      g.fillRect(i * size, 0, size, size)
    })
    return c
  }
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  canvas.style.width = '256px'
  canvas.style.height = '256px'
  document.body.appendChild(canvas)
  const rs = new RenderSystem(canvas, new Map())
  const world = new ECSWorld()
  world.addComponent(world.createEntity(), createCamera2D({ x: 128, y: 128, zoom: 1, background: '#000000' }))
  const gl = (rs as unknown as { gl: WebGL2RenderingContext }).gl

  const tiles = new TileLayerData({
    width: 16,
    height: 16,
    tileset: { image: solid(['#ffffff', '#0000ff']), tileWidth: 16, tileHeight: 16, columns: 2 },
    tinted: true,
    variants: { 1: [1, 1] },
  })
  tiles.fill(1)
  tiles.setTint(0, 0, 0x00ff00ff)
  tiles.setTile(1, 0, 2)
  world.addComponent(world.createEntity(), createTileLayerComponent(tiles))
  rs.update(world, 1 / 60)

  // ── captureFrame ─────────────────────────────────────────────────────────
  // A scene with distinct colours (the unit tests only see a fake GL).
  const frame = () => rs.update(world, 0)
  const flipped = (data: Uint8Array | Uint8ClampedArray, w: number, h: number) => {
    const o = new Uint8Array(data.length)
    for (let y = 0; y < h; y++) o.set(data.subarray(y * w * 4, (y + 1) * w * 4), (h - 1 - y) * w * 4)
    return o
  }
  const screen = (): Uint8Array => {
    frame()
    const d = new Uint8Array(256 * 256 * 4)
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, d)
    return flipped(d, 256, 256)
  }
  const pixelsOf = (src: CanvasImageSource, w: number, h: number) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')!
    g.drawImage(src, 0, 0)
    return g.getImageData(0, 0, w, h).data
  }
  const same = (a: ArrayLike<number>, b: ArrayLike<number>) => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }
  const at = (d: ArrayLike<number>, w: number, x: number, y: number) => {
    const i = (y * w + x) * 4
    return [d[i], d[i + 1], d[i + 2], d[i + 3]].join(',')
  }
  const target = { canvas, render: frame }

  const onScreen = screen()
  // The drawing buffer is cleared after the frame is presented, so a plain
  // toBlob()/readPixels() in a later task comes out black; captureFrame copies
  // in the same task as the render.
  const cap = (await captureFrame(target, { type: 'canvas' })) as HTMLCanvasElement
  const capPx = pixelsOf(cap, 256, 256)
  out.captureSize = `${cap.width}x${cap.height}`
  out.captureNotBlack = capPx.some((v, i) => i % 4 !== 3 && v !== 0)
  out.captureEqualsScreen = same(capPx, onScreen)
  out.captureTile = at(capPx, 256, 40, 40)

  const blob = (await captureFrame(target)) as Blob
  const bmp = await createImageBitmap(blob)
  out.blobType = blob.type
  out.blobEqualsScreen = same(pixelsOf(bmp, 256, 256), onScreen)
  const bitmap = (await captureFrame(target, { type: 'bitmap' })) as ImageBitmap
  out.bitmapEqualsScreen = same(pixelsOf(bitmap, 256, 256), onScreen)

  const small = (await captureFrame(target, { type: 'canvas', width: 64 })) as HTMLCanvasElement
  const smallPx = pixelsOf(small, 64, 64)
  out.smallSize = `${small.width}x${small.height}`
  out.smallTile = at(smallPx, 64, 10, 10)

  // Sharp upscale: re-rendered at 2x, so the 16px tile edge lands on a pixel
  // boundary instead of a blurred one: blue tile (x 16..31) next to a white one.
  const big = (await captureFrame(target, { type: 'canvas', width: 512, renderAtSize: true })) as HTMLCanvasElement
  const bigPx = pixelsOf(big, 512, 512)
  out.bigSize = `${big.width}x${big.height}`
  out.bigEdge = `${at(bigPx, 512, 63, 8)}|${at(bigPx, 512, 64, 8)}`
  // The same size by smoothed scaling blurs that edge.
  const blurry = (await captureFrame(target, { type: 'canvas', width: 512, smoothing: true })) as HTMLCanvasElement
  out.scaledEdgeIsBlurred = at(pixelsOf(blurry, 512, 512), 512, 63, 8) !== '0,0,255,255'
  out.canvasRestored = `${canvas.width}x${canvas.height}`
  out.stillRenders = same(screen(), onScreen)
  out.glErrorCapture = gl.getError()
}
main()
  .catch((e) => {
    out.error = String((e as Error).stack ?? e)
  })
  .then(() => {
    document.title = 'done'
    document.body.setAttribute('data-out', JSON.stringify(out))
  })
