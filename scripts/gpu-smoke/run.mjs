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

/** Bundle `entry`, run it in headless Chrome and return the JSON it leaves in `data-out`. */
async function runPage(entry, { extraArgs = [], hash = '' } = {}) {
  const name = path.parse(entry).name
  await build({
    entryPoints: [path.join(here, entry)],
    bundle: true,
    format: 'iife',
    outfile: path.join(dir, `${name}.js`),
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'error',
  })
  writeFileSync(
    path.join(dir, `${name}.html`),
    `<!doctype html><html><head><meta charset="utf-8"></head><body><script src="${name}.js"></script></body></html>`,
  )
  // Chrome sometimes exits non-zero after --dump-dom succeeded; the dumped DOM is what counts.
  const run = () =>
    execFileSync(
      chrome,
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu-sandbox',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--allow-file-access-from-files',
        // Lets the page's async work (blob encoding, GPU timer readback) finish before the DOM is dumped.
        '--virtual-time-budget=10000',
        ...extraArgs,
        '--dump-dom',
        `file://${path.join(dir, `${name}.html`)}${hash}`,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 },
    )
  let dom
  try {
    dom = run()
  } catch (e) {
    dom = e && typeof e.stdout === 'string' ? e.stdout : ''
  }
  const m = /data-out="([^"]*)"/.exec(dom)
  if (!m) throw new Error(`gpu-smoke: ${entry} produced no output`)
  return JSON.parse(m[1].replace(/&quot;/g, '"'))
}

function check(label, out, expect) {
  const failures = Object.entries(expect).filter(([k, v]) => out[k] !== v)
  if (out.error || failures.length) {
    console.error(`gpu-smoke (${label}) failed:`, JSON.stringify(out, null, 2))
    process.exit(1)
  }
}

const CANVAS2D_EXPECT = {
  backend: 'canvas2d',
  fallbackWarnings: 0,
  webgl: 'none',
  tintedTile: '0,255,0,255',
  blueTile: '0,0,255,255',
  whiteTile: '255,255,255,255',
  overlapTopIsYellow: '255,255,0,255',
  magentaOnly: '255,0,255,255',
  redTintedLayerSprite: '255,0,0,255',
  circleCenter: '255,0,0,255',
  circleCornerIsTile: '255,255,255,255',
  rectSprite: '255,128,0,255',
  textLayerGlyphs: 'ok',
  nightTile: '128,128,255,255',
  afterClear: '255,255,255,255',
}

try {
  {
    const out = await runPage('page.ts')
    const expect = {
      tintedTile: '0,255,0,255',
      blueTile: '0,0,255,255',
      whiteTile: '255,255,255,255',
      overlapTopIsYellow: '255,255,0,255',
      magentaOnly: '255,0,255,255',
      nightTile: '128,128,255,255',
      retintedAfterSetTiles: '0,0,255,255',
      atlasBeforeRepaint: '255,255,0,255',
      atlasAfterRepaint: '255,0,0,255',
      glError: 0,
      glError2: 0,
      spriteBelowDecor: '255,0,0,255',
      decorAboveLowSprite: '0,255,0,255',
      highSpriteAboveDecor: '255,255,0,255',
      glError3: 0,
      mipCheckerGrey: '128,128,128,255',
      mipCheckerGreyB: '128,128,128,255',
      glError5: 0,
      biasBrightens: '192,192,192,255',
      biasAfterTint: '128,128,128,255',
      glError6: 0,
      pivotQuadLeftOfX: '255,0,255,255',
      pivotNotRightOfX: '255,255,255,255',
      anchorQuadRightOfX: '255,0,255,255',
      anchorNotLeftOfX: '255,255,255,255',
      glError7: 0,
      colorAddRed: '192,128,128,255',
      additiveOnWhite: '255,255,255,255',
      glError8: 0,
      circleCenter: '0,255,0,255',
      circleOutside: 'ok',
      circleAntialiased: 'ok',
      lineMiddle: '255,0,255,255',
      lineOutside: 'ok',
      polygonInside: '0,255,255,255',
      polygonOutside: 'ok',
      gradientLeft: 'dark',
      gradientRight: 'light',
      glErrorShapes: 0,
      stackTopLeft: '255,0,255,255',
      stackBottomLeftUntouched: 'ok',
      stackKeepsScene: 'ok',
      glError6: 0,
      groupTopIsCyan: '0,255,255,255',
      groupUnderIsRed: '255,0,0,255',
      groupOverlapTopCyan: '0,255,255,255',
      groupSwitchRedOnTop: '255,0,0,255',
      frameTableMagenta: '255,0,255,255',
      glError4: 0,
    }
    check('layers', out, expect)
    console.log('gpu-smoke: tile layer (tint, variants, avg colour) and multi-atlas sprite layer render correctly')
  }
  {
    const out = await runPage('text.ts')
    check('text', out, {
      glError: 0,
      whiteText: 'ok',
      tintedText: 'ok',
      alphaText: 'ok',
      belowSpriteZ: 'ok',
      aboveSpriteZ: 'ok',
      oneDrawPerLayer: 1,
      entityWhite: 'ok',
      entityRed: 'ok',
      entityOpacity: 'ok',
      entityStroke: 'ok',
      entityAlignRight: 'ok',
      entityBaselineTop: 'ok',
      entityWrap: 'ok',
      entitySqueeze: 'ok',
      glError2: 0,
      glError3: 0,
    })
    console.log(
      'gpu-smoke: glyph-atlas text layer renders correctly (tint, alpha, z-order, one draw) and Text components keep their full style',
    )
  }
  {
    // No WebGL here: the page mounts <Game renderer="canvas2d"> and reads the 2D canvas back.
    // Virtual time lets its timers (engine start-up) run before the DOM is dumped.
    const out = await runPage('canvas2d.tsx', { extraArgs: ['--virtual-time-budget=8000'] })
    check('canvas2d', out, CANVAS2D_EXPECT)
    console.log('gpu-smoke: Canvas2D renderer draws tile layer, sprite layer, shapes and screen tint correctly')
  }
  {
    // WebGL switched off in the browser: renderer="auto" must fall back to Canvas2D, warn once,
    // and draw the same pixels.
    const out = await runPage('canvas2d.tsx', {
      hash: '#auto',
      extraArgs: ['--virtual-time-budget=8000', '--disable-3d-apis', '--disable-gpu', '--disable-software-rasterizer'],
    })
    check('canvas2d auto fallback', out, { ...CANVAS2D_EXPECT, fallbackWarnings: 1 })
    console.log('gpu-smoke: renderer="auto" falls back to Canvas2D when WebGL is disabled and draws the same pixels')
  }
  {
    const out = await runPage('tint.ts')
    const ok = (...keys) => Object.fromEntries(keys.map((k) => [k, 'ok']))
    check('tint', out, {
      ...ok(
        'layerTint',
        'layerOpacity',
        'additive',
        'multiply',
        'screen',
        'sortedTintDimsGround',
        'sortedTintSparesTop',
        'stackedTints',
        'stackedTintsBackground',
        'tileAdditive',
        'tileOutside',
      ),
      glError: 0,
      glError2: 0,
      glError3: 0,
    })
    console.log('gpu-smoke: per-layer tint/opacity/blend, stacked and z-limited screen tints render correctly')
  }
  {
    const out = await runPage('wind.ts')
    check('wind', out, {
      restTop: 'ok',
      swayTopMoves: 'ok',
      swayBaseStays: 'ok',
      unflaggedStays: 'ok',
      glError: 0,
    })
    console.log('gpu-smoke: GPU vertex sway bends flagged sprites from a time uniform (base fixed)')
  }
  {
    const out = await runPage('stats.ts')
    check('stats', out, {
      layerKinds: 'tile,sprite',
      layerDrawCalls: '1,1',
      tileTexturesCounted: true,
      noGpuByDefault: true,
      gpuMsOk: true,
      gpuFlagMatches: true,
      gpuOff: true,
      glError: 0,
    })
    console.log(
      `gpu-smoke: stats layers, tile textures and GPU timer (supported: ${out.gpuTimerSupported}) are consistent`,
    )
  }
  {
    const out = await runPage('capture.ts')
    check('capture', out, {
      captureSize: '256x256',
      captureNotBlack: true,
      captureEqualsScreen: true,
      captureTile: '255,255,255,255',
      blobType: 'image/png',
      blobEqualsScreen: true,
      bitmapEqualsScreen: true,
      smallSize: '64x64',
      smallTile: '255,255,255,255',
      bigSize: '512x512',
      bigEdge: '0,0,255,255|255,255,255,255',
      scaledEdgeIsBlurred: true,
      canvasRestored: '256x256',
      stillRenders: true,
      glErrorCapture: 0,
    })
    console.log('gpu-smoke: captureFrame matches the on-screen frame in every result type, at any size')
  }
  {
    const out = await runPage('sharp.ts')
    console.log('sharpness metrics:', JSON.stringify(out))
    check('sharp', out, { crispAt1x: 'ok', crispAt4x: 'ok', fixedBlursAt4x: 'ok', hasEdges: 'ok', gl1: 0, gl4: 0 })
    console.log('gpu-smoke: zoom-aware glyph atlas keeps labels crisp at 1x and 4x zoom')
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}
