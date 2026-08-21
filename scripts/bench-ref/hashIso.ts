import { performance } from 'node:perf_hooks'
import { SpatialHash } from '../../packages/core/src/spatialHash.ts'
import { RefSpatialHash } from './refSpatialHash.ts'

const px = new Float64Array(1000)
const py = new Float64Array(1000)
for (let i = 0; i < 1000; i++) {
  px[i] = (i * 7919) % 800
  py[i] = (i * 6553) % 600
}

function bench(label: string, fn: () => void, iters: number): void {
  let best = Infinity
  for (let r = 0; r < 5; r++) {
    fn()
    const t0 = performance.now()
    for (let i = 0; i < iters; i++) fn()
    best = Math.min(best, (performance.now() - t0) / iters)
  }
  console.log(`${label}: ${best.toFixed(4)} ms/op`)
}

{
  const h1 = new RefSpatialHash(64)
  const h2 = new SpatialHash(64)
  const insOld = () => {
    for (let i = 0; i < 1000; i++) {
      const j = (i + 1) % 1000
      h1.insert(i % 500, px[j], py[j], 16, 16)
    }
  }
  const insNew = () => {
    for (let i = 0; i < 1000; i++) {
      const j = (i + 1) % 1000
      h2.insert(i % 500, px[j], py[j], 16, 16)
    }
  }
  bench('OLD insert', insOld, 50)
  bench('NEW insert', insNew, 50)
  bench('OLD insert again', insOld, 50)
  bench('NEW insert again', insNew, 50)
}
{
  const h1 = new RefSpatialHash(64)
  const h2 = new SpatialHash(64)
  for (let i = 0; i < 1000; i++) {
    h1.insert(i, px[i], py[i], 16, 16)
    h2.insert(i, px[i], py[i], 16, 16)
  }
  const qOld = () => h1.queryRect(400, 300, 200, 200)
  const qNew = () => h2.queryRect(400, 300, 200, 200)
  bench('OLD queryRect', qOld, 20000)
  bench('NEW queryRect', qNew, 20000)
  bench('OLD queryRect again', qOld, 20000)
  bench('NEW queryRect again', qNew, 20000)
  // sanity: same results?
  console.log('same results:', JSON.stringify(h1.queryRect(400, 300, 200, 200)) === JSON.stringify(h2.queryRect(400, 300, 200, 200)))
}
