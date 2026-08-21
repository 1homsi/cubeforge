import { performance } from 'node:perf_hooks'
import { ECSWorld, type Component } from '../../packages/core/src/ecs/world.ts'
import { RefWorld } from './refWorld.ts'

interface Pos extends Component {
  type: 'Pos'
  x: number
  y: number
}

function populate(w: any): void {
  for (let i = 0; i < 2000; i++) {
    const e = w.createEntity()
    w.addComponent(e, { type: 'Pos', x: i, y: i } as Pos)
    if (i % 2 === 0) w.addComponent(e, { type: 'Vel', vx: 1, vy: 1 } as Vel)
  }
}
interface Vel extends Component {
  type: 'Vel'
  vx: number
  vy: number
}

const oldW = new RefWorld()
const newW = new ECSWorld()
populate(oldW)
populate(newW)

function bench(label: string, fn: () => void, iters: number): number {
  let best = Infinity
  for (let r = 0; r < 5; r++) {
    fn()
    const t0 = performance.now()
    for (let i = 0; i < iters; i++) fn()
    best = Math.min(best, (performance.now() - t0) / iters)
  }
  console.log(`${label}: ${best.toFixed(6)} ms/op`)
  return best
}

// Interleaved rounds to cancel JIT-order effects
for (let round = 0; round < 3; round++) {
  const o = bench(`r${round} OLD query('Pos') hit`, () => oldW.query('Pos'), 300000)
  const n = bench(`r${round} NEW query('Pos') hit`, () => newW.query('Pos'), 300000)
  console.log(`   → ratio ${(o / n).toFixed(2)}x`)
}
