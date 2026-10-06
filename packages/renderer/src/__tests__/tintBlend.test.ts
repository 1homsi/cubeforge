import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ECSWorld } from '@cubeforge/core'
import { RenderSystem } from '../webglRenderSystem'
import { TileLayerData, createTileLayerComponent } from '../tileLayer'
import { SpriteLayer } from '../spriteLayer'
import { TextLayer } from '../textLayer'
import { createRecordingCanvas, installHeadlessCanvasDOM } from '../testing/recordingGL'

let uninstall: () => void
beforeAll(() => {
  uninstall = installHeadlessCanvasDOM()
})
afterAll(() => uninstall())

const GL = {
  ONE: 1,
  ZERO: 0,
  SRC_ALPHA: 0x0302,
  ONE_MINUS_SRC_ALPHA: 0x0303,
  ONE_MINUS_SRC_COLOR: 0x0301,
  DST_COLOR: 0x0306,
}

function setup() {
  const canvas = createRecordingCanvas(200, 100)
  const rs = new RenderSystem(canvas, new Map())
  return { gl: canvas.gl, rs, world: new ECSWorld() }
}

function layer(z: number, n: number, opts: ConstructorParameters<typeof SpriteLayer>[0] = {}) {
  const l = new SpriteLayer({ zIndex: z, ...opts })
  for (let i = 0; i < n; i++) l.add(0, 0, 8, 8)
  return l
}

describe('named and sorted screen tints', () => {
  it('draws the legacy tint after every sprite layer', () => {
    const { gl, rs, world } = setup()
    rs.addSpriteLayer(layer(1, 2))
    rs.addSpriteLayer(layer(5, 3))
    rs.setScreenTint(0.5, 0.5, 1, 1)
    rs.update(world, 1 / 60)
    expect(gl.draws.map((d) => d.count)).toEqual([2, 3, 1])
  })

  it('a tint with zIndex only covers what is drawn before it', () => {
    const { gl, rs, world } = setup()
    rs.addSpriteLayer(layer(1, 2))
    rs.addSpriteLayer(layer(5, 3))
    rs.setTint('night', 0.2, 0.2, 0.5, 1, { zIndex: 3 })
    rs.update(world, 1 / 60)
    expect(gl.draws.map((d) => d.count)).toEqual([2, 1, 3]) // layer z1, tint, layer z5 stays bright
    // multiply: DST_COLOR x ZERO
    expect(gl.draws[1].blend).toEqual([GL.DST_COLOR, GL.ZERO])
  })

  it('a sorted tint draws after items at equal layer and zIndex, and covers beneath-sprite tile layers', () => {
    const { gl, rs, world } = setup()
    const tiles = new TileLayerData({
      width: 2,
      height: 2,
      tileset: {
        image: { width: 8, height: 8 } as unknown as HTMLCanvasElement,
        tileWidth: 8,
        tileHeight: 8,
        columns: 1,
      },
    })
    tiles.fill(1)
    world.addComponent(world.createEntity(), createTileLayerComponent(tiles))
    rs.addSpriteLayer(layer(3, 2))
    rs.setTint('t', 1, 0, 0, 0.5, { zIndex: 3, mode: 'normal' })
    rs.update(world, 1 / 60)
    expect(gl.draws.map((d) => (d.kind === 'arrays' ? 'T' : d.count))).toEqual(['T', 2, 1])
  })

  it('stacks several named tints and removes them', () => {
    const { gl, rs, world } = setup()
    rs.addSpriteLayer(layer(1, 1))
    rs.setTint('a', 0.5, 0.5, 0.5, 1)
    rs.setTint('b', 1, 1, 1, 0.3, { mode: 'additive' })
    rs.update(world, 1 / 60)
    expect(gl.draws).toHaveLength(3)
    expect(gl.draws[2].blend).toEqual([GL.SRC_ALPHA, GL.ONE]) // additive
    rs.clearTint('a')
    rs.update(world, 1 / 60)
    expect(gl.draws).toHaveLength(2)
    rs.setTint('b', 1, 1, 1, 0)
    rs.update(world, 1 / 60)
    expect(gl.draws).toHaveLength(1)
  })

  it('screen tints use the screen blend function', () => {
    const { gl, rs, world } = setup()
    rs.setScreenTint(0.2, 0.2, 0.2, 1, 'screen')
    rs.update(world, 1 / 60)
    expect(gl.draws.at(-1)!.blend).toEqual([GL.ONE, GL.ONE_MINUS_SRC_COLOR])
  })
})

describe('per-layer blend, tint and opacity', () => {
  it('SpriteLayer blend sets the blend function for its draw and restores it', () => {
    const { gl, rs, world } = setup()
    rs.addSpriteLayer(layer(1, 1, { blend: 'additive' }))
    rs.addSpriteLayer(layer(2, 1, { blend: 'multiply' }))
    rs.addSpriteLayer(layer(3, 1, { blend: 'screen' }))
    rs.addSpriteLayer(layer(4, 1))
    rs.update(world, 1 / 60)
    expect(gl.draws.map((d) => d.blend)).toEqual([
      [GL.SRC_ALPHA, GL.ONE],
      [GL.DST_COLOR, GL.ONE_MINUS_SRC_ALPHA],
      [GL.ONE, GL.ONE_MINUS_SRC_COLOR],
      [GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA],
    ])
  })

  it('opacity, tintColor and blend are reactive (bump the version)', () => {
    const l = layer(0, 1)
    const v = l.version
    l.opacity = 0.5
    l.tintColor = 0xff0000ff
    l.blend = 'screen'
    expect(l.version).toBe(v + 3)
    l.opacity = 0.5
    expect(l.version).toBe(v + 3)
    expect(l.tintColor).toBe(0xff0000ff)
  })

  it('TileLayer blend applies to its draw and wakes via onChange', () => {
    const { gl, rs, world } = setup()
    const tiles = new TileLayerData({
      width: 2,
      height: 2,
      tileset: {
        image: { width: 8, height: 8 } as unknown as HTMLCanvasElement,
        tileWidth: 8,
        tileHeight: 8,
        columns: 1,
      },
      blend: 'multiply',
      tintColor: 0x8080ffff,
    })
    tiles.fill(1)
    let changes = 0
    tiles.onChange = () => changes++
    world.addComponent(world.createEntity(), createTileLayerComponent(tiles))
    rs.update(world, 1 / 60)
    expect(gl.draws[0].blend).toEqual([GL.DST_COLOR, GL.ONE_MINUS_SRC_ALPHA])
    tiles.blend = 'normal'
    tiles.tintColor = 0xffffffff
    expect(changes).toBe(2)
  })

  it('TextLayer blend uses premultiplied factors', () => {
    const { gl, rs, world } = setup()
    const t = new TextLayer({ blend: 'additive', tintColor: 0xff0000ff })
    t.add('hi', 100, 50)
    rs.addTextLayer(t)
    rs.update(world, 1 / 60)
    expect(gl.draws[0].blend).toEqual([GL.ONE, GL.ONE])
  })
})
