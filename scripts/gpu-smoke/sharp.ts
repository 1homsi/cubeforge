import { ECSWorld } from '../../packages/core/src/index.ts'
import { RenderSystem } from '../../packages/renderer/src/webglRenderSystem.ts'
import { createCamera2D } from '../../packages/renderer/src/components/camera2d.ts'
import { TextLayer, GlyphAtlas } from '../../packages/renderer/src/textLayer.ts'

const out: Record<string, unknown> = {}
try {
  const SIZE = 256
  /** Edge width of a label rendered at `zoom`: intermediate-valued pixels per edge on rows through the stems. */
  const edgeWidth = (zoom: number, zoomAware: boolean) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIZE
    canvas.style.width = canvas.style.height = `${SIZE}px`
    document.body.appendChild(canvas)
    const rs = new RenderSystem(canvas, new Map())
    const world = new ECSWorld()
    world.addComponent(world.createEntity(), createCamera2D({ x: 128, y: 128, zoom, background: '#000000' }))
    const layer = new TextLayer({
      atlas: new GlyphAtlas(),
      fontFamily: 'sans-serif',
      weight: 'bold',
      fontSize: 16,
      zoomAware,
    })
    layer.add('HHH', 128, 128)
    rs.addTextLayer(layer)
    rs.update(world, 1 / 60)
    rs.update(world, 1 / 60)
    const gl = (rs as unknown as { gl: WebGL2RenderingContext }).gl
    const d = new Uint8Array(SIZE * SIZE * 4)
    gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, d)
    let mid = 0
    let edges = 0
    // rows through the vertical stems of the 'H's (above and below the crossbar), relative to the label centre
    const rows = [-0.3, -0.25, 0.25, 0.3].map((f) => Math.round(128 + f * 16 * zoom))
    for (const y of rows) {
      const row = SIZE - 1 - y
      let prev = d[row * SIZE * 4]
      for (let x = 1; x < SIZE; x++) {
        const v = d[(row * SIZE + x) * 4]
        if (v > 30 && v < 225) mid++
        if (prev <= 127 !== v <= 127) edges++
        prev = v
      }
    }
    return { width: edges ? mid / edges : 99, edges, gl: gl.getError() }
  }
  for (const z of [1, 4]) {
    const a = edgeWidth(z, true)
    const b = edgeWidth(z, false)
    out[`aware${z}`] = a.width.toFixed(2)
    out[`fixed${z}`] = b.width.toFixed(2)
    out[`edges${z}`] = a.edges
    out[`gl${z}`] = a.gl + b.gl
  }
  out.crispAt1x = Number(out.aware1) <= 2.2 ? 'ok' : `edge width ${out.aware1}`
  out.crispAt4x = Number(out.aware4) <= 2.2 ? 'ok' : `edge width ${out.aware4}`
  out.fixedBlursAt4x =
    Number(out.fixed4) > Number(out.aware4) + 0.8 ? 'ok' : `fixed ${out.fixed4} vs aware ${out.aware4}`
  out.hasEdges = Number(out.edges1) >= 8 && Number(out.edges4) >= 8 ? 'ok' : 'no stems found'
} catch (e) {
  out.error = String((e as Error).stack ?? e)
}
document.title = 'done'
document.body.setAttribute('data-out', JSON.stringify(out))
