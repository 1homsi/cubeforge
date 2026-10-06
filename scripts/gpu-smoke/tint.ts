import { ECSWorld } from '../../packages/core/src/index.ts'
import { RenderSystem } from '../../packages/renderer/src/webglRenderSystem.ts'
import { createCamera2D } from '../../packages/renderer/src/components/camera2d.ts'
import { SpriteLayer, SPRITE_UNTEXTURED } from '../../packages/renderer/src/spriteLayer.ts'
import { TileLayerData, createTileLayerComponent } from '../../packages/renderer/src/tileLayer.ts'
import type { LayerBlendMode } from '../../packages/renderer/src/blendModes.ts'

const out: Record<string, unknown> = {}
try {
  const SIZE = 256
  const make = (background = '#000000') => {
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    canvas.style.width = `${SIZE}px`
    canvas.style.height = `${SIZE}px`
    document.body.appendChild(canvas)
    const rs = new RenderSystem(canvas, new Map())
    const world = new ECSWorld()
    world.addComponent(world.createEntity(), createCamera2D({ x: SIZE / 2, y: SIZE / 2, zoom: 1, background }))
    const gl = (rs as unknown as { gl: WebGL2RenderingContext }).gl
    const px = (x: number, y: number) => {
      const d = new Uint8Array(4)
      gl.readPixels(x, SIZE - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, d)
      return [d[0], d[1], d[2], d[3]]
    }
    return { rs, world, gl, px }
  }
  // one solid square per call, at (x, y) in a layer with the given options
  const rect = (
    rs: RenderSystem,
    x: number,
    y: number,
    color: number,
    z: number,
    opts: { opacity?: number; tintColor?: number; blend?: LayerBlendMode } = {},
  ) => {
    const l = new SpriteLayer({ zIndex: z, ...opts })
    const i = l.add(x, y, 40, 40)
    l.flags[i] = SPRITE_UNTEXTURED
    l.color[i] = color
    rs.addSpriteLayer(l)
    return l
  }
  /** Channels within `tol` of `want`, else the actual values. */
  const near = (got: number[], want: number[], tol = 2) =>
    got.every((v, i) => Math.abs(v - want[i]) <= tol) ? 'ok' : got.join(',')

  const a = make()
  rect(a.rs, 32, 32, 0xffffffff, 0, { tintColor: 0xff0000ff })
  rect(a.rs, 96, 32, 0xffffffff, 0, { opacity: 0.5 })
  rect(a.rs, 160, 32, 0x800000ff, 0)
  rect(a.rs, 160, 32, 0x008000ff, 1, { blend: 'additive' })
  rect(a.rs, 32, 96, 0xffffffff, 0)
  rect(a.rs, 32, 96, 0x0080ffff, 1, { blend: 'multiply' })
  rect(a.rs, 96, 96, 0x800000ff, 0)
  rect(a.rs, 96, 96, 0x000080ff, 1, { blend: 'screen' })
  a.rs.update(a.world, 1 / 60)
  a.rs.update(a.world, 1 / 60)
  out.layerTint = near(a.px(32, 32), [255, 0, 0, 255])
  out.layerOpacity = near(a.px(96, 32), [128, 128, 128, 255], 2)
  out.additive = near(a.px(160, 32), [128, 128, 0, 255])
  out.multiply = near(a.px(32, 96), [0, 128, 255, 255])
  out.screen = near(a.px(96, 96), [128, 0, 128, 255])
  out.glError = a.gl.getError()

  // a tint that stops at zIndex 5: ground (z1) dims, the z9 sprite stays bright
  const b = make()
  rect(b.rs, 64, 64, 0xffffffff, 1)
  rect(b.rs, 192, 64, 0xffffffff, 9)
  b.rs.setTint('night', 0.5, 0.5, 0.5, 1, { zIndex: 5 })
  b.rs.update(b.world, 1 / 60)
  out.sortedTintDimsGround = near(b.px(64, 64), [128, 128, 128, 255])
  out.sortedTintSparesTop = near(b.px(192, 64), [255, 255, 255, 255])
  out.glError2 = b.gl.getError()

  // stacked named tints multiply; a tile layer blends additively
  const c = make('#004000')
  rect(c.rs, 64, 64, 0xffffffff, 1)
  c.rs.setTint('a', 0.5, 0.5, 0.5, 1)
  c.rs.setTint('b', 0.5, 0.5, 0.5, 1)
  c.rs.update(c.world, 1 / 60)
  out.stackedTints = near(c.px(64, 64), [64, 64, 64, 255])
  out.stackedTintsBackground = near(c.px(200, 200), [0, 16, 0, 255]) // #004000 x 0.25
  const d = make('#004000')
  const tile = document.createElement('canvas')
  tile.width = tile.height = 8
  const tg = tile.getContext('2d')!
  tg.fillStyle = '#0000ff'
  tg.fillRect(0, 0, 8, 8)
  const tiles = new TileLayerData({
    width: 4,
    height: 4,
    tileset: { image: tile, tileWidth: 8, tileHeight: 8, columns: 1 },
    opacity: 0.5,
    blend: 'additive',
  })
  tiles.fill(1)
  tiles.x = 100
  tiles.y = 100
  d.world.addComponent(d.world.createEntity(), createTileLayerComponent(tiles))
  d.rs.update(d.world, 1 / 60)
  d.rs.update(d.world, 1 / 60)
  out.tileAdditive = near(d.px(110, 110), [0, 64, 128, 255], 3)
  out.tileOutside = near(d.px(10, 10), [0, 64, 0, 255])
  out.glError3 = d.gl.getError()
} catch (e) {
  out.error = String((e as Error).stack ?? e)
}
document.title = 'done'
document.body.setAttribute('data-out', JSON.stringify(out))
