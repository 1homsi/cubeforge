import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ECSWorld, createTransform } from '@cubeforge/core'
import { RenderSystem } from '../webglRenderSystem'
import { createCamera2D, type Camera2DComponent } from '../components/camera2d'
import { SpriteLayer, SPRITE_HIDDEN } from '../spriteLayer'
import { createRecordingCanvas, installHeadlessCanvasDOM } from '../testing/recordingGL'

let uninstall: () => void
beforeAll(() => {
  uninstall = installHeadlessCanvasDOM()
})
afterAll(() => uninstall())

function setup(camOpts: Partial<Camera2DComponent>) {
  const canvas = createRecordingCanvas(800, 600)
  const entityIds = new Map<string, number>()
  const rs = new RenderSystem(canvas, entityIds)
  const world = new ECSWorld()
  const camEntity = world.createEntity()
  const cam = createCamera2D(camOpts)
  world.addComponent(camEntity, cam)
  const step = (frames = 1) => {
    for (let i = 0; i < frames; i++) rs.update(world, 1 / 60)
  }
  return { rs, world, cam, entityIds, step }
}

function makeLayer() {
  const layer = new SpriteLayer()
  layer.add(10, 20, 8, 8, 0, 100)
  layer.add(300, 40, 8, 8, 0, 200)
  layer.add(-50, 70, 8, 8, 0, 300)
  return layer
}

describe('camera follow: point provider', () => {
  it('snaps to the provided point with no smoothing', () => {
    const p = { x: 120, y: -40 }
    const { cam, step } = setup({ followPoint: () => p })
    step()
    expect([cam.x, cam.y]).toEqual([120, -40])
    p.x = 200
    step()
    expect(cam.x).toBe(200)
  })

  it('applies the follow offset (look-ahead)', () => {
    const { cam, step } = setup({ followPoint: () => ({ x: 100, y: 50 }), followOffsetX: 30, followOffsetY: -10 })
    step()
    expect([cam.x, cam.y]).toEqual([130, 40])
  })

  it('smooths toward the point instead of snapping', () => {
    const { cam, step } = setup({ followPoint: () => ({ x: 100, y: 0 }), smoothing: 0.85 })
    step()
    expect(cam.x).toBeGreaterThan(0)
    expect(cam.x).toBeLessThan(100)
    const first = cam.x
    step(30)
    expect(cam.x).toBeGreaterThan(first)
    expect(cam.x).toBeLessThan(100)
    step(600)
    expect(cam.x).toBeCloseTo(100, 3)
  })

  it('honours the dead zone', () => {
    const p = { x: 20, y: 0 }
    const { cam, step } = setup({ followPoint: () => p, deadZone: { w: 100, h: 100 } })
    step()
    expect(cam.x).toBe(0)
    p.x = 80
    step()
    expect(cam.x).toBe(30)
  })

  it('clamps to bounds', () => {
    const { cam, step } = setup({
      followPoint: () => ({ x: 5000, y: 5000 }),
      bounds: { x: 0, y: 0, width: 1600, height: 1200 },
    })
    step()
    expect([cam.x, cam.y]).toEqual([1600 - 400, 1200 - 300])
  })

  it('holds its position when the provider returns null or undefined', () => {
    let target: { x: number; y: number } | null | undefined = { x: 60, y: 70 }
    const { cam, step } = setup({ followPoint: () => target })
    step()
    expect([cam.x, cam.y]).toEqual([60, 70])
    target = null
    step(3)
    expect([cam.x, cam.y]).toEqual([60, 70])
    target = undefined
    step()
    expect([cam.x, cam.y]).toEqual([60, 70])
    target = { x: 5, y: 6 }
    step()
    expect([cam.x, cam.y]).toEqual([5, 6])
  })

  it('holds on non-finite points', () => {
    let x = 10
    const { cam, step } = setup({ followPoint: () => ({ x, y: 0 }) })
    step()
    x = NaN
    step()
    expect(cam.x).toBe(10)
  })
})

describe('camera follow: sprite layer', () => {
  it('follows a sprite by index and tracks it as it moves', () => {
    const layer = makeLayer()
    const { cam, step } = setup({ followSprite: { layer, index: 1 } })
    step()
    expect([cam.x, cam.y]).toEqual([300, 40])
    layer.set(1, 350, 45)
    step()
    expect([cam.x, cam.y]).toEqual([350, 45])
  })

  it('follows a sprite by id (first match) and survives swap-remove', () => {
    const layer = makeLayer()
    const { cam, step } = setup({ followSprite: { layer, id: 300 } })
    step()
    expect([cam.x, cam.y]).toEqual([-50, 70])
    // swap-remove slot 0: the last sprite (id 300) moves to slot 0
    layer.removeAt(0)
    layer.set(0, -60, 71)
    step()
    expect([cam.x, cam.y]).toEqual([-60, 71])
  })

  it('uses the first sprite when several share an id', () => {
    const layer = makeLayer()
    layer.add(999, 999, 8, 8, 0, 200)
    const { cam, step } = setup({ followSprite: { layer, id: 200 } })
    step()
    expect([cam.x, cam.y]).toEqual([300, 40])
  })

  it('smooths and applies offset, dead zone and bounds like the entity follow', () => {
    const layer = makeLayer()
    const smooth = setup({ followSprite: { layer, index: 1 }, smoothing: 0.85, followOffsetX: 10 })
    smooth.step()
    expect(smooth.cam.x).toBeGreaterThan(0)
    expect(smooth.cam.x).toBeLessThan(310)
    smooth.step(600)
    expect(smooth.cam.x).toBeCloseTo(310, 3)

    const dz = setup({ followSprite: { layer, index: 0 }, deadZone: { w: 10, h: 10 } })
    dz.step()
    expect(dz.cam.x).toBe(10 - 5)

    const bounded = setup({
      followSprite: { layer, index: 1 },
      bounds: { x: 0, y: 0, width: 2000, height: 1200 },
    })
    bounded.step()
    // target (300, 40) is closer to the edge than half the view: clamped to (400, 300)
    expect([bounded.cam.x, bounded.cam.y]).toEqual([400, 300])
  })

  it('holds when the sprite is hidden, removed, or the id is unknown', () => {
    const layer = makeLayer()
    const { cam, step } = setup({ followSprite: { layer, index: 2 } })
    step()
    expect(cam.x).toBe(-50)
    layer.flags[2] |= SPRITE_HIDDEN
    layer.set(2, 500, 500)
    step()
    expect([cam.x, cam.y]).toEqual([-50, 70])
    layer.flags[2] &= ~SPRITE_HIDDEN
    step()
    expect([cam.x, cam.y]).toEqual([500, 500])
    layer.removeAt(2)
    layer.set(1, 0, 0)
    step()
    expect([cam.x, cam.y]).toEqual([500, 500])

    const byId = setup({ followSprite: { layer, id: 12345 } })
    byId.cam.x = 7
    byId.step()
    expect(byId.cam.x).toBe(7)
  })

  it('holds for an out-of-range index', () => {
    const layer = makeLayer()
    const { cam, step } = setup({ followSprite: { layer, index: 99 }, x: 3, y: 4 })
    step()
    expect([cam.x, cam.y]).toEqual([3, 4])
  })
})

describe('camera follow: priority', () => {
  it('followPoint > followSprite > followEntity', () => {
    const layer = makeLayer()
    const { cam, world, entityIds, step } = setup({
      followPoint: () => ({ x: 1, y: 1 }),
      followSprite: { layer, index: 1 },
      followEntityId: 'hero',
    })
    const hero = world.createEntity()
    world.addComponent(hero, createTransform(900, 900))
    entityIds.set('hero', hero)
    step()
    expect([cam.x, cam.y]).toEqual([1, 1])
    cam.followPoint = undefined
    step()
    expect([cam.x, cam.y]).toEqual([300, 40])
    cam.followSprite = undefined
    step()
    expect([cam.x, cam.y]).toEqual([900, 900])
  })

  it('a provider that returns null holds instead of falling back to lower priorities', () => {
    const { cam, world, entityIds, step } = setup({ followPoint: () => null, followEntityId: 'hero', x: 2, y: 3 })
    const hero = world.createEntity()
    world.addComponent(hero, createTransform(900, 900))
    entityIds.set('hero', hero)
    step()
    expect([cam.x, cam.y]).toEqual([2, 3])
  })

  it('entity follow is unchanged when no point or sprite is set', () => {
    const { cam, world, entityIds, step } = setup({ followEntityId: 'hero', followOffsetX: 5 })
    const hero = world.createEntity()
    world.addComponent(hero, createTransform(40, 50))
    entityIds.set('hero', hero)
    step()
    expect([cam.x, cam.y]).toEqual([45, 50])
  })
})
