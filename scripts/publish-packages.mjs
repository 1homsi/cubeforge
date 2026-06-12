import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { cp, mkdir, readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const nodeBin = process.execPath

export const publishPackagePaths = [
  'packages/core',
  'packages/input',
  'packages/renderer',
  'packages/physics',
  'packages/renderer3d',
  'packages/audio',
  'integrations/context',
  'integrations/gameplay',
  'integrations/devtools',
  'integrations/editor',
  'packages/net',
  'integrations/cubeforge',
  'packages/create-cubeforge-game',
]

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function getVersion() {
  const raw = process.env.VERSION || process.env.RELEASE_VERSION
  if (raw) return raw.replace(/^v/, '')
  return readJson(path.join(repoRoot, 'integrations/cubeforge/package.json')).version
}

export function preparePackageJson(pkg, version) {
  const prepared = structuredClone(pkg)
  prepared.version = version
  delete prepared.private

  if (prepared.publishConfig) {
    Object.assign(prepared, prepared.publishConfig)
    delete prepared.publishConfig
  }

  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    if (!prepared[section]) continue
    for (const [name, range] of Object.entries(prepared[section])) {
      if (typeof range === 'string' && range.startsWith('workspace:')) {
        prepared[section][name] = version
      }
    }
  }

  delete prepared.devDependencies
  return prepared
}

export function preparePackagesInPlace(version = getVersion()) {
  for (const rel of publishPackagePaths) {
    const file = path.join(repoRoot, rel, 'package.json')
    writeJson(file, preparePackageJson(readJson(file), version))
  }
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

function assertEntryExists(stageDir, pkg) {
  const entries = [pkg.main, pkg.module, pkg.types]
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
  assertEntryExists(stageDir, pkg)
  return { rel, pkg, stageDir }
}

function packPackage(stageDir, tarballsDir) {
  const output = execFileSync(npmBin, ['pack', '--json', '--pack-destination', tarballsDir], {
    cwd: stageDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const [info] = JSON.parse(output)
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
    for (const rel of publishPackagePaths) {
      console.log(`Staging ${rel}`)
      const staged = await stagePackage(rel, stageRoot, version)
      console.log(`Packing ${staged.pkg.name}`)
      packed.push({ name: staged.pkg.name, tarball: packPackage(staged.stageDir, tarballsDir) })
    }

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
        skipLibCheck: true,
        esModuleInterop: true,
      },
      include: ['index.ts'],
    })
    writeFileSync(
      path.join(consumerDir, 'index.ts'),
      [
        "import { AudioOcclusion, CharacterController, Game, Game3D, Raycaster, RenderSystem, Room, createInputMap, overlapBox, useCollisionEnter, useSound } from 'cubeforge'",
        "import type { ContactData, ECSWorld, Game3DProps, NetTransport, RaycastHit, RenderLayer, SoundControls } from 'cubeforge'",
        '',
        'type SmokeTypes = [ContactData, ECSWorld, Game3DProps, NetTransport, RaycastHit, RenderLayer, SoundControls]',
        'const values = [AudioOcclusion, CharacterController, Game, Game3D, Raycaster, RenderSystem, Room, createInputMap, overlapBox, useCollisionEnter, useSound]',
        'export type { SmokeTypes }',
        'export { values }',
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
        "const m = await import('cubeforge'); for (const key of ['Game','Room','RenderSystem','Game3D','Raycaster']) { if (!m[key]) throw new Error(`missing ${key}`) }",
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
