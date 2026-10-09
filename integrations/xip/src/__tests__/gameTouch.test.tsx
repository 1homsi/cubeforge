// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useContext } from 'react'
import { render, act } from '@testing-library/react'

vi.mock('@xip/renderer', async (orig) => {
  const actual = await orig<typeof import('@xip/renderer')>()
  class RenderSystem {
    update() {}
    setDefaultSampling() {}
    dispose() {}
  }
  return { ...actual, RenderSystem }
})

import { Game } from '../components/Game'
import { EngineContext, type EngineState } from '../context'

function touch(canvas: HTMLElement, type: 'touchstart' | 'touchmove' | 'touchend'): boolean {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(e, 'changedTouches', {
    value: Object.assign([{ identifier: 1, clientX: 5, clientY: 5 }], { item: () => null }),
  })
  canvas.dispatchEvent(e)
  return e.defaultPrevented
}

describe('<Game> touch default actions', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })
  afterEach(() => vi.unstubAllGlobals())

  it('cancels all touch events by default and follows touchPreventDefault / touchAction props', async () => {
    let engine: EngineState | null = null
    function Probe() {
      engine = useContext(EngineContext)
      return null
    }
    const tree = (props: Record<string, unknown>) => (
      <Game asyncAssets {...props}>
        <Probe />
      </Game>
    )
    let r!: ReturnType<typeof render>
    await act(async () => {
      r = render(tree({}))
    })
    const canvas = engine!.canvas
    expect([touch(canvas, 'touchstart'), touch(canvas, 'touchmove'), touch(canvas, 'touchend')]).toEqual([
      true,
      true,
      true,
    ])
    await act(async () => r.rerender(tree({ touchPreventDefault: 'move', touchAction: 'none' })))
    expect([touch(canvas, 'touchstart'), touch(canvas, 'touchmove'), touch(canvas, 'touchend')]).toEqual([
      false,
      true,
      false,
    ])
    expect(canvas.style.touchAction).toBe('none')
    await act(async () => r.rerender(tree({ touchPreventDefault: false })))
    expect([touch(canvas, 'touchstart'), touch(canvas, 'touchmove'), touch(canvas, 'touchend')]).toEqual([
      false,
      false,
      false,
    ])
  })
})
