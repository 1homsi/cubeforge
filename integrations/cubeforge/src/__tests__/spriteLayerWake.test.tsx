import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SpriteLayer } from '@cubeforge/renderer'
import { EngineContext, type EngineState } from '../context'
import { useSpriteLayer } from '../hooks/useSpriteLayer'

afterEach(cleanup)

describe('useSpriteLayer', () => {
  it('wakes an onDemand loop on touch() and layer mutations, and stops after unmount', () => {
    const markDirty = vi.fn()
    const engine = {
      loop: { markDirty },
      activeRenderSystem: { addSpriteLayer: vi.fn(), removeSpriteLayer: vi.fn() },
    } as unknown as EngineState
    let layer: SpriteLayer | undefined
    function People() {
      layer = useSpriteLayer({ zIndex: 5 })
      return null
    }
    const view = render(
      <EngineContext.Provider value={engine}>
        <People />
      </EngineContext.Provider>,
    )
    markDirty.mockClear()
    layer!.touch()
    expect(markDirty).toHaveBeenCalledTimes(1)
    layer!.add(0, 0, 4, 4)
    layer!.set(0, 5, 5)
    expect(markDirty).toHaveBeenCalledTimes(3)
    layer!.markAtlasDirty()
    expect(markDirty).toHaveBeenCalledTimes(4)
    view.unmount()
    layer!.touch()
    expect(markDirty).toHaveBeenCalledTimes(4)
  })
})
