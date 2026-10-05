import { beforeAll, describe, expect, it } from 'vitest'
import { ECSWorld, createTransform } from '@cubeforge/core'
import { RenderSystem } from '../webglRenderSystem'
import { createRecordingCanvas, installHeadlessCanvasDOM } from '../testing/recordingGL'
import { createText } from '../components/text'
import { createCamera2D } from '../components/camera2d'
import { createEntityTextBatcher } from '../textEntities'
import { textRasterKey } from '../textTexture'
import { SpriteLayer } from '../spriteLayer'

beforeAll(() => {
  installHeadlessCanvasDOM()
})

function world() {
  const w = new ECSWorld()
  w.addComponent(w.createEntity(), createCamera2D({ x: 200, y: 150, zoom: 1 }))
  return w
}

function addText(w: ECSWorld, opts: Parameters<typeof createText>[0], x = 200, y = 150) {
  const id = w.createEntity()
  w.addComponent(id, createTransform(x, y))
  const text = createText(opts)
  w.addComponent(id, text)
  return { id, text }
}

describe('Text entities on the glyph atlas', () => {
  it('batches 1,000 labels into one draw call', () => {
    const w = world()
    for (let i = 0; i < 1000; i++)
      addText(w, { text: `L${i % 50}`, fontSize: 10 }, (i % 40) * 8, Math.floor(i / 40) * 8)
    const canvas = createRecordingCanvas(400, 300)
    const rs = new RenderSystem(canvas, new Map())
    ;(w.getComponent(w.queryOne('Camera2D')!, 'Camera2D') as { zoom: number }).zoom = 0.6
    rs.update(w, 1 / 60)
    expect(canvas.gl.draws.filter((d) => d.kind === 'instanced')).toHaveLength(1)
    expect(rs.getStats().drawCalls).toBe(1)
  })

  it('maps opacity, align, baseline, wrap, stroke and shadow onto the run', () => {
    const w = world()
    const plain = addText(w, { text: 'Hello', align: 'left', baseline: 'top' })
    const mid = addText(w, { text: 'Hello', align: 'right', baseline: 'middle', opacity: 0.5 })
    const fx = addText(w, {
      text: 'Hello world again',
      strokeColor: '#000000',
      strokeWidth: 2,
      shadowColor: '#333333',
      wordWrap: true,
      maxWidth: 40,
      fontWeight: 'bold',
    })
    const b = createEntityTextBatcher()
    b.sync(w, 1)
    const L = b.tail
    expect(L.count).toBe(3)
    // find runs by text
    const idx = (t: string, n = 0) => [...Array(L.count).keys()].filter((i) => L.texts[i] === t)[n]
    const pi = idx('Hello', 0)
    const mi = idx('Hello', 1)
    const fi = idx('Hello world again')
    expect(L.anchorX[pi]).toBe(0)
    expect(L.anchorX[mi]).toBe(1)
    expect(L.alpha[mi]).toBeCloseTo(0.5)
    expect(L.anchorY[pi]).toBeLessThan(L.anchorY[mi]) // top vs middle
    expect(L.layout(fi).lines).toBeGreaterThan(1) // wordWrap at maxWidth
    // stroke/shadow/weight bake into a distinct atlas style; plain text shares the layer default tint
    expect(L.style[fi]).not.toBe(L.style[pi])
    const s = L.styles[L.style[fi]]
    expect(s.outlineColor).toBe('#000000')
    expect(s.weight).toBe('bold')
    expect(s.shadowColor).toBe('#333333')
    expect(L.color[fi]).toBe(0xffffffff)
    expect(plain.text.text).toBe('Hello')
    expect(fx.text.wordWrap).toBe(true)
  })

  it('removes runs of destroyed or hidden entities and keeps the rest', () => {
    const w = world()
    const a = addText(w, { text: 'a' })
    const b = addText(w, { text: 'bb' })
    addText(w, { text: 'ccc' })
    const batcher = createEntityTextBatcher()
    batcher.sync(w, 1)
    expect(batcher.tail.count).toBe(3)
    b.text.visible = false
    batcher.sync(w, 1)
    expect(batcher.tail.count).toBe(2)
    expect([...batcher.tail.texts].sort()).toEqual(['a', 'ccc'])
    w.destroyEntity(a.id)
    batcher.sync(w, 1)
    expect(batcher.tail.texts).toEqual(['ccc'])
  })

  it('draws text in zIndex order inside the tail layer', () => {
    const w = world()
    addText(w, { text: 'top', zIndex: 5 })
    addText(w, { text: 'bottom', zIndex: 1 })
    const b = createEntityTextBatcher()
    b.sync(w, 1)
    const order = b.tail.drawOrder()
    expect(b.tail.texts[order[0]]).toBe('bottom')
    expect(b.tail.texts[order[1]]).toBe('top')
  })

  it('sends complex scripts and maxWidth squeeze to the canvas path', () => {
    const w = world()
    const arabic = addText(w, { text: 'مرحبا' })
    const squeeze = addText(w, { text: 'a very long label indeed', maxWidth: 20 })
    addText(w, { text: 'plain' })
    const b = createEntityTextBatcher()
    b.sync(w, 1)
    expect(b.fallback).toContain(arabic.id)
    expect(b.fallback).toContain(squeeze.id)
    expect(b.fallback).toHaveLength(2)
    const visible = [...Array(b.tail.count).keys()].filter((i) => !(b.tail.flags[i] & 1))
    expect(visible.map((i) => b.tail.texts[i])).toEqual(['plain'])
  })

  it('draws fallback text through per-entity textures, anchored at the text origin', () => {
    const w = world()
    addText(w, { text: 'مرحبا', opacity: 0.4, align: 'left', baseline: 'top' })
    const canvas = createRecordingCanvas(400, 300, { captureInstances: true })
    const rs = new RenderSystem(canvas, new Map())
    rs.update(w, 1 / 60)
    const d = canvas.gl.draws.filter((x) => x.kind === 'instanced')
    expect(d).toHaveLength(1)
    const inst = canvas.gl.frameInstances()[0]
    expect(inst.a).toBeCloseTo(0.4) // opacity is the vertex alpha
    expect(inst.anchorX).toBeLessThan(0.5) // left-aligned: origin near the left edge
    expect(inst.x).toBe(200)
  })

  it('sorts text with a layer against sprite layers', () => {
    const w = world()
    addText(w, { text: 'x', layer: 'default', zIndex: 1 })
    addText(w, { text: 'y', layer: 'default', zIndex: 9 })
    const sprites = new SpriteLayer({ zIndex: 5 })
    sprites.add(200, 150, 10, 10)
    sprites.add(210, 150, 10, 10)
    const canvas = createRecordingCanvas(400, 300)
    const rs = new RenderSystem(canvas, new Map())
    rs.addSpriteLayer(sprites)
    rs.update(w, 1 / 60)
    expect(canvas.gl.draws.map((d) => d.count)).toEqual([1, 2, 1])
  })

  it('keys cached text textures on weight, style, wrap and effects but not opacity', () => {
    const base = createText({ text: 'k' })
    const key = (o: Parameters<typeof createText>[0]) => textRasterKey(createText({ text: 'k', ...o }), 1)
    expect(key({ fontWeight: 'bold' })).not.toBe(textRasterKey(base, 1))
    expect(key({ fontStyle: 'italic' })).not.toBe(textRasterKey(base, 1))
    expect(key({ strokeColor: '#000', strokeWidth: 2 })).not.toBe(textRasterKey(base, 1))
    expect(key({ wordWrap: true, maxWidth: 10 })).not.toBe(textRasterKey(base, 1))
    expect(key({ align: 'left' })).not.toBe(textRasterKey(base, 1))
    expect(textRasterKey(base, 2)).not.toBe(textRasterKey(base, 1))
    expect(key({ opacity: 0.3 })).toBe(textRasterKey(base, 1))
  })
})
