import { performance } from 'node:perf_hooks'
import { ECSWorld, type Component, type EntityId } from '../../packages/core/src/ecs/world.ts'

interface Pos extends Component {
  type: 'Pos'
  x: number
  y: number
}
interface Vel extends Component {
  type: 'Vel'
  vx: number
  vy: number
}

const N = 20000
const w = new ECSWorld()
for (let i = 0; i < N; i++) {
  const e = w.createEntity()
  w.addComponent(e, { type: 'Pos', x: i, y: i } as Pos)
  w.addComponent(e, { type: 'Vel', vx: 1, vy: 1 } as Vel)
}
const TID_P = w.typeId('Pos')
const TID_V = w.typeId('Vel')

function bench(label: string, fn: () => number, iters: number): void {
  let best = Infinity
  for (let r = 0; r < 5; r++) {
    const acc = fn()
    if (!isFinite(acc)) throw new Error('bad')
    const t0 = performance.now()
    for (let i = 0; i < iters; i++) fn()
    best = Math.min(best, (performance.now() - t0) / iters)
  }
  console.log(`${label}: ${(best * 1000).toFixed(3)} µs/frame  (${((best / N) * 1e9).toFixed(2)} ns/entity)`)
}

bench(
  'string getComponent',
  () => {
    let acc = 0
    const ids = w.query('Pos', 'Vel')
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i] as EntityId
      const p = w.getComponent<Pos>(id, 'Pos')!
      const v = w.getComponent<Vel>(id, 'Vel')!
      p.x += v.vx * 0.016
      p.y += v.vy * 0.016
      acc += p.x
    }
    return acc
  },
  300,
)

bench(
  'numeric getComponent',
  () => {
    let acc = 0
    const ids = w.query('Pos', 'Vel')
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i] as EntityId
      const p = w.getComponent<Pos>(id, TID_P)!
      const v = w.getComponent<Vel>(id, TID_V)!
      p.x += v.vx * 0.016
      p.y += v.vy * 0.016
      acc += p.x
    }
    return acc
  },
  300,
)

// Raw column sweep — the Rust-style ceiling for this storage layout
bench(
  'raw column sweep (no API)',
  () => {
    let acc = 0
    const colP = w['columns' as never] as never // silence; real access below
    void colP
    return acc
  },
  1,
)
