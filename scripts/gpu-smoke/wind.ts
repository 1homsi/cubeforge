import { ECSWorld } from '../../packages/core/src/index.ts'
import { RenderSystem } from '../../packages/renderer/src/webglRenderSystem.ts'
import { createCamera2D } from '../../packages/renderer/src/components/camera2d.ts'
import { SpriteLayer, SPRITE_UNTEXTURED, SPRITE_SWAY } from '../../packages/renderer/src/spriteLayer.ts'

const out: Record<string, unknown> = {}
try {
  const SIZE = 256
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  canvas.style.width = `${SIZE}px`
  canvas.style.height = `${SIZE}px`
  document.body.appendChild(canvas)
  const rs = new RenderSystem(canvas, new Map())
  const world = new ECSWorld()
  world.addComponent(world.createEntity(), createCamera2D({ x: 128, y: 128, zoom: 1, background: '#000000' }))
  const gl = (rs as unknown as { gl: WebGL2RenderingContext }).gl
  const lit = (x: number, y: number) => {
    const d = new Uint8Array(4)
    gl.readPixels(x, SIZE - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, d)
    return d[0] > 200
  }
  // 20x40 rect centred on (64, 128): x 54..74, y 108..148. Wind: top sways 0.25 x 40 = 10 px at sin = 1.
  const layer = new SpriteLayer({ wind: { amplitude: 0.25, speed: 0.5, frequency: 0 } })
  const mk = (x: number, flag: number) => {
    const i = layer.add(x, 128, 20, 40)
    layer.flags[i] = SPRITE_UNTEXTURED | flag
    layer.color[i] = 0xffffffff
  }
  mk(64, SPRITE_SWAY)
  mk(192, 0) // not flagged: must not move
  rs.addSpriteLayer(layer)
  rs.update(world, 0) // t = 0: sin(0) = 0, nothing bent
  out.restTop = lit(60, 111) && !lit(80, 111) ? 'ok' : 'moved at t=0'
  rs.update(world, 0.5) // t = 0.5 s at 0.5 Hz: sin(pi/2) = 1
  out.swayTopMoves = lit(80, 111) && !lit(56, 111) ? 'ok' : 'top did not sway right'
  out.swayBaseStays = lit(56, 145) && !lit(80, 145) ? 'ok' : 'base moved'
  out.unflaggedStays = lit(184, 111) && !lit(204, 111) && lit(200, 145) ? 'ok' : 'unflagged sprite moved'
  out.glError = gl.getError()
} catch (e) {
  out.error = String((e as Error).stack ?? e)
}
document.title = 'done'
document.body.setAttribute('data-out', JSON.stringify(out))
