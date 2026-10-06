/**
 * Stress scenarios shared by the headless (Node) runner and the browser page.
 * Each scenario builds an ECS world on a RenderSystem and exposes `step()`,
 * which advances the simulation and renders one frame through the same system
 * order as <Game>: sim (external data / scripts) -> physics -> render.
 */
import { ECSWorld, EventBus, createEngineStats, createTransform } from '@cubeforge/core'
import type { EngineStats, EntityId, TransformComponent } from '@cubeforge/core'
import {
  RenderSystem,
  SpriteLayer,
  TextLayer,
  TileLayerData,
  createSprite,
  createText,
  createCamera2D,
  createTileLayerComponent,
} from '@cubeforge/renderer'
import { PhysicsSystem } from '@cubeforge/physics'

export interface ScenarioContext {
  canvas: HTMLCanvasElement
  /** Image used as the sprite atlas (a real loaded image in the browser, a stub headless). */
  atlas: HTMLImageElement
  /** Creates a canvas for the dynamic-canvas scenario. */
  createCanvas(w: number, h: number): HTMLCanvasElement
  now(): number
}

export interface Scenario {
  name: string
  description: string
  world: ECSWorld
  renderer: RenderSystem
  stats: EngineStats
  /** Phase timings of the last step, ms. */
  simMs: number
  step(): void
}

export interface ScenarioDef {
  name: string
  description: string
  setup(ctx: ScenarioContext): Scenario
}

const W = 1280
const H = 720
const DT = 1 / 60
const ATLAS = 256
const FRAME = 16

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function base(
  ctx: ScenarioContext,
  name: string,
  description: string,
  cam: { x: number; y: number; zoom?: number },
  sim: (world: ECSWorld) => void,
): Scenario {
  const world = new ECSWorld()
  const events = new EventBus()
  const physics = new PhysicsSystem(980, events)
  const renderer = new RenderSystem(ctx.canvas, new Map())
  const stats = createEngineStats(renderer.stats)
  const camId = world.createEntity()
  world.addComponent(camId, createCamera2D({ x: cam.x, y: cam.y, zoom: cam.zoom ?? 1, background: '#000000' }))

  const sc: Scenario = {
    name,
    description,
    world,
    renderer,
    stats,
    simMs: 0,
    step() {
      const t0 = ctx.now()
      sim(world)
      const t1 = ctx.now()
      physics.update(world, DT)
      const t2 = ctx.now()
      renderer.update(world, DT)
      const t3 = ctx.now()
      sc.simMs = t1 - t0
      stats.scriptMs = t1 - t0
      stats.physicsMs = t2 - t1
      stats.renderMs = t3 - t2
      stats.updateMs = t3 - t0
      stats.systemsMs = t2 - t0
      stats.entityCount = world.entityCount
      stats.frame++
    },
  }
  return sc
}

function addAtlasSprite(
  world: ECSWorld,
  ctx: ScenarioContext,
  x: number,
  y: number,
  frame: number,
  zIndex = 0,
): { id: EntityId; t: TransformComponent } {
  const id = world.createEntity()
  const t = createTransform(x, y)
  world.addComponent(id, t)
  world.addComponent(
    id,
    createSprite({
      width: FRAME,
      height: FRAME,
      image: ctx.atlas,
      src: ctx.atlas.src,
      frameWidth: FRAME,
      frameHeight: FRAME,
      frameColumns: ATLAS / FRAME,
      frameIndex: frame,
      zIndex,
    }),
  )
  return { id, t }
}

/** N moving atlas sprites whose positions come from an external struct-of-arrays sim. */
function movingSprites(n: number): ScenarioDef {
  return {
    name: `sprites-${n}`,
    description: `${n} atlas sprites moved every frame from external SoA data`,
    setup(ctx) {
      const r = rng(1)
      const xs = new Float32Array(n)
      const ys = new Float32Array(n)
      const vx = new Float32Array(n)
      const vy = new Float32Array(n)
      const transforms: TransformComponent[] = []
      const sc = base(ctx, this.name, this.description, { x: W / 2, y: H / 2 }, () => {
        for (let i = 0; i < n; i++) {
          let x = xs[i] + vx[i]
          let y = ys[i] + vy[i]
          if (x < 0 || x > W) vx[i] = -vx[i]
          if (y < 0 || y > H) vy[i] = -vy[i]
          x = xs[i] = x
          y = ys[i] = y
          const t = transforms[i]
          t.x = x
          t.y = y
        }
      })
      for (let i = 0; i < n; i++) {
        xs[i] = r() * W
        ys[i] = r() * H
        vx[i] = (r() - 0.5) * 4
        vy[i] = (r() - 0.5) * 4
        transforms.push(addAtlasSprite(sc.world, ctx, xs[i], ys[i], (r() * 256) | 0, (r() * 4) | 0).t)
      }
      return sc
    },
  }
}

/** Keeps `live` entities alive, destroying and re-creating `perFrame` of them every frame. */
function churn(live: number, perFrame: number): ScenarioDef {
  return {
    name: `churn-${live}x${perFrame}`,
    description: `${live} live sprites, ${perFrame} destroyed + ${perFrame} created per frame (${perFrame * 60}/s each way)`,
    setup(ctx) {
      const r = rng(2)
      const ids: EntityId[] = []
      let cursor = 0
      const sc = base(ctx, this.name, this.description, { x: W / 2, y: H / 2 }, (world) => {
        for (let k = 0; k < perFrame; k++) {
          world.destroyEntity(ids[cursor])
          ids[cursor] = addAtlasSprite(world, ctx, r() * W, r() * H, (r() * 256) | 0).id
          cursor = (cursor + 1) % live
        }
      })
      for (let i = 0; i < live; i++) ids.push(addAtlasSprite(sc.world, ctx, r() * W, r() * H, (r() * 256) | 0).id)
      return sc
    },
  }
}

/**
 * A cols x rows tile world built the only way the engine allows today: one
 * Transform+Sprite entity per tile. The camera pans so culling has work to do.
 */
function tileWorld(cols: number, rows: number): ScenarioDef {
  return {
    name: `tiles-${cols}x${rows}`,
    description: `${cols * rows} static tile entities (one per tile), panning camera, ${FRAME}px tiles`,
    setup(ctx) {
      const r = rng(3)
      let f = 0
      const sc = base(ctx, this.name, this.description, { x: W / 2, y: H / 2 }, (world) => {
        const cam = world.getComponent<{ type: 'Camera2D'; x: number; y: number }>(
          world.queryOne('Camera2D')!,
          'Camera2D',
        )!
        f++
        cam.x = W / 2 + ((f * 4) % (cols * FRAME - W))
        cam.y = H / 2 + ((f * 2) % (rows * FRAME - H))
      })
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          addAtlasSprite(sc.world, ctx, x * FRAME + FRAME / 2, y * FRAME + FRAME / 2, (r() * 256) | 0, -10)
        }
      }
      return sc
    },
  }
}

/** One large canvas (e.g. a pre-rendered map) drawn as a sprite, redrawn and marked dirty every frame. */
function dynamicCanvas(w: number, h: number): ScenarioDef {
  return {
    name: `dyncanvas-${w}x${h}`,
    description: `one ${w}x${h} dynamic canvas, a few pixels changed and marked dirty every frame`,
    setup(ctx) {
      const canvas = ctx.createCanvas(w, h)
      const g = canvas.getContext('2d')!
      let f = 0
      let renderer: RenderSystem | null = null
      const sc = base(ctx, this.name, this.description, { x: w / 2, y: h / 2, zoom: Math.min(W / w, H / h) }, () => {
        f++
        g.fillStyle = f & 1 ? '#3a7' : '#a73'
        g.fillRect((f * 16) % w, ((f * 16) / w) * 16, 16, 16)
        renderer!.markDynamicCanvasDirty('map')
      })
      renderer = sc.renderer
      renderer.registerDynamicCanvas('map', canvas)
      const id = sc.world.createEntity()
      sc.world.addComponent(id, createTransform(w / 2, h / 2))
      sc.world.addComponent(id, createSprite({ width: w, height: h, dynamicSrc: 'map' }))
      return sc
    },
  }
}

/** Same motion as sprites-N, but through a SpriteLayer (typed arrays, no entities). */
function spriteLayer(n: number): ScenarioDef {
  return {
    name: `spritelayer-${n}`,
    description: `${n} atlas sprites in one SpriteLayer, moved every frame`,
    setup(ctx) {
      const r = rng(1)
      const layer = new SpriteLayer({
        image: ctx.atlas,
        frameWidth: FRAME,
        frameHeight: FRAME,
        frameColumns: ATLAS / FRAME,
        capacity: n,
      })
      const vx = new Float32Array(n)
      const vy = new Float32Array(n)
      const sc = base(ctx, this.name, this.description, { x: W / 2, y: H / 2 }, () => {
        const X = layer.x
        const Y = layer.y
        for (let i = 0; i < n; i++) {
          const x = X[i] + vx[i]
          const y = Y[i] + vy[i]
          if (x < 0 || x > W) vx[i] = -vx[i]
          if (y < 0 || y > H) vy[i] = -vy[i]
          X[i] = x
          Y[i] = y
        }
        layer.touch()
      })
      for (let i = 0; i < n; i++) {
        layer.add(r() * W, r() * H, FRAME, FRAME, (r() * 256) | 0)
        vx[i] = (r() - 0.5) * 4
        vy[i] = (r() - 0.5) * 4
      }
      sc.renderer.addSpriteLayer(layer)
      return sc
    },
  }
}

/** Human Box shape: two atlases in one layer, depth-sorted by y every frame. */
function depthLayer(n: number): ScenarioDef {
  return {
    name: `spritelayer-depth-${n}`,
    description: `${n} sprites from 2 atlases in one SpriteLayer, y-sorted every frame`,
    setup(ctx) {
      const r = rng(1)
      const atlas = { image: ctx.atlas, frameWidth: FRAME, frameHeight: FRAME, frameColumns: ATLAS / FRAME }
      const layer = new SpriteLayer({ atlases: [atlas, { ...atlas }], sortByKey: true, capacity: n })
      const vx = new Float32Array(n)
      const vy = new Float32Array(n)
      const sc = base(ctx, this.name, this.description, { x: W / 2, y: H / 2 }, () => {
        const X = layer.x
        const Y = layer.y
        const K = layer.sortKey
        for (let i = 0; i < n; i++) {
          const x = X[i] + vx[i]
          const y = Y[i] + vy[i]
          if (x < 0 || x > W) vx[i] = -vx[i]
          if (y < 0 || y > H) vy[i] = -vy[i]
          X[i] = x
          Y[i] = y
          K[i] = y
        }
        layer.touch()
      })
      for (let i = 0; i < n; i++) {
        const k = layer.add(r() * W, r() * H, FRAME, FRAME, (r() * 256) | 0)
        layer.atlas[k] = i & 1
        layer.sortKey[k] = layer.y[k]
        vx[i] = (r() - 0.5) * 4
        vy[i] = (r() - 0.5) * 4
      }
      sc.renderer.addSpriteLayer(layer)
      return sc
    },
  }
}

/** Frame table + 12 atlases (two bind groups): atlas picked by y band so groups stay contiguous in depth order. */
function atlasLayer(n: number): ScenarioDef {
  return {
    name: `spritelayer-atlases-${n}`,
    description: `${n} sprites, 12 atlases (2 bind groups) with frame tables, y-sorted every frame`,
    setup(ctx) {
      const r = rng(1)
      const frames = Array.from({ length: 16 }, (_, i) => ({
        x: (i % 4) * 64,
        y: Math.floor(i / 4) * 64,
        w: 60,
        h: 60,
      }))
      const atlas = { image: ctx.atlas, frames, inset: 0.5 }
      const layer = new SpriteLayer({
        atlases: Array.from({ length: 12 }, () => ({ ...atlas })),
        sortByKey: true,
        capacity: n,
      })
      const vx = new Float32Array(n)
      const vy = new Float32Array(n)
      const sc = base(ctx, this.name, this.description, { x: W / 2, y: H / 2 }, () => {
        const X = layer.x
        const Y = layer.y
        const K = layer.sortKey
        for (let i = 0; i < n; i++) {
          const x = X[i] + vx[i]
          const y = Y[i] + vy[i]
          if (x < 0 || x > W) vx[i] = -vx[i]
          if (y < 0 || y > H) vy[i] = -vy[i]
          X[i] = x
          Y[i] = y
          K[i] = y
        }
        layer.touch()
      })
      for (let i = 0; i < n; i++) {
        const k = layer.add(r() * W, r() * H, FRAME, FRAME, (r() * 16) | 0)
        layer.atlas[k] = Math.min(11, Math.floor((layer.y[k] / H) * 12))
        layer.sortKey[k] = layer.y[k]
        vx[i] = (r() - 0.5) * 0.2 // slow drift keeps atlas bands stable
        vy[i] = 0
      }
      sc.renderer.addSpriteLayer(layer)
      return sc
    },
  }
}

/** Human Box shape: a floating name above every person, a few renamed each frame. */
function textLayer(n: number): ScenarioDef {
  return {
    name: `textlayer-${n}`,
    description: `${n} labels in one TextLayer (glyph atlas), moved every frame, 25 renamed per frame`,
    setup(ctx) {
      const r = rng(5)
      const layer = new TextLayer({ fontSize: 12, outlineColor: '#000000', outlineWidth: 3 })
      const vx = new Float32Array(n)
      const vy = new Float32Array(n)
      let f = 0
      const sc = base(ctx, this.name, this.description, { x: W / 2, y: H / 2 }, () => {
        const X = layer.x
        const Y = layer.y
        f++
        for (let i = 0; i < n; i++) {
          const x = X[i] + vx[i]
          const y = Y[i] + vy[i]
          if (x < 0 || x > W) vx[i] = -vx[i]
          if (y < 0 || y > H) vy[i] = -vy[i]
          X[i] = x
          Y[i] = y
        }
        for (let k = 0; k < 25; k++) layer.setText((f * 25 + k) % n, `Person ${(f * 7 + k) % 100}`)
        layer.touch()
      })
      for (let i = 0; i < n; i++) {
        layer.add(`Person ${i % 100}`, r() * W, r() * H)
        vx[i] = (r() - 0.5) * 2
        vy[i] = (r() - 0.5) * 2
      }
      sc.renderer.addTextLayer(layer)
      return sc
    },
  }
}

/** 1,000 <Text> entities with an outline: the old one-texture-and-draw-per-entity cost. */
function textEntities(n: number): ScenarioDef {
  return {
    name: `text-entities-${n}`,
    description: `${n} Text entities (outlined, moving), batched through the glyph atlas`,
    setup(ctx) {
      const r = rng(7)
      const ts: TransformComponent[] = []
      const vx = new Float32Array(n)
      const vy = new Float32Array(n)
      const sc = base(ctx, this.name, this.description, { x: W / 2, y: H / 2 }, () => {
        for (let i = 0; i < n; i++) {
          const t = ts[i]
          t.x += vx[i]
          t.y += vy[i]
          if (t.x < 0 || t.x > W) vx[i] = -vx[i]
          if (t.y < 0 || t.y > H) vy[i] = -vy[i]
        }
      })
      for (let i = 0; i < n; i++) {
        const id = sc.world.createEntity()
        const t = createTransform(r() * W, r() * H)
        ts.push(t)
        sc.world.addComponent(id, t)
        sc.world.addComponent(
          id,
          createText({ text: `Person ${i % 100}`, fontSize: 12, strokeColor: '#000000', strokeWidth: 3 }),
        )
        vx[i] = (r() - 0.5) * 2
        vy[i] = (r() - 0.5) * 2
      }
      return sc
    },
  }
}

/** The same tile world as one TileLayer, with 10 tile edits per frame. */
function tileLayer(cols: number, rows: number): ScenarioDef {
  return {
    name: `tilelayer-${cols}x${rows}`,
    description: `${cols * rows} tiles in one TileLayer, 10 setTile per frame, panning camera`,
    setup(ctx) {
      const r = rng(3)
      const tiles = new Uint16Array(cols * rows)
      for (let i = 0; i < tiles.length; i++) tiles[i] = 1 + ((r() * 256) | 0)
      const layer = new TileLayerData({
        width: cols,
        height: rows,
        tiles,
        tileset: { image: ctx.atlas, tileWidth: FRAME, tileHeight: FRAME, columns: ATLAS / FRAME },
      })
      let f = 0
      const sc = base(ctx, this.name, this.description, { x: W / 2, y: H / 2 }, (world) => {
        const cam = world.getComponent<{ type: 'Camera2D'; x: number; y: number }>(
          world.queryOne('Camera2D')!,
          'Camera2D',
        )!
        f++
        cam.x = W / 2 + ((f * 4) % (cols * FRAME - W))
        cam.y = H / 2 + ((f * 2) % (rows * FRAME - H))
        for (let k = 0; k < 10; k++) layer.setTile((r() * cols) | 0, (r() * rows) | 0, 1 + ((r() * 256) | 0))
      })
      const id = sc.world.createEntity()
      sc.world.addComponent(id, createTileLayerComponent(layer))
      return sc
    },
  }
}

/** dyncanvas-WxH with the changed 16x16 region passed to markDirty. */
function dynamicCanvasRect(w: number, h: number): ScenarioDef {
  return {
    name: `dyncanvas-rect-${w}x${h}`,
    description: `one ${w}x${h} dynamic canvas, 16x16 changed and marked dirty by rect every frame`,
    setup(ctx) {
      const canvas = ctx.createCanvas(w, h)
      const g = canvas.getContext('2d')!
      let f = 0
      let renderer: RenderSystem | null = null
      const sc = base(ctx, this.name, this.description, { x: w / 2, y: h / 2, zoom: Math.min(W / w, H / h) }, () => {
        f++
        const x = (f * 16) % w
        const y = (((f * 16) / w) | 0) * 16
        g.fillStyle = f & 1 ? '#3a7' : '#a73'
        g.fillRect(x, y, 16, 16)
        renderer!.markDynamicCanvasDirty('map', x, y, 16, 16)
      })
      renderer = sc.renderer
      renderer.registerDynamicCanvas('map', canvas)
      const id = sc.world.createEntity()
      sc.world.addComponent(id, createTransform(w / 2, h / 2))
      sc.world.addComponent(id, createSprite({ width: w, height: h, dynamicSrc: 'map' }))
      return sc
    },
  }
}

export const SCENARIOS: ScenarioDef[] = [
  movingSprites(3000),
  movingSprites(10000),
  spriteLayer(3000),
  spriteLayer(10000),
  depthLayer(3000),
  atlasLayer(3000),
  textLayer(1000),
  textEntities(1000),
  churn(3000, 200),
  tileWorld(600, 300),
  tileLayer(600, 300),
  dynamicCanvas(4800, 2400),
  dynamicCanvasRect(4800, 2400),
]

export const VIEWPORT = { width: W, height: H, atlasSize: ATLAS }
