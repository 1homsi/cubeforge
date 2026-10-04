// Headless physics benchmark: N dynamic boxes and circles piling onto a floor.
// Run: npx esbuild benchmarks/physics.bench.mts --bundle --platform=node --format=esm --outfile=/tmp/p.mjs && node /tmp/p.mjs [N] [frames]
import { performance } from 'node:perf_hooks'
import { ECSWorld, createTransform } from '../packages/core/src/index.ts'
import { PhysicsSystem } from '../packages/physics/src/physicsSystem.ts'
import { createRigidBody } from '../packages/physics/src/components/rigidbody.ts'
import { createBoxCollider } from '../packages/physics/src/components/boxCollider.ts'
import { createCircleCollider } from '../packages/physics/src/components/circleCollider.ts'

const N = Number(process.argv[2] ?? 1000)
const FRAMES = Number(process.argv[3] ?? 600)

function build() {
  const world = new ECSWorld()
  const phys = new PhysicsSystem(980)
  world.addSystem(phys)
  const floor = world.createEntity()
  world.addComponent(floor, createTransform(0, 400))
  world.addComponent(floor, createRigidBody({ isStatic: true }))
  world.addComponent(floor, createBoxCollider(4000, 40))
  for (let w = -1; w <= 1; w += 2) {
    const wall = world.createEntity()
    world.addComponent(wall, createTransform(w * 600, 0))
    world.addComponent(wall, createRigidBody({ isStatic: true }))
    world.addComponent(wall, createBoxCollider(40, 1600))
  }
  for (let i = 0; i < N; i++) {
    const e = world.createEntity()
    world.addComponent(e, createTransform(((i * 37) % 1100) - 550, -((i / 30) | 0) * 22))
    world.addComponent(e, createRigidBody())
    if (i % 3 === 0) world.addComponent(e, createCircleCollider(9))
    else world.addComponent(e, createBoxCollider(18, 18))
  }
  return { world, phys }
}

const { world } = build()
const times: number[] = []
for (let f = 0; f < FRAMES; f++) {
  const t0 = performance.now()
  world.update(1 / 60)
  times.push(performance.now() - t0)
}
const settled = times.slice(FRAMES / 2).sort((a, b) => a - b)
const all = times.reduce((a, b) => a + b, 0) / FRAMES
console.log(
  `bodies=${N} frames=${FRAMES} mean ${all.toFixed(3)} ms, settled median ${settled[settled.length >> 1].toFixed(3)} ms`,
)
