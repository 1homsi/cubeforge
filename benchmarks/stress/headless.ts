/**
 * Headless scenario runner (Node, no GPU). Bundled and spawned by
 * benchmarks/run.mjs, one process per scenario; prints one JSON result line.
 */
import v8 from 'node:v8'
import { Session } from 'node:inspector/promises'
import { writeFileSync } from 'node:fs'
import { PerformanceObserver, performance } from 'node:perf_hooks'
import { createRecordingCanvas, installHeadlessCanvasDOM } from '@xip/renderer'
import { SCENARIOS, VIEWPORT, type ScenarioContext } from './scenarios'

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : def
}

const name = arg('scenario', SCENARIOS[0].name)
const frames = Number(arg('frames', '300'))
const warmup = Number(arg('warmup', '60'))
const def = SCENARIOS.find((s) => s.name === name)
if (!def) {
  console.error(`unknown scenario ${name}; have: ${SCENARIOS.map((s) => s.name).join(', ')}`)
  process.exit(2)
}

installHeadlessCanvasDOM()
const atlas = {
  src: 'bench://atlas.png',
  complete: true,
  naturalWidth: VIEWPORT.atlasSize,
  naturalHeight: VIEWPORT.atlasSize,
  width: VIEWPORT.atlasSize,
  height: VIEWPORT.atlasSize,
} as unknown as HTMLImageElement
const ctx: ScenarioContext = {
  canvas: createRecordingCanvas(VIEWPORT.width, VIEWPORT.height),
  atlas,
  createCanvas: (w, h) => createRecordingCanvas(w, h),
  now: () => performance.now(),
}

const gc = (globalThis as { gc?: () => void }).gc
if (!gc) throw new Error('run with --expose-gc (benchmarks/run.mjs does this)')
const heapUsed = (): number => v8.getHeapStatistics().used_heap_size

/**
 * Bytes allocated per frame, measured as heap growth over short windows that
 * start from a forced GC. Windows are kept small so the young generation
 * (sized up by run.mjs) does not fill and scavenge mid-window.
 */
function measureAlloc(step: () => void, n: number, window = 5): number {
  let bytes = 0
  let done = 0
  while (done < n) {
    const k = Math.min(window, n - done)
    gc!()
    const h0 = heapUsed()
    for (let i = 0; i < k; i++) step()
    bytes += heapUsed() - h0
    done += k
  }
  return Math.max(0, Math.round(bytes / n))
}

const tSetup = performance.now()
const sc = def.setup(ctx)
const setupMs = performance.now() - tSetup

for (let i = 0; i < warmup; i++) sc.step()

const total = new Float64Array(frames)
const sim = new Float64Array(frames)
const phys = new Float64Array(frames)
const render = new Float64Array(frames)

// Profiles cover only the measured frames (not setup/warmup) and are taken in a
// separate pass so profiler overhead does not skew the numbers below.
const profileOut = arg('profile-out', '')
if (profileOut) {
  const session = new Session()
  session.connect()
  await session.post('Profiler.enable')
  await session.post('Profiler.setSamplingInterval', { interval: 100 })
  await session.post('HeapProfiler.enable')
  await session.post('HeapProfiler.startSampling', {
    samplingInterval: 1024,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  })
  await session.post('Profiler.start')
  for (let i = 0; i < frames; i++) sc.step()
  const { profile } = await session.post('Profiler.stop')
  const { profile: heap } = await session.post('HeapProfiler.stopSampling')
  writeFileSync(`${profileOut}/${sc.name}.cpuprofile`, JSON.stringify(profile))
  writeFileSync(`${profileOut}/${sc.name}.heapprofile`, JSON.stringify(heap))
  session.disconnect()
}

gc?.()
await new Promise((r) => setTimeout(r, 20))
let gcCount = 0
let gcMs = 0
const obs = new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    gcCount++
    gcMs += e.duration
  }
})
obs.observe({ entryTypes: ['gc'] })
for (let i = 0; i < frames; i++) {
  sc.step()
  const s = sc.stats
  total[i] = s.updateMs
  sim[i] = s.scriptMs
  phys[i] = s.physicsMs
  render[i] = s.renderMs
}

await new Promise((r) => setTimeout(r, 20))
obs.disconnect()
const allocBytesPerFrame = measureAlloc(() => sc.step(), Math.min(frames, 60))

function pct(arr: Float64Array, p: number): number {
  const sorted = Float64Array.from(arr).sort()
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
}
const r2 = (x: number): number => Math.round(x * 1000) / 1000
const rs = sc.stats.render
console.log(
  JSON.stringify({
    scenario: sc.name,
    description: sc.description,
    frames,
    setupMs: r2(setupMs),
    entities: sc.stats.entityCount,
    ms: {
      median: r2(pct(total, 0.5)),
      p95: r2(pct(total, 0.95)),
      simMedian: r2(pct(sim, 0.5)),
      physicsMedian: r2(pct(phys, 0.5)),
      renderMedian: r2(pct(render, 0.5)),
    },
    alloc: { bytesPerFrame: allocBytesPerFrame, gcCount, gcMs: r2(gcMs) },
    render: {
      drawCalls: rs.drawCalls,
      batches: rs.batches,
      instances: rs.instances,
      spritesConsidered: rs.spritesConsidered,
      spritesCulled: rs.spritesCulled,
      textureUploadsPerFrame: rs.textureUploads,
      textureUploadBytesPerFrame: rs.textureUploadBytes,
      textureCount: rs.textureCount,
      textureBytes: rs.textureBytes,
    },
  }),
)
