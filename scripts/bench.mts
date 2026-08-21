/**
 * Cubeforge performance benchmark — old (reference) vs new implementation,
 * measured in the same process, best-of-3 runs each.
 *
 * Run: npx tsx scripts/bench.mts
 */
import { performance } from 'node:perf_hooks'
import { ECSWorld, type Component } from '../packages/core/src/ecs/world.ts'
import { SpatialHash } from '../packages/core/src/spatialHash.ts'
import { RefWorld } from './bench-ref/refWorld.ts'
import { RefSpatialHash } from './bench-ref/refSpatialHash.ts'

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

/** Best-of-N timing in ms/op. */
function measure(fn: () => void, iters: number, runs = 3): number {
  let best = Infinity
  for (let r = 0; r < runs; r++) {
    fn() // warmup
    const t0 = performance.now()
    for (let i = 0; i < iters; i++) fn()
    best = Math.min(best, (performance.now() - t0) / iters)
  }
  return best
}

const rows: Array<{ name: string; oldMs: number; newMs: number }> = []

function compare(name: string, oldFn: () => void, newFn: () => void, iters: number, runs = 3): void {
  const oldMs = measure(oldFn, iters, runs)
  const newMs = measure(newFn, iters, runs)
  rows.push({ name, oldMs, newMs })
}

const N = 2000

// ── Structural churn on a persistent world (realistic bullet/particle pattern) ──
{
  const oldW = new RefWorld()
  const newW = new ECSWorld()
  // Warm both worlds: pre-create the archetypes so edge caches exist.
  for (const w of [oldW, newW]) {
    const ids: number[] = []
    for (let i = 0; i < 500; i++) {
      const e = w.createEntity()
      w.addComponent(e, { type: 'Pos', x: i, y: i } as Pos)
      w.addComponent(e, { type: 'Vel', vx: 1, vy: 1 } as Vel)
      ids.push(e)
    }
    for (const e of ids) w.destroyEntity(e)
  }
  function churn(w: RefWorld | ECSWorld): void {
    const ids: number[] = []
    for (let i = 0; i < 500; i++) {
      const e = w.createEntity()
      w.addComponent(e, { type: 'Pos', x: i, y: i } as Pos)
      w.addComponent(e, { type: 'Vel', vx: 1, vy: 1 } as Vel)
      ids.push(e)
    }
    for (const e of ids) w.destroyEntity(e)
    w.query('Pos')
  }
  compare('spawn churn (warm world): 500x create+2comps+destroy', () => churn(oldW), () => churn(newW), 200)
}

function makePopulated(kind: 'old' | 'new'): RefWorld | ECSWorld {
  const w: RefWorld | ECSWorld = kind === 'old' ? new RefWorld() : new ECSWorld()
  for (let i = 0; i < N; i++) {
    const e = w.createEntity()
    w.addComponent(e, { type: 'Pos', x: i, y: i } as Pos)
    if (i % 2 === 0) w.addComponent(e, { type: 'Vel', vx: 1, vy: 1 } as Vel)
  }
  return w
}

// ── Query patterns ──
{
  const oldW = makePopulated('old')
  const newW = makePopulated('new')
  compare('query cache hit ("Pos")', () => oldW.query('Pos'), () => newW.query('Pos'), 200000)
  compare(
    'query rebuild after mutation',
    () => {
      const e = oldW.createEntity()
      oldW.query('Pos', 'Vel')
      oldW.destroyEntity(e)
      oldW.query('Pos', 'Vel')
    },
    () => {
      const e = newW.createEntity()
      newW.query('Pos', 'Vel')
      newW.destroyEntity(e)
      newW.query('Pos', 'Vel')
    },
    20000,
  )
  compare(
    'movement tick (2000 ents)',
    () => {
      let acc = 0
      for (const id of oldW.query('Pos', 'Vel')) {
        const p = oldW.getComponent<Pos>(id, 'Pos')!
        p.x += 0.016
        acc += p.x
      }
      if (!isFinite(acc)) throw new Error('unreachable')
    },
    () => {
      let acc = 0
      for (const id of newW.query('Pos', 'Vel')) {
        const p = newW.getComponent<Pos>(id, 'Pos')!
        p.x += 0.016
        acc += p.x
      }
      if (!isFinite(acc)) throw new Error('unreachable')
    },
    3000,
  )
  compare('getSnapshot()', () => oldW.getSnapshot(), () => newW.getSnapshot(), 30)
}

// ── Spatial hash ──
{
  const px = new Float64Array(1000)
  const py = new Float64Array(1000)
  for (let i = 0; i < 1000; i++) {
    px[i] = (i * 7919) % 800
    py[i] = (i * 6553) % 600
  }
  const oldH = new RefSpatialHash(64)
  const newH = new SpatialHash(64)
  compare(
    'SpatialHash 1000 inserts (moving)',
    () => {
      for (let i = 0; i < 1000; i++) {
        const j = (i + 1) % 1000
        oldH.insert(i % 500, px[j], py[j], 16, 16)
      }
    },
    () => {
      for (let i = 0; i < 1000; i++) {
        const j = (i + 1) % 1000
        newH.insert(i % 500, px[j], py[j], 16, 16)
      }
    },
    50,
  )
  // populate then measure queries
  for (let i = 0; i < 1000; i++) {
    oldH.insert(i, px[i], py[i], 16, 16)
    newH.insert(i, px[i], py[i], 16, 16)
  }
  compare('SpatialHash queryRect 200x200', () => oldH.queryRect(400, 300, 200, 200), () => newH.queryRect(400, 300, 200, 200), 20000)
}

// ── Report ──
console.log('\n=== RESULTS (best of 3, ms/op) ===\n')
let geoOld = 0
let geoNew = 0
for (const { name, oldMs, newMs } of rows) {
  const speedup = oldMs / newMs
  console.log(`${name.padEnd(42)} ${oldMs.toFixed(4).padStart(9)} → ${newMs.toFixed(4).padStart(9)}   ${speedup.toFixed(1)}x`)
  geoOld += Math.log(oldMs)
  geoNew += Math.log(newMs)
}
const geo = Math.exp((geoOld - geoNew) / rows.length)
console.log(`\nGeometric mean speedup across ${rows.length} scenarios: ${geo.toFixed(1)}x`)
