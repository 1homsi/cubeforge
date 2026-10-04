import { ECSWorld } from '../../packages/core/src/index.ts'
import { RenderSystem } from '../../packages/renderer/src/webglRenderSystem.ts'
import { createCamera2D } from '../../packages/renderer/src/components/camera2d.ts'
import { TileLayerData, createTileLayerComponent } from '../../packages/renderer/src/tileLayer.ts'
import { SpriteLayer } from '../../packages/renderer/src/spriteLayer.ts'

const out: Record<string, unknown> = {}
try {
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
  const cam = world.createEntity()
  world.addComponent(cam, createCamera2D({ x: 128, y: 128, zoom: 1, background: '#000000' }))

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
  const te = world.createEntity()
  world.addComponent(te, createTileLayerComponent(tiles))

  const layer = new SpriteLayer({
    atlases: [
      { image: solid(['#ffff00']), frameWidth: 16, frameHeight: 16 },
      { image: solid(['#ff00ff']), frameWidth: 16, frameHeight: 16 },
    ],
    sortByKey: true,
    zIndex: 5,
  })
  const a = layer.add(200, 200, 20, 20, 0, 1)
  layer.atlas[a] = 0
  layer.sortKey[a] = 2
  const b = layer.add(206, 206, 20, 20, 0, 2)
  layer.atlas[b] = 1
  layer.sortKey[b] = 1
  rs.addSpriteLayer(layer)

  const gl = (rs as unknown as { gl: WebGL2RenderingContext }).gl
  const px = (x: number, y: number) => {
    const d = new Uint8Array(4)
    gl.readPixels(x, 255 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, d)
    return [...d].join(',')
  }
  rs.update(world, 1 / 60)
  rs.update(world, 1 / 60)
  out.tintedTile = px(8, 8)
  out.blueTile = px(24, 8)
  out.whiteTile = px(40, 40)
  out.overlapTopIsYellow = px(205, 205)
  out.magentaOnly = px(214, 214)
  out.glError = gl.getError()
  // far zoom: average-colour path
  world.getComponent<{ type: 'Camera2D'; zoom: number }>(cam, 'Camera2D')!.zoom = 0.05
  tiles.jitter = 0.5
  rs.update(world, 1 / 60)
  out.farZoomCenter = px(128, 128)
  out.glError2 = gl.getError()
} catch (e) {
  out.error = String((e as Error).stack ?? e)
}
document.title = 'done'
document.body.setAttribute('data-out', JSON.stringify(out))
