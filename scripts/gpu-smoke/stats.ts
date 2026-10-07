import { ECSWorld } from '../../packages/core/src/index.ts'
import { RenderSystem } from '../../packages/renderer/src/webglRenderSystem.ts'
import { createCamera2D } from '../../packages/renderer/src/components/camera2d.ts'
import { TileLayerData, createTileLayerComponent } from '../../packages/renderer/src/tileLayer.ts'
import { SpriteLayer } from '../../packages/renderer/src/spriteLayer.ts'

const out: Record<string, unknown> = {}
void (async () => {
  try {
    const solid = (color: string) => {
      const c = document.createElement('canvas')
      c.width = c.height = 16
      const g = c.getContext('2d')!
      g.fillStyle = color
      g.fillRect(0, 0, 16, 16)
      return c
    }
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    canvas.style.width = canvas.style.height = '256px'
    document.body.appendChild(canvas)
    const rs = new RenderSystem(canvas, new Map())
    const world = new ECSWorld()
    world.addComponent(world.createEntity(), createCamera2D({ x: 128, y: 128, zoom: 1, background: '#000000' }))
    const tiles = new TileLayerData({
      width: 16,
      height: 16,
      tileset: { image: solid('#ffffff'), tileWidth: 16, tileHeight: 16, columns: 1 },
      tinted: true,
    })
    tiles.fill(1)
    tiles.setTint(0, 0, 0x00ff00ff)
    world.addComponent(world.createEntity(), createTileLayerComponent(tiles))
    const sprites = new SpriteLayer({ image: solid('#ff0000'), frameWidth: 16, frameHeight: 16 })
    sprites.add(128, 128, 20, 20)
    rs.addSpriteLayer(sprites)
    const gl = (rs as unknown as { gl: WebGL2RenderingContext }).gl
    rs.update(world, 1 / 60)
    const st = rs.stats
    out.layerKinds = st.layers.map((l) => l.kind).join(',')
    out.layerDrawCalls = st.layers.map((l) => l.drawCalls).join(',')
    out.tileTexturesCounted = st.tile.textureCount >= 3 && st.textureBytes >= st.tile.textureBytes
    // GPU timing is opt-in; SwiftShader has no timer query, which must read as null, not throw.
    out.noGpuByDefault = st.gpuMs === null && st.gpuTimerSupported === null
    out.gpuTimerSupported = await rs.setGpuTiming(true)
    for (let i = 0; i < 40; i++) {
      rs.update(world, 1 / 60)
      await new Promise((r) => setTimeout(r, 10))
    }
    const g = st.gpuMs
    out.gpuMsOk = out.gpuTimerSupported
      ? g === null || (Number.isFinite(g) && g >= 0)
      : g === null && st.gpuMsAvg === null
    out.gpuFlagMatches = st.gpuTimerSupported === out.gpuTimerSupported
    out.gpuMs = g
    await rs.setGpuTiming(false)
    out.gpuOff = st.gpuMs === null
    out.glError = gl.getError()
  } catch (e) {
    out.error = String((e as Error).stack ?? e)
  }
  document.title = 'done'
  document.body.setAttribute('data-out', JSON.stringify(out))
})()
