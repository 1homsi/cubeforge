import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ECSWorld, createTransform } from '@xip/core'
import { createRenderStats } from '@xip/core'
import { Canvas2DRenderSystem, createCanvas2DStats } from '../canvas2dRenderSystem'
import { createSprite } from '../components/sprite'
import { createText } from '../components/text'
import { createCamera2D } from '../components/camera2d'
import { createParallaxLayer } from '../components/parallaxLayer'
import { createTileLayerComponent, TileLayerData } from '../tileLayer'
import { SpriteLayer, SPRITE_FLIP_X, SPRITE_HIDDEN, SPRITE_UNTEXTURED } from '../spriteLayer'
import { GlyphAtlas, TextLayer, TEXT_HIDDEN } from '../textLayer'
import { createFakeGlyphCanvas } from '../testing/fakeGlyphCanvas'
import { fakeCanvas, fakeImage, type Op } from './fakeCanvas2D'

beforeEach(() => vi.stubGlobal('OffscreenCanvas', undefined))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setup(w = 200, h = 100, cw = w, ch = h) {
  const fc = fakeCanvas(w, h, cw, ch)
  const rs = new Canvas2DRenderSystem(fc.canvas, new Map())
  const world = new ECSWorld()
  const cam = world.createEntity()
  world.addComponent(
    cam,
    createCamera2D({ x: w / (2 * (w / cw)), y: h / (2 * (h / ch)), zoom: 1, background: '#102030' }),
  )
  return { ...fc, rs, world, cam }
}

function addSprite(world: ECSWorld, x: number, y: number, opts: Parameters<typeof createSprite>[0], rot = 0) {
  const e = world.createEntity()
  world.addComponent(e, createTransform(x, y, rot))
  world.addComponent(e, createSprite(opts))
  return e
}

const draws = (ops: Op[], name: string) => ops.filter((o) => o.name === name)

describe('Canvas2DRenderSystem: construction', () => {
  it('keeps its stats object in step with the core RenderStats shape', () => {
    expect(createCanvas2DStats()).toEqual(createRenderStats())
  })

  it('requests an opaque 2D context and throws when there is none', () => {
    const getContext = vi.fn(() => null)
    const canvas = { width: 1, height: 1, getContext } as unknown as HTMLCanvasElement
    expect(() => new Canvas2DRenderSystem(canvas, new Map())).toThrow(/Canvas 2D is not available/)
    const { canvas: ok } = fakeCanvas(10, 10)
    const spy = vi.spyOn(ok, 'getContext')
    new Canvas2DRenderSystem(ok, new Map())
    expect(spy).toHaveBeenCalledWith('2d', { alpha: false })
  })
})

describe('Canvas2DRenderSystem: camera and sprites', () => {
  it('clears to the camera background, then draws a solid sprite under the world transform', () => {
    const { rs, world, ops } = setup()
    addSprite(world, 100, 50, { width: 10, height: 20, color: '#ff0000' })
    rs.update(world, 1 / 60)
    const [clear, rect] = draws(ops, 'fillRect')
    expect(clear.fill).toBe('rgb(16,32,48)')
    expect(clear.args).toEqual([0, 0, 200, 100])
    expect(rect.fill).toBe('rgb(255,0,0)')
    // camera centred on the sprite: it lands at the canvas centre, scale 1
    expect(rect.tf).toEqual([1, 0, -0, 1, 100, 50])
    expect(rect.args).toEqual([-5, -10, 10, 20])
    expect(rs.stats.spritesConsidered).toBe(1)
    expect(rs.stats.instances).toBe(1)
  })

  it('scales by zoom and devicePixelRatio and applies rotation, flip and anchor', () => {
    const { rs, world, ops, cam } = setup(400, 200, 200, 100)
    world.getComponent<{ zoom: number }>(cam, 'Camera2D')!.zoom = 2
    addSprite(
      world,
      100,
      50,
      { width: 10, height: 10, color: '#fff', flipX: true, anchorX: 0, anchorY: 0 },
      Math.PI / 2,
    )
    rs.update(world, 1 / 60)
    const r = draws(ops, 'fillRect')[1]
    // dpr 2 * zoom 2 = 4 device px per world unit; 90 degrees, mirrored in x
    expect(r.tf[0]).toBeCloseTo(0)
    expect(r.tf[1]).toBeCloseTo(-4)
    expect(r.tf[2]).toBeCloseTo(-4)
    expect(r.tf[3]).toBeCloseTo(0)
    expect(r.tf[4]).toBeCloseTo(200)
    expect(r.tf[5]).toBeCloseTo(100)
    expect(r.args).toEqual([0, 0, 10, 10])
  })

  it('sorts by render layer, then zIndex, and culls sprites outside the view', () => {
    const { rs, world, ops } = setup()
    addSprite(world, 100, 50, { width: 4, height: 4, color: '#00ff00', zIndex: 5 })
    addSprite(world, 100, 50, { width: 4, height: 4, color: '#0000ff', zIndex: 1 })
    addSprite(world, 100, 50, { width: 4, height: 4, color: '#ff00ff', layer: 'foreground', zIndex: -9 })
    addSprite(world, 5000, 50, { width: 4, height: 4, color: '#ffffff' })
    rs.update(world, 1 / 60)
    expect(
      draws(ops, 'fillRect')
        .slice(1)
        .map((o) => o.fill),
    ).toEqual(['rgb(0,0,255)', 'rgb(0,255,0)', 'rgb(255,0,255)'])
    expect(rs.stats.spritesCulled).toBe(1)
  })

  it('draws sheet frames, opacity, blend mode and sampling', () => {
    const { rs, world, ops } = setup()
    rs.setDefaultSampling('linear')
    const img = fakeImage(64, 32)
    addSprite(world, 100, 50, {
      width: 16,
      height: 16,
      image: img,
      frameWidth: 16,
      frameHeight: 16,
      frameIndex: 5,
      opacity: 0.5,
      blendMode: 'additive',
    })
    rs.update(world, 1 / 60)
    const d = draws(ops, 'drawImage')[0]
    // 4 columns: frame 5 is column 1, row 1
    expect(d.args).toEqual([img, 16, 16, 16, 16, -8, -8, 16, 16])
    expect(d.alpha).toBe(0.5)
    expect(d.comp).toBe('lighter')
    expect(d.smooth).toBe(true)
  })

  it('multiplies a tinted texture through a cached copy and mixes tint into solid colours', () => {
    const { rs, world, ops, offscreen } = setup()
    const img = fakeImage(8, 8)
    addSprite(world, 100, 50, { width: 8, height: 8, image: img, tint: '#ff0000', tintOpacity: 1 })
    addSprite(world, 100, 50, { width: 8, height: 8, color: '#ffffff', tint: '#00ff00', tintOpacity: 1, zIndex: 1 })
    rs.update(world, 1 / 60)
    rs.update(world, 1 / 60)
    // one tinted copy, built once: image multiplied by red, alpha restored
    expect(offscreen).toHaveLength(1)
    const names = offscreen[0].ops.map((o) => `${o.name}:${o.comp}`)
    expect(names).toContain('fillRect:multiply')
    expect(names).toContain('drawImage:destination-in')
    expect(draws(ops, 'drawImage')[0].args[0]).toBe(offscreen[0])
    expect(draws(ops, 'fillRect').find((o) => o.fill === 'rgb(0,255,0)')).toBeTruthy()
  })

  it('draws shape presets as paths with the stroke colour', () => {
    const { rs, world, ops } = setup()
    addSprite(world, 100, 50, {
      width: 20,
      height: 20,
      color: '#336699',
      shape: 'circle',
      strokeColor: '#ffffff',
      strokeWidth: 2,
    })
    rs.update(world, 1 / 60)
    expect(draws(ops, 'arc')).toHaveLength(1)
    expect(draws(ops, 'fill')[0].fill).toBe('rgb(51,102,153)')
    expect(draws(ops, 'stroke')).toHaveLength(1)
  })

  it('samples a registered dynamic canvas live and skips unknown ids', () => {
    const { rs, world, ops } = setup()
    const dyn = { width: 32, height: 32 } as unknown as HTMLCanvasElement
    rs.registerDynamicCanvas('map', dyn)
    addSprite(world, 100, 50, { width: 16, height: 16, dynamicSrc: 'map' })
    rs.update(world, 1 / 60)
    expect(draws(ops, 'drawImage')[0].args.slice(0, 5)).toEqual([dyn, 0, 0, 32, 32])
    rs.unregisterDynamicCanvas('map')
    ops.length = 0
    rs.update(world, 1 / 60)
    expect(draws(ops, 'drawImage')).toHaveLength(0)
  })
})

describe('Canvas2DRenderSystem: SpriteLayer', () => {
  function layerWorld(layerOpts: ConstructorParameters<typeof SpriteLayer>[0]) {
    const s = setup()
    const layer = new SpriteLayer(layerOpts)
    s.rs.addSpriteLayer(layer)
    return { ...s, layer }
  }

  it('draws atlas frames with rotation, flip flags and per-sprite alpha', () => {
    const img = fakeImage(32, 16)
    const { rs, world, ops, layer } = layerWorld({ image: img, frameWidth: 16, frameHeight: 16 })
    const a = layer.add(60, 40, 10, 12, 1)
    layer.add(140, 60, 10, 10, 0)
    layer.rotation[a] = Math.PI
    layer.flags[1] = SPRITE_FLIP_X
    layer.color[1] = 0xffffff80
    rs.update(world, 1 / 60)
    const d = draws(ops, 'drawImage')
    expect(d).toHaveLength(2)
    expect(d[0].args).toEqual([img, 16, 0, 16, 16, -5, -6, 10, 12])
    expect(d[0].tf[0]).toBeCloseTo(-1)
    expect(d[0].tf[4]).toBeCloseTo(60)
    expect(d[1].tf[0]).toBe(-1)
    expect(d[1].alpha).toBeCloseTo(128 / 255)
    expect(rs.stats.instances).toBe(2)
  })

  it('skips hidden and culled sprites, and draws untextured ones as solid rects', () => {
    const img = fakeImage(16, 16)
    const { rs, world, ops, layer } = layerWorld({ image: img })
    layer.add(50, 50, 8, 8)
    layer.add(60, 50, 8, 8)
    layer.add(70, 50, 8, 8)
    layer.add(9000, 50, 8, 8)
    layer.flags[0] = SPRITE_HIDDEN
    layer.flags[2] = SPRITE_UNTEXTURED
    layer.color[2] = 0x336699ff
    rs.update(world, 1 / 60)
    expect(draws(ops, 'drawImage')).toHaveLength(1)
    const solid = draws(ops, 'fillRect').filter((o) => o.fill === 'rgb(51,102,153)')
    expect(solid).toHaveLength(1)
    expect(solid[0].args).toEqual([66, 46, 8, 8])
  })

  it('draws in ascending sortKey order when sortByKey is set', () => {
    const { rs, world, ops, layer } = layerWorld({ sortByKey: true })
    for (const [x, key] of [
      [20, 3],
      [40, 1],
      [60, 2],
    ] as const) {
      const i = layer.add(x, 50, 4, 4)
      layer.sortKey[i] = key
    }
    rs.update(world, 1 / 60)
    expect(
      draws(ops, 'fillRect')
        .slice(1)
        .map((o) => o.args[0]),
    ).toEqual([38, 58, 18])
  })

  it('picks the atlas per sprite, tints textures by colour and waits for loading atlases', () => {
    const a0 = fakeImage(8, 8)
    const loading = {
      width: 8,
      height: 8,
      naturalWidth: 0,
      naturalHeight: 0,
      complete: false,
    } as unknown as HTMLImageElement
    const { rs, world, ops, layer, offscreen } = layerWorld({
      atlases: [{ image: a0 }, { image: loading }, { image: fakeImage(8, 8) }],
    })
    layer.add(40, 50, 8, 8)
    layer.add(60, 50, 8, 8)
    layer.add(80, 50, 8, 8)
    layer.atlas[1] = 1
    layer.atlas[2] = 2
    layer.color[2] = 0xff0000ff
    rs.update(world, 1 / 60)
    const d = draws(ops, 'drawImage')
    expect(d).toHaveLength(2) // atlas 1 is still loading
    expect(d[0].args[0]).toBe(a0)
    expect(offscreen).toHaveLength(1)
    expect(d[1].args[0]).toBe(offscreen[0])
  })

  it('draws sprites that point past the 8 atlas slots as solid rects', () => {
    const atlases = Array.from({ length: 9 }, () => ({ image: fakeImage(8, 8) }))
    const { rs, world, ops, layer } = layerWorld({ atlases })
    layer.add(100, 50, 6, 6)
    layer.atlas[0] = 8
    layer.color[0] = 0x336699ff
    rs.update(world, 1 / 60)
    expect(draws(ops, 'drawImage')).toHaveLength(0)
    expect(draws(ops, 'fillRect').some((o) => o.fill === 'rgb(51,102,153)')).toBe(true)
  })

  it('interleaves with regular sprites by layer order and zIndex', () => {
    const { rs, world, ops, layer } = layerWorld({ zIndex: 5 })
    layer.add(100, 50, 6, 6)
    layer.color[0] = 0x00ff00ff
    layer.flags[0] = SPRITE_UNTEXTURED
    addSprite(world, 100, 50, { width: 4, height: 4, color: '#ff0000', zIndex: 1 })
    addSprite(world, 100, 50, { width: 4, height: 4, color: '#0000ff', zIndex: 9 })
    rs.update(world, 1 / 60)
    expect(
      draws(ops, 'fillRect')
        .slice(1)
        .map((o) => o.fill),
    ).toEqual(['rgb(255,0,0)', 'rgb(0,255,0)', 'rgb(0,0,255)'])
  })

  it('stops drawing a removed layer and honours visible=false', () => {
    const { rs, world, ops, layer } = layerWorld({})
    layer.add(100, 50, 6, 6)
    layer.visible = false
    rs.update(world, 1 / 60)
    expect(draws(ops, 'fillRect')).toHaveLength(1) // just the background
    layer.visible = true
    rs.removeSpriteLayer(layer)
    ops.length = 0
    rs.update(world, 1 / 60)
    expect(draws(ops, 'fillRect')).toHaveLength(1)
  })
})

describe('Canvas2DRenderSystem: TileLayer', () => {
  it('draws visible chunks under sprites and applies layer opacity', () => {
    const { rs, world, ops } = setup()
    const tileImg = fakeImage(32, 16)
    const layer = new TileLayerData({
      width: 4,
      height: 4,
      tileset: { image: tileImg, tileWidth: 16, tileHeight: 16, columns: 2 },
      opacity: 0.5,
    })
    layer.fill(1)
    const e = world.createEntity()
    world.addComponent(e, createTileLayerComponent(layer))
    addSprite(world, 32, 32, { width: 4, height: 4, color: '#ff0000' })
    rs.update(world, 1 / 60)
    const chunk = draws(ops, 'drawImage').find((o) => o.args[0] !== tileImg && o.alpha === 0.5)
    expect(chunk).toBeTruthy()
    expect(ops.indexOf(chunk!)).toBeLessThan(ops.findIndex((o) => o.fill === 'rgb(255,0,0)'))
    expect(rs.tileLayerStats.drawCalls).toBe(1)
  })
})

describe('Canvas2DRenderSystem: parallax', () => {
  it('scrolls opposite to the camera and repeats across the canvas', () => {
    const { rs, world, ops, cam } = setup()
    const img = fakeImage(50, 20)
    const g = globalThis as unknown as { Image: unknown }
    const prev = g.Image
    g.Image = function () {
      return img
    }
    try {
      const e = world.createEntity()
      world.addComponent(
        e,
        createParallaxLayer({
          src: 'bg.png',
          speedX: 0.5,
          speedY: 0,
          repeatX: true,
          repeatY: false,
          zIndex: -1,
          offsetX: 0,
          offsetY: 0,
          imageWidth: 0,
          imageHeight: 0,
        }),
      )
      world.getComponent<{ x: number }>(cam, 'Camera2D')!.x = 120
      rs.update(world, 1 / 60)
    } finally {
      g.Image = prev
    }
    const d = draws(ops, 'drawImage')
    // draw x = 0 - 120 * 0.5 = -60, wrapped into [-50, 0): -10, then 40, 90, 140, 190
    expect(d.map((o) => o.args[1])).toEqual([-10, 40, 90, 140, 190])
    expect(d.every((o) => o.args[2] === 0)).toBe(true)
  })
})

describe('Canvas2DRenderSystem: screen tint', () => {
  function tintOps(mode: 'multiply' | 'normal' | 'additive', a = 0.5) {
    const { rs, world, ops } = setup()
    rs.setScreenTint(0.5, 0.5, 1, a, mode)
    rs.update(world, 1 / 60)
    return draws(ops, 'fillRect')[1]
  }

  it('multiplies the frame by mix(1, colour, strength)', () => {
    const t = tintOps('multiply')
    expect(t.comp).toBe('multiply')
    expect(t.alpha).toBe(1)
    expect(t.fill).toBe('rgb(191,191,255)')
    expect(t.args).toEqual([0, 0, 200, 100])
    expect(t.tf).toEqual([1, 0, 0, 1, 0, 0])
  })

  it('draws normal and additive tints with the strength as alpha', () => {
    const n = tintOps('normal')
    expect([n.comp, n.alpha, n.fill]).toEqual(['source-over', 0.5, 'rgb(128,128,255)'])
    const a = tintOps('additive')
    expect([a.comp, a.alpha]).toEqual(['lighter', 0.5])
  })

  it('draws nothing at zero strength, after clear, and sits between sprites and text', () => {
    const { rs, world, ops } = setup()
    addSprite(world, 100, 50, { width: 4, height: 4, color: '#ff0000' })
    const t = world.createEntity()
    world.addComponent(t, createTransform(100, 50))
    world.addComponent(t, createText({ text: 'hi' }))
    rs.setScreenTint(0, 0, 0, 0.5)
    rs.update(world, 1 / 60)
    const kinds = ops
      .filter((o) => o.name === 'fillRect' || o.name === 'fillText')
      .map((o) => (o.comp === 'multiply' ? 'tint' : o.name))
    expect(kinds).toEqual(['fillRect', 'fillRect', 'tint', 'fillText'])
    rs.clearScreenTint()
    ops.length = 0
    rs.update(world, 1 / 60)
    expect(ops.some((o) => o.comp === 'multiply')).toBe(false)
  })
})

describe('Canvas2DRenderSystem: text', () => {
  it('honours align, baseline, offsets, stroke, shadow and opacity', () => {
    const { rs, world, ops, state } = (() => {
      const s = setup()
      return { ...s, state: s.ctx as unknown as Record<string, unknown> }
    })()
    const e = world.createEntity()
    world.addComponent(e, createTransform(100, 50))
    world.addComponent(
      e,
      createText({
        text: 'score',
        fontSize: 20,
        fontFamily: 'serif',
        align: 'right',
        baseline: 'top',
        offsetX: 4,
        offsetY: -2,
        strokeColor: '#000',
        strokeWidth: 3,
        shadowColor: '#222',
        shadowOffsetX: 1,
        opacity: 0.5,
      }),
    )
    rs.update(world, 1 / 60)
    const fill = draws(ops, 'fillText')[0]
    expect(fill.args[0]).toBe('score')
    expect(fill.tf).toEqual([1, 0, -0, 1, 104, 48])
    expect(fill.alpha).toBe(0.5)
    expect(draws(ops, 'strokeText')).toHaveLength(1)
    expect(state.font).toBe('20px serif')
    expect(state.textAlign).toBe('right')
    expect(state.textBaseline).toBe('top')
  })

  it('wraps words at maxWidth using the line height', () => {
    const { rs, world, ops } = setup()
    const e = world.createEntity()
    world.addComponent(e, createTransform(100, 50))
    // the fake measureText is 8px per character
    world.addComponent(
      e,
      createText({ text: 'aaa bbb ccc', fontSize: 10, wordWrap: true, maxWidth: 60, lineHeight: 2 }),
    )
    rs.update(world, 1 / 60)
    const lines = draws(ops, 'fillText').map((o) => [o.args[0], o.args[2]])
    expect(lines).toEqual([
      ['aaa bbb', 0],
      ['ccc', 20],
    ])
  })

  it('applies fontWeight and fontStyle, and sorts text that sets a layer with sprites', () => {
    const { rs, world, ops, ctx } = setup()
    const sorted = world.createEntity()
    world.addComponent(sorted, createTransform(100, 50))
    world.addComponent(
      sorted,
      createText({ text: 'mid', layer: 'default', zIndex: 5, fontWeight: 'bold', fontStyle: 'italic' }),
    )
    const top = world.createEntity()
    world.addComponent(top, createTransform(100, 50))
    world.addComponent(top, createText({ text: 'top', zIndex: -9 }))
    addSprite(world, 100, 50, { width: 4, height: 4, color: '#ff0000', zIndex: 1 })
    addSprite(world, 100, 50, { width: 4, height: 4, color: '#0000ff', zIndex: 9 })
    rs.update(world, 1 / 60)
    const seq = ops
      .filter((o) => o.name === 'fillText' || (o.name === 'fillRect' && o.fill !== 'rgb(16,32,48)'))
      .map((o) => (o.name === 'fillText' ? String(o.args[0]) : String(o.fill)))
    // 'mid' joins the sprite sort by zIndex; 'top' has no layer and draws above everything
    expect(seq).toEqual(['rgb(255,0,0)', 'mid', 'rgb(0,0,255)', 'top'])
    expect(ctx.font).toBe('16px monospace') // last drawn: 'top'
    expect(draws(ops, 'fillText')[0].args[0]).toBe('mid')
  })

  it('splits wrapped text at newlines too', () => {
    const { rs, world, ops } = setup()
    const e = world.createEntity()
    world.addComponent(e, createTransform(100, 50))
    world.addComponent(e, createText({ text: 'one\ntwo three', fontSize: 10, wordWrap: true, maxWidth: 40 }))
    rs.update(world, 1 / 60)
    expect(draws(ops, 'fillText').map((o) => o.args[0])).toEqual(['one', 'two', 'three'])
  })

  it('skips invisible text and orders by zIndex', () => {
    const { rs, world, ops } = setup()
    for (const [txt, z, visible] of [
      ['top', 5, true],
      ['hidden', 3, false],
      ['under', 1, true],
    ] as const) {
      const e = world.createEntity()
      world.addComponent(e, createTransform(10, 10))
      world.addComponent(e, createText({ text: txt, zIndex: z, visible }))
    }
    rs.update(world, 1 / 60)
    expect(draws(ops, 'fillText').map((o) => o.args[0])).toEqual(['under', 'top'])
  })
})

describe('Canvas2DRenderSystem: particles and trails', () => {
  it('draws live particles as tinted sprites, circles or squares', () => {
    const { rs, world, ops, offscreen } = setup()
    const e = world.createEntity()
    world.addComponent(e, createTransform(100, 50))
    world.addComponent(e, {
      type: 'ParticlePool',
      particles: [{ x: 100, y: 50, vx: 0, vy: 0, life: 1, maxLife: 1, size: 10, color: '#ff8800', gravity: 0 }],
      active: false,
      maxParticles: 8,
      timer: 0,
      rate: 0,
      angle: 0,
      spread: 0,
      speed: 0,
      particleLife: 1,
      particleSize: 10,
      color: '#ff8800',
      gravity: 0,
      particleShape: 'circle',
    })
    rs.update(world, 0)
    expect(draws(ops, 'arc')).toHaveLength(1)
    expect(draws(ops, 'fill').at(-1)!.fill).toBe('rgb(255,136,0)')
    expect(offscreen).toHaveLength(0)
  })
})

describe('Canvas2DRenderSystem: housekeeping', () => {
  it('exposes the hooks the engine drives and tolerates debug overlays', () => {
    const { rs, world, ops } = setup()
    rs.setDebugNavGrid({ cols: 2, rows: 1, cellSize: 8, walkable: new Uint8Array([1, 0]) } as never)
    rs.flashContactPoint(10, 10)
    rs.markDynamicCanvasDirty('x')
    rs.update(world, 1 / 60)
    expect(draws(ops, 'fillRect').length).toBeGreaterThan(3)
    expect(rs.getStats()).toBe(rs.stats)
    expect(rs.getDefaultSampling()).toBe('nearest')
    expect(rs.stats.frames).toBe(1)
    rs.dispose()
  })
})

describe('Canvas2DRenderSystem: tile layer order', () => {
  function tileLayer(opts: Partial<ConstructorParameters<typeof TileLayerData>[0]>) {
    const image = fakeImage(16, 16)
    const layer = new TileLayerData({
      width: 2,
      height: 2,
      tileset: { image, tileWidth: 16, tileHeight: 16, columns: 1 },
      ...opts,
    })
    layer.fill(1)
    return layer
  }

  it('sorts layers with a renderLayer among sprites and keeps the rest beneath everything', () => {
    const { rs, world, ops } = setup()
    const under = tileLayer({ zIndex: 99, opacity: 0.25 })
    const mid = tileLayer({ renderLayer: 'default', zIndex: 5, opacity: 0.5 })
    for (const l of [mid, under]) world.addComponent(world.createEntity(), createTileLayerComponent(l))
    addSprite(world, 100, 50, { width: 4, height: 4, color: '#ff0000', zIndex: 1 })
    addSprite(world, 100, 50, { width: 4, height: 4, color: '#0000ff', zIndex: 9 })
    rs.update(world, 1 / 60)
    const order = ops
      .filter((o) => (o.name === 'drawImage' && o.alpha !== 1) || (o.name === 'fillRect' && o.fill !== 'rgb(16,32,48)'))
      .map((o) => (o.name === 'drawImage' ? `tile@${o.alpha}` : String(o.fill)))
    expect(order).toEqual(['tile@0.25', 'rgb(255,0,0)', 'tile@0.5', 'rgb(0,0,255)'])
  })

  it('draws a renderLayer tile layer before a sprite at the same layer and zIndex', () => {
    const { rs, world, ops } = setup()
    world.addComponent(
      world.createEntity(),
      createTileLayerComponent(tileLayer({ renderLayer: 'default', opacity: 0.5 })),
    )
    addSprite(world, 100, 50, { width: 4, height: 4, color: '#ff0000' })
    rs.update(world, 1 / 60)
    const tile = ops.findIndex((o) => o.name === 'drawImage' && o.alpha === 0.5)
    const sprite = ops.findIndex((o) => o.fill === 'rgb(255,0,0)')
    expect(tile).toBeGreaterThan(-1)
    expect(tile).toBeLessThan(sprite)
  })
})

describe('Canvas2DRenderSystem: TextLayer', () => {
  function textWorld(opts: ConstructorParameters<typeof TextLayer>[0] = {}) {
    const fake = createFakeGlyphCanvas()
    const atlas = new GlyphAtlas({ createCanvas: fake.createCanvas, pageSize: 256 })
    const layer = new TextLayer({ atlas, fontSize: 10, ...opts })
    const s = setup()
    s.rs.addTextLayer(layer)
    return { ...s, layer, atlas }
  }

  it('draws one glyph cell per visible character straight from the atlas page', () => {
    const { rs, world, ops, layer, atlas } = textWorld()
    layer.add('AB', 100, 50, { anchorX: 0, anchorY: 0 })
    rs.update(world, 1 / 60)
    const d = draws(ops, 'drawImage')
    expect(d).toHaveLength(2)
    const page = atlas.pages[0]
    expect(d[0].args[0]).toBe(page.canvas)
    expect(d[0].tf).toEqual([1, 0, -0, 1, 100, 50])
    expect(d[0].alpha).toBe(1)
    // source rect is the glyph's UV cell scaled back to page pixels
    const g = atlas.glyph(layer.atlasStyle(0), 65)
    expect(d[0].args[1]).toBeCloseTo(g.u0 * page.size)
    expect(d[0].args[3]).toBeCloseTo((g.u1 - g.u0) * page.size)
    expect(rs.stats.instances).toBe(2)
    expect(rs.stats.batches).toBe(1)
  })

  it('applies run colour, alpha and layer opacity, rotation and anchor', () => {
    const { rs, world, ops, layer, offscreen } = textWorld({ opacity: 0.5 })
    layer.add('A', 100, 50, { color: 0xff0000ff, alpha: 0.5, rotation: Math.PI / 2, anchorX: 0, anchorY: 0 })
    rs.update(world, 1 / 60)
    const d = draws(ops, 'drawImage')[0]
    expect(d.alpha).toBeCloseTo(0.25)
    expect(d.tf[0]).toBeCloseTo(0)
    expect(d.tf[1]).toBeCloseTo(1)
    // a red run multiplies the glyph through a tinted copy
    expect(offscreen).toHaveLength(1)
    expect(d.args[0]).toBe(offscreen[0])
    expect(offscreen[0].ops.some((o) => o.name === 'fillRect' && o.fill === 'rgb(255,0,0)')).toBe(true)
  })

  it('draws runs in ascending sortKey order when sortByKey is set', () => {
    const { rs, world, ops, layer } = textWorld({ sortByKey: true })
    for (const [x, key] of [
      [40, 3],
      [100, 1],
      [160, 2],
    ] as const) {
      const i = layer.add('A', x, 50, { anchorX: 0, anchorY: 0 })
      layer.sortKey[i] = key
    }
    rs.update(world, 1 / 60)
    expect(draws(ops, 'drawImage').map((o) => o.tf[4])).toEqual([100, 160, 40])
  })

  it('skips hidden runs, runs outside the view and invisible layers', () => {
    const { rs, world, ops, layer } = textWorld()
    layer.add('A', 100, 50)
    const h = layer.add('B', 100, 50)
    layer.add('C', 9000, 50)
    layer.flags[h] = TEXT_HIDDEN
    rs.update(world, 1 / 60)
    expect(draws(ops, 'drawImage')).toHaveLength(1)
    layer.visible = false
    ops.length = 0
    rs.update(world, 1 / 60)
    expect(draws(ops, 'drawImage')).toHaveLength(0)
  })

  it('sorts with sprites by layer and zIndex, and stops after removeTextLayer', () => {
    const { rs, world, ops, layer } = textWorld({ zIndex: 5 })
    layer.add('A', 100, 50)
    addSprite(world, 100, 50, { width: 4, height: 4, color: '#ff0000', zIndex: 1 })
    addSprite(world, 100, 50, { width: 4, height: 4, color: '#0000ff', zIndex: 9 })
    rs.update(world, 1 / 60)
    const seq = ops.filter((o) => o.name === 'drawImage' || (o.name === 'fillRect' && o.fill !== 'rgb(16,32,48)'))
    expect(seq.map((o) => (o.name === 'drawImage' ? 'text' : String(o.fill)))).toEqual([
      'rgb(255,0,0)',
      'text',
      'rgb(0,0,255)',
    ])
    rs.removeTextLayer(layer)
    ops.length = 0
    rs.update(world, 1 / 60)
    expect(draws(ops, 'drawImage')).toHaveLength(0)
  })
})

describe('Canvas2DRenderSystem: dynamic canvases and camera follow', () => {
  it('creates, resizes and disposes dynamic canvases by id', () => {
    const { rs, world, ops } = setup()
    const dyn = rs.createDynamicCanvas({
      id: 'atlas',
      width: 16,
      height: 16,
      canvas: { width: 16, height: 16, getContext: () => ({}) } as never,
    })
    expect(rs.hasDynamicCanvas('atlas')).toBe(true)
    expect(rs.dynamicCanvasIds()).toEqual(['atlas'])
    expect(() => rs.createDynamicCanvas({ id: 'atlas', width: 1, height: 1 })).toThrow(/already registered/)
    addSprite(world, 100, 50, { width: 16, height: 16, dynamicSrc: 'atlas' })
    rs.update(world, 1 / 60)
    expect(draws(ops, 'drawImage')[0].args.slice(0, 5)).toEqual([dyn.canvas, 0, 0, 16, 16])
    dyn.dispose()
    expect(rs.hasDynamicCanvas('atlas')).toBe(false)
    ops.length = 0
    rs.update(world, 1 / 60)
    expect(draws(ops, 'drawImage')).toHaveLength(0)
  })

  it('follows a point provider, and clamps and centres small camera bounds', () => {
    const { rs, world, ops, cam } = setup()
    const c = world.getComponent<Record<string, unknown>>(cam, 'Camera2D')!
    c.followPoint = () => ({ x: 400, y: 300 })
    c.smoothing = 0
    addSprite(world, 400, 300, { width: 10, height: 10, color: '#ff0000' })
    rs.update(world, 1 / 60)
    expect(draws(ops, 'fillRect')[1].tf).toEqual([1, 0, -0, 1, 100, 50])
    c.followPoint = undefined
    c.bounds = { x: 0, y: 0, width: 100, height: 50 } // smaller than the 200x100 view: centre on it
    rs.update(world, 1 / 60)
    expect([c.x, c.y]).toEqual([50, 25])
  })
})

describe('Canvas2DRenderSystem: post-process stack', () => {
  it('runs effects on the finished frame (usePostProcess works without WebGL)', () => {
    const { rs, world } = setup()
    addSprite(world, 20, 20, { width: 10, height: 10, color: '#ff0000' })
    const seen: Array<[number, number]> = []
    rs.postProcessStack.add((_ctx, w, h) => void seen.push([w, h]))
    rs.update(world, 1 / 60)
    expect(seen).toEqual([[200, 100]])
  })

  it('skips the stack when it is empty', () => {
    const { rs, world } = setup()
    expect(() => rs.update(world, 1 / 60)).not.toThrow()
    expect(rs.postProcessStack.size).toBe(0)
  })
})
