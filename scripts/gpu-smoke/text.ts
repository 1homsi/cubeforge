import { ECSWorld } from '../../packages/core/src/index.ts'
import { RenderSystem } from '../../packages/renderer/src/webglRenderSystem.ts'
import { createCamera2D } from '../../packages/renderer/src/components/camera2d.ts'
import { SpriteLayer, SPRITE_UNTEXTURED } from '../../packages/renderer/src/spriteLayer.ts'
import { TextLayer, GlyphAtlas } from '../../packages/renderer/src/textLayer.ts'
import { createText } from '../../packages/renderer/src/components/text.ts'
import { createTransform } from '../../packages/core/src/index.ts'

const out: Record<string, unknown> = {}
try {
  const make = (size = 256) => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    document.body.appendChild(canvas)
    const rs = new RenderSystem(canvas, new Map())
    const world = new ECSWorld()
    const cam = world.createEntity()
    world.addComponent(cam, createCamera2D({ x: size / 2, y: size / 2, zoom: 1, background: '#000000' }))
    const gl = (rs as unknown as { gl: WebGL2RenderingContext }).gl
    return { rs, world, gl, size }
  }
  const atlas = new GlyphAtlas()
  const { rs, world, gl, size } = make()
  const pixels = (x: number, y: number, w: number, h: number) => {
    const d = new Uint8Array(w * h * 4)
    gl.readPixels(x, size - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, d)
    return d
  }
  const any = (x: number, y: number, w: number, h: number, pred: (r: number, g: number, b: number) => boolean) => {
    const d = pixels(x, y, w, h)
    for (let i = 0; i < d.length; i += 4) if (pred(d[i], d[i + 1], d[i + 2])) return true
    return false
  }
  const maxR = (x: number, y: number, w: number, h: number) => {
    const d = pixels(x, y, w, h)
    let m = 0
    for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i])
    return m
  }
  const style = { atlas, fontFamily: 'sans-serif', weight: 'bold', fontSize: 40 }
  const word = (layer: TextLayer, x: number, y: number, o = {}) => layer.add('MMMM', x, y, o)

  const white = new TextLayer({ ...style, zIndex: 1 })
  word(white, 64, 64)
  const red = new TextLayer({ ...style, zIndex: 1 })
  word(red, 192, 64, { color: 0xff0000ff })
  const half = new TextLayer({ ...style, zIndex: 1 })
  word(half, 64, 192, { alpha: 0.5 })
  const under = new TextLayer({ ...style, zIndex: 1 })
  word(under, 192, 192)
  const over = new TextLayer({ ...style, zIndex: 9 })
  word(over, 128, 128, { size: 30 })
  const sprites = new SpriteLayer({ zIndex: 5 })
  const a = sprites.add(192, 192, 120, 60)
  sprites.flags[a] = SPRITE_UNTEXTURED
  sprites.color[a] = 0xff00ffff
  const b = sprites.add(128, 128, 120, 50)
  sprites.flags[b] = SPRITE_UNTEXTURED
  sprites.color[b] = 0x0000ffff
  for (const l of [white, red, half, under, over]) rs.addTextLayer(l)
  rs.addSpriteLayer(sprites)
  rs.update(world, 1 / 60)
  rs.update(world, 1 / 60)

  const isWhite = (r: number, g: number, b: number) => r > 200 && g > 200 && b > 200
  out.whiteText = any(16, 40, 96, 48, isWhite) ? 'ok' : 'no white pixels'
  out.tintedText =
    any(144, 40, 96, 48, (r, g, b) => r > 200 && g < 30 && b < 30) && !any(144, 40, 96, 48, (_r, g) => g > 100)
      ? 'ok'
      : 'not red'
  const mr = maxR(16, 168, 96, 48)
  out.alphaText = mr >= 110 && mr <= 150 ? 'ok' : `max ${mr}`
  // text z=1 below the magenta sprite at z=5: no white shows through
  out.belowSpriteZ = any(144, 168, 96, 48, (_r, g) => g > 100) ? 'text above sprite' : 'ok'
  // text z=9 above the blue sprite at z=5
  out.aboveSpriteZ = any(92, 112, 72, 34, isWhite) ? 'ok' : 'text hidden by sprite'
  out.glError = gl.getError()

  // one draw call for hundreds of labels
  const big = make()
  const many = new TextLayer({ ...style, fontSize: 8 })
  for (let i = 0; i < 400; i++) many.add(`n${i}`, (i % 20) * 12 + 8, Math.floor(i / 20) * 12 + 8, { size: 8 })
  big.rs.addTextLayer(many)
  big.rs.update(big.world, 1 / 60)
  out.oneDrawPerLayer = big.rs.getStats().drawCalls
  out.glError2 = big.gl.getError()

  // Text components (batched through the glyph atlas) honour the full style
  const tx = make()
  const put = (o: Parameters<typeof createText>[0], x: number, y: number) => {
    const id = tx.world.createEntity()
    tx.world.addComponent(id, createTransform(x, y))
    tx.world.addComponent(id, createText({ fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: 36, ...o }))
  }
  put({ text: 'MMMM' }, 64, 40)
  put({ text: 'MMMM', color: '#ff0000' }, 192, 40)
  put({ text: 'MMMM', opacity: 0.5 }, 64, 100)
  put({ text: 'MMMM', strokeColor: '#ff0000', strokeWidth: 5, color: '#ffffff' }, 192, 100)
  put({ text: 'MMMM', fontSize: 24, align: 'right' }, 128, 150)
  put({ text: 'MMMM', fontSize: 24, baseline: 'top' }, 64, 190)
  put({ text: 'MM MM', fontSize: 24, wordWrap: true, maxWidth: 60 }, 192, 170)
  put({ text: 'MMMMMMMM', fontSize: 30, maxWidth: 40 }, 64, 240)
  tx.rs.update(tx.world, 1 / 60)
  tx.rs.update(tx.world, 1 / 60)
  const tpix = (x: number, y: number, w: number, h: number) => {
    const d = new Uint8Array(w * h * 4)
    tx.gl.readPixels(x, tx.size - y - h, w, h, tx.gl.RGBA, tx.gl.UNSIGNED_BYTE, d)
    return d
  }
  const tany = (x: number, y: number, w: number, h: number, pred: (r: number, g: number, b: number) => boolean) => {
    const d = tpix(x, y, w, h)
    for (let i = 0; i < d.length; i += 4) if (pred(d[i], d[i + 1], d[i + 2])) return true
    return false
  }
  const lit = (r: number, g: number, b: number) => r > 100 || g > 100 || b > 100
  out.entityWhite = tany(16, 20, 96, 40, isWhite) ? 'ok' : 'no white'
  out.entityRed =
    tany(144, 20, 96, 40, (r, g, b) => r > 200 && g < 30 && b < 30) && !tany(144, 20, 96, 40, (_r, g) => g > 100)
      ? 'ok'
      : 'not red'
  const er = (() => {
    const d = tpix(16, 80, 96, 40)
    let m = 0
    for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i])
    return m
  })()
  out.entityOpacity = er >= 110 && er <= 150 ? 'ok' : `max ${er}`
  out.entityStroke =
    tany(144, 80, 96, 40, (r, g, b) => r > 200 && g < 60 && b < 60) && tany(144, 80, 96, 40, isWhite)
      ? 'ok'
      : 'stroke/fill missing'
  out.entityAlignRight = tany(40, 135, 88, 30, lit) && !tany(134, 135, 30, 20, lit) ? 'ok' : 'not right aligned'
  out.entityBaselineTop = tany(16, 192, 96, 24, lit) && !tany(16, 170, 96, 18, lit) ? 'ok' : 'baseline top ignored'
  out.entityWrap = tany(150, 190, 84, 16, lit) ? 'ok' : 'did not wrap'
  out.entitySqueeze =
    tany(44, 225, 40, 28, lit) && !tany(0, 225, 38, 28, lit) && !tany(90, 225, 60, 28, lit) ? 'ok' : 'not squeezed'
  out.glError3 = tx.gl.getError()
} catch (e) {
  out.error = String((e as Error).stack ?? e)
}
document.title = 'done'
document.body.setAttribute('data-out', JSON.stringify(out))
