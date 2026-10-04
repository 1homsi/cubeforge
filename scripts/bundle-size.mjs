// Measures what a consumer pays for importing a list of symbols from the
// built cubeforge package (integrations/cubeforge/dist).
//
//   node scripts/bundle-size.mjs [--entry cubeforge/render] [--symbols A,B]
//        [--check <gzipBytes>] [--forbid sub1,sub2] [--json] [--top N]
import { build } from 'esbuild'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const pkgDir = path.join(repoRoot, 'integrations/cubeforge')

export const HUMAN_BOX_SYMBOLS = [
  'Game',
  'World',
  'Entity',
  'Camera2D',
  'Transform',
  'Sprite',
  'useEntity',
  'useGame',
  'useDynamicCanvas',
  'useCamera',
  'useGestures',
]

function parseArgs(argv) {
  const opts = { entry: 'cubeforge', symbols: HUMAN_BOX_SYMBOLS, check: null, forbid: [], json: false, top: 0 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--entry') opts.entry = next()
    else if (a === '--symbols') opts.symbols = next().split(',').filter(Boolean)
    else if (a === '--check') opts.check = Number(next())
    else if (a === '--forbid') opts.forbid = next().split(',').filter(Boolean)
    else if (a === '--json') opts.json = true
    else if (a === '--top') opts.top = Number(next())
    else throw new Error(`Unknown argument: ${a}`)
  }
  return opts
}

export async function measure(entry, symbols) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cubeforge-size-'))
  try {
    mkdirSync(path.join(dir, 'node_modules'))
    symlinkSync(pkgDir, path.join(dir, 'node_modules/cubeforge'), 'dir')
    const src = path.join(dir, 'entry.js')
    writeFileSync(src, `export { ${symbols.join(', ')} } from '${entry}'\n`)
    // Code splitting like an app bundler: dynamic import() targets (e.g. devtools)
    // become lazy chunks and are not counted as the initial load.
    const result = await build({
      entryPoints: [src],
      absWorkingDir: dir,
      bundle: true,
      splitting: true,
      outdir: path.join(dir, 'out'),
      minify: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      write: false,
      metafile: true,
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      logLevel: 'error',
    })
    const outputs = result.metafile.outputs
    const entryOut = Object.keys(outputs).find((k) => outputs[k].entryPoint)
    const initial = new Set([entryOut])
    for (const queue = [entryOut]; queue.length > 0; ) {
      for (const imp of outputs[queue.pop()].imports) {
        if (imp.kind === 'import-statement' && !imp.external && !initial.has(imp.path)) {
          initial.add(imp.path)
          queue.push(imp.path)
        }
      }
    }
    const byPath = new Map(result.outputFiles.map((f) => [path.basename(f.path), f.contents]))
    const parts = [...initial].map((k) => byPath.get(path.basename(k)) ?? new Uint8Array())
    const code = Buffer.concat(parts.map((p) => Buffer.from(p)))
    const inputs = [...initial]
      .flatMap((k) => Object.entries(outputs[k].inputs))
      .map(([file, info]) => ({ file: file.replace(/^.*?integrations\/cubeforge\//, ''), bytes: info.bytesInOutput }))
      .filter((i) => i.bytes > 0)
      .sort((a, b) => b.bytes - a.bytes)
    return { entry, symbols, minified: code.length, gzip: gzipSync(code, { level: 9 }).length, inputs }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2))
  const r = await measure(opts.entry, opts.symbols)
  const kb = (n) => `${(n / 1024).toFixed(1)} kB`
  if (opts.json) console.log(JSON.stringify(r, null, 2))
  else {
    console.log(
      `${r.entry} {${r.symbols.length} symbols}: ${kb(r.minified)} min (${r.minified} B), ${kb(r.gzip)} gzip (${r.gzip} B)`,
    )
    console.log(`modules in output: ${r.inputs.length}`)
    for (const i of r.inputs.slice(0, opts.top)) console.log(`  ${String(i.bytes).padStart(8)}  ${i.file}`)
  }

  let failed = false
  const hits = r.inputs.filter((i) => opts.forbid.some((f) => i.file.includes(f)))
  if (hits.length) {
    failed = true
    console.error(`Forbidden modules in output:\n${hits.map((h) => `  ${h.file}`).join('\n')}`)
  }
  if (opts.check != null && r.gzip > opts.check) {
    failed = true
    console.error(`Gzip size ${r.gzip} B exceeds budget ${opts.check} B`)
  }
  if (failed) process.exit(1)
}
