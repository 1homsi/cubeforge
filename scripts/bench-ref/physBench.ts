import { performance } from 'node:perf_hooks'
import { ECSWorld, type Component } from '../../packages/core/src/ecs/world.ts'
import { PhysicsSystem } from '../../packages/physics/src/physicsSystem.ts'

interface Transform extends Component {
  type: 'Transform'
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}
interface Box extends Component {
  type: 'BoxCollider'
  width: number
  height: number
  offsetX: number
  offsetY: number
  enabled: boolean
  layer: string
  mask: string | string[]
  group: string
  isTrigger: boolean
  isStatic?: boolean
}
interface RB extends Component {
  type: 'RigidBody'
  vx: number
  vy: number
}

const N = 800
function buildWorld(): { world: ECSWorld; phys: PhysicsSystem } {
  const world = new ECSWorld()
  const phys = new PhysicsSystem(-1200)
  world.addSystem(phys)
  // grid of boxes, half static floors, half falling dynamics
  for (let i = 0; i < N; i++) {
    const e = world.createEntity()
    const dynamic = i % 2 === 1
    world.addComponent(e, {
      type: 'Transform',
      x: ((i * 37) % 640) - 320,
      y: Math.floor(i / 20) * 40 - 200 + (dynamic ? i % 7 : 0),
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    } as Transform)
    world.addComponent(e, {
      type: 'BoxCollider',
      width: 30,
      height: 30,
      offsetX: 0,
      offsetY: 0,
      enabled: true,
      layer: 'default',
      mask: '*',
      group: '',
      isTrigger: false,
      isStatic: !dynamic,
    } as Box)
    if (dynamic) world.addComponent(e, { type: 'RigidBody', vx: 10, vy: -5 } as RB)
  }
  return { world, phys }
}

const frames = 240
// warmup
{
  const { world, phys } = buildWorld()
  for (let f = 0; f < 30; f++) phys.update(world, 1 / 60)
}
let best = Infinity
for (let r = 0; r < 3; r++) {
  const { world, phys } = buildWorld()
  const t0 = performance.now()
  for (let f = 0; f < frames; f++) phys.update(world, 1 / 60)
  best = Math.min(best, performance.now() - t0)
}
console.log(`physics step (${N} bodies, ${frames} frames): ${(best / frames).toFixed(3)} ms/frame`)
