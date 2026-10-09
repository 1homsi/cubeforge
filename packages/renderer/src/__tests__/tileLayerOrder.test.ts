import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ECSWorld, createTransform } from '@xip/core'
import { RenderSystem } from '../webglRenderSystem'
import { createSprite } from '../components/sprite'
import { TileLayerData, createTileLayerComponent } from '../tileLayer'
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
  const world = new ECSWorld()
  return { gl: canvas.gl, rs, world }
}

function addSprite(world: ECSWorld, z: number, layer?: string) {
  const e = world.createEntity()
  world.addComponent(e, createTransform(0, 0))
  world.addComponent(e, createSprite({ width: 8, height: 8, color: '#ff0000', zIndex: z, layer }))
}

function addTiles(world: ECSWorld, opts: Partial<ConstructorParameters<typeof TileLayerData>[0]> = {}) {
  const l = new TileLayerData({
    width: 4,
    height: 4,
    tileset: {
      image: { width: 16, height: 16 } as unknown as HTMLCanvasElement,
      tileWidth: 16,
      tileHeight: 16,
      columns: 1,
    },
    ...opts,
  })
  l.fill(1)
  const e = world.createEntity()
  world.addComponent(e, createTileLayerComponent(l))
  return l
}

/** Draw kinds of the last frame in order: 'S' sprite batch, 'T' tile page, 'L' sprite layer. */
function order(gl: ReturnType<typeof setup>['gl']): string {
  return gl.draws.map((d) => (d.kind === 'arrays' ? 'T' : 'S')).join('')
}

describe('TileLayer shared z-order', () => {
  it('legacy tile layers (no renderLayer) draw beneath every sprite', () => {
    const { gl, rs, world } = setup()
    addSprite(world, 0)
    addTiles(world, { zIndex: 50 })
    rs.update(world, 1 / 60)
    expect(order(gl)).toBe('TS')
  })

  it('a tile layer with renderLayer sorts between sprites by zIndex', () => {
    const { gl, rs, world } = setup()
    addSprite(world, 0)
    addSprite(world, 10)
    addTiles(world, { renderLayer: 'default', zIndex: 5 })
    rs.update(world, 1 / 60)
    expect(order(gl)).toBe('STS')
  })

  it('above every sprite when its zIndex is higher; below when lower', () => {
    const { gl, rs, world } = setup()
    addSprite(world, 0)
    const t = addTiles(world, { renderLayer: 'default', zIndex: 5 })
    rs.update(world, 1 / 60)
    expect(order(gl)).toBe('ST')
    t.zIndex = -1
    rs.update(world, 1 / 60)
    expect(order(gl)).toBe('TS')
  })

  it('orders by render layer first (named layer above default sprites)', () => {
    const { gl, rs, world } = setup()
    rs.layers.addLayer('overlay', 100)
    addSprite(world, 999)
    addTiles(world, { renderLayer: 'overlay', zIndex: -5 })
    rs.update(world, 1 / 60)
    expect(order(gl)).toBe('ST')
  })

  it('at equal layer and zIndex the tile layer draws before sprites', () => {
    const { gl, rs, world } = setup()
    addSprite(world, 3)
    addTiles(world, { renderLayer: 'default', zIndex: 3 })
    rs.update(world, 1 / 60)
    expect(order(gl)).toBe('TS')
  })

  it('interleaves with SpriteLayers', () => {
    const { gl, rs, world } = setup()
    const a = new SpriteLayer({ zIndex: 0 })
    a.add(0, 0, 4, 4)
    const b = new SpriteLayer({ zIndex: 10 })
    b.add(0, 0, 4, 4)
    rs.addSpriteLayer(b)
    rs.addSpriteLayer(a)
    addTiles(world, { renderLayer: 'default', zIndex: 5 })
    rs.update(world, 1 / 60)
    expect(order(gl)).toBe('STS')
  })

  it('mixes legacy and sorted tile layers: legacy first, then the sorted one in z order', () => {
    const { gl, rs, world } = setup()
    addSprite(world, 0)
    addTiles(world, { zIndex: 100 })
    addTiles(world, { renderLayer: 'default', zIndex: 1 })
    rs.update(world, 1 / 60)
    expect(order(gl)).toBe('TST')
  })

  it('changing renderLayer at runtime reorders and counts every draw', () => {
    const { gl, rs, world } = setup()
    addSprite(world, 0)
    const t = addTiles(world)
    rs.update(world, 1 / 60)
    expect(order(gl)).toBe('TS')
    t.renderLayer = 'default'
    t.zIndex = 4
    rs.update(world, 1 / 60)
    expect(order(gl)).toBe('ST')
    expect(rs.stats.drawCalls).toBe(2)
  })
})
