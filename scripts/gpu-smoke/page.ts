import { ECSWorld } from '../../packages/core/src/index.ts'
import { RenderSystem } from '../../packages/renderer/src/webglRenderSystem.ts'
import { createCamera2D } from '../../packages/renderer/src/components/camera2d.ts'
import { TileLayerData, createTileLayerComponent } from '../../packages/renderer/src/tileLayer.ts'
import { createSprite } from '../../packages/renderer/src/components/sprite.ts'
import { createTransform } from '../../packages/core/src/index.ts'
import { SpriteLayer } from '../../packages/renderer/src/spriteLayer.ts'
import {
  createCircleShape,
  createLineShape,
  createPolygonShape,
} from '../../packages/renderer/src/components/shapes.ts'
import { createGradient } from '../../packages/renderer/src/components/gradient.ts'

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

  const yellowAtlas = solid(['#ffff00'])
  const layer = new SpriteLayer({
    atlases: [
      { image: yellowAtlas, frameWidth: 16, frameHeight: 16 },
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
  rs.setScreenTint(0.5, 0.5, 1, 1, 'multiply')
  rs.update(world, 1 / 60)
  out.nightTile = px(40, 40)
  rs.setScreenTint(1, 1, 1, 0)
  // a tint set in the same frame as a full tile replace must still reach the GPU
  tiles.setTiles(tiles.tiles)
  tiles.setTint(0, 0, 0x0000ffff)
  rs.update(world, 1 / 60)
  out.retintedAfterSetTiles = px(8, 8)
  // repainting a canvas used as a layer image shows up after markAtlasDirty()
  rs.update(world, 1 / 60)
  out.atlasBeforeRepaint = px(192, 192)
  const g2 = yellowAtlas.getContext('2d')!
  g2.fillStyle = '#ff0000'
  g2.fillRect(0, 0, 16, 16)
  layer.markAtlasDirty(0)
  rs.update(world, 1 / 60)
  out.atlasAfterRepaint = px(192, 192)
  // far zoom: average-colour path
  world.getComponent<{ type: 'Camera2D'; zoom: number }>(cam, 'Camera2D')!.zoom = 0.05
  tiles.jitter = 0.5
  rs.update(world, 1 / 60)
  out.farZoomCenter = px(128, 128)
  out.glError2 = gl.getError()

  // tile layer in the shared z-order: above a sprite (z 0), beneath another (z 20)
  world.getComponent<{ type: 'Camera2D'; zoom: number }>(cam, 'Camera2D')!.zoom = 1
  tiles.jitter = 0
  const addBox = (x: number, z: number, color: string) => {
    const e = world.createEntity()
    world.addComponent(e, createTransform(x, 100))
    world.addComponent(e, createSprite({ width: 40, height: 40, color, zIndex: z }))
  }
  addBox(100, 0, '#ff0000') // x 80..120
  addBox(140, 20, '#ffff00') // x 120..160
  const decor = new TileLayerData({
    width: 2,
    height: 2,
    tileset: { image: solid(['#00ff00']), tileWidth: 16, tileHeight: 16, columns: 1 },
    renderLayer: 'default',
    zIndex: 10,
    x: 100,
    y: 90, // covers x 100..132, y 90..122
  })
  decor.fill(1)
  world.addComponent(world.createEntity(), createTileLayerComponent(decor))
  rs.update(world, 1 / 60)
  rs.update(world, 1 / 60)
  out.spriteBelowDecor = px(85, 95)
  out.decorAboveLowSprite = px(105, 95)
  out.highSpriteAboveDecor = px(125, 95)
  out.glError3 = gl.getError()

  // tile atlas filtering: a 1px checkerboard zoomed out 4x is mid grey with mipmaps
  const checker = document.createElement('canvas')
  checker.width = 16
  checker.height = 16
  const cg = checker.getContext('2d')!
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      cg.fillStyle = (x + y) % 2 ? '#ffffff' : '#000000'
      cg.fillRect(x, y, 1, 1)
    }
  const mipLayer = new TileLayerData({
    width: 4,
    height: 4,
    tileset: { image: checker, tileWidth: 16, tileHeight: 16, columns: 1 },
    minFilter: 'mipmap',
    farZoomPx: 0,
    zIndex: 5,
    x: 100,
    y: 100, // 64x64 world, 16x16 px at zoom 0.25 around screen (121..137)
  })
  mipLayer.fill(1)
  world.addComponent(world.createEntity(), createTileLayerComponent(mipLayer))
  world.getComponent<{ type: 'Camera2D'; zoom: number }>(cam, 'Camera2D')!.zoom = 0.25
  rs.update(world, 1 / 60)
  rs.update(world, 1 / 60)
  out.mipCheckerGrey = px(129, 129)
  out.mipCheckerGreyB = px(125, 133)
  out.glError5 = gl.getError()

  // vector shapes: antialiased circle / line, triangulated polygon, baked gradient
  world.getComponent<{ type: 'Camera2D'; zoom: number }>(cam, 'Camera2D')!.zoom = 1
  const addShape = (x: number, y: number, ...comps: object[]) => {
    const e = world.createEntity()
    world.addComponent(e, createTransform(x, y))
    for (const c of comps) world.addComponent(e, c as never)
  }
  addShape(60, 200, createCircleShape({ radius: 20, color: '#00ff00', zIndex: 50 }))
  addShape(
    100,
    230,
    createLineShape({ endX: 100, endY: 0, color: '#ff00ff', lineWidth: 4, zIndex: 50, lineCap: 'butt' }),
  )
  addShape(
    0,
    0,
    createPolygonShape({
      points: [
        { x: 200, y: 150 },
        { x: 240, y: 150 },
        { x: 220, y: 190 },
      ],
      color: '#00ffff',
      zIndex: 50,
    }),
  )
  addShape(
    30,
    80,
    createGradient({
      stops: [
        { offset: 0, color: '#000000' },
        { offset: 1, color: '#ffffff' },
      ],
      width: 40,
      height: 40,
      zIndex: 60,
    }),
  )
  rs.update(world, 1 / 60)
  rs.update(world, 1 / 60)
  out.circleCenter = px(60, 200)
  out.circleOutside = px(60 + 24, 200) === '0,255,0,255' ? 'bad' : 'ok'
  // pixel (74, 213) straddles the rim: a partial coverage blend, not 0 or 255
  const rim = Number(px(74, 213).split(',')[0])
  out.circleAntialiased = rim > 10 && rim < 245 ? 'ok' : `bad:${rim}`
  out.lineMiddle = px(150, 230)
  out.lineOutside = px(150, 238) === '255,0,255,255' ? 'bad' : 'ok'
  out.polygonInside = px(220, 160)
  out.polygonOutside = px(205, 186) === '0,255,255,255' ? 'bad' : 'ok'
  out.gradientLeft = Number(px(12, 80).split(',')[0]) < 60 ? 'dark' : 'bad'
  out.gradientRight = Number(px(48, 80).split(',')[0]) > 200 ? 'light' : 'bad'
  out.glErrorShapes = gl.getError()

  // usePostProcess effect stack: a 2D effect paints the top-left corner; the rest of the frame stays
  rs.postProcessStack.add((ctx) => {
    ctx.fillStyle = '#ff00ff'
    ctx.fillRect(0, 0, 32, 32)
  })
  rs.update(world, 1 / 60)
  out.stackTopLeft = px(10, 10)
  out.stackBottomLeftUntouched = px(10, 245) === '255,0,255,255' ? 'flipped' : 'ok'
  out.stackKeepsScene = px(128, 128) === '255,0,255,255' ? 'overwritten' : 'ok'
  out.glError6 = gl.getError()
  world.getComponent<{ type: 'Camera2D'; zoom: number }>(cam, 'Camera2D')!.zoom = 1
  tiles.jitter = 0
  // sprite layer: 12 atlases (two bind groups, drawn in depth order) and a frame table
  const many = new SpriteLayer({
    atlases: Array.from({ length: 12 }, (_, i) => ({
      image: solid([i === 9 ? '#00ffff' : i === 0 ? '#ff0000' : '#ffffff']),
      frameWidth: 16,
      frameHeight: 16,
    })),
    sortByKey: true,
    zIndex: 30,
  })
  const m0 = many.add(150, 50, 16, 16)
  many.atlas[m0] = 0
  many.sortKey[m0] = 1
  const m9 = many.add(156, 56, 16, 16)
  many.atlas[m9] = 9
  many.sortKey[m9] = 2
  const m0b = many.add(190, 50, 16, 16) // red again after the group switch: draws on top of cyan
  many.atlas[m0b] = 0
  many.sortKey[m0b] = 3
  const m9b = many.add(196, 56, 16, 16)
  many.atlas[m9b] = 9
  many.sortKey[m9b] = 0
  rs.addSpriteLayer(many)
  const framed = new SpriteLayer({
    image: solid(['#00ff00', '#ff00ff']),
    frames: [{ x: 16, y: 0, w: 16, h: 16 }],
    inset: 2,
    zIndex: 40,
  })
  framed.add(230, 50, 16, 16, 0)
  rs.addSpriteLayer(framed)
  rs.update(world, 1 / 60)
  rs.update(world, 1 / 60)
  out.groupTopIsCyan = px(162, 62) // only the cyan (atlas 9, key 2) sprite covers it
  out.groupUnderIsRed = px(144, 44) // only the red (atlas 0, key 1) sprite
  out.groupOverlapTopCyan = px(155, 55)
  out.groupSwitchRedOnTop = px(192, 52)
  out.frameTableMagenta = px(230, 50)
  out.glError4 = gl.getError()

  // additive tile bias: grey 0x80 + bias 0x40 = 0xC0, tint still multiplies first
  world.getComponent<{ type: 'Camera2D'; zoom: number }>(cam, 'Camera2D')!.zoom = 1
  const grey = new TileLayerData({
    width: 2,
    height: 1,
    tileset: { image: solid(['#808080']), tileWidth: 16, tileHeight: 16, columns: 1 },
    tinted: true,
    biased: true,
    zIndex: 90,
    x: 20,
    y: 220,
  })
  grey.fill(1)
  grey.setBias(0, 0, 0x404040)
  grey.setTint(1, 0, 0x808080ff) // 0x80 * 0.5 = 0x40
  grey.setBias(1, 0, 0x404040) // + 0x40 = 0x80
  world.addComponent(world.createEntity(), createTileLayerComponent(grey))
  rs.update(world, 1 / 60)
  rs.update(world, 1 / 60)
  out.biasBrightens = px(28, 228)
  out.biasAfterTint = px(44, 228)
  out.glError6 = gl.getError()

  // per-sprite anchor and frame pivot move the quad around its (x, y)
  const pv = new SpriteLayer({
    atlases: [{ image: solid(['#ff00ff']), frames: [{ x: 0, y: 0, w: 16, h: 16, pivot: { x: 16, y: 16 } }] }],
    zIndex: 60,
  })
  pv.add(100, 232, 16, 16, 0) // frame pivot bottom-right: quad x 84..100, y 216..232
  const pa = pv.add(160, 232, 16, 16, 0)
  pv.setAnchor(pa, 0, 0) // top-left anchor: quad x 160..176, y 232..248
  rs.addSpriteLayer(pv)
  rs.update(world, 1 / 60)
  rs.update(world, 1 / 60)
  out.pivotQuadLeftOfX = px(92, 224)
  out.pivotNotRightOfX = px(108, 240)
  out.anchorQuadRightOfX = px(168, 240)
  out.anchorNotLeftOfX = px(152, 224)
  out.glError7 = gl.getError()

  // additive colour and per-sprite additive blending (mid grey sprite over the white tiles)
  const ad = new SpriteLayer({ atlases: [{}], zIndex: 70 })
  const a0 = ad.add(40, 40, 16, 16)
  ad.flags[a0] |= 1 << 3 // SPRITE_UNTEXTURED
  ad.color[a0] = 0x808080ff
  ad.enableColorAdd()[a0] = 0x400000 // 0x80 + 0x40 red, then drawn normally
  const a1 = ad.add(80, 40, 16, 16)
  ad.flags[a1] |= (1 << 3) | 32 // untextured + additive: black-ish sprite adds onto white (stays white)
  ad.color[a1] = 0x303030ff
  const a2 = ad.add(120, 40, 16, 16) // additive over the blue tile (1,0): grey 0x30 added to 0,0,255
  ad.flags[a2] |= (1 << 3) | 32
  ad.color[a2] = 0x303030ff
  rs.addSpriteLayer(ad)
  rs.update(world, 1 / 60)
  rs.update(world, 1 / 60)
  out.colorAddRed = px(40, 40)
  out.additiveOnWhite = px(80, 40)
  out.glError8 = gl.getError()
} catch (e) {
  out.error = String((e as Error).stack ?? e)
}
document.title = 'done'
document.body.setAttribute('data-out', JSON.stringify(out))
