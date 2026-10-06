// Recording CanvasRenderingContext2D stand-in for tests: every draw call is kept with
// the transform, alpha, composite op, fill style and smoothing in effect when it ran.
import { vi } from 'vitest'

export interface Op {
  name: string
  args: unknown[]
  /** [a, b, c, d, e, f] at call time */
  tf: number[]
  alpha: number
  comp: string
  fill: unknown
  smooth: boolean
}

const DRAWS = new Set([
  'fillRect',
  'strokeRect',
  'drawImage',
  'fillText',
  'strokeText',
  'fill',
  'stroke',
  'arc',
  'ellipse',
  'roundRect',
  'rect',
])

export function makeCtx() {
  const ops: Op[] = []
  let tf = [1, 0, 0, 1, 0, 0]
  const state: Record<string, unknown> = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  }
  const ctx = new Proxy(state, {
    get(t, p: string) {
      if (p === 'getTransform') return () => ({ a: tf[0], b: tf[1], c: tf[2], d: tf[3], e: tf[4], f: tf[5] })
      if (p === 'measureText') return (s: string) => ({ width: s.length * 8 })
      if (p === 'createPattern') return () => ({ setTransform: () => {} })
      if (p === 'createRadialGradient' || p === 'createLinearGradient') return () => ({ addColorStop: () => {} })
      if (p in t) return t[p]
      return (...args: unknown[]) => {
        if (p === 'setTransform') {
          const m = args[0] as { a: number; b: number; c: number; d: number; e: number; f: number }
          tf = args.length === 1 ? [m.a, m.b, m.c, m.d, m.e, m.f] : (args as number[]).slice()
        }
        if (DRAWS.has(p) || p === 'save' || p === 'restore' || p === 'translate' || p === 'clearRect') {
          ops.push({
            name: p,
            args,
            tf: tf.slice(),
            alpha: t.globalAlpha as number,
            comp: t.globalCompositeOperation as string,
            fill: t.fillStyle,
            smooth: t.imageSmoothingEnabled as boolean,
          })
        }
        return undefined
      }
    },
    set(t, p: string, v) {
      t[p] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, ops, state }
}

export interface FakeCanvas {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  ops: Op[]
  /** Offscreen canvases (tinted copies, particle sprites...) created through document.createElement. */
  offscreen: { width: number; height: number; ops: Op[] }[]
}

/** A main canvas plus a document.createElement('canvas') that returns recording offscreens. */
export function fakeCanvas(width: number, height: number, clientWidth = width, clientHeight = height): FakeCanvas {
  const main = makeCtx()
  const offscreen: FakeCanvas['offscreen'] = []
  const createElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') return createElement(tag)
    const o = makeCtx()
    const el = { width: 0, height: 0, getContext: () => o.ctx, ops: o.ops }
    offscreen.push(el)
    return el as unknown as HTMLCanvasElement
  })
  const canvas = {
    width,
    height,
    clientWidth,
    clientHeight,
    getContext: (type: string) => (type === '2d' ? main.ctx : null),
  } as unknown as HTMLCanvasElement
  return { canvas, ctx: main.ctx, ops: main.ops, offscreen }
}

/** A loaded-image stand-in (complete, with natural size). */
export function fakeImage(w: number, h: number, src = ''): HTMLImageElement {
  return { width: w, height: h, naturalWidth: w, naturalHeight: h, complete: true, src } as unknown as HTMLImageElement
}
