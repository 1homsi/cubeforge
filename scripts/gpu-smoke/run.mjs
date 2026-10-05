#!/usr/bin/env node
// Renders tile and sprite layers in headless Chrome (real WebGL2 via SwiftShader)
// and checks pixels. Catches shader compile/link errors the fake-GL unit tests can't.
// Chrome: $CHROME, else common install paths.
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  return candidates.find((c) => existsSync(c)) ?? null
}

const chrome = findChrome()
if (!chrome) {
  console.log('gpu-smoke: no Chrome found (set CHROME)')
  process.exit(process.env.CI ? 1 : 0)
}

const dir = mkdtempSync(path.join(tmpdir(), 'cubeforge-gpu-'))
try {
  await build({
    entryPoints: [path.join(here, 'page.ts')],
    bundle: true,
    format: 'iife',
    outfile: path.join(dir, 'smoke.js'),
    logLevel: 'error',
  })
  writeFileSync(
    path.join(dir, 'index.html'),
    '<!doctype html><html><body><script src="smoke.js"></script></body></html>',
  )
  const dom = execFileSync(
    chrome,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu-sandbox',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--allow-file-access-from-files',
      '--dump-dom',
      `file://${path.join(dir, 'index.html')}`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 },
  )
  const m = /data-out="([^"]*)"/.exec(dom)
  if (!m) throw new Error('gpu-smoke: page produced no output')
  const out = JSON.parse(m[1].replace(/&quot;/g, '"'))
  const expect = {
    tintedTile: '0,255,0,255',
    blueTile: '0,0,255,255',
    whiteTile: '255,255,255,255',
    overlapTopIsYellow: '255,255,0,255',
    magentaOnly: '255,0,255,255',
    nightTile: '128,128,255,255',
    retintedAfterSetTiles: '0,0,255,255',
    glError: 0,
    glError2: 0,
  }
  const failures = Object.entries(expect).filter(([k, v]) => out[k] !== v)
  if (out.error || failures.length) {
    console.error('gpu-smoke failed:', JSON.stringify(out, null, 2))
    process.exit(1)
  }
  console.log('gpu-smoke: tile layer (tint, variants, avg colour) and multi-atlas sprite layer render correctly')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
