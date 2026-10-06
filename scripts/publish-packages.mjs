import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { cp, mkdir, readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const nodeBin = process.execPath

// Packages actually published to npm. The monorepo also contains
// @cubeforge/* scoped workspace packages, but no npm scope/org is
// configured for them — `cubeforge` compiles their sources into its dist
// (integrations/cubeforge/build.mjs), so consumers never need them as runtime
// deps. Extend this list only after creating the npm org + trusted publisher
// for the scope.
//
// Versioning: all published packages ship the same version, taken from the
// release tag (VERSION env, set by .github/workflows/publish.yml). Versions in
// the repo's package.json files are not the source of truth.
export const publishPackagePaths = ['integrations/cubeforge', 'packages/create-cubeforge-game']

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

function getVersion({ required = false } = {}) {
  const raw = process.env.VERSION || process.env.RELEASE_VERSION
  if (!raw && required) {
    throw new Error('VERSION (or RELEASE_VERSION) must be set to the release tag, e.g. VERSION=v0.9.2')
  }
  const version = raw
    ? raw.replace(/^v/, '')
    : readJson(path.join(repoRoot, 'integrations/cubeforge/package.json')).version
  if (!SEMVER.test(version)) throw new Error(`Invalid release version "${raw ?? version}"; expected semver like 1.2.3`)
  return version
}

function publishedNames() {
  return new Set(publishPackagePaths.map((rel) => readJson(path.join(repoRoot, rel, 'package.json')).name))
}

const DEP_SECTIONS = ['dependencies', 'optionalDependencies', 'peerDependencies']

/** Throws unless every manifest carries `version` and no workspace-only ranges remain. */
export function assertConsistentManifests(pkgs, version, published = publishedNames()) {
  const problems = []
  for (const pkg of pkgs) {
    if (pkg.version !== version) problems.push(`${pkg.name}: version ${pkg.version} != ${version}`)
    for (const section of DEP_SECTIONS) {
      for (const [name, range] of Object.entries(pkg[section] ?? {})) {
        if (typeof range === 'string' && range.startsWith('workspace:')) {
          problems.push(`${pkg.name}: ${section}.${name} still uses ${range}`)
        }
        if (name.startsWith('@cubeforge/')) problems.push(`${pkg.name}: ${section}.${name} is not published to npm`)
        if (published.has(name) && range !== version) {
          problems.push(`${pkg.name}: ${section}.${name} is ${range}, expected ${version}`)
        }
      }
    }
  }
  if (problems.length) throw new Error(`Inconsistent publish manifests:\n  ${problems.join('\n  ')}`)
}

export function preparePackageJson(pkg, version, published = publishedNames()) {
  const prepared = structuredClone(pkg)
  prepared.version = version
  delete prepared.private

  if (prepared.publishConfig) {
    Object.assign(prepared, prepared.publishConfig)
    delete prepared.publishConfig
  }

  // @cubeforge/* packages are compiled into the published dist; listing them
  // as runtime deps would 404 on npm. Other published packages are pinned to
  // the release version.
  for (const section of DEP_SECTIONS) {
    const deps = prepared[section]
    if (!deps) continue
    for (const name of Object.keys(deps)) {
      if (name.startsWith('@cubeforge/')) delete deps[name]
      else if (published.has(name)) deps[name] = version
    }
    if (Object.keys(deps).length === 0) delete prepared[section]
  }

  delete prepared.devDependencies
  return prepared
}

export function preparePackagesInPlace(version = getVersion({ required: true })) {
  const published = publishedNames()
  const prepared = publishPackagePaths.map((rel) => {
    const file = path.join(repoRoot, rel, 'package.json')
    return { file, pkg: preparePackageJson(readJson(file), version, published) }
  })
  assertConsistentManifests(
    prepared.map((p) => p.pkg),
    version,
    published,
  )
  for (const { file, pkg } of prepared) writeJson(file, pkg)
  console.log(`Stamped ${prepared.map((p) => p.pkg.name).join(', ')} at ${version}`)
}

async function listFiles(dir, prefix = '') {
  const currentDir = path.join(dir, prefix)
  const entries = await readdir(currentDir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const rel = path.join(prefix, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(dir, rel)))
    else files.push(path.join(dir, rel))
  }
  return files
}

function assertNoPublishJunk(files) {
  const junk = files.filter((file) => {
    const normalized = file.split(path.sep).join('/')
    return (
      normalized.includes('/__tests__/') ||
      normalized.includes('/__bench__/') ||
      normalized.includes('/coverage/') ||
      normalized.endsWith('.tsbuildinfo')
    )
  })
  if (junk.length > 0) {
    throw new Error(`Publish package contains generated test/bench junk:\n${junk.join('\n')}`)
  }
}

function assertNoUnpublishedImports(files) {
  const bad = files.filter(
    (file) =>
      /\.(m?js|d\.m?ts)$/.test(file) &&
      /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]@cubeforge\//.test(readFileSync(file, 'utf8')),
  )
  if (bad.length) throw new Error(`Published files import unpublished @cubeforge/* packages:\n${bad.join('\n')}`)
}

function exportTargets(exp) {
  if (typeof exp === 'string') return [exp]
  if (!exp || typeof exp !== 'object') return []
  return Object.values(exp).flatMap(exportTargets)
}

function assertEntryExists(stageDir, pkg) {
  const entries = [pkg.main, pkg.module, pkg.types, ...exportTargets(pkg.exports)]
  if (pkg.bin && typeof pkg.bin === 'object') entries.push(...Object.values(pkg.bin))
  for (const entry of entries.filter(Boolean)) {
    const full = path.join(stageDir, entry)
    if (!existsSync(full)) throw new Error(`${pkg.name} points to missing published file: ${entry}`)
  }
}

async function stagePackage(rel, outDir, version) {
  const srcDir = path.join(repoRoot, rel)
  const pkg = preparePackageJson(readJson(path.join(srcDir, 'package.json')), version)
  const stageDir = path.join(outDir, rel)
  await mkdir(stageDir, { recursive: true })
  writeJson(path.join(stageDir, 'package.json'), pkg)

  for (const item of pkg.files ?? []) {
    const src = path.join(srcDir, item)
    if (!existsSync(src)) throw new Error(`${pkg.name} files entry is missing after build: ${item}`)
    await cp(src, path.join(stageDir, item), { recursive: true, dereference: true })
  }

  const stagedFiles = await listFiles(stageDir)
  assertNoPublishJunk(stagedFiles)
  assertNoUnpublishedImports(stagedFiles)
  assertEntryExists(stageDir, pkg)
  return { rel, pkg, stageDir }
}

function packPackage(stageDir, tarballsDir) {
  const output = execFileSync(npmBin, ['pack', '--json', '--pack-destination', tarballsDir], {
    cwd: stageDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  // npm <= 11 prints an array, npm >= 12 an object keyed by package name.
  const parsed = JSON.parse(output)
  const info = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0]
  assertNoPublishJunk(info.files.map((file) => path.join(stageDir, file.path)))
  return path.join(tarballsDir, info.filename)
}

async function smoke(version = getVersion()) {
  const workDir = mkdtempSync(path.join(tmpdir(), 'cubeforge-publish-'))
  const stageRoot = path.join(workDir, 'stage')
  const tarballsDir = path.join(workDir, 'tarballs')
  const consumerDir = path.join(workDir, 'consumer')
  await mkdir(tarballsDir, { recursive: true })
  await mkdir(consumerDir, { recursive: true })

  try {
    const packed = []
    const stagedPkgs = []
    for (const rel of publishPackagePaths) {
      console.log(`Staging ${rel}`)
      const staged = await stagePackage(rel, stageRoot, version)
      stagedPkgs.push(staged.pkg)
      console.log(`Packing ${staged.pkg.name}`)
      packed.push({ name: staged.pkg.name, tarball: packPackage(staged.stageDir, tarballsDir) })
    }

    assertConsistentManifests(stagedPkgs, version)

    const rootPkg = readJson(path.join(repoRoot, 'package.json'))
    const consumerPkg = {
      name: 'cubeforge-packed-smoke',
      private: true,
      type: 'module',
      dependencies: Object.fromEntries(packed.map(({ name, tarball }) => [name, `file:${tarball}`])),
      devDependencies: {
        react: rootPkg.devDependencies.react,
        'react-dom': rootPkg.devDependencies['react-dom'],
        '@types/react': rootPkg.devDependencies['@types/react'],
        '@types/react-dom': rootPkg.devDependencies['@types/react-dom'],
      },
    }
    writeJson(path.join(consumerDir, 'package.json'), consumerPkg)
    writeJson(path.join(consumerDir, 'tsconfig.json'), {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        strict: true,
        // Off so unresolved imports inside the published .d.ts files fail here.
        skipLibCheck: false,
        esModuleInterop: true,
      },
      include: ['index.ts'],
    })
    writeFileSync(
      path.join(consumerDir, 'index.ts'),
      [
        "import { CharacterController, Game, RenderSystem, Room, createInputMap, overlapBox, useCollisionEnter, useSound } from 'cubeforge'",
        "import type { ContactData, ECSWorld, NetTransport, RaycastHit, RenderLayer, SoundControls } from 'cubeforge'",
        "import { Game as RenderGame, World, Entity, Camera2D, Transform, Sprite, useEntity, useGame, useDynamicCanvas, useCamera, useGestures } from 'cubeforge/render'",
        "import type { EngineState } from 'cubeforge/render'",
        "import { gjk } from 'cubeforge/advanced'",
        "import { mountGame, createTestEngine, cleanup, EngineContext, RecordingGL } from 'cubeforge/test'",
        "import type { MountedGame } from 'cubeforge/test'",
        '',
        'type IsAny<T> = 0 extends 1 & T ? true : false',
        'const engineTyped: IsAny<EngineState> = false',
        "const ecsTyped: IsAny<EngineState['ecs']> = false",
        'type SmokeTypes = [ContactData, ECSWorld, NetTransport, RaycastHit, RenderLayer, SoundControls]',
        'const values = [CharacterController, Game, RenderSystem, Room, createInputMap, overlapBox, useCollisionEnter, useSound]',
        'const renderValues = [RenderGame, World, Entity, Camera2D, Transform, Sprite, useEntity, useGame, useDynamicCanvas, useCamera, useGestures, gjk]',
        'const testValues = [mountGame, createTestEngine, cleanup, EngineContext, RecordingGL]',
        'export type { SmokeTypes, MountedGame }',
        'export { values, renderValues, testValues, engineTyped, ecsTyped }',
        '',
      ].join('\n'),
    )

    console.log('Installing packed packages into clean consumer')
    execFileSync(npmBin, ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: consumerDir,
      stdio: 'inherit',
    })
    console.log('Typechecking clean consumer import')
    execFileSync(
      nodeBin,
      ['--max-old-space-size=8192', path.join(repoRoot, 'node_modules/typescript/bin/tsc'), '--noEmit'],
      {
        cwd: consumerDir,
        stdio: 'inherit',
      },
    )
    console.log('Importing cubeforge at runtime from clean consumer')
    execFileSync(
      nodeBin,
      [
        '--input-type=module',
        '-e',
        [
          "const m = await import('cubeforge'); for (const key of ['Game','Room','RenderSystem']) { if (!m[key]) throw new Error(`missing ${key}`) }",
          "const r = await import('cubeforge/render'); for (const key of ['Game','World','Entity','Camera2D','Transform','Sprite','useEntity','useGame','useDynamicCanvas','useCamera','useGestures']) { if (!r[key]) throw new Error(`cubeforge/render missing ${key}`) }",
          "const a = await import('cubeforge/advanced'); if (!a.gjk) throw new Error('cubeforge/advanced missing gjk')",
          "const t = await import('cubeforge/test'); for (const key of ['mountGame','createTestEngine','cleanup','EngineContext','RecordingGL']) { if (!t[key]) throw new Error(`cubeforge/test missing ${key}`) }",
        ].join('\n'),
      ],
      { cwd: consumerDir, stdio: 'inherit' },
    )
  } finally {
    if (!process.env.KEEP_CUBEFORGE_PUBLISH_SMOKE) rmSync(workDir, { recursive: true, force: true })
  }
}

const command = process.argv[2]
if (command === 'prepare') {
  preparePackagesInPlace()
} else if (command === 'smoke') {
  await smoke()
} else if (command === 'list-paths') {
  console.log(publishPackagePaths.join('\n'))
} else {
  console.error('Usage: node scripts/publish-packages.mjs <prepare|smoke|list-paths>')
  process.exit(1)
}
