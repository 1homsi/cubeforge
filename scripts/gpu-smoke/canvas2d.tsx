// Canvas2D scenario: mounts <Game renderer="canvas2d"> in headless Chrome and reads real
// pixels back from the 2D canvas. Mirrors page.ts (the WebGL scenario) where it can.
// The URL hash picks the `renderer` prop: 'canvas2d' (default) or 'auto' (run with WebGL disabled).
import { createElement as h, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { SpriteLayer, TileLayerData } from '../../packages/renderer/src/index.ts'
import { Game } from '../../integrations/xip/src/components/Game.tsx'
import { World } from '../../integrations/xip/src/components/World.tsx'
import { Camera2D } from '../../integrations/xip/src/components/Camera2D.tsx'
import { Entity } from '../../integrations/xip/src/components/Entity.tsx'
import { Transform } from '../../integrations/xip/src/components/Transform.tsx'
import { Sprite } from '../../integrations/xip/src/components/Sprite.tsx'
import { TileLayer, useTileLayer } from '../../integrations/xip/src/components/TileLayer.tsx'
import { useSpriteLayer } from '../../integrations/xip/src/hooks/useSpriteLayer.ts'
import { useScreenTint } from '../../integrations/xip/src/hooks/useScreenTint.ts'
import { useTextLayer } from '../../integrations/xip/src/hooks/useTextLayer.ts'
import { useGame } from '../../integrations/xip/src/hooks/useGame.ts'

const out: Record<string, unknown> = {}
const renderer = (location.hash.slice(1) || 'canvas2d') as 'auto' | 'canvas2d'
const warnings: string[] = []
const warn = console.warn
console.warn = (...args: unknown[]) => {
  warnings.push(String(args[0]))
  warn(...args)
}

const solid = (colors: string[], size = 16) => {
  const c = document.createElement('canvas')
  c.width = size * colors.length
  c.height = size
  const g = c.getContext('2d')!
  colors.forEach((col, i) => {
    g.fillStyle = col
    g.fillRect(i * size, 0, size, size)
  })
  return c
}

const tileset = { image: solid(['#ffffff', '#0000ff']), tileWidth: 16, tileHeight: 16, columns: 2 }
const atlases = [
  { image: solid(['#ffff00']), frameWidth: 16, frameHeight: 16 },
  { image: solid(['#ff00ff']), frameWidth: 16, frameHeight: 16 },
]

let tiles!: TileLayerData
let layer!: SpriteLayer
let tint!: ReturnType<typeof useScreenTint>
let engine!: ReturnType<typeof useGame>
let labels!: ReturnType<typeof useTextLayer>

function Scene() {
  engine = useGame()
  tint = useScreenTint()
  tiles = useTileLayer({ width: 16, height: 16, tileset })
  layer = useSpriteLayer({ atlases, sortByKey: true, zIndex: 5 })
  labels = useTextLayer({ fontFamily: 'sans-serif', fontSize: 24, zIndex: 8 })
  useEffect(() => {
    tiles.fill(1)
    tiles.setTint(0, 0, 0x00ff00ff)
    tiles.setTile(1, 0, 2)
    const a = layer.add(200, 200, 20, 20, 0, 1)
    layer.atlas[a] = 0
    layer.sortKey[a] = 2
    const b = layer.add(206, 206, 20, 20, 0, 2)
    layer.atlas[b] = 1
    layer.sortKey[b] = 1
    // a rotated, half-transparent, red-tinted yellow sprite on the first atlas
    const c = layer.add(40, 120, 20, 20, 0, 3)
    layer.color[c] = 0xff0000ff
    layer.touch()
    labels.add('HIH', 50, 60, { color: 0xff0000ff })
  }, [])
  return h(
    'div',
    null,
    h(TileLayer, { layer: tiles, zIndex: -1 }),
    h(
      Entity,
      null,
      h(Transform, { x: 200, y: 40 }),
      h(Sprite, { width: 30, height: 30, color: '#ff0000', shape: 'circle' }),
    ),
    h(Entity, null, h(Transform, { x: 100, y: 200 }), h(Sprite, { width: 20, height: 20, color: '#ff8000' })),
  )
}

function App() {
  return h(
    Game,
    { width: 256, height: 256, renderer, asyncAssets: true },
    h(World, null, h(Camera2D, { x: 128, y: 128, background: '#000000' }), h(Scene)),
  )
}

async function main() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  createRoot(host).render(h(App))
  for (let i = 0; i < 50 && !(engine && engine.ecs.queryOne('Camera2D') !== undefined); i++) {
    await new Promise((r) => setTimeout(r, 50))
  }
  await new Promise((r) => setTimeout(r, 200))
  const canvas = engine.canvas
  const g = canvas.getContext('2d')!
  const px = (x: number, y: number) => [...g.getImageData(x, y, 1, 1).data].join(',')
  const frame = () => engine.activeRenderSystem!.update(engine.ecs, 1 / 60)
  frame()
  out.backend = engine.renderBackend
  out.fallbackWarnings = warnings.filter((w) => w.includes('Canvas2D renderer')).length
  out.webgl = canvas.getContext('webgl2') === null ? 'none' : 'created'
  out.tintedTile = px(8, 8)
  out.blueTile = px(24, 8)
  out.whiteTile = px(40, 40)
  out.overlapTopIsYellow = px(205, 205)
  out.magentaOnly = px(214, 214)
  out.redTintedLayerSprite = px(40, 120)
  out.circleCenter = px(200, 40)
  out.circleCornerIsTile = px(187, 27)
  out.rectSprite = px(100, 200)
  // red glyphs from the text layer's atlas, drawn over the white tiles
  let red = 0
  const region = g.getImageData(20, 40, 60, 40).data
  for (let i = 0; i < region.length; i += 4) if (region[i] > 200 && region[i + 1] < 80 && region[i + 2] < 80) red++
  out.textLayerGlyphs = red > 30 ? 'ok' : `only ${red} red pixels`
  tint.set(0.5, 0.5, 1, 1, 'multiply')
  frame()
  out.nightTile = px(100, 100)
  tint.clear()
  tiles.jitter = 0
  frame()
  out.afterClear = px(100, 100)
}

main()
  .catch((e) => {
    out.error = String((e as Error).stack ?? e)
  })
  .finally(() => {
    document.title = 'done'
    document.body.setAttribute('data-out', JSON.stringify(out))
  })
