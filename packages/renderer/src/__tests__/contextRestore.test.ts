import { afterEach, describe, expect, it, vi } from 'vitest'
import { ECSWorld } from '@cubeforge/core'
import { RenderSystem } from '../webglRenderSystem'

afterEach(() => vi.restoreAllMocks())

function setup() {
  const ctx2d = new Proxy({} as Record<string, unknown>, {
    get: (t, p: string) => (p in t ? t[p] : () => ({ addColorStop: () => {} })),
    set: (t, p: string, v) => ((t[p] = v), true),
  })
  const createElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = createElement(tag)
    if (tag === 'canvas') Object.defineProperty(el, 'getContext', { value: () => ctx2d })
    return el
  })
  const calls: string[] = []
  let lost = false
  const gl = new Proxy({} as Record<string, unknown>, {
    get(_t, p: string) {
      if (/^[A-Z_0-9]+$/.test(p)) return p
      if (p === 'isContextLost') return () => lost
      if (p.startsWith('get') || p.startsWith('create')) {
        return () => {
          calls.push(p)
          return {}
        }
      }
      return () => {
        calls.push(p)
        return true
      }
    },
  })
  const target = new EventTarget()
  const canvas = Object.assign(target, {
    width: 64,
    height: 64,
    clientWidth: 64,
    clientHeight: 64,
    getContext: () => gl,
  })
  const rs = new RenderSystem(canvas as unknown as HTMLCanvasElement, new Map())
  return { rs, canvas, calls, setLost: (v: boolean) => (lost = v) }
}

describe('GL context loss', () => {
  it('prevents default on loss so the browser restores, then rebuilds GL objects', () => {
    const { rs, canvas, calls, setLost } = setup()
    rs.registerDynamicCanvas('map', { width: 8, height: 8 } as unknown as HTMLCanvasElement)
    const lostEvent = new Event('webglcontextlost', { cancelable: true })
    setLost(true)
    canvas.dispatchEvent(lostEvent)
    expect(lostEvent.defaultPrevented).toBe(true)
    setLost(false)
    calls.length = 0
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(calls.filter((c) => c === 'createProgram').length).toBeGreaterThanOrEqual(2)
    expect(calls).toContain('texImage2D')
    rs.update(new ECSWorld(), 1 / 60)
  })

  it('dispose deletes GL resources and detaches listeners', () => {
    const { rs, canvas, calls } = setup()
    calls.length = 0
    rs.dispose()
    expect(calls).toContain('deleteProgram')
    expect(calls).toContain('deleteBuffer')
    const ev = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
  })
})
