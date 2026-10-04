// Headless CPU benchmark of the WebGL render path against a no-op GL.
// Run: npx tsx benchmarks/render.bench.mts [sprites]
import { performance } from 'node:perf_hooks'
import { ECSWorld } from '../packages/core/src/ecs/world.ts'
import { ScriptSystem } from '../packages/core/src/systems/scriptSystem.ts'
import { PhysicsSystem } from '../packages/physics/src/physicsSystem.ts'
import { EventBus } from '../packages/core/src/events/eventBus.ts'
import { SpriteLayer } from '../packages/renderer/src/spriteLayer.ts'
import { RenderSystem as WebGLRenderSystem } from '../packages/renderer/src/webglRenderSystem.ts'

function fakeGL(): WebGL2RenderingContext {
  const consts = new Proxy({}, { get: (_t, p) => (typeof p === 'string' ? p.length : 0) })
  const obj = {} as Record<string, unknown>
  return new Proxy(obj, {
    get(t, p: string) {
      if (p in t) return t[p]
      if (/^[A-Z_0-9]+$/.test(p)) return (consts as Record<string, number>)[p]
      if (p === 'isContextLost') return () => false
      if (p.startsWith('get') && p !== 'getError') return () => ({})
      if (p.startsWith('create')) return () => ({})
      if (p === 'checkFramebufferStatus') return () => 0
      if (p === 'getError') return () => 0
      return () => true
    },
  }) as unknown as WebGL2RenderingContext
}

class FakeImage {
  src = ''
  complete = true
  naturalWidth = 64
  naturalHeight = 64
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
}
;(globalThis as Record<string, unknown>).Image = FakeImage
const ctx2d: unknown = new Proxy({} as Record<string, unknown>, {
  get(t, p: string) {
    if (p in t) return t[p]
    if (p === 'measureText') return () => ({ width: 10 })
    return () => ({ addColorStop: () => {} })
  },
  set: (t, p: string, v) => ((t[p] = v), true),
})
;(globalThis as Record<string, unknown>).document = {
  createElement: () => ({ getContext: () => ctx2d, width: 0, height: 0 }),
}

const N = Number(process.argv[2] ?? 3000)
const FRAMES = Number(process.argv[3] ?? 300)
const gl = fakeGL()
const canvas = {
  width: 1280,
  height: 720,
  clientWidth: 1280,
  clientHeight: 720,
  getContext: () => gl,
} as unknown as HTMLCanvasElement
const rs = new WebGLRenderSystem(canvas, new Map())
const world = new ECSWorld()
const FULL = process.argv.includes('--full')
if (FULL) {
  world.addSystem(new ScriptSystem(null))
  world.addSystem(new PhysicsSystem(980, new EventBus()))
  world.addSystem(rs)
}
const step = () => (FULL ? world.update(1 / 60) : rs.update(world, 1 / 60))

const cam = world.createEntity()
world.addComponent(cam, {
  type: 'Camera2D',
  x: 640,
  y: 360,
  zoom: 1,
  smoothing: 0,
  background: '#000',
  shakeTimer: 0,
  shakeDuration: 0,
  shakeIntensity: 0,
} as never)

const LAYER = process.argv.includes('--layer')
const layer = new SpriteLayer({ src: 'atlas0.png', frameWidth: 16, frameHeight: 16, capacity: N })
if (LAYER) {
  rs.addSpriteLayer(layer)
  for (let i = 0; i < N; i++) layer.add((i * 37) % 1280, (i * 53) % 720, 16, 16, i % 4)
}
const imgs = Array.from({ length: 8 }, (_, i) => Object.assign(new FakeImage(), { src: `atlas${i}.png` }))
const ids: number[] = []
for (let i = 0; i < (LAYER ? 0 : N); i++) {
  const e = world.createEntity()
  world.addComponent(e, {
    type: 'Transform',
    x: (i * 37) % 1280,
    y: (i * 53) % 720,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  } as never)
  world.addComponent(e, {
    type: 'Sprite',
    width: 16,
    height: 16,
    color: i % 3 ? '#fff' : '#f80',
    image: i % 5 ? imgs[i % 8] : undefined,
    src: i % 5 ? imgs[i % 8].src : undefined,
    offsetX: 0,
    offsetY: 0,
    zIndex: i % 4,
    visible: true,
    flipX: false,
    anchorX: 0.5,
    anchorY: 0.5,
    frameIndex: i % 4,
    frameWidth: 16,
    frameHeight: 16,
    layer: 'default',
  } as never)
  ids.push(e)
}

let t = 0
for (let f = 0; f < 30; f++) step()
let renderMs = 0
const t0 = performance.now()
for (let f = 0; f < FRAMES; f++) {
  if (LAYER) {
    const X = layer.x,
      Y = layer.y
    for (let k = 0; k < N; k++) {
      X[k] += Math.sin(t + k) * 0.5
      Y[k] += Math.cos(t + k) * 0.5
    }
    layer.touch()
  }
  for (let k = 0; k < ids.length; k++) {
    const tr = world.getComponent<{ x: number; y: number }>(ids[k], 'Transform')!
    tr.x += Math.sin(t + k) * 0.5
    tr.y += Math.cos(t + k) * 0.5
  }
  t += 0.016
  const r0 = performance.now()
  step()
  renderMs += performance.now() - r0
}
const ms = (performance.now() - t0) / FRAMES
console.log(
  `sprites=${N} frames=${FRAMES} total ${ms.toFixed(3)} ms/frame, render ${(renderMs / FRAMES).toFixed(3)} ms/frame`,
)
