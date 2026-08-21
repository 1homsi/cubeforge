import { performance } from 'node:perf_hooks'
import { ECSWorld, type Component } from '../../packages/core/src/ecs/world.ts'
import { RefWorld } from './refWorld.ts'

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

const which = process.argv[2]
const w: any = which === 'old' ? new RefWorld() : new ECSWorld()
for (let i = 0; i < 2000; i++) {
  const e = w.createEntity()
  w.addComponent(e, { type: 'Pos', x: i, y: i } as Pos)
  if (i % 2 === 0) w.addComponent(e, { type: 'Vel', vx: 1, vy: 1 } as Vel)
}

let best = Infinity
for (let r = 0; r < 7; r++) {
  w.query('Pos')
  const t0 = performance.now()
  for (let i = 0; i < 1000000; i++) w.query('Pos')
  best = Math.min(best, (performance.now() - t0) / 1000000)
}
console.log(`${which}: ${best.toFixed(6)} ms/op`)
