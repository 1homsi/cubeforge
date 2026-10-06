// One ESM file per source module so consumer bundlers can drop unused modules.
// Workspace @cubeforge/* sources land in dist/_pkg/<name>/ with imports
// rewritten to relative paths. Types come from tsup (tsup.config.ts).
import { build } from 'esbuild'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(pkgDir, '../..')
const outDir = path.join(pkgDir, 'dist')
const tsconfig = path.join(pkgDir, 'tsconfig.json')

const entries = ['index', 'advanced', 'render', 'test']
const external = ['react', 'react-dom', 'react/jsx-runtime']

const roots = [
  [path.join(pkgDir, 'src'), ''],
  ...['audio', 'core', 'input', 'net', 'physics', 'renderer'].map((p) => [
    path.join(repoRoot, 'packages', p, 'src'),
    `_pkg/${p}/`,
  ]),
  ...['context', 'devtools', 'editor', 'gameplay'].map((p) => [
    path.join(repoRoot, 'integrations', p, 'src'),
    `_pkg/${p}/`,
  ]),
]

function outPathFor(file) {
  for (const [root, prefix] of roots) {
    const rel = path.relative(root, file)
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      return (
        prefix +
        rel
          .replace(/\.(tsx?|jsx?|mjs)$/, '')
          .split(path.sep)
          .join('/')
      )
    }
  }
  throw new Error(`Source outside known package roots: ${file}`)
}

const common = {
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  jsx: 'automatic',
  jsxDev: false,
  tsconfig,
  external,
  logLevel: 'warning',
  absWorkingDir: repoRoot,
}

// Pass 1: discover every source module reachable from the public entries.
const graph = await build({
  ...common,
  entryPoints: entries.map((e) => path.join(pkgDir, 'src', `${e}.ts`)),
  write: false,
  metafile: true,
  outdir: outDir,
})
const absSources = Object.keys(graph.metafile.inputs)
  .filter((f) => !f.includes('node_modules'))
  .map((f) => path.resolve(repoRoot, f))

// Pass 2: build each module on its own, externalising every import.
const preserveModules = {
  name: 'preserve-modules',
  setup(b) {
    b.onResolve({ filter: /.*/ }, async (args) => {
      if (args.kind === 'entry-point' || args.pluginData?.inner) return undefined
      if (external.includes(args.path)) return { path: args.path, external: true }
      const res = await b.resolve(args.path, {
        importer: args.importer,
        resolveDir: args.resolveDir,
        kind: args.kind,
        pluginData: { inner: true },
      })
      if (res.errors.length) return { errors: res.errors }
      if (res.external || res.path.includes(`${path.sep}node_modules${path.sep}`)) {
        return { path: args.path, external: true }
      }
      const from = path.posix.dirname(outPathFor(args.importer))
      let rel = path.posix.relative(from, outPathFor(res.path)) + '.js'
      if (!rel.startsWith('.')) rel = `./${rel}`
      return { path: rel, external: true }
    })
  },
}

rmSync(outDir, { recursive: true, force: true })
await build({
  ...common,
  entryPoints: absSources.map((f) => ({ in: f, out: outPathFor(f) })),
  outdir: outDir,
  outExtension: { '.js': '.js' },
  plugins: [preserveModules],
})
console.log(`cubeforge: emitted ${absSources.length} ESM modules to dist/`)
