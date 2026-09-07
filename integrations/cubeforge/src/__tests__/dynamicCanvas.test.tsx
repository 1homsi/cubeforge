import { useLayoutEffect } from 'react'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EngineContext, type EngineState } from '../context'
import { useDynamicCanvas, type DynamicCanvasHandle } from '../hooks/useDynamicCanvas'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useDynamicCanvas', () => {
  it('preserves the committed bitmap and registers it before consumer layout drawing on resize', () => {
    const order: string[] = []
    const drawImage = vi.fn(() => order.push('copy'))
    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = createElement(tag)
      if (tag === 'canvas') Object.defineProperty(element, 'getContext', { value: () => ({ drawImage }) })
      return element
    })
    const registerDynamicCanvas = vi.fn(() => order.push('register'))
    const unregisterDynamicCanvas = vi.fn()
    const markDynamicCanvasDirty = vi.fn(() => order.push('dirty'))
    const engine = {
      activeRenderSystem: { registerDynamicCanvas, unregisterDynamicCanvas, markDynamicCanvasDirty },
      loop: { markDirty: vi.fn() },
    } as unknown as EngineState
    let handle: DynamicCanvasHandle
    function Probe({ width }: { width: number }) {
      handle = useDynamicCanvas(width, 32)
      useLayoutEffect(() => {
        handle.markDirty()
      }, [width])
      return null
    }
    const view = (width: number) => (
      <EngineContext.Provider value={engine}>
        <Probe width={width} />
      </EngineContext.Provider>
    )
    const result = render(view(64))
    const original = handle!
    expect(order).toEqual(['register', 'dirty'])
    expect(engine.loop.markDirty).toHaveBeenCalledTimes(2)
    order.length = 0
    result.rerender(view(128))
    expect(handle!.id).toBe(original.id)
    expect(handle!.canvas).not.toBe(original.canvas)
    expect(drawImage).toHaveBeenCalledWith(original.canvas, 0, 0, 128, 32)
    expect(order).toEqual(['copy', 'register', 'dirty'])
    expect(engine.loop.markDirty).toHaveBeenCalledTimes(4)
    result.rerender(view(128))
    expect(registerDynamicCanvas).toHaveBeenCalledTimes(2)
    result.unmount()
    expect(unregisterDynamicCanvas).toHaveBeenCalledTimes(2)
  })
})
