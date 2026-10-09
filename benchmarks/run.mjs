#!/usr/bin/env node
/**
 * Xip stress benchmark.
 *
 *   node benchmarks/run.mjs                    # all scenarios, headless, table output
 *   node benchmarks/run.mjs --scenario sprites-3000 --frames 600
 *   node benchmarks/run.mjs --profile          # + CPU / allocation profile summary per scenario
 *   node benchmarks/run.mjs --ci               # fewer frames, enforce benchmarks/budgets.json
 *   node benchmarks/run.mjs --json out.json    # write raw results
 *   node benchmarks/run.mjs --browser          # serve the same scenarios on a real GPU at http://localhost:5199
 *   node benchmarks/run.mjs --micro            # ECS / spatial-hash micro-benchmarks (scripts/bench.mts)
 *
 * Headless runs use the recording WebGL2 context: everything the engine does
 * on the CPU is real (ECS, sorting, batching, instance writes); GPU work is not.
 */
import { build, context } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const out = join(here, '.out')
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(`--${n}`)
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d)

const alias = {
  '@xip/core': join(root, 'packages/core/src/index.ts'),
  '@xip/renderer': join(root, 'packages/renderer/src/index.ts'),
  '@xip/physics': join(root, 'packages/physics/src/index.ts'),
  '@xip/input': join(root, 'packages/input/src/index.ts'),
}

if (flag('browser')) {
  const ctx = await context({
    entryPoints: [join(here, 'stress/browser.ts')],
    bundle: true,
    format: 'esm',
    outdir: join(out, 'web'),
    alias,
    sourcemap: true,
    minify: !flag('no-minify'),
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  mkdirSync(join(out, 'web'), { recursive: true })
  writeFileSync(join(out, 'web/index.html'), readFileSync(join(here, 'stress/index.html')))
  const { port } = await ctx.serve({ servedir: join(out, 'web'), port: Number(opt('port', '5199')) })
  console.log(`stress page: http://localhost:${port}/?scenario=sprites-3000`)
  await new Promise(() => {})
}

mkdirSync(out, { recursive: true })

if (flag('micro')) {
  const micro = join(out, 'micro.mjs')
  await build({
    entryPoints: [join(root, 'scripts/bench.mts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: micro,
    alias,
    logLevel: 'warning',
  })
  const r = spawnSync(process.execPath, ['--expose-gc', micro], { stdio: 'inherit' })
  process.exit(r.status ?? 1)
}

const bundle = join(out, 'headless.mjs')
await build({
  entryPoints: [join(here, 'stress/headless.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: bundle,
  alias,
  sourcemap: 'linked',
  logLevel: 'warning',
})

const ci = flag('ci')
const profile = flag('profile')
const frames = opt('frames', ci ? '120' : '300')
const warmup = opt('warmup', ci ? '30' : '60')
const budgets = ci ? JSON.parse(readFileSync(join(here, 'budgets.json'), 'utf8')) : null
const list = opt('scenario', null)?.split(',') ?? (await listScenarios())

async function listScenarios() {
  const r = spawnSync(process.execPath, [bundle, '--scenario', '__list__'], { encoding: 'utf8' })
  const m = /have: (.*)/.exec(r.stderr)
  if (!m) throw new Error(`could not list scenarios:\n${r.stderr}`)
  return m[1].trim().split(', ')
}

const profDir = join(out, 'prof')
if (profile) {
  rmSync(profDir, { recursive: true, force: true })
  mkdirSync(profDir, { recursive: true })
}

const results = []
const failures = []
for (const name of list) {
  const nodeArgs = ['--expose-gc', '--max-semi-space-size=128']
  const extra = profile ? ['--profile-out', profDir] : []
  const r = spawnSync(
    process.execPath,
    [...nodeArgs, bundle, '--scenario', name, '--frames', frames, '--warmup', warmup, ...extra],
    {
      encoding: 'utf8',
      maxBuffer: 64 << 20,
    },
  )
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout)
    failures.push(`${name}: process exited with ${r.status}`)
    continue
  }
  const res = JSON.parse(r.stdout.trim().split('\n').pop())
  results.push(res)
  if (budgets) checkBudget(res, budgets[name])
}

function checkBudget(res, b) {
  if (!b) return failures.push(`${res.scenario}: no budget in benchmarks/budgets.json`)
  const val = {
    medianMs: res.ms.median,
    allocBytesPerFrame: res.alloc.bytesPerFrame,
    drawCalls: res.render.drawCalls,
    batches: res.render.batches,
    textureUploadBytesPerFrame: res.render.textureUploadBytesPerFrame,
  }
  for (const [k, max] of Object.entries(b)) {
    if (k.startsWith('_')) continue
    if (!(k in val)) failures.push(`${res.scenario}: unknown budget key ${k}`)
    else if (val[k] > max) failures.push(`${res.scenario}: ${k} = ${val[k]} exceeds budget ${max}`)
  }
}

const kb = (b) => (b >= 1 << 20 ? `${(b / (1 << 20)).toFixed(1)}M` : b >= 1024 ? `${(b / 1024).toFixed(1)}K` : `${b}`)
const rows = results.map((r) => ({
  scenario: r.scenario,
  entities: r.entities,
  'median ms': r.ms.median,
  'p95 ms': r.ms.p95,
  'sim ms': r.ms.simMedian,
  'phys ms': r.ms.physicsMedian,
  'render ms': r.ms.renderMedian,
  'alloc/frame': kb(r.alloc.bytesPerFrame),
  gcs: r.alloc.gcCount,
  draws: r.render.drawCalls,
  instances: r.render.instances,
  culled: r.render.spritesCulled,
  'upload/frame': kb(r.render.textureUploadBytesPerFrame),
  'tex mem': kb(r.render.textureBytes),
}))
console.log(`\nheadless, ${frames} frames after ${warmup} warmup, node ${process.version}`)
console.table(rows)

if (profile) for (const name of list) summarizeProfiles(name)

const jsonOut = opt('json', null)
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 2))

if (failures.length) {
  console.error(`\nbenchmark budget failures:\n  ${failures.join('\n  ')}`)
  process.exit(1)
} else if (ci) console.log('\nall scenarios within budget')

// ── Profile summaries ────────────────────────────────────────────────────────

function where(cf) {
  const file = cf.url ? basename(cf.url) : ''
  return `${cf.functionName || '(anonymous)'} ${file}${file ? `:${cf.lineNumber + 1}` : ''}`
}

function summarizeProfiles(name) {
  const files = readdirSync(profDir)
  const cpuFile = files.find((f) => f.startsWith(name) && f.endsWith('.cpuprofile'))
  if (cpuFile) {
    const p = JSON.parse(readFileSync(join(profDir, cpuFile), 'utf8'))
    const dt = new Map()
    for (let i = 0; i < p.samples.length; i++)
      dt.set(p.samples[i], (dt.get(p.samples[i]) ?? 0) + (p.timeDeltas[i] ?? 0))
    const self = new Map()
    let tot = 0
    for (const n of p.nodes) {
      const us = dt.get(n.id) ?? 0
      if (!us) continue
      const k = where(n.callFrame)
      self.set(k, (self.get(k) ?? 0) + us)
      tot += us
    }
    const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 15)
    console.log(`\n── ${name}: CPU self time over measured frames ──`)
    for (const [k, us] of top) console.log(`  ${((100 * us) / tot).toFixed(1).padStart(5)}%  ${k}`)
  }
  const heapFile = files.find((f) => f.startsWith(name) && f.endsWith('.heapprofile'))
  if (heapFile) {
    const p = JSON.parse(readFileSync(join(profDir, heapFile), 'utf8'))
    const self = new Map()
    const walk = (n) => {
      const bytes = n.selfSize ?? 0
      if (bytes) self.set(where(n.callFrame), (self.get(where(n.callFrame)) ?? 0) + bytes)
      for (const c of n.children ?? []) walk(c)
    }
    walk(p.head)
    const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 8)
    console.log(`── ${name}: sampled allocations over measured frames (top sites) ──`)
    for (const [k, b] of top) console.log(`  ${kb(b).padStart(7)}  ${k}`)
  }
}
